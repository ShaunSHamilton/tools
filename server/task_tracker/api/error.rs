use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

use crate::task_tracker::shared::error::AppError;

/// Newtype wrapper so we can implement axum's `IntoResponse` for `AppError`
/// without violating orphan rules (both the trait and the wrapped type are
/// defined outside this crate).
pub struct ApiError(pub AppError);

impl From<AppError> for ApiError {
    fn from(e: AppError) -> Self {
        ApiError(e)
    }
}

impl From<mongodb::error::Error> for ApiError {
    fn from(e: mongodb::error::Error) -> Self {
        ApiError(AppError::Database(e.to_string()))
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(e: anyhow::Error) -> Self {
        ApiError(AppError::Internal(e))
    }
}


impl From<reqwest::Error> for ApiError {
    fn from(e: reqwest::Error) -> Self {
        tracing::error!(error = %e, "http client error");
        ApiError(AppError::Internal(anyhow::anyhow!("upstream request failed")))
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message) = match &self.0 {
            AppError::NotFound => (StatusCode::NOT_FOUND, self.0.to_string()),
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, self.0.to_string()),
            AppError::Forbidden => (StatusCode::FORBIDDEN, self.0.to_string()),
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, msg.clone()),
            AppError::Database(e) => {
                tracing::error!(error = %e, "database error");
                (StatusCode::INTERNAL_SERVER_ERROR, "internal server error".into())
            }
            AppError::Internal(e) => {
                tracing::error!(error = %e, "internal error");
                (StatusCode::INTERNAL_SERVER_ERROR, "internal server error".into())
            }
        };

        (status, Json(json!({ "error": message }))).into_response()
    }
}
