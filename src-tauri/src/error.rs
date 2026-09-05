//! Erros que atravessam a fronteira IPC.
//!
//! Cada variante carrega uma mensagem que a interface pode exibir como está, em
//! português e dizendo o que fazer a seguir. Detalhe técnico bruto do
//! subprocesso fica no log, não na tela.

use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("não encontrei o programa de análise em {0}. Rode `uv sync` dentro de tools/chord-worker.")]
    WorkerMissing(String),

    #[error("a análise demorou mais que o limite de {0} segundos e foi interrompida")]
    Timeout(u64),

    #[error("a análise falhou: {0}")]
    WorkerFailed(String),

    #[error("a análise devolveu um resultado que não pude interpretar: {0}")]
    MalformedOutput(String),

    #[error("não consegui ler o arquivo de áudio: {0}")]
    AudioUnreadable(String),

    #[error("falha ao usar o cache de análises: {0}")]
    Cache(String),

    #[error("não encontrei o {0}. Instale com `brew install {0}` e abra o aplicativo de novo.")]
    ToolMissing(String),

    #[error("a busca no YouTube falhou: {0}")]
    SearchFailed(String),

    #[error("não consegui importar deste endereço: {0}")]
    ImportFailed(String),
}

/// A interface recebe a mensagem já pronta, não a estrutura do erro.
impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}
