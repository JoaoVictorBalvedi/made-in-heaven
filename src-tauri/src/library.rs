//! O repertório: o que entrou no aplicativo fica guardado e volta sem reimportar.
//!
//! A identidade de uma música é o SHA-256 do conteúdo do áudio — a mesma chave
//! que indexa a análise de acordes. Com isso, arquivo, análise e entrada no
//! índice vivem sob a mesma chave: importar duas vezes não duplica, uma música
//! que volta já chega analisada, e apagar é apagar tudo que leva aquela chave.

use std::{
    io::Read,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryEntry {
    /// SHA-256 do conteúdo. A mesma chave usada pelo cache de análise.
    pub id: String,
    pub title: String,
    /// `file` ou `youtube`, para a interface poder dizer de onde veio.
    pub source: String,
    /// Presente quando veio do YouTube. É a chave que evita rebaixar.
    pub video_id: Option<String>,
    /// Caminho absoluto do arquivo dentro da pasta de dados.
    pub path: String,
    /// Capa do álbum, quando encontrada. Vira o rótulo do disco na tela.
    ///
    /// Tem padrão porque índices gravados antes deste campo existir precisam
    /// continuar legíveis: sem isso, o repertório inteiro sumiria da tela.
    #[serde(default)]
    pub cover_path: Option<String>,
    /// Segundos desde a época, formatado pela interface.
    pub added_at: u64,
}

fn library_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::Library(error.to_string()))?
        .join("library");
    std::fs::create_dir_all(directory.join("audio"))
        .map_err(|error| AppError::Library(error.to_string()))?;
    Ok(directory)
}

fn index_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    Ok(library_dir(app)?.join("index.json"))
}

/// Extrai a capa embutida no arquivo e a guarda ao lado do áudio.
///
/// A maioria dos MP3 carrega a arte na tag; quando não carrega, o disco na tela
/// fica sem rótulo, o que é uma ausência aceitável e não um erro.
fn extract_embedded_cover(app: &AppHandle, audio_path: &Path, id: &str) -> Option<String> {
    use lofty::file::TaggedFileExt;
    use lofty::probe::Probe;

    let tagged = Probe::open(audio_path).ok()?.read().ok()?;
    let tag = tagged.primary_tag().or_else(|| tagged.first_tag())?;
    let picture = tag.pictures().first()?;
    let extension = match picture.mime_type()?.as_str() {
        "image/png" => "png",
        _ => "jpg",
    };
    let destination = library_dir(app).ok()?.join("covers").join(format!("{id}.{extension}"));
    std::fs::create_dir_all(destination.parent()?).ok()?;
    std::fs::write(&destination, picture.data()).ok()?;
    Some(destination.to_string_lossy().into_owned())
}

/// Guarda uma imagem de capa já baixada, movendo-a para junto do repertório.
pub fn adopt_cover(app: &AppHandle, source: &Path, id: &str) -> Option<String> {
    let extension = source.extension().and_then(|value| value.to_str()).unwrap_or("jpg");
    let destination = library_dir(app).ok()?.join("covers").join(format!("{id}.{extension}"));
    std::fs::create_dir_all(destination.parent()?).ok()?;
    if std::fs::rename(source, &destination).is_err() {
        std::fs::copy(source, &destination).ok()?;
        let _ = std::fs::remove_file(source);
    }
    Some(destination.to_string_lossy().into_owned())
}

/// Índice ilegível vira biblioteca vazia em vez de erro: os arquivos de áudio
/// continuam no disco e podem ser readotados, então travar aqui só atrapalha.
fn read_index(app: &AppHandle) -> Vec<LibraryEntry> {
    let Ok(path) = index_path(app) else { return Vec::new() };
    let Ok(raw) = std::fs::read(path) else { return Vec::new() };
    serde_json::from_slice(&raw).unwrap_or_default()
}

/// Escrita atômica: uma interrupção no meio não deixa índice pela metade.
fn write_index(app: &AppHandle, entries: &[LibraryEntry]) -> Result<(), AppError> {
    let path = index_path(app)?;
    let temporary = path.with_extension("json.tmp");
    let serialized =
        serde_json::to_vec_pretty(entries).map_err(|error| AppError::Library(error.to_string()))?;
    std::fs::write(&temporary, serialized).map_err(|error| AppError::Library(error.to_string()))?;
    std::fs::rename(&temporary, &path).map_err(|error| AppError::Library(error.to_string()))
}

/// SHA-256 do conteúdo de um arquivo.
pub fn content_id(path: &Path) -> Result<String, AppError> {
    let mut file =
        std::fs::File::open(path).map_err(|error| AppError::AudioUnreadable(error.to_string()))?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0_u8; 1024 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| AppError::AudioUnreadable(error.to_string()))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

/// Todo o repertório, do mais recente para o mais antigo.
pub fn list(app: &AppHandle) -> Result<Vec<LibraryEntry>, AppError> {
    adopt_loose_downloads(app);
    let mut entries = read_index(app);
    // Some do índice o que não existe mais em disco: apagar por fora não deve
    // deixar uma entrada fantasma que falha ao ser aberta.
    let before = entries.len();
    entries.retain(|entry| Path::new(&entry.path).is_file());
    if entries.len() != before {
        let _ = write_index(app, &entries);
    }
    entries.sort_by(|left, right| right.added_at.cmp(&left.added_at));
    Ok(entries)
}

pub fn find_by_video(app: &AppHandle, video_id: &str) -> Option<LibraryEntry> {
    read_index(app)
        .into_iter()
        .find(|entry| entry.video_id.as_deref() == Some(video_id))
        .filter(|entry| Path::new(&entry.path).is_file())
}

