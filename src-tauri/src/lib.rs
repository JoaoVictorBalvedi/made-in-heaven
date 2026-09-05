//! Casca desktop: janela, diálogos nativos e supervisão dos subprocessos.
//!
//! Regra de fronteira: handlers de comando validam entrada e delegam. Regra de
//! negócio não mora aqui nem em componente Svelte.

mod analysis;
mod error;
mod process;

use std::path::PathBuf;

use analysis::ChordAnalysis;
use error::AppError;

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

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![analyze_track])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar a janela do aplicativo");
}
