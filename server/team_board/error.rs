use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;

pub enum ApiError {
    BadRequest(&'static str),
    Unauthorized(&'static str),
    NotFound(&'static str),
    Internal,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            ApiError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            ApiError::Unauthorized(msg) => (StatusCode::UNAUTHORIZED, msg),
            ApiError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            ApiError::Internal => (StatusCode::INTERNAL_SERVER_ERROR, "internal server error"),
        };
        (status, Json(json!({ "error": message }))).into_response()
    }
}

impl From<mongodb::error::Error> for ApiError {
    fn from(e: mongodb::error::Error) -> Self {
        tracing::error!(error = %e, "database error");
        ApiError::Internal
    }
}
