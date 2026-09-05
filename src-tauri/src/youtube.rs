//! Busca e importação de áudio do YouTube, através do `yt-dlp`.
//!
//! Duas operações com perfis bem diferentes: a busca só lê metadados e precisa
//! responder enquanto o usuário digita; a importação baixa um arquivo e pode
//! levar minutos. Ambas passam pela mesma supervisão de subprocesso.

use std::{
    path::{Path, PathBuf},
    time::Duration,
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::{
    error::AppError,
    library::{self, LibraryEntry},
    process::{run_bounded, Bounds},
};

/// A busca compete com a digitação do usuário: ou responde rápido, ou não serve.
const SEARCH_TIMEOUT: Duration = Duration::from_secs(12);
const SEARCH_RESULTS: usize = 10;
const MAX_SEARCH_STDOUT: usize = 512 * 1024;

/// Baixar é trabalho de minutos; o teto existe contra travamento, não pressa.
const IMPORT_TIMEOUT: Duration = Duration::from_secs(600);
const MAX_IMPORT_STDOUT: usize = 64 * 1024;

const MAX_STDERR: usize = 32 * 1024;
/// Consulta longa demais é erro de quem chamou, não pergunta legítima.
const MAX_QUERY_BYTES: usize = 180;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct YoutubeCandidate {
    pub id: String,
    pub title: String,
    pub channel: String,
    /// Ausente quando o YouTube não informa (transmissões ao vivo, por exemplo).
    pub duration_seconds: Option<f64>,
    pub thumbnail: Option<String>,
}

/// O subconjunto do JSON do yt-dlp que nos interessa. Campo faltando não é erro.
#[derive(Deserialize)]
struct RawCandidate {
    id: Option<String>,
    title: Option<String>,
    channel: Option<String>,
    uploader: Option<String>,
    duration: Option<f64>,
    thumbnails: Option<Vec<RawThumbnail>>,
}

#[derive(Deserialize)]
struct RawThumbnail {
    url: Option<String>,
}

/// Busca no YouTube, devolvendo apenas metadados — nada é baixado aqui.
pub fn search(query: &str) -> Result<Vec<YoutubeCandidate>, AppError> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }
    if trimmed.len() > MAX_QUERY_BYTES {
        return Err(AppError::SearchFailed("a busca é longa demais".into()));
    }

    let tool = find_tool("yt-dlp")?;
    let search_term = format!("ytsearch{SEARCH_RESULTS}:{trimmed}");
    let limit = SEARCH_RESULTS.to_string();
    let captured = run_bounded(
        &tool,
        &[
            // Ignora o config pessoal do usuário: o comportamento precisa ser o
            // mesmo em qualquer máquina.
            "--ignore-config",
            // Só metadados da lista, sem resolver cada vídeo. É o que faz a
            // busca custar um segundo em vez de dezenas.
            "--flat-playlist",
            "--dump-json",
            "--playlist-end",
            &limit,
            // Encerra as flags: uma busca começando com "-" não vira opção.
            "--",
            &search_term,
        ],
        &Bounds {
            stdout_bytes: MAX_SEARCH_STDOUT,
            stderr_bytes: MAX_STDERR,
            timeout: SEARCH_TIMEOUT,
        },
    )?;

    if !captured.success {
        return Err(AppError::SearchFailed(explain(&captured.stderr)));
    }

    // Uma linha JSON por resultado. Linha ilegível é descartada — um resultado
    // estranho não deve derrubar a busca inteira.
    let text = String::from_utf8_lossy(&captured.stdout);
    Ok(text.lines().filter_map(parse_candidate).collect())
}

fn parse_candidate(line: &str) -> Option<YoutubeCandidate> {
    let raw: RawCandidate = serde_json::from_str(line).ok()?;
    let id = raw.id?;
    Some(YoutubeCandidate {
        title: raw.title.unwrap_or_else(|| id.clone()),
        channel: raw.channel.or(raw.uploader).unwrap_or_default(),
        duration_seconds: raw.duration,
        thumbnail: raw
            .thumbnails
            .and_then(|list| list.into_iter().find_map(|thumbnail| thumbnail.url)),
        id,
    })
}

