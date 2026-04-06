use axum::{Extension, Json, extract::State, http::StatusCode, response::IntoResponse};
use axum_extra::extract::{PrivateCookieJar, cookie::Cookie};
use serde::{Deserialize, Serialize};

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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    pub picture: Option<String>,
    pub display_name: Option<String>,
    pub show_live_cursors: bool,
}

impl From<&User> for ApiUser {
    fn from(u: &User) -> Self {
        ApiUser {
            id: u.id.to_hex(),
            name: u.name.clone(),
            email: Some(u.email.clone()),
            picture: u.picture.clone(),
            display_name: u.display_name.clone(),
            show_live_cursors: u.show_live_cursors.unwrap_or(true),
        }
    }
}

impl ApiUser {
    /// Build an `ApiUser` with the email omitted (used when the requester is
    /// not an org admin and should not see other members' email addresses).
    pub fn without_email(u: &User) -> Self {
        ApiUser {
            id: u.id.to_hex(),
            name: u.name.clone(),
            email: None,
            picture: u.picture.clone(),
            display_name: u.display_name.clone(),
            show_live_cursors: u.show_live_cursors.unwrap_or(true),
        }
    }
}

#[derive(Deserialize)]
pub struct UpdateMeRequest {
    pub display_name: Option<serde_json::Value>,
    pub show_live_cursors: Option<bool>,
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
    (StatusCode::NO_CONTENT, jar.remove(Cookie::build("sid").path("/")))
}

/// Return the currently authenticated user.
pub async fn me(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
) -> Result<Json<ApiUser>, ApiError> {
    let user = User::find_by_id(&state.db, &user_id.0)
        .await?
        .ok_or(ApiError::NotFound("user not found".into()))?;

    Ok(Json(ApiUser::from(&user)))
}

/// Update the current user's settings (display_name, show_live_cursors).
pub async fn update_me(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
    Json(body): Json<UpdateMeRequest>,
) -> Result<Json<ApiUser>, ApiError> {
    // Resolve display_name: the field may be absent, null, or a string
    let display_name: Option<Option<String>> = match body.display_name {
        None => None, // field was not sent — don't touch it
        Some(serde_json::Value::Null) => Some(None), // explicit null — clear it
        Some(serde_json::Value::String(s)) => {
            let trimmed = s.trim().to_string();
            if trimmed.is_empty() {
                Some(None) // blank string — clear the display name
            } else if trimmed.len() > 50 {
                return Err(ApiError::BadRequest(
                    "display_name must be 50 characters or fewer".into(),
                ));
            } else {
                Some(Some(trimmed))
            }
        }
        _ => return Err(ApiError::BadRequest("display_name must be a string or null".into())),
    };

    let user = User::update_settings(
        &state.db,
        &user_id.0,
        display_name,
        body.show_live_cursors,
    )
    .await?
    .ok_or(ApiError::NotFound("user not found".into()))?;

    Ok(Json(ApiUser::from(&user)))
}
