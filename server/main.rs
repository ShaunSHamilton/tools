use std::{net::SocketAddr, sync::Arc};
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
    let tb_router = server::team_board::app::create_app(tb_state.clone());

    // ── Task Tracker ─────────────────────────────────────────────────────────
    info!("Initialising task-tracker…");
    let tt_config = server::task_tracker::shared::config::Config::from_env()
        .expect("task-tracker config");
    let tt_db = server::task_tracker::shared::db::connect(&tt_config.mongodb_uri)
        .await
        .expect("task-tracker MongoDB");

    // Reuse the same cookie key as team-board so both apps can read the shared
    // session cookie.
    let mut key_bytes = [0u8; 64];
    let src = tb_config.cookie_key.as_bytes();
    key_bytes[..64].copy_from_slice(&src[..64]);
    let tt_cookie_key = axum_extra::extract::cookie::Key::from(&key_bytes);

    // Job channels
    let (report_tx, mut report_rx) =
        tokio::sync::mpsc::unbounded_channel::<server::task_tracker::shared::jobs::report_generation::ReportGenerationJob>();

    // Spawn report generation worker
    let rw_state = Arc::new(
        server::task_tracker::worker::jobs::report_generation::ReportWorkerState {
            db: tt_db.clone(),
            tb_db: tb_state.db.clone(),
            anthropic: server::task_tracker::worker::report::anthropic::AnthropicProvider::new(
                tt_config.anthropic_api_key.clone(),
            ),
            http: reqwest::Client::new(),
        },
    );
    tokio::spawn(async move {
        while let Some(job) = report_rx.recv().await {
            let state = Arc::clone(&rw_state);
            tokio::spawn(async move {
                if let Err(e) =
                    server::task_tracker::worker::jobs::report_generation::handle(job, state).await
                {
                    tracing::error!(error = %e, "report generation worker error");
                }
            });
        }
    });

    let tt_router = server::task_tracker::api::router::build(
        tt_db,
        tb_state.db.clone(),
        tt_config,
        tt_cookie_key,
        report_tx,
    );

    // ── Combined router ─────────────────────────────────────────────────────
    let dist_dir = "dist";
    let app = axum::Router::new()
        .nest("/api", shared_api)
        .nest("/exam-creator", ec_router)
        .nest("/team-board", tb_router)
        .nest("/task-tracker", tt_router)
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
