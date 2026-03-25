use axum::{extract::State, http::StatusCode, Json};
use mongodb::bson::doc;
use serde_json::{json, Value};

use crate::task_tracker::api::router::AppState;

pub async fn handler(State(state): State<AppState>) -> (StatusCode, Json<Value>) {
    let db_ok = state.db.run_command(doc! { "ping": 1 }).await.is_ok();

    let status = if db_ok {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    (status, Json(json!({ "status": if db_ok { "ok" } else { "degraded" }, "db": db_ok })))
}
