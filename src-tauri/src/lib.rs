//! Casca desktop: janela, diálogos nativos e supervisão dos subprocessos.
//!
//! Regra de fronteira: handlers de comando validam entrada e delegam. Regra de
//! negócio não mora aqui nem em componente Svelte.

mod analysis;
mod error;
mod library;
mod process;
mod youtube;

use std::path::PathBuf;

use analysis::ChordAnalysis;
use error::AppError;
use library::LibraryEntry;
use youtube::YoutubeCandidate;

/// Analisa os acordes de uma faixa. Reaproveita o resultado já guardado.
#[tauri::command]
async fn analyze_track(app: tauri::AppHandle, path: String) -> Result<ChordAnalysis, AppError> {
    let audio_path = PathBuf::from(path);
    if !audio_path.is_absolute() {
        return Err(AppError::AudioUnreadable(
            "o caminho da música precisa ser absoluto".into(),
        ));
    }
    // A inferência bloqueia por minutos; manter isso fora da thread da interface
    // é o que impede a janela de congelar durante a análise.
    tauri::async_runtime::spawn_blocking(move || analysis::analyze_track(&app, &audio_path))
        .await
        .map_err(|error| AppError::WorkerFailed(error.to_string()))?
}

/// Busca músicas no YouTube. Só metadados: nada é baixado aqui.
#[tauri::command]
async fn search_youtube(query: String) -> Result<Vec<YoutubeCandidate>, AppError> {
    tauri::async_runtime::spawn_blocking(move || youtube::search(&query))
        .await
        .map_err(|error| AppError::SearchFailed(error.to_string()))?
}

/// Baixa o áudio de um vídeo e devolve o caminho local do arquivo.
#[tauri::command]
async fn import_youtube(app: tauri::AppHandle, video_id: String) -> Result<LibraryEntry, AppError> {
    tauri::async_runtime::spawn_blocking(move || youtube::import(&app, &video_id))
        .await
        .map_err(|error| AppError::ImportFailed(error.to_string()))?
}

/// Todo o repertório guardado, do mais recente para o mais antigo.
#[tauri::command]
async fn library_list(app: tauri::AppHandle) -> Result<Vec<LibraryEntry>, AppError> {
    tauri::async_runtime::spawn_blocking(move || library::list(&app))
        .await
        .map_err(|error| AppError::Library(error.to_string()))?
}

/// Completa título e capa do que ficou faltando no repertório. Devolve a lista
/// atualizada. Sem nada a consertar, não toca na rede.
#[tauri::command]
async fn library_repair(app: tauri::AppHandle) -> Result<Vec<LibraryEntry>, AppError> {
    tauri::async_runtime::spawn_blocking(move || {
        if library::needs_repair(&app) {
            library::repair(&app)
        } else {
            library::list(&app)
        }
    })
    .await
    .map_err(|error| AppError::Library(error.to_string()))?
}

/// Copia um arquivo do disco para o repertório.
#[tauri::command]
async fn library_add_file(app: tauri::AppHandle, path: String) -> Result<LibraryEntry, AppError> {
    let source = PathBuf::from(path);
    if !source.is_absolute() {
        return Err(AppError::AudioUnreadable("o caminho precisa ser absoluto".into()));
    }
    tauri::async_runtime::spawn_blocking(move || {
        let title = source
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or("Sem título")
            .to_string();
        library::adopt_file(&app, &source, &title, "file", None, false, None)
    })
    .await
    .map_err(|error| AppError::Library(error.to_string()))?
}

/// Apaga uma música do repertório, junto da análise dela.
#[tauri::command]
async fn library_remove(app: tauri::AppHandle, id: String) -> Result<(), AppError> {
    tauri::async_runtime::spawn_blocking(move || library::remove(&app, &id))
        .await
        .map_err(|error| AppError::Library(error.to_string()))?
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            analyze_track,
            search_youtube,
            import_youtube,
            library_list,
            library_repair,
            library_add_file,
            library_remove
        ])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar a janela do aplicativo");
}
