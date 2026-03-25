use std::net::SocketAddr;
use tower_http::services::{ServeDir, ServeFile};
use tracing::info;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    // Global tracing subscriber (only one per process)
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,server=debug".into()),
        )
        .pretty()
        .init();

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);

    // ── Exam Creator ────────────────────────────────────────────────────────
    info!("Initialising exam-creator…");
    let ec_env_vars = server::exam_creator::config::EnvVars::new();

    // Initialise Sentry (exam-creator owns the DSN)
    let _sentry_guard = if let Some(ref dsn) = ec_env_vars.sentry_dsn {
        info!("Initialising Sentry");
        Some(sentry::init((
            dsn.clone(),
            sentry::ClientOptions {
                release: sentry::release_name!(),
                traces_sample_rate: 1.0,
                ..Default::default()
            },
        )))
    } else {
        None
    };

    let ec_router = server::exam_creator::app::app(ec_env_vars).await.unwrap();

    // ── Team Board ──────────────────────────────────────────────────────────
    info!("Initialising team-board…");
    let tb_config = server::team_board::config::Config::from_env();
    let tb_db = server::team_board::db::connect(&tb_config).await;
    let tb_state = server::team_board::app::build_state(&tb_config, tb_db);
    let shared_api = server::team_board::app::create_shared_api_router(tb_state.clone());
    let tb_router = server::team_board::app::create_app(tb_state);

    // ── Combined router ─────────────────────────────────────────────────────
    let dist_dir = "dist";
    let app = axum::Router::new()
        .nest("/api", shared_api)
        .nest("/exam-creator", ec_router)
        .nest("/team-board", tb_router)
        .fallback_service(
            ServeDir::new(dist_dir).fallback(ServeFile::new(format!("{dist_dir}/index.html"))),
        );

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();

    info!(
        "Server listening on 0.0.0.0:{} (accessible from any interface)",
        listener.local_addr().unwrap().port()
    );
    info!("Application: http://127.0.0.1:{port}");

    let server = axum::serve(listener, app);

    // Create shutdown signal handler
    let shutdown_signal = async {
        let ctrl_c = async {
            tokio::signal::ctrl_c()
                .await
                .expect("failed to install Ctrl+C handler");
        };

        #[cfg(unix)]
        let terminate = async {
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                .expect("failed to install SIGTERM handler")
                .recv()
                .await;
        };

        #[cfg(not(unix))]
        let terminate = std::future::pending::<()>();

        tokio::select! {
            _ = ctrl_c => {
                info!("Received SIGINT (Ctrl+C), starting graceful shutdown...");
            },
            _ = terminate => {
                info!("Received SIGTERM, starting graceful shutdown...");
            },
        }
    };

    // Run server with graceful shutdown
    if let Err(err) = server.with_graceful_shutdown(shutdown_signal).await {
        tracing::error!("Server error: {}", err);
    }

    info!("Server shutdown complete.");
}
