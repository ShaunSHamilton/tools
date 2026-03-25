use axum::{Json, extract::State, http::StatusCode, response::IntoResponse};
use axum_extra::extract::{PrivateCookieJar, cookie::Cookie};
use serde::Deserialize;
use time::Duration;
use uuid::Uuid;

use crate::team_board::{
    app::AppState,
    error::ApiError,
    models::{notification::Notification, session::Session, user::User},
};

use super::ApiUser;

#[derive(Deserialize)]
pub struct DevLoginRequest {
    pub name: String,
    pub email: String,
}

/// DEV ONLY — create or find a user by email and issue a session cookie.
pub async fn dev_login(
    State(state): State<AppState>,
    jar: PrivateCookieJar,
    Json(body): Json<DevLoginRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let name = body.name.trim().to_string();
    let email = body.email.trim().to_lowercase();

    if name.is_empty() || email.is_empty() {
        return Err(ApiError::BadRequest("name and email are required"));
    }

    let user = match User::find_by_email(&state.db, &email).await? {
        Some(u) => u,
        None => User::create(&state.db, name, email).await?,
    };

    if let Err(e) = Notification::backfill_pending_invites(&state.db, user.id, &user.email).await {
        tracing::warn!(error = %e, "failed to backfill invite notifications");
    }

    let session_id = Uuid::new_v4().to_string();
    let ttl = state.config.session_ttl_in_s as i64;
    let expires_at = {
        let millis = chrono::Utc::now().timestamp_millis() + ttl * 1000;
        mongodb::bson::DateTime::from_millis(millis)
    };

    Session::create(&state.db, user.id, session_id.clone(), expires_at)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "failed to create session");
            ApiError::Internal
        })?;

    let cookie = Cookie::build(("sid", session_id))
        .path("/")
        .http_only(true)
        .max_age(Duration::seconds(ttl));

    tracing::info!(user_id = %user.id, "dev login");

    Ok((StatusCode::OK, jar.add(cookie), Json(ApiUser::from(&user))))
}
