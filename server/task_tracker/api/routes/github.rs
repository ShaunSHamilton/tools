use axum::{
    extract::{Query, State},
    http::{header, StatusCode},
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use mongodb::bson::{doc, oid::ObjectId};
use serde::Deserialize;
use serde_json::json;
use crate::task_tracker::shared::{
    error::AppError,
    models::github_connection::{GithubConnection, GithubConnectionDto},
};

use crate::task_tracker::api::{
    error::ApiError,
    middleware::auth::AuthUser,
    router::AppState,
    utils::jwt,
};

// ─── Connect GitHub OAuth flow ────────────────────────────────────────────────

/// Returns a GitHub OAuth URL. The frontend redirects the browser to this URL.
/// Embeds the authenticated user_id in a signed JWT state parameter so we can
/// recover it in the callback without server-side session storage.
pub async fn connect_start(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<impl IntoResponse, ApiError> {
    let connect_state = jwt::encode_connect_state(auth.user_id, &state.config.github_client_secret)?;

    let redirect_uri = format!("{}/api/github/connect/callback", state.config.app_base_url);
    let url = format!(
        "https://github.com/login/oauth/authorize?client_id={}&redirect_uri={}&scope=repo&state={}",
        state.config.github_client_id,
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(&connect_state),
    );

    Ok(Json(json!({ "url": url })))
}

/// GitHub redirects here after the user authorises access.
/// Exchanges the OAuth code for an access token and upserts `github_connections`.
#[derive(Deserialize)]
pub struct ConnectCallback {
    pub code: String,
    pub state: String,
}

pub async fn connect_callback(
    State(state): State<AppState>,
    Query(params): Query<ConnectCallback>,
) -> Result<impl IntoResponse, ApiError> {
    // Verify and decode the state JWT to recover the user_id
    let claims = jwt::decode_connect_state(&params.state, &state.config.github_client_secret)
        .map_err(|_| AppError::BadRequest("invalid or expired connect state".into()))?;

    let user_id = ObjectId::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("malformed user_id in state".into()))?;

    // Exchange OAuth code for access token
    #[derive(Deserialize)]
    struct GithubToken {
        access_token: String,
        scope: Option<String>,
        refresh_token: Option<String>,
        expires_in: Option<i64>,
        refresh_token_expires_in: Option<i64>,
    }

    let token: GithubToken = state
        .http
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .form(&[
            ("client_id", state.config.github_client_id.as_str()),
            ("client_secret", state.config.github_client_secret.as_str()),
            ("code", params.code.as_str()),
        ])
        .send()
        .await?
        .json()
        .await?;

    // Fetch the GitHub user's profile
    #[derive(Deserialize)]
    struct GithubUser {
        id: i64,
        login: String,
    }

    let gh_user: GithubUser = state
        .http
        .get("https://api.github.com/user")
        .bearer_auth(&token.access_token)
        .header("User-Agent", "task-tracker")
        .send()
        .await?
        .json()
        .await?;

    let scopes: Vec<String> = token
        .scope
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .collect();

    let now = Utc::now();
    let token_expires_at = token.expires_in.map(|s| now + chrono::Duration::seconds(s));
    let refresh_token_expires_at = token.refresh_token_expires_in.map(|s| now + chrono::Duration::seconds(s));
    let github_connections = state.db.collection::<GithubConnection>("github_connections");

    // Upsert the github_connections document
    let existing = github_connections
        .find_one(doc! { "user_id": user_id })
        .await?;

    if existing.is_some() {
        github_connections
            .update_one(
                doc! { "user_id": user_id },
                doc! { "$set": {
                    "github_user_id": gh_user.id,
                    "github_username": &gh_user.login,
                    "access_token": &token.access_token,
                    "refresh_token": bson::serialize_to_bson(&token.refresh_token).unwrap(),
                    "token_expires_at": bson::serialize_to_bson(&token_expires_at).unwrap(),
                    "refresh_token_expires_at": bson::serialize_to_bson(&refresh_token_expires_at).unwrap(),
                    "scopes": bson::serialize_to_bson(&scopes).unwrap(),
                    "connected_at": bson::serialize_to_bson(&now).unwrap(),
                }},
            )
            .await?;
    } else {
        let conn = GithubConnection {
            id: ObjectId::new(),
            user_id,
            github_user_id: gh_user.id,
            github_username: gh_user.login.clone(),
            access_token: token.access_token.clone(),
            refresh_token: token.refresh_token.clone(),
            token_expires_at,
            refresh_token_expires_at,
            scopes: Some(scopes),
            connected_at: now,
        };
        github_connections.insert_one(&conn).await?;
    }

    // Redirect to the frontend dashboard
    let redirect_url = format!("{}/dashboard", state.config.frontend_base_url);
    let mut headers = axum::http::HeaderMap::new();
    headers.insert(
        header::LOCATION,
        redirect_url.parse().expect("valid redirect URL"),
    );

    Ok((StatusCode::FOUND, headers))
}

// ─── Disconnect ───────────────────────────────────────────────────────────────

/// Removes the GitHub connection for the authenticated user.
pub async fn disconnect(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<impl IntoResponse, ApiError> {
    let github_connections = state.db.collection::<GithubConnection>("github_connections");
    github_connections
        .delete_one(doc! { "user_id": auth.user_id })
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

// ─── Status ───────────────────────────────────────────────────────────────────

/// Returns the current GitHub connection status for the authenticated user.
pub async fn status(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<impl IntoResponse, ApiError> {
    let github_connections = state.db.collection::<GithubConnection>("github_connections");
    let connection = github_connections
        .find_one(doc! { "user_id": auth.user_id })
        .await?;

    match connection {
        None => Ok(Json(json!({ "connected": false }))),
        Some(conn) => {
            let dto: GithubConnectionDto = conn.into();
            Ok(Json(json!({ "connected": true, "connection": dto })))
        }
    }
}
