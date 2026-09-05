//! Execução supervisionada de subprocessos, com tetos explícitos.
//!
//! Todo processo externo que o aplicativo dispara — análise de acordes hoje,
//! importação do YouTube adiante — passa por aqui. Um subprocesso que trava,
//! cospe saída sem fim ou morre pela metade não pode derrubar o aplicativo, e a
//! única forma de garantir isso é impor limite de tempo e de bytes desde fora.

use std::{
    io::Read,
    path::Path,
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};

use crate::error::AppError;

/// Intervalo entre verificações de término. Curto o bastante para o
/// cancelamento parecer imediato, longo o bastante para não girar em vão.
const POLL_INTERVAL: Duration = Duration::from_millis(50);

pub struct Bounds {
    /// Teto para a saída útil. Ultrapassar é erro, não truncamento silencioso.
    pub stdout_bytes: usize,
    /// Teto para o diagnóstico. Este pode ser truncado sem prejuízo.
    pub stderr_bytes: usize,
    pub timeout: Duration,
}

pub struct Captured {
    pub stdout: Vec<u8>,
    pub stderr: String,
    pub success: bool,
}

/// Roda um programa até o fim, o teto de tempo ou o teto de bytes.
pub fn run_bounded(program: &Path, args: &[&str], bounds: &Bounds) -> Result<Captured, AppError> {
    if !program.is_file() {
        return Err(AppError::WorkerMissing(program.display().to_string()));
    }

    let mut child = Command::new(program)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| AppError::WorkerFailed(format!("não consegui iniciar: {error}")))?;

    // Os canos precisam ser drenados enquanto o processo vive: um cano cheio
    // bloqueia o filho, e ele nunca terminaria sozinho.
    let stdout_pipe = child.stdout.take().expect("stdout foi pedido como pipe");
    let stderr_pipe = child.stderr.take().expect("stderr foi pedido como pipe");
    let stdout_cap = bounds.stdout_bytes;
    let stderr_cap = bounds.stderr_bytes;
    let stdout_reader = thread::spawn(move || read_capped(stdout_pipe, stdout_cap));
    let stderr_reader = thread::spawn(move || read_capped(stderr_pipe, stderr_cap));

    let started = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {}
            Err(error) => {
                let _ = child.kill();
                return Err(AppError::WorkerFailed(format!("supervisão falhou: {error}")));
            }
        }
        if started.elapsed() >= bounds.timeout {
            let _ = child.kill();
            let _ = child.wait();
            return Err(AppError::Timeout(bounds.timeout.as_secs()));
        }
        thread::sleep(POLL_INTERVAL);
    };

    let stdout = stdout_reader.join().unwrap_or_else(|_| Err(overflow("stdout")))?;
    let stderr = stderr_reader.join().unwrap_or_else(|_| Err(overflow("stderr")))?;

    Ok(Captured {
        stdout,
        stderr: String::from_utf8_lossy(&stderr).trim().to_string(),
        success: status.success(),
    })
}

/// Lê o cano inteiro, falhando se passar do teto em vez de truncar em silêncio.
fn read_capped(mut source: impl Read, cap: usize) -> Result<Vec<u8>, AppError> {
    let mut buffer = Vec::new();
    // Um byte além do teto basta para distinguir "no limite" de "estourou".
    source
        .by_ref()
        .take((cap + 1) as u64)
        .read_to_end(&mut buffer)
        .map_err(|error| AppError::WorkerFailed(format!("leitura falhou: {error}")))?;
    if buffer.len() > cap {
        return Err(overflow("saída"));
    }
    Ok(buffer)
}

fn overflow(what: &str) -> AppError {
    AppError::WorkerFailed(format!("{what} passou do tamanho máximo permitido"))
}
