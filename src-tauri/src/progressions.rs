//! Progressões salvas pelo usuário.
//!
//! Mesma disciplina do repertório: escrita atômica, e arquivo ilegível vira
//! lista vazia em vez de erro — perder o acesso a tudo por causa de um byte
//! errado seria pior do que começar de novo.

use std::{
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::error::AppError;

/// Um nome absurdamente longo não ajuda ninguém e engorda o arquivo.
const MAX_NAME_CHARS: usize = 80;
/// Teto de acordes por progressão, para uma chamada malformada não crescer sem fim.
const MAX_CHORDS: usize = 256;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedProgression {
    pub id: String,
    pub name: String,
    pub chords: Vec<String>,
    pub saved_at: u64,
}

fn file_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::Library(error.to_string()))?;
    std::fs::create_dir_all(&directory).map_err(|error| AppError::Library(error.to_string()))?;
    Ok(directory.join("progressions.json"))
}

fn read_all(app: &AppHandle) -> Vec<SavedProgression> {
    let Ok(path) = file_path(app) else { return Vec::new() };
    let Ok(raw) = std::fs::read(path) else { return Vec::new() };
    serde_json::from_slice(&raw).unwrap_or_default()
}

fn write_all(app: &AppHandle, items: &[SavedProgression]) -> Result<(), AppError> {
    let path = file_path(app)?;
    let temporary = path.with_extension("json.tmp");
    let serialized =
        serde_json::to_vec_pretty(items).map_err(|error| AppError::Library(error.to_string()))?;
    std::fs::write(&temporary, serialized).map_err(|error| AppError::Library(error.to_string()))?;
    std::fs::rename(&temporary, &path).map_err(|error| AppError::Library(error.to_string()))
}

/** Todas as progressões salvas, da mais recente para a mais antiga. */
pub fn list(app: &AppHandle) -> Vec<SavedProgression> {
    let mut items = read_all(app);
    items.sort_by(|left, right| right.saved_at.cmp(&left.saved_at));
    items
}

/// Salva uma progressão. Um nome já usado é sobrescrito, em vez de duplicar.
pub fn save(app: &AppHandle, name: &str, chords: Vec<String>) -> Result<SavedProgression, AppError> {
    let trimmed: String = name.trim().chars().take(MAX_NAME_CHARS).collect();
    if trimmed.is_empty() {
        return Err(AppError::Library("a progressão precisa de um nome".into()));
    }
    if chords.is_empty() {
        return Err(AppError::Library("não há acordes para salvar".into()));
    }
    if chords.len() > MAX_CHORDS {
        return Err(AppError::Library("progressão longa demais".into()));
    }

    let mut items = read_all(app);
    // Comparação sem caixa: "Blues" e "blues" são a mesma ideia para quem salva.
    let existing = items
        .iter()
        .position(|item| item.name.to_lowercase() == trimmed.to_lowercase());

    let entry = SavedProgression {
        id: match existing {
            Some(index) => items[index].id.clone(),
            None => format!("{:x}", now_seconds()),
        },
        name: trimmed,
        chords,
        saved_at: now_seconds(),
    };

    match existing {
        Some(index) => items[index] = entry.clone(),
        None => items.push(entry.clone()),
    }
    write_all(app, &items)?;
    Ok(entry)
}

pub fn remove(app: &AppHandle, id: &str) -> Result<(), AppError> {
    let mut items = read_all(app);
    items.retain(|item| item.id != id);
    write_all(app, &items)
}

fn now_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or_default()
}
