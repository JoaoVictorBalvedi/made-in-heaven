//! Ponte para o worker de acordes: invoca, valida e guarda em cache.
//!
//! Regra de fronteira: o modelo é a única autoridade sobre qual acorde soa. Este
//! módulo confere se a saída é bem formada e a rejeita quando não é — nunca
//! reescreve, suaviza ou corrige um rótulo.

use std::{
    path::{Path, PathBuf},
    time::Duration,
};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::{
    error::AppError,
    process::{run_bounded, Bounds},
};

/// Análise é trabalho de minutos no pior caso; o teto existe para o aplicativo
/// não ficar preso para sempre num worker travado, não para apressá-lo.
const ANALYSIS_TIMEOUT: Duration = Duration::from_secs(600);
const MAX_STDOUT_BYTES: usize = 8 * 1024 * 1024;
const MAX_STDERR_BYTES: usize = 64 * 1024;

/// Um acorde a cada 100 ms numa música de duas horas ainda cabe folgado.
const MAX_CHORDS: usize = 100_000;
const MAX_LABEL_CHARS: usize = 32;

/// Tolerância para comparar fronteiras que passaram por arredondamento.
const EPSILON_SECONDS: f64 = 0.05;

/// Bump manual sempre que o worker mudar de modelo ou de formato de saída:
/// é o que invalida análises antigas guardadas em disco.
const CACHE_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TimedChord {
    pub label: String,
    pub source_label: String,
    pub start_seconds: f64,
    pub end_seconds: f64,
    pub strength: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChordAnalysis {
    pub model_version: String,
    pub dictionary: String,
    pub duration_seconds: f64,
    pub chords: Vec<TimedChord>,
    pub warnings: Vec<String>,
}

#[derive(Serialize, Deserialize)]
struct CacheEntry {
    version: u32,
    analysis: ChordAnalysis,
}

/// Analisa uma faixa, reaproveitando o resultado guardado quando existir.
pub fn analyze_track(app: &AppHandle, audio_path: &Path) -> Result<ChordAnalysis, AppError> {
    let identity = crate::library::content_id(audio_path)?;
    if let Some(cached) = read_cache(app, &identity) {
        return Ok(cached);
    }
    let analysis = run_worker(app, audio_path)?;
    write_cache(app, &identity, &analysis);
    Ok(analysis)
}

fn run_worker(app: &AppHandle, audio_path: &Path) -> Result<ChordAnalysis, AppError> {
    let worker = worker_path(app);
    let audio = audio_path.to_string_lossy().into_owned();
    let bounds = Bounds {
        stdout_bytes: MAX_STDOUT_BYTES,
        stderr_bytes: MAX_STDERR_BYTES,
        timeout: ANALYSIS_TIMEOUT,
    };

    let captured = run_bounded(&worker, &[audio.as_str()], &bounds)?;
    if !captured.success {
        let diagnostic = if captured.stderr.is_empty() {
            "o programa de análise terminou sem explicar o motivo".to_string()
        } else {
            captured.stderr.lines().last().unwrap_or_default().to_string()
        };
        return Err(AppError::WorkerFailed(diagnostic));
    }

    let analysis: ChordAnalysis = serde_json::from_slice(&captured.stdout)
        .map_err(|error| AppError::MalformedOutput(error.to_string()))?;
    validate(&analysis)?;
    Ok(analysis)
}

/// Rejeita saída incoerente antes que ela vire uma interface quebrada.
fn validate(analysis: &ChordAnalysis) -> Result<(), AppError> {
    let duration = analysis.duration_seconds;
    if !duration.is_finite() || duration <= 0.0 {
        return Err(AppError::MalformedOutput("duração inválida".into()));
    }
    if analysis.chords.len() > MAX_CHORDS {
        return Err(AppError::MalformedOutput("acordes demais".into()));
    }

    let mut previous_end = 0.0_f64;
    for (index, chord) in analysis.chords.iter().enumerate() {
        let at = || format!("acorde {index}");
        if chord.label.is_empty() || chord.label.chars().count() > MAX_LABEL_CHARS {
            return Err(AppError::MalformedOutput(format!("{}: rótulo inválido", at())));
        }
        if !chord.start_seconds.is_finite() || !chord.end_seconds.is_finite() {
            return Err(AppError::MalformedOutput(format!("{}: tempo não finito", at())));
        }
        if chord.start_seconds < 0.0 || chord.end_seconds <= chord.start_seconds {
            return Err(AppError::MalformedOutput(format!("{}: intervalo vazio ou negativo", at())));
        }
        if chord.start_seconds + EPSILON_SECONDS < previous_end {
            return Err(AppError::MalformedOutput(format!("{}: sobrepõe o anterior", at())));
        }
        if chord.end_seconds > duration + EPSILON_SECONDS {
            return Err(AppError::MalformedOutput(format!("{}: passa do fim da música", at())));
        }
        if !chord.strength.is_finite() || !(0.0..=1.0).contains(&chord.strength) {
            return Err(AppError::MalformedOutput(format!("{}: confiança fora de 0–1", at())));
        }
        previous_end = chord.end_seconds;
    }
    Ok(())
}

/// Onde procurar o programa de análise, em ordem de prioridade.
///
/// O lançador empacotado é um script com shebang absoluto para o Python do
/// ambiente virtual, que fica no repositório: o aplicativo depende de ele
/// continuar existindo ali. É a escolha consciente de um aplicativo pessoal —
/// embutir torch e os pesos do modelo custaria quase um gigabyte.
fn worker_path(app: &AppHandle) -> PathBuf {
    if let Ok(override_path) = std::env::var("MUSICA_CHORD_WORKER") {
        return PathBuf::from(override_path);
    }

    if let Ok(resource) = app.path().resource_dir().map(|dir| dir.join("chord-worker")) {
        if resource.is_file() {
            return resource;
        }
    }

    #[cfg(debug_assertions)]
    {
        let development = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../tools/chord-worker/.venv/bin/chord-worker");
        if development.is_file() {
            return development;
        }
    }

    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|dir| dir.join("chord-worker")))
        .unwrap_or_else(|| PathBuf::from("chord-worker"))
}

