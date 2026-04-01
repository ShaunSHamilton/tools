use axum::{
    Json, Router, middleware,
    routing::{delete, get, patch, post},
};
use axum_extra::extract::cookie::Key;
use serde::Serialize;
use std::sync::Arc;
use tower_http::cors::CorsLayer;

use crate::team_board::{config::Config, ws::OrgPresence};

#[derive(Clone)]
pub struct AppState {
    pub config: Arc<Config>,
    pub db: mongodb::Database,
    pub cookie_key: Key,
    pub http_client: reqwest::Client,
    /// Live WebSocket connections per org
    pub presence: Arc<OrgPresence>,
}

impl axum::extract::FromRef<AppState> for Key {
    fn from_ref(state: &AppState) -> Self {
        state.cookie_key.clone()
    }
}

pub fn build_state(config: &Config, db: mongodb::Database) -> AppState {
    let mut key_bytes = [0u8; 64];
    let src = config.cookie_key.as_bytes();
    key_bytes[..64].copy_from_slice(&src[..64]);
    let cookie_key = Key::from(&key_bytes);

    let http_client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .expect("failed to build HTTP client");

    AppState {
        config: Arc::new(config.clone()),
        db,
        cookie_key,
        http_client,
        presence: OrgPresence::new(),
    }
}

/// Shared auth router — mount at `/api` in the top-level server.
/// Handles login, callback, logout, and session check for all apps.
pub fn create_shared_api_router(state: AppState) -> Router {
    let dev_api = if cfg!(debug_assertions) && state.config.mock_auth {
        tracing::warn!("mock_auth enabled; dev login route is active");
        Router::new().route(
            "/auth/dev-login",
            post(crate::auth::dev::dev_login),
        )
    } else {
        Router::new()
    };

    let public_api = Router::new()
        .route(
            "/auth/github/login",
            get(crate::auth::github::github_login),
        )
        .route(
            "/auth/callback/github",
            get(crate::auth::github::github_callback),
        )
        .merge(dev_api);

    let protected_api = Router::new()
        .route("/auth/me", get(crate::auth::me))
        .route("/auth/me", patch(crate::auth::update_me))
        .route("/auth/logout", post(crate::auth::logout))
        // Organisations (unified — shared across all apps)
        .route("/orgs", post(crate::team_board::routes::orgs::create_org))
        .route("/orgs", get(crate::team_board::routes::orgs::list_orgs))
        .route("/orgs/{org_id}", get(crate::team_board::routes::orgs::get_org))
        .route(
            "/orgs/{org_id}/members/invite",
            post(crate::team_board::routes::orgs::invite_member),
        )
        .route(
            "/orgs/{org_id}/members/{user_id}",
            delete(crate::team_board::routes::orgs::remove_member),
        )
        .route(
            "/orgs/{org_id}/members/{user_id}/role",
            patch(crate::team_board::routes::orgs::change_role),
        )
        .route(
            "/orgs/{org_id}/invitations",
            get(crate::team_board::routes::orgs::list_invitations),
        )
        .route(
            "/orgs/{org_id}/invitations/{invite_id}",
            delete(crate::team_board::routes::orgs::cancel_invitation),
        )
        .route(
            "/invitations/{invite_id}/accept",
            post(crate::team_board::routes::orgs::accept_invite),
        )
        .route(
            "/invitations/{invite_id}/decline",
            post(crate::team_board::routes::orgs::decline_invite),
        )
        // Notifications (unified — shared across all apps)
        .route(
            "/notifications",
            get(crate::team_board::routes::orgs::list_notifications),
        )
        .route(
            "/notifications/{notif_id}/read",
            patch(crate::team_board::routes::orgs::mark_notification_read),
        )
        .layer(middleware::from_fn_with_state(
            state.clone(),
            crate::team_board::middleware::auth::require_auth,
        ));

    public_api.merge(protected_api).with_state(state)
}

pub fn create_app(state: AppState) -> Router {
    let cors = build_cors(&state.config);

    // Protected routes — require_auth middleware injects UserId + SessionCookie
    let protected_api = Router::new()
        // Tasks
        .route(
            "/orgs/{org_id}/tasks",
            post(crate::team_board::routes::tasks::create_task),
        )
        .route(
            "/orgs/{org_id}/tasks",
            get(crate::team_board::routes::tasks::list_tasks),
        )
        .route("/tasks/{task_id}", patch(crate::team_board::routes::tasks::update_task))
        .route(
            "/tasks/{task_id}/reorder",
            patch(crate::team_board::routes::tasks::reorder_task),
        )
        .route(
            "/tasks/{task_id}",
            delete(crate::team_board::routes::tasks::delete_task),
        )
        .route(
            "/tasks/{task_id}/upvote",
            post(crate::team_board::routes::tasks::upvote_task),
        )
        .route(
            "/tasks/{task_id}/upvote",
            delete(crate::team_board::routes::tasks::remove_upvote),
        )
        // Suggestions
        .route(
            "/tasks/{task_id}/suggestions",
            post(crate::team_board::routes::suggestions::create_suggestion),
        )
        .route(
            "/tasks/{task_id}/suggestions",
            get(crate::team_board::routes::suggestions::list_suggestions),
        )
        .route(
            "/suggestions/{suggestion_id}",
            delete(crate::team_board::routes::suggestions::delete_suggestion),
        )
        .route(
            "/suggestions/{suggestion_id}/dismiss",
            patch(crate::team_board::routes::suggestions::dismiss_suggestion),
        )
        .route(
            "/suggestions/{suggestion_id}/vote",
            post(crate::team_board::routes::suggestions::vote_suggestion),
        )
        .route(
            "/suggestions/{suggestion_id}/vote",
            delete(crate::team_board::routes::suggestions::remove_vote_suggestion),
        )
        .route(
            "/suggestions/{suggestion_id}/reorder",
            patch(crate::team_board::routes::suggestions::reorder_suggestion),
        )
        .layer(middleware::from_fn_with_state(
            state.clone(),
            crate::team_board::middleware::auth::require_auth,
        ));

    let public_api = Router::new().route("/health", get(health_handler));

    Router::new()
        .nest("/api", public_api.merge(protected_api))
        // WebSocket — auth via signed session cookie
        .route("/ws", get(crate::team_board::ws::ws_handler))
        .layer(middleware::from_fn(crate::team_board::middleware::request_log::log_request))
        .layer(cors)
        .with_state(state)
}

fn build_cors(config: &Config) -> CorsLayer {
    use axum::http::{HeaderValue, Method, header};
    use tower_http::cors::AllowOrigin;

    let origins: Vec<HeaderValue> = config
        .allowed_origins
        .iter()
        .filter_map(|o| o.parse().ok())
        .collect();

    CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::PATCH, Method::DELETE])
        .allow_headers([header::CONTENT_TYPE, header::ACCEPT])
        .allow_credentials(true)
        .allow_origin(AllowOrigin::list(origins))
}

#[derive(Serialize)]
struct HealthResponse {
    status: &'static str,
}

async fn health_handler() -> Json<HealthResponse> {
    Json(HealthResponse { status: "ok" })
}