/// Traz um vídeo para o repertório. Se ele já estiver lá, nada é baixado.
pub fn import(app: &AppHandle, video_id: &str) -> Result<LibraryEntry, AppError> {
    if !is_video_id(video_id) {
        return Err(AppError::ImportFailed("identificador de vídeo inválido".into()));
    }
    // A rede só é tocada se o vídeo ainda não estiver guardado.
    if let Some(existing) = library::find_by_video(app, video_id) {
        return Ok(existing);
    }

    let tool = find_tool("yt-dlp")?;
    let ffmpeg = ffmpeg_directory()?;
    let ffmpeg = ffmpeg.to_string_lossy().into_owned();
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::ImportFailed(error.to_string()))?
        .join("downloads");
    std::fs::create_dir_all(&directory).map_err(|error| AppError::ImportFailed(error.to_string()))?;

    let template = directory.join("%(id)s.%(ext)s");
    let template = template.to_string_lossy().into_owned();
    let url = format!("https://www.youtube.com/watch?v={video_id}");

    let captured = run_bounded(
        &tool,
        &[
            "--ignore-config",
            "--ffmpeg-location",
            &ffmpeg,
            "--no-playlist",
            "--no-progress",
            "--extract-audio",
            "--audio-format",
            "mp3",
            "--audio-quality",
            "0",
            // A miniatura vira o rótulo do disco na tela. Salva como arquivo
            // ao lado do áudio para o repertório não depender da rede depois.
            "--write-thumbnail",
            "--convert-thumbnail",
            "jpg",
            "--output",
            &template,
            // O título vem primeiro; o caminho final, depois de mover o arquivo.
            // A ordem é o que permite ler os dois sem ambiguidade.
            "--print",
            "title",
            "--print",
            "after_move:filepath",
            "--",
            &url,
        ],
        &Bounds {
            stdout_bytes: MAX_IMPORT_STDOUT,
            stderr_bytes: MAX_STDERR,
            timeout: IMPORT_TIMEOUT,
        },
    )?;

    if !captured.success {
        return Err(AppError::ImportFailed(explain(&captured.stderr)));
    }

    let output = String::from_utf8_lossy(&captured.stdout);
    let (title, path) = split_title_and_path(&output);
    if path.is_empty() || !Path::new(&path).is_file() {
        return Err(AppError::ImportFailed(
            "o download terminou sem deixar um arquivo utilizável".into(),
        ));
    }
    // O yt-dlp grava a miniatura com o mesmo nome do áudio.
    let thumbnail = directory.join(format!("{video_id}.jpg"));
    let content_id = library::content_id(Path::new(&path))?;
    let cover = thumbnail
        .is_file()
        .then(|| library::adopt_cover(app, &thumbnail, &content_id))
        .flatten();

    library::adopt_file(
        app,
        Path::new(&path),
        &title,
        "youtube",
        Some(video_id.to_string()),
        true,
        cover,
    )
}

/// O caminho é sempre a última linha; o que vier antes é o título, que pode
/// conter quebra de linha sem estragar a leitura.
fn split_title_and_path(output: &str) -> (String, String) {
    let lines: Vec<&str> = output.lines().filter(|line| !line.trim().is_empty()).collect();
    let Some((path, title_lines)) = lines.split_last() else {
        return (String::new(), String::new());
    };
    (title_lines.join(" ").trim().to_string(), path.trim().to_string())
}

