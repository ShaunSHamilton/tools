use axum::{Extension, Json, extract::State, http::StatusCode, response::IntoResponse};
use axum_extra::extract::{PrivateCookieJar, cookie::Cookie};
use serde::Serialize;

use crate::team_board::{
    app::AppState,
    error::ApiError,
    middleware::auth::{SessionCookie, UserId},
    models::{session::Session, user::User},
};

pub mod github;

pub mod dev;

// ── Request / response types ──────────────────────────────────────────────────

#[derive(Serialize)]
pub struct ApiUser {
    pub id: String,
    pub name: String,
    pub email: String,
    pub picture: Option<String>,
}

impl From<&User> for ApiUser {
    fn from(u: &User) -> Self {
        ApiUser {
            id: u.id.to_hex(),
            name: u.name.clone(),
            email: u.email.clone(),
            picture: u.picture.clone(),
        }
    }
}

// ── Handlers ──────────────────────────────────────────────────────────────────

/// Revoke the current session.
pub async fn logout(
    State(state): State<AppState>,
    jar: PrivateCookieJar,
    Extension(session_cookie): Extension<SessionCookie>,
) -> impl IntoResponse {
    if let Err(e) = Session::delete_by_session_id(&state.db, &session_cookie.0).await {
        tracing::warn!(error = %e, "failed to delete session on logout");
    }
    (StatusCode::NO_CONTENT, jar.remove(Cookie::from("sid")))
}

/// Return the currently authenticated user.
pub async fn me(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
) -> Result<Json<ApiUser>, ApiError> {
    let user = User::find_by_id(&state.db, &user_id.0)
        .await?
        .ok_or(ApiError::NotFound("user not found"))?;

    Ok(Json(ApiUser::from(&user)))
}