/// Copia um arquivo para o repertório. Já estando lá, devolve o que existe.
pub fn adopt_file(
    app: &AppHandle,
    source_path: &Path,
    title: &str,
    source: &str,
    video_id: Option<String>,
    move_instead_of_copy: bool,
    cover_path: Option<String>,
) -> Result<LibraryEntry, AppError> {
    let id = content_id(source_path)?;
    let mut entries = read_index(app);
    if let Some(existing) = entries.iter().find(|entry| entry.id == id) {
        if Path::new(&existing.path).is_file() {
            return Ok(existing.clone());
        }
    }

    let extension = source_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("mp3");
    let destination = library_dir(app)?.join("audio").join(format!("{id}.{extension}"));
    if destination != source_path {
        if move_instead_of_copy {
            // Renomear falha entre volumes diferentes; copiar e apagar sempre funciona.
            if std::fs::rename(source_path, &destination).is_err() {
                std::fs::copy(source_path, &destination)
                    .map_err(|error| AppError::Library(error.to_string()))?;
                let _ = std::fs::remove_file(source_path);
            }
        } else {
            std::fs::copy(source_path, &destination)
                .map_err(|error| AppError::Library(error.to_string()))?;
        }
    }

    // A capa vinda de fora tem prioridade; sem ela, tenta a arte embutida.
    let cover = cover_path.or_else(|| extract_embedded_cover(app, &destination, &id));

    let entry = LibraryEntry {
        id: id.clone(),
        title: title.to_string(),
        source: source.to_string(),
        video_id,
        path: destination.to_string_lossy().into_owned(),
        cover_path: cover,
        added_at: now_seconds(),
    };
    entries.retain(|existing| existing.id != id);
    entries.push(entry.clone());
    write_index(app, &entries)?;
    Ok(entry)
}

/// Uma entrada ainda nomeada pelo identificador do vídeo, e não pelo título.
///
/// Acontece com o que foi adotado de downloads antigos, feitos antes de o
/// título ser guardado. Comparar título com identificador é o suficiente:
/// nenhum título real é igual ao próprio id.
fn needs_title(entry: &LibraryEntry) -> bool {
    entry.video_id.as_deref() == Some(entry.title.as_str())
}

/// Uma entrada sem capa guardada.
fn needs_cover(entry: &LibraryEntry) -> bool {
    match &entry.cover_path {
        None => true,
        Some(path) => !Path::new(path).is_file(),
    }
}

/// Completa título e capa do que ficou faltando.
///
/// Falha de rede não é erro: a entrada continua utilizável sem capa e com o
/// identificador no lugar do título, e a próxima abertura tenta de novo.
pub fn repair(app: &AppHandle) -> Result<Vec<LibraryEntry>, AppError> {
    let mut entries = read_index(app);
    let mut changed = false;

    for entry in entries.iter_mut() {
        if needs_title(entry) {
            if let Some(video_id) = entry.video_id.clone() {
                if let Ok(title) = crate::youtube::fetch_title(&video_id) {
                    entry.title = title;
                    changed = true;
                }
            }
        }
        if needs_cover(entry) {
            // A arte embutida no arquivo não custa rede, então vem primeiro.
            let found = extract_embedded_cover(app, Path::new(&entry.path), &entry.id).or_else(
                || {
                    let video_id = entry.video_id.as_deref()?;
                    let downloaded = crate::youtube::fetch_thumbnail(app, video_id).ok()?;
                    adopt_cover(app, &downloaded, &entry.id)
                },
            );
            if found.is_some() {
                entry.cover_path = found;
                changed = true;
            }
        }
    }

    if changed {
        write_index(app, &entries)?;
    }
    entries.sort_by(|left, right| right.added_at.cmp(&left.added_at));
    Ok(entries)
}

/// Há entrada esperando título ou capa? A interface usa isto para só ir à rede
/// quando há de fato o que consertar.
pub fn needs_repair(app: &AppHandle) -> bool {
    read_index(app)
        .iter()
        .any(|entry| needs_title(entry) || needs_cover(entry))
}

/// Apaga a música, a análise dela e a entrada no índice.
pub fn remove(app: &AppHandle, id: &str) -> Result<(), AppError> {
    let mut entries = read_index(app);
    if let Some(entry) = entries.iter().find(|entry| entry.id == id) {
        let _ = std::fs::remove_file(&entry.path);
        if let Some(cover) = &entry.cover_path {
            let _ = std::fs::remove_file(cover);
        }
    }
    if let Ok(cache) = crate::analysis::cache_file(app, id) {
        let _ = std::fs::remove_file(cache);
    }
    entries.retain(|entry| entry.id != id);
    write_index(app, &entries)
}

/// Migração única: downloads feitos antes da biblioteca existir entram nela em
/// vez de ficarem órfãos numa pasta que ninguém mais lê.
fn adopt_loose_downloads(app: &AppHandle) {
    let Ok(base) = app.path().app_data_dir() else { return };
    let legacy = base.join("imports");
    let Ok(directory) = std::fs::read_dir(&legacy) else { return };

    for item in directory.flatten() {
        let path = item.path();
        if !path.is_file() {
            continue;
        }
        // O nome do arquivo era o identificador do vídeo.
        let video_id = path.file_stem().and_then(|stem| stem.to_str()).map(String::from);
        let title = video_id.clone().unwrap_or_else(|| "Importado".into());
        let _ = adopt_file(app, &path, &title, "youtube", video_id, true, None);
    }
    let _ = std::fs::remove_dir(&legacy);
}

fn now_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or_default()
}