/// Onde mora a análise de uma música. O repertório precisa disto para apagar
/// tudo que leva a mesma chave.
pub fn cache_file(app: &AppHandle, identity: &str) -> Result<PathBuf, AppError> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| AppError::Cache(error.to_string()))?
        .join("analysis/chords");
    std::fs::create_dir_all(&directory).map_err(|error| AppError::Cache(error.to_string()))?;
    Ok(directory.join(format!("{identity}.json")))
}

/// Cache ilegível ou de versão antiga é simplesmente ignorado: reanalisar é
/// sempre seguro, então uma falha aqui nunca vira erro para o usuário.
fn read_cache(app: &AppHandle, identity: &str) -> Option<ChordAnalysis> {
    let path = cache_file(app, identity).ok()?;
    let raw = std::fs::read(path).ok()?;
    let entry: CacheEntry = serde_json::from_slice(&raw).ok()?;
    (entry.version == CACHE_VERSION).then_some(entry.analysis)
}

fn write_cache(app: &AppHandle, identity: &str, analysis: &ChordAnalysis) {
    let entry = CacheEntry { version: CACHE_VERSION, analysis: analysis.clone() };
    let Ok(path) = cache_file(app, identity) else { return };
    let Ok(serialized) = serde_json::to_vec(&entry) else { return };
    if let Err(error) = std::fs::write(&path, serialized) {
        tracing_write_failure(&path, &error);
    }
}

fn tracing_write_failure(path: &Path, error: &std::io::Error) {
    eprintln!("não consegui gravar o cache em {}: {error}", path.display());
}

#[cfg(test)]
mod tests {
    use super::*;

    fn chord(start: f64, end: f64) -> TimedChord {
        TimedChord {
            label: "Am".into(),
            source_label: "A:min".into(),
            start_seconds: start,
            end_seconds: end,
            strength: 0.9,
        }
    }

    fn analysis(chords: Vec<TimedChord>) -> ChordAnalysis {
        ChordAnalysis {
            model_version: "teste".into(),
            dictionary: "submission".into(),
            duration_seconds: 100.0,
            chords,
            warnings: vec![],
        }
    }

    #[test]
    fn aceita_sequencia_bem_formada() {
        let subject = analysis(vec![chord(0.0, 2.0), chord(2.0, 5.0), chord(5.0, 100.0)]);
        assert!(validate(&subject).is_ok());
    }

    #[test]
    fn aceita_analise_sem_nenhum_acorde() {
        // Silêncio ou fala: o modelo não devolver acorde algum é resposta válida.
        assert!(validate(&analysis(vec![])).is_ok());
    }

    #[test]
    fn rejeita_sobreposicao_alem_do_arredondamento() {
        let subject = analysis(vec![chord(0.0, 5.0), chord(2.0, 8.0)]);
        assert!(validate(&subject).is_err());
    }

    #[test]
    fn tolera_sobreposicao_de_arredondamento() {
        // O worker apara fronteiras em milissegundos; isso não é incoerência.
        let subject = analysis(vec![chord(0.0, 2.0), chord(1.999, 4.0)]);
        assert!(validate(&subject).is_ok());
    }

    #[test]
    fn rejeita_intervalo_invertido_ou_vazio() {
        assert!(validate(&analysis(vec![chord(5.0, 5.0)])).is_err());
        assert!(validate(&analysis(vec![chord(5.0, 2.0)])).is_err());
    }

    #[test]
    fn rejeita_acorde_depois_do_fim_da_musica() {
        assert!(validate(&analysis(vec![chord(0.0, 500.0)])).is_err());
    }

    #[test]
    fn rejeita_tempo_nao_finito() {
        assert!(validate(&analysis(vec![chord(0.0, f64::NAN)])).is_err());
        assert!(validate(&analysis(vec![chord(0.0, f64::INFINITY)])).is_err());
    }

    #[test]
    fn rejeita_confianca_fora_da_faixa() {
        let mut subject = analysis(vec![chord(0.0, 2.0)]);
        subject.chords[0].strength = 1.5;
        assert!(validate(&subject).is_err());
    }

    #[test]
    fn rejeita_rotulo_vazio_ou_gigante() {
        let mut subject = analysis(vec![chord(0.0, 2.0)]);
        subject.chords[0].label = String::new();
        assert!(validate(&subject).is_err());

        let mut subject = analysis(vec![chord(0.0, 2.0)]);
        subject.chords[0].label = "A".repeat(MAX_LABEL_CHARS + 1);
        assert!(validate(&subject).is_err());
    }

    #[test]
    fn rejeita_duracao_invalida() {
        let mut subject = analysis(vec![]);
        subject.duration_seconds = 0.0;
        assert!(validate(&subject).is_err());
    }
}
