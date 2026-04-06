#[derive(Debug, thiserror::Error)]
pub enum WorkerError {
    #[error("{0}")]
    MongoDB(#[from] mongodb::error::Error),
    #[error("{0}")]
    Reqwest(#[from] reqwest::Error),
    #[error("{0}")]
    Message(String),
}
