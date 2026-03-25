use axum::http::header::{ACCEPT, USER_AGENT};
use axum::{
    extract::{Query, State},
    response::{IntoResponse, Redirect},
};
use axum_extra::extract::{PrivateCookieJar, cookie::Cookie};
use jsonwebtoken::{Algorithm, EncodingKey, Header};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use time::Duration;
use uuid::Uuid;

use crate::team_board::{
    app::AppState,
    error::ApiError,
    models::{session::Session, user::User},
};

const GITHUB_ORG: &str = "freeCodeCamp";
const GITHUB_TEAM: &str = "staff";
const GITHUB_API: &str = "https://api.github.com";
const GITHUB_API_VERSION: &str = "2026-03-10";

// ── Login (redirect to GitHub) ────────────────────────────────────────────────

pub async fn github_login(State(state): State<AppState>) -> impl IntoResponse {
    if state.config.mock_auth {
        let url = format!("{}?code=mock&state=mock", state.config.github_redirect_url);
        return Redirect::to(&url);
    }

    let csrf_state = Uuid::new_v4().to_string();
    let url = format!(
        "https://github.com/login/oauth/authorize?client_id={}&state={}",
        state.config.github_client_id, csrf_state
    );

    Redirect::to(&url)
}

// ── Callback ──────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CallbackParams {
    code: String,
    #[allow(dead_code)]
    state: String,
}

pub async fn github_callback(
    State(state): State<AppState>,
    jar: PrivateCookieJar,
    Query(params): Query<CallbackParams>,
) -> Result<impl IntoResponse, ApiError> {
    // 1. Exchange code for a user access token.
    let user_token = exchange_code(
        &params.code,
        &state.config.github_client_id,
        &state.config.github_client_secret,
        &state.config.github_redirect_url,
        &state.http_client,
        state.config.mock_auth,
    )
    .await?;

    // 2. Fetch the user's public profile.
    let user_info = fetch_user(&user_token, &state.http_client, state.config.mock_auth).await?;

    // 3. Resolve a verified primary email (may be absent on the public profile).
    let email = match user_info.email {
        Some(ref e) => e.clone(),
        None => {
            fetch_primary_email(&user_token, &state.http_client, state.config.mock_auth).await?
        }
    };

    // 4. Verify the user is an active member of freeCodeCamp/staff.
    //    Uses an App JWT to obtain an org installation token, which is then
    //    used to check team membership authoritatively.
    verify_staff_membership(
        &user_info.login,
        &state.config.github_client_id,
        &state.config.github_app_private_key,
        &state.http_client,
        state.config.mock_auth,
    )
    .await?;

    // 5. Upsert the user record.
    let user = User::find_or_create_by_github(
        &state.db,
        user_info.id,
        user_info.name.unwrap_or_else(|| email.clone()),
        email,
        user_info.avatar_url,
    )
    .await
    .map_err(|e| {
        tracing::error!(error = %e, "db error during github login");
        ApiError::Internal
    })?;

    // 6. Create a session and set the cookie.
    let ttl = state.config.session_ttl_in_s as i64;
    let session_id = Uuid::new_v4().to_string();
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

    tracing::info!(user_id = %user.id, login = %user_info.login, "github login");

    Ok((jar.add(cookie), Redirect::to("/")))
}

// ── OAuth code exchange ────────────────────────────────────────────────────────

async fn exchange_code(
    code: &str,
    client_id: &str,
    client_secret: &str,
    redirect_url: &str,
    http_client: &Client,
    mock_auth: bool,
) -> Result<String, ApiError> {
    if mock_auth {
        return Ok("mock-user-token".to_string());
    }

    #[derive(Deserialize)]
    struct TokenResponse {
        access_token: String,
    }

    let text = http_client
        .post("https://github.com/login/oauth/access_token")
        .header(ACCEPT, "application/json")
        .json(&serde_json::json!({
            "client_id": client_id,
            "client_secret": client_secret,
            "code": code,
            "redirect_uri": redirect_url,
        }))
        .send()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "github token exchange request failed");
            ApiError::Unauthorized("GitHub token exchange failed")
        })?
        .error_for_status()
        .map_err(|e| {
            tracing::error!(error = %e, "github token exchange returned error status");
            ApiError::Unauthorized("GitHub token exchange failed")
        })?
        .text()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "failed to read token exchange response body");
            ApiError::Internal
        })?;

    tracing::debug!(token_exchange_response = text);

    serde_json::from_str::<TokenResponse>(&text)
        .map_err(|e| {
            tracing::error!(error = %e, "failed to deserialize token exchange response");
            ApiError::Internal
        })
        .map(|r| r.access_token)
}