/// Busca só o título de um vídeo, sem baixar nada.
///
/// Serve para consertar entradas antigas do repertório, adotadas antes de o
/// título passar a ser guardado no momento do download.
pub fn fetch_title(video_id: &str) -> Result<String, AppError> {
    if !is_video_id(video_id) {
        return Err(AppError::ImportFailed("identificador de vídeo inválido".into()));
    }
    let tool = find_tool("yt-dlp")?;
    let url = format!("https://www.youtube.com/watch?v={video_id}");
    let captured = run_bounded(
        &tool,
        &["--ignore-config", "--skip-download", "--print", "title", "--", &url],
        &Bounds {
            stdout_bytes: MAX_IMPORT_STDOUT,
            stderr_bytes: MAX_STDERR,
            timeout: SEARCH_TIMEOUT,
        },
    )?;
    if !captured.success {
        return Err(AppError::ImportFailed(explain(&captured.stderr)));
    }
    let title = String::from_utf8_lossy(&captured.stdout).trim().to_string();
    if title.is_empty() {
        return Err(AppError::ImportFailed("o vídeo não informou um título".into()));
    }
    Ok(title)
}

/// Baixa só a miniatura de um vídeo, sem o áudio.
///
/// Serve para dar capa a entradas trazidas antes de a miniatura ser guardada.
pub fn fetch_thumbnail(app: &AppHandle, video_id: &str) -> Result<PathBuf, AppError> {
    if !is_video_id(video_id) {
        return Err(AppError::ImportFailed("identificador de vídeo inválido".into()));
    }
    let tool = find_tool("yt-dlp")?;
    let ffmpeg = ffmpeg_directory()?;
    let ffmpeg = ffmpeg.to_string_lossy().into_owned();
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::ImportFailed(error.to_string()))?
        .join("downloads");
    std::fs::create_dir_all(&directory).map_err(|error| AppError::ImportFailed(error.to_string()))?;

    let template = directory.join("%(id)s.%(ext)s");
    let template = template.to_string_lossy().into_owned();
    let url = format!("https://www.youtube.com/watch?v={video_id}");
    let captured = run_bounded(
        &tool,
        &[
            "--ignore-config",
            "--ffmpeg-location",
            &ffmpeg,
            "--skip-download",
            "--write-thumbnail",
            "--convert-thumbnail",
            "jpg",
            "--output",
            &template,
            "--",
            &url,
        ],
        &Bounds {
            stdout_bytes: MAX_IMPORT_STDOUT,
            stderr_bytes: MAX_STDERR,
            timeout: SEARCH_TIMEOUT,
        },
    )?;
    if !captured.success {
        return Err(AppError::ImportFailed(explain(&captured.stderr)));
    }
    let thumbnail = directory.join(format!("{video_id}.jpg"));
    if !thumbnail.is_file() {
        return Err(AppError::ImportFailed("o vídeo não trouxe miniatura".into()));
    }
    Ok(thumbnail)
}

/// Identificadores do YouTube têm 11 caracteres de um alfabeto restrito. Checar
/// aqui impede que texto arbitrário vire argumento de linha de comando.
fn is_video_id(candidate: &str) -> bool {
    candidate.len() == 11
        && candidate
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-' || character == '_')
}

/// O diretório onde moram `ffmpeg` e `ffprobe`.
///
/// O yt-dlp precisa dos dois para extrair áudio e converter a miniatura, e os
/// procura no PATH que herdou de nós. Dizer onde estão é o que faz a
/// importação funcionar num aplicativo aberto pelo Finder, cujo ambiente não
/// tem os diretórios que o shell do usuário configura.
fn ffmpeg_directory() -> Result<PathBuf, AppError> {
    let binary = find_tool("ffmpeg")?;
    binary
        .parent()
        .map(Path::to_path_buf)
        .ok_or_else(|| AppError::ToolMissing("ffmpeg".into()))
}

/// Localiza uma ferramenta externa.
///
/// O PATH não pode ser a única fonte: um aplicativo aberto pelo Finder herda um
/// ambiente mínimo, sem os diretórios que o shell do usuário configura.
fn find_tool(name: &str) -> Result<PathBuf, AppError> {
    const COMMON_DIRECTORIES: [&str; 4] =
        ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/opt/local/bin"];

    if let Some(found) = std::env::var_os("PATH")
        .map(|path| std::env::split_paths(&path).collect::<Vec<_>>())
        .unwrap_or_default()
        .into_iter()
        .map(|directory| directory.join(name))
        .find(|candidate| candidate.is_file())
    {
        return Ok(found);
    }
    COMMON_DIRECTORIES
        .iter()
        .map(|directory| Path::new(directory).join(name))
        .find(|candidate| candidate.is_file())
        .ok_or_else(|| AppError::ToolMissing(name.to_string()))
}

