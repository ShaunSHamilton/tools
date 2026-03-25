use axum::{
    extract::{FromRequestParts, Request, State},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use axum_extra::extract::PrivateCookieJar;
use mongodb::bson::oid::ObjectId;

use crate::team_board::{app::AppState, models::session::Session};

/// Injected into request extensions by `require_auth`.
/// Available to all protected handlers via `Extension(UserId(id))`.
#[derive(Clone)]
pub struct UserId(pub ObjectId);

/// The session ID string — injected alongside UserId so logout can remove
/// the exact session rather than all sessions for the user.
#[derive(Clone)]
pub struct SessionCookie(pub String);

pub async fn require_auth(
    State(state): State<AppState>,
    req: Request,
    next: Next,
) -> Response {
    let (mut parts, body) = req.into_parts();

    let jar: PrivateCookieJar = PrivateCookieJar::from_request_parts(&mut parts, &state)
        .await
        .expect("PrivateCookieJar extraction is infallible");

    let session_id = match jar.get("sid").map(|c| c.value().to_owned()) {
        Some(sid) => sid,
        None => return (StatusCode::UNAUTHORIZED, "missing session").into_response(),
    };

    let session = match Session::find_by_session_id(&state.db, &session_id).await {
        Ok(Some(s)) => s,
        Ok(None) => return (StatusCode::UNAUTHORIZED, "invalid or expired session").into_response(),
        Err(e) => {
            tracing::error!(error = %e, "session lookup failed");
            return (StatusCode::INTERNAL_SERVER_ERROR, "db error").into_response();
        }
    };

    let mut req = Request::from_parts(parts, body);
    req.extensions_mut().insert(UserId(session.user_id));
    req.extensions_mut().insert(SessionCookie(session_id));
    next.run(req).await
}