// ── GitHub App JWT ─────────────────────────────────────────────────────────────

#[derive(Serialize)]
struct AppJwtClaims<'a> {
    iat: i64,
    exp: i64,
    iss: &'a str,
}

fn create_app_jwt(client_id: &str, private_key_pem: &str) -> Result<String, ApiError> {
    let now = chrono::Utc::now().timestamp();
    let claims = AppJwtClaims {
        iat: now - 60,  // 60 s in the past to tolerate clock skew
        exp: now + 600, // max 10 minutes (GitHub limit)
        iss: client_id,
    };

    let key = EncodingKey::from_rsa_pem(private_key_pem.as_bytes()).map_err(|e| {
        tracing::error!(error = %e, "failed to parse GitHub App private key");
        ApiError::Internal
    })?;

    jsonwebtoken::encode(&Header::new(Algorithm::RS256), &claims, &key).map_err(|e| {
        tracing::error!(error = %e, "failed to sign GitHub App JWT");
        ApiError::Internal
    })
}

// ── Staff membership verification ─────────────────────────────────────────────

async fn verify_staff_membership(
    username: &str,
    client_id: &str,
    private_key_pem: &str,
    http_client: &Client,
    mock_auth: bool,
) -> Result<(), ApiError> {
    if mock_auth {
        return Ok(());
    }

    let app_jwt = create_app_jwt(client_id, private_key_pem)?;

    // Resolve the freeCodeCamp org installation ID using the App JWT.
    let installation_id = fetch_org_installation_id(&app_jwt, http_client).await?;

    // Exchange the App JWT for a short-lived installation access token.
    let installation_token =
        create_installation_token(&app_jwt, installation_id, http_client).await?;

    // Confirm the user is an active member of freeCodeCamp/staff.
    check_team_membership(username, &installation_token, http_client).await
}

async fn fetch_org_installation_id(app_jwt: &str, http_client: &Client) -> Result<u64, ApiError> {
    #[derive(Deserialize)]
    struct Installation {
        id: u64,
    }

    let url = format!("{GITHUB_API}/orgs/{GITHUB_ORG}/installation");
    tracing::debug!(url);

    let text = http_client
        .get(url)
        .bearer_auth(app_jwt)
        .header(USER_AGENT, "team-board")
        .header(ACCEPT, "application/vnd.github+json")
        .header("X-GitHub-Api-Version", GITHUB_API_VERSION)
        .send()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "failed to fetch org installation");
            ApiError::Internal
        })?
        .error_for_status()
        .map_err(|e| {
            tracing::error!(error = %e, "org installation request returned error status");
            ApiError::Internal
        })?
        .text()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "failed to read org installation response body");
            ApiError::Internal
        })?;

    tracing::debug!(org_installation = text);

    serde_json::from_str::<Installation>(&text)
        .map_err(|e| {
            tracing::error!(error = %e, "failed to deserialize org installation response");
            ApiError::Internal
        })
        .map(|i| i.id)
}

async fn create_installation_token(
    app_jwt: &str,
    installation_id: u64,
    http_client: &Client,
) -> Result<String, ApiError> {
    #[derive(Deserialize)]
    struct TokenResponse {
        token: String,
    }

    let url = format!("{GITHUB_API}/app/installations/{installation_id}/access_tokens");
    tracing::debug!(url);

    let text = http_client
        .post(url)
        .bearer_auth(app_jwt)
        .header(USER_AGENT, "team-board")
        .header(ACCEPT, "application/vnd.github+json")
        .header("X-GitHub-Api-Version", GITHUB_API_VERSION)
        .send()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "failed to create installation token");
            ApiError::Internal
        })?
        .error_for_status()
        .map_err(|e| {
            tracing::error!(error = %e, "installation token request returned error status");
            ApiError::Internal
        })?
        .text()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "failed to read installation token response body");
            ApiError::Internal
        })?;

    tracing::debug!(installation_token_response = text);

    serde_json::from_str::<TokenResponse>(&text)
        .map_err(|e| {
            tracing::error!(error = %e, "failed to deserialize installation token response");
            ApiError::Internal
        })
        .map(|r| r.token)
}

