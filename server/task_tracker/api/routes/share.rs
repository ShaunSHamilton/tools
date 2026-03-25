use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Json,
};
use mongodb::bson::doc;

use crate::task_tracker::shared::{error::AppError, models::report::Report};

use crate::task_tracker::api::{error::ApiError, router::AppState};

/// GET /share/:token — public, no auth required.
pub async fn public_report(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let reports = state.db.collection::<Report>("reports");
    let report = reports
        .find_one(doc! { "share_token": &token, "status": "completed" })
        .await?
        .ok_or(AppError::NotFound)?;

    Ok(Json(report))
}
