use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
    Json,
};
use axum_extra::extract::{PrivateCookieJar, cookie::Key};
use mongodb::bson::oid::ObjectId;
use serde_json::{json, Value};

use crate::task_tracker::api::router::AppState;
use crate::team_board::models::session::Session;

/// Extractor that validates the shared session cookie and injects the authenticated user.
/// Reads the `sid` cookie (set by team_board's auth handler) and looks up the session
/// in team_board's MongoDB database.
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: ObjectId,
}

impl FromRequestParts<AppState> for AuthUser {
    type Rejection = (StatusCode, Json<Value>);

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let jar: PrivateCookieJar<Key> = PrivateCookieJar::from_request_parts(parts, state)
            .await
            .map_err(|_| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": "cookie extraction failed" })),
                )
            })?;

        let session_id = jar
            .get("sid")
            .map(|c| c.value().to_owned())
            .ok_or_else(|| {
                (
                    StatusCode::UNAUTHORIZED,
                    Json(json!({ "error": "not authenticated" })),
                )
            })?;

        let session = Session::find_by_session_id(&state.tb_db, &session_id)
            .await
            .map_err(|e| {
                tracing::error!(error = %e, "session lookup failed");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(json!({ "error": "db error" })),
                )
            })?
            .ok_or_else(|| {
                (
                    StatusCode::UNAUTHORIZED,
                    Json(json!({ "error": "invalid or expired session" })),
                )
            })?;

        Ok(AuthUser {
            user_id: session.user_id,
        })
    }
}
