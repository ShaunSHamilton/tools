use axum::{extract::Request, middleware::Next, response::Response};
use std::time::Instant;

pub async fn log_request(req: Request, next: Next) -> Response {
    let start = Instant::now();
    let method = req.method().clone();
    let path = req.uri().path().to_owned();

    let response = next.run(req).await;

    let elapsed_ms = start.elapsed().as_millis();
    let status = response.status().as_u16();

    tracing::info!(
        method = %method,
        path = %path,
        status,
        elapsed_ms,
        "request"
    );

    response
}
