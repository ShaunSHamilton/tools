use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use mongodb::bson::doc;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::task_tracker::shared::{error::AppError, jobs::pdf_export::PdfExportJob};

use crate::task_tracker::api::{error::ApiError, middleware::auth::AuthUser, router::AppState, spaces};

// ─── MongoDB helper types ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportExport {
    #[serde(rename = "_id")]
    pub id: Uuid,
    pub report_id: Uuid,
    pub format: String,
    pub status: String,
    pub storage_key: Option<String>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
}

// ─── POST /reports/:id/export/pdf ─────────────────────────────────────────────

pub async fn create_pdf_export(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(report_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    // Verify report ownership and completion
    use crate::task_tracker::shared::models::report::Report;
    let reports = state.db.collection::<Report>("reports");
    let report = reports
        .find_one(doc! {
            "_id": bson::serialize_to_bson(&report_id).unwrap(),
            "user_id": auth.user_id,
        })
        .await?
        .ok_or(AppError::NotFound)?;

    if report.status != "completed" {
        return Err(
            AppError::BadRequest("report must be completed before exporting".into()).into(),
        );
    }

    // Return existing completed export if one exists
    let exports = state.db.collection::<ReportExport>("report_exports");
    let existing = exports
        .find_one(doc! {
            "report_id": bson::serialize_to_bson(&report_id).unwrap(),
            "format": "pdf",
        })
        .sort(doc! { "created_at": -1 })
        .await?;

    if let Some(ref e) = existing {
        if e.status == "completed" {
            let download_url = spaces::presigned_download_url(&state.config, e.storage_key.as_deref().unwrap_or(""))
                .await
                .unwrap_or_default();
            return Ok(Json(json!({
                "id": e.id,
                "status": e.status,
                "download_url": download_url,
                "created_at": e.created_at,
            })));
        }
        if e.status == "pending" {
            return Ok(Json(json!({
                "id": e.id,
                "status": e.status,
                "download_url": null,
                "created_at": e.created_at,
            })));
        }
        // If "failed", fall through to create a new attempt
    }

    // Create new export record
    let now = Utc::now();
    let export = ReportExport {
        id: Uuid::new_v4(),
        report_id,
        format: "pdf".to_string(),
        status: "pending".to_string(),
        storage_key: None,
        error_message: None,
        created_at: now,
    };

    exports.insert_one(&export).await?;

    // Enqueue job
    let job = PdfExportJob { export_id: export.id };
    state
        .pdf_export_queue
        .send(job)
        .map_err(|e| anyhow::anyhow!("failed to enqueue pdf export job: {e}"))?;

    Ok(Json(json!({
        "id": export.id,
        "status": export.status,
        "download_url": null,
        "created_at": export.created_at,
    })))
}

// ─── GET /reports/:id/export/pdf ──────────────────────────────────────────────

pub async fn get_pdf_export(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(report_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    // Verify ownership
    use crate::task_tracker::shared::models::report::Report;
    let reports = state.db.collection::<Report>("reports");
    reports
        .find_one(doc! {
            "_id": bson::serialize_to_bson(&report_id).unwrap(),
            "user_id": auth.user_id,
        })
        .await?
        .ok_or(AppError::NotFound)?;

    let exports = state.db.collection::<ReportExport>("report_exports");
    let export = exports
        .find_one(doc! {
            "report_id": bson::serialize_to_bson(&report_id).unwrap(),
            "format": "pdf",
        })
        .sort(doc! { "created_at": -1 })
        .await?
        .ok_or(AppError::NotFound)?;

    let download_url = if export.status == "completed" {
        let key = export.storage_key.as_deref().unwrap_or("");
        spaces::presigned_download_url(&state.config, key).await.ok()
    } else {
        None
    };

    Ok(Json(json!({
        "id": export.id,
        "status": export.status,
        "download_url": download_url,
        "error_message": export.error_message,
        "created_at": export.created_at,
    })))
}
