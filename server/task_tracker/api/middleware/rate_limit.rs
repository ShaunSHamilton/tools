use std::{
    net::{IpAddr, Ipv4Addr},
    num::NonZeroU32,
    sync::Arc,
};

use axum::{
    extract::Request,
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use governor::{DefaultKeyedRateLimiter, Quota, RateLimiter};
use serde_json::json;

pub type IpRateLimiter = DefaultKeyedRateLimiter<IpAddr>;

/// Create a keyed (per-IP) rate limiter allowing `per_minute` requests per minute.
pub fn new_limiter(per_minute: u32) -> Arc<IpRateLimiter> {
    Arc::new(RateLimiter::keyed(
        Quota::per_minute(NonZeroU32::new(per_minute).expect("per_minute must be > 0")),
    ))
}

/// Axum middleware: enforces per-IP rate limiting.
/// Reads the client IP from `X-Real-IP` → `X-Forwarded-For` → falls back to 127.0.0.1.
pub async fn rate_limit(
    headers: HeaderMap,
    axum::extract::Extension(limiter): axum::extract::Extension<Arc<IpRateLimiter>>,
    req: Request,
    next: Next,
) -> Response {
    let ip = extract_ip(&headers);

    match limiter.check_key(&ip) {
        Ok(_) => next.run(req).await,
        Err(_) => (
            StatusCode::TOO_MANY_REQUESTS,
            Json(json!({ "error": "rate limit exceeded" })),
        )
            .into_response(),
    }
}

fn extract_ip(headers: &HeaderMap) -> IpAddr {
    headers
        .get("x-real-ip")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.trim().parse().ok())
        .or_else(|| {
            headers
                .get("x-forwarded-for")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.split(',').next()?.trim().parse().ok())
        })
        .unwrap_or(IpAddr::V4(Ipv4Addr::LOCALHOST))
}
