use axum::{
    Extension, Router,
    extract::FromRef,
    http::{HeaderName, HeaderValue},
    middleware,
    routing::{get, post},
};
use axum_extra::extract::cookie::Key;
use mongodb::Database;
use reqwest::Client;
use tokio::sync::mpsc::UnboundedSender;
use tower_http::{
    cors::{Any, CorsLayer},
    set_header::SetResponseHeaderLayer,
    trace::TraceLayer,
};

use crate::task_tracker::api::routes::{github, health, orgs, reports, share};
use crate::task_tracker::shared::{
    config::Config,
    jobs::report_generation::ReportGenerationJob,
};

use crate::task_tracker::api::middleware::rate_limit;

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub tb_db: Database,
    pub config: Config,
    pub http: Client,
    pub cookie_key: Key,
    pub report_queue: UnboundedSender<ReportGenerationJob>,
}

impl FromRef<AppState> for Key {
    fn from_ref(state: &AppState) -> Self {
        state.cookie_key.clone()
    }
}

pub fn build(
    db: Database,
    tb_db: Database,
    config: Config,
    cookie_key: Key,
    report_queue: UnboundedSender<ReportGenerationJob>,
) -> Router {
    let state = AppState {
        db,
        tb_db,
        config,
        http: Client::new(),
        cookie_key,
        report_queue,
    };

    let limiter = rate_limit::new_limiter(30);

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let api = Router::new()
        // Health
        .route("/health", get(health::handler))
        // Auth (session check only — login is handled by team_board)
        .route("/auth/me", get(auth_me))
        // GitHub connect (for fetching events for report generation)
        .route("/github/connect/start", post(github::connect_start))
        .route("/github/connect/callback", get(github::connect_callback))
        .route("/github/status", get(github::status))
        // Reports
        .route("/reports", post(reports::create).get(reports::list))
        .route(
            "/reports/{id}",
            get(reports::get)
                .patch(reports::rename)
                .delete(reports::delete),
        )
        .route(
            "/reports/{id}/orgs",
            get(reports::get_orgs).put(reports::update_orgs),
        )
        .route("/reports/{id}/share", post(reports::share))
        // Organisations
        .route("/orgs", post(orgs::create).get(orgs::list))
        .route("/orgs/{slug}", get(orgs::detail))
        .route("/orgs/{slug}/invites", post(orgs::invite))
        .route("/orgs/{slug}/reports", get(orgs::list_reports))
        .route("/orgs/invites/{token}/accept", post(orgs::accept_invite))
        // Public share (no auth)
        .route("/share/{token}", get(share::public_report))
        .with_state(state);

    Router::new()
        .nest("/api", api)
        // Rate limiting
        .layer(middleware::from_fn(rate_limit::rate_limit))
        .layer(Extension(limiter))
        // Security headers
        .layer(SetResponseHeaderLayer::if_not_present(
            HeaderName::from_static("x-content-type-options"),
            HeaderValue::from_static("nosniff"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            HeaderName::from_static("x-frame-options"),
            HeaderValue::from_static("SAMEORIGIN"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            HeaderName::from_static("referrer-policy"),
            HeaderValue::from_static("strict-origin-when-cross-origin"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            HeaderName::from_static("x-xss-protection"),
            HeaderValue::from_static("1; mode=block"),
        ))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
}

/// Returns the current authenticated user from the team_board session.
async fn auth_me(
    axum::extract::State(state): axum::extract::State<AppState>,
    auth: crate::task_tracker::api::middleware::auth::AuthUser,
) -> axum::response::Response {
    use axum::response::IntoResponse;
    use crate::team_board::models::user::User;

    let users = state.tb_db.collection::<User>("users");
    match users
        .find_one(mongodb::bson::doc! { "_id": auth.user_id })
        .await
    {
        Ok(Some(user)) => axum::Json(serde_json::json!({
            "id": user.id.to_hex(),
            "name": user.name,
            "email": user.email,
            "picture": user.picture,
        }))
        .into_response(),
        Ok(None) => (
            axum::http::StatusCode::UNAUTHORIZED,
            axum::Json(serde_json::json!({ "error": "user not found" })),
        )
            .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "user lookup failed");
            (
                axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                axum::Json(serde_json::json!({ "error": "db error" })),
            )
                .into_response()
        }
    }
}