/// Traduz o diagnóstico do yt-dlp para uma frase com próximo passo.
fn explain(stderr: &str) -> String {
    let last = stderr.lines().last().unwrap_or_default().trim();
    let lowered = last.to_lowercase();
    if lowered.contains("sign in") || lowered.contains("bot") {
        return "o YouTube pediu verificação para este vídeo. Tente outro resultado.".into();
    }
    if lowered.contains("unavailable") || lowered.contains("private") {
        return "este vídeo não está disponível.".into();
    }
    if lowered.contains("update") || lowered.contains("nsig") || lowered.contains("player") {
        return "o yt-dlp precisa ser atualizado: `brew upgrade yt-dlp`.".into();
    }
    if last.is_empty() {
        "o yt-dlp terminou sem explicar o motivo.".into()
    } else {
        last.chars().take(240).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn aceita_identificador_valido() {
        assert!(is_video_id("dQw4w9WgXcQ"));
        assert!(is_video_id("a-b_c1234_5"));
    }

    #[test]
    fn rejeita_identificador_com_tamanho_errado() {
        assert!(!is_video_id(""));
        assert!(!is_video_id("curto"));
        assert!(!is_video_id("longodemais123"));
    }

    #[test]
    fn rejeita_tentativa_de_injetar_argumento() {
        // O identificador entra numa linha de comando: nada fora do alfabeto.
        assert!(!is_video_id("--exec=rm;x"));
        assert!(!is_video_id("../../../etc"));
        assert!(!is_video_id("abc def ghi;"));
    }

    #[test]
    fn parse_ignora_linha_ilegivel() {
        assert!(parse_candidate("isto não é json").is_none());
        assert!(parse_candidate(r#"{"title":"sem id"}"#).is_none());
    }

    #[test]
    fn parse_preenche_o_que_falta() {
        let candidate = parse_candidate(r#"{"id":"dQw4w9WgXcQ"}"#).expect("id basta");
        assert_eq!(candidate.title, "dQw4w9WgXcQ");
        assert_eq!(candidate.channel, "");
        assert_eq!(candidate.duration_seconds, None);
    }

    #[test]
    fn parse_usa_uploader_quando_nao_ha_canal() {
        let line = r#"{"id":"dQw4w9WgXcQ","title":"t","uploader":"alguém","duration":12.5}"#;
        let candidate = parse_candidate(line).expect("linha válida");
        assert_eq!(candidate.channel, "alguém");
        assert_eq!(candidate.duration_seconds, Some(12.5));
    }

    #[test]
    fn separa_titulo_e_caminho() {
        let (title, path) = split_title_and_path("Minha Música\n/tmp/abc.mp3\n");
        assert_eq!(title, "Minha Música");
        assert_eq!(path, "/tmp/abc.mp3");
    }

    #[test]
    fn titulo_com_quebra_de_linha_nao_engole_o_caminho() {
        // O caminho é a última linha; o resto, por mais linhas que tenha, é título.
        let (title, path) = split_title_and_path("Parte um\nParte dois\n/tmp/abc.mp3");
        assert_eq!(title, "Parte um Parte dois");
        assert_eq!(path, "/tmp/abc.mp3");
    }

    #[test]
    fn saida_vazia_nao_quebra() {
        assert_eq!(split_title_and_path(""), (String::new(), String::new()));
    }

    #[test]
    fn explica_falhas_conhecidas_com_proximo_passo() {
        assert!(explain("ERROR: Sign in to confirm you're not a bot").contains("verificação"));
        assert!(explain("ERROR: Video unavailable").contains("não está disponível"));
        assert!(explain("Please update yt-dlp").contains("brew upgrade"));
        assert!(explain("").contains("sem explicar"));
    }
}