async fn check_team_membership(
    username: &str,
    token: &str,
    http_client: &Client,
) -> Result<(), ApiError> {
    #[derive(Deserialize)]
    struct TeamMembership {
        state: String,
    }

    let url = format!("{GITHUB_API}/orgs/{GITHUB_ORG}/teams/{GITHUB_TEAM}/memberships/{username}");
    tracing::debug!(url);

    let res = http_client
        .get(url)
        .bearer_auth(token)
        .header(USER_AGENT, "team-board")
        .header(ACCEPT, "application/vnd.github+json")
        .header("X-GitHub-Api-Version", GITHUB_API_VERSION)
        .send()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "failed to check team membership");
            ApiError::Internal
        })?;

    let status = res.status();

    let text = res.text().await.map_err(|e| {
        tracing::error!(error = %e, "failed to read team membership response body");
        ApiError::Internal
    })?;

    tracing::debug!(team_membership_status = %status, team_membership_response = text);

    if status == 404 {
        return Err(ApiError::Unauthorized(
            "not a member of the freeCodeCamp staff team",
        ));
    }

    if !status.is_success() {
        tracing::error!(status = %status, "team membership request returned error status");
        return Err(ApiError::Internal);
    }

    let membership = serde_json::from_str::<TeamMembership>(&text).map_err(|e| {
        tracing::error!(error = %e, "failed to deserialize team membership response");
        ApiError::Internal
    })?;

    if membership.state != "active" {
        return Err(ApiError::Unauthorized(
            "freeCodeCamp staff team membership is not active",
        ));
    }

    Ok(())
}

// ── User info ──────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct GitHubUser {
    id: i64,
    login: String,
    avatar_url: String,
    email: Option<String>,
    name: Option<String>,
}

async fn fetch_user(
    user_token: &str,
    http_client: &Client,
    mock_auth: bool,
) -> Result<GitHubUser, ApiError> {
    if mock_auth {
        return Ok(GitHubUser {
            id: 0,
            login: "dev-user".to_string(),
            avatar_url: String::new(),
            email: Some("dev@freecodecamp.org".to_string()),
            name: Some("Dev User".to_string()),
        });
    }

    let text = http_client
        .get(format!("{GITHUB_API}/user"))
        .bearer_auth(user_token)
        .header(USER_AGENT, "team-board")
        .header(ACCEPT, "application/vnd.github+json")
        .header("X-GitHub-Api-Version", GITHUB_API_VERSION)
        .send()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "failed to fetch GitHub user info");
            ApiError::Internal
        })?
        .error_for_status()
        .map_err(|e| {
            tracing::warn!(error = %e, "GitHub user info request failed");
            ApiError::Unauthorized("GitHub API request failed")
        })?
        .text()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "failed to read GitHub user info response body");
            ApiError::Internal
        })?;

    tracing::debug!(github_user_info = text);

    serde_json::from_str::<GitHubUser>(&text).map_err(|e| {
        tracing::error!(error = %e, "failed to deserialize GitHub user info");
        ApiError::Internal
    })
}

async fn fetch_primary_email(
    user_token: &str,
    http_client: &Client,
    mock_auth: bool,
) -> Result<String, ApiError> {
    if mock_auth {
        return Ok("dev@freecodecamp.org".to_string());
    }

    #[derive(Deserialize)]
    struct EmailEntry {
        email: String,
        primary: bool,
        verified: bool,
    }

    let text = http_client
        .get(format!("{GITHUB_API}/user/emails"))
        .bearer_auth(user_token)
        .header(USER_AGENT, "team-board")
        .header(ACCEPT, "application/vnd.github+json")
        .header("X-GitHub-Api-Version", GITHUB_API_VERSION)
        .send()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "failed to fetch GitHub user emails");
            ApiError::Internal
        })?
        .error_for_status()
        .map_err(|e| {
            tracing::warn!(error = %e, "GitHub user emails request failed");
            ApiError::Unauthorized("GitHub API request failed")
        })?
        .text()
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "failed to read GitHub user emails response body");
            ApiError::Internal
        })?;

    tracing::debug!(github_user_emails = text);

    let emails = serde_json::from_str::<Vec<EmailEntry>>(&text).map_err(|e| {
        tracing::error!(error = %e, "failed to deserialize GitHub user emails");
        ApiError::Internal
    })?;

    emails
        .into_iter()
        .find(|e| e.primary && e.verified)
        .map(|e| e.email)
        .ok_or(ApiError::Unauthorized(
            "no verified primary email on GitHub account",
        ))
}
