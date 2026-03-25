use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{NaiveDate, Utc};
use mongodb::bson::doc;
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::task_tracker::shared::{
    error::AppError,
    models::{
        organisation::OrgMembership,
        report::{Report, ReportSummary},
    },
};

use crate::task_tracker::api::{error::ApiError, middleware::auth::AuthUser, router::AppState};

// ─── Request types ────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CreateReportRequest {
    pub period_start: NaiveDate,
    pub period_end: NaiveDate,
    /// Replaces the default structured-sections prompt when provided.
    pub custom_instructions: Option<String>,
    /// Org IDs whose members should be able to see this report.
    pub org_ids: Option<Vec<Uuid>>,
}

#[derive(Deserialize)]
pub struct UpdateOrgsRequest {
    pub org_ids: Vec<Uuid>,
}

#[derive(Deserialize)]
pub struct RenameReportRequest {
    pub title: String,
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

pub async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<CreateReportRequest>,
) -> Result<impl IntoResponse, ApiError> {
    if req.period_end < req.period_start {
        return Err(AppError::BadRequest("period_end must be >= period_start".into()).into());
    }
    if let Some(ref instructions) = req.custom_instructions {
        if instructions.len() > 5000 {
            return Err(AppError::BadRequest(
                "custom_instructions must be ≤ 5000 characters".into(),
            )
            .into());
        }
    }

    // If org_ids supplied, verify the user is actually a member of each org
    if let Some(ref ids) = req.org_ids {
        if !ids.is_empty() {
            let memberships = state.db.collection::<OrgMembership>("org_memberships");
            let member_count = memberships
                .count_documents(doc! {
                    "user_id": auth.user_id,
                    "org_id": { "$in": bson::serialize_to_bson(ids).unwrap() }
                })
                .await?;

            if member_count != ids.len() as u64 {
                return Err(
                    AppError::BadRequest("one or more org_ids are invalid".into()).into()
                );
            }
        }
    }

    let title = format!("Report {} to {}", req.period_start, req.period_end);
    let now = Utc::now();
    let org_ids = req.org_ids.clone().unwrap_or_default();

    let report = Report {
        id: Uuid::new_v4(),
        user_id: auth.user_id,
        org_id: None,
        title,
        period_start: req.period_start,
        period_end: req.period_end,
        status: "pending".to_string(),
        content_md: None,
        error_message: None,
        custom_instructions: req.custom_instructions,
        share_token: None,
        generated_at: None,
        shared_at: None,
        created_at: now,
        updated_at: now,
        org_ids,
    };

    let reports = state.db.collection::<Report>("reports");
    reports.insert_one(&report).await?;

    // Enqueue the generation job
    let job = crate::task_tracker::shared::jobs::report_generation::ReportGenerationJob {
        report_id: report.id,
    };
    state
        .report_queue
        .send(job)
        .map_err(|e| anyhow::anyhow!("failed to enqueue report job: {e}"))?;

    Ok((StatusCode::CREATED, Json(report)))
}

pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<impl IntoResponse, ApiError> {
    use futures_util::TryStreamExt;

    let reports = state.db.collection::<ReportSummary>("reports");
    let cursor = reports
        .find(doc! { "user_id": bson::serialize_to_bson(&auth.user_id).unwrap() })
        .sort(doc! { "created_at": -1 })
        .limit(50)
        .projection(doc! {
            "_id": 1,
            "title": 1,
            "period_start": 1,
            "period_end": 1,
            "status": 1,
            "generated_at": 1,
            "created_at": 1,
        })
        .await?;

    let results: Vec<ReportSummary> = cursor.try_collect().await?;

    Ok(Json(json!({ "reports": results })))
}

pub async fn get(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(report_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let reports = state.db.collection::<Report>("reports");
    let report = reports
        .find_one(doc! {
            "_id": bson::serialize_to_bson(&report_id).unwrap(),
            "user_id": auth.user_id,
        })
        .await?
        .ok_or(AppError::NotFound)?;

    Ok(Json(report))
}

pub async fn rename(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(report_id): Path<Uuid>,
    Json(req): Json<RenameReportRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let title = req.title.trim().to_string();
    if title.is_empty() {
        return Err(AppError::BadRequest("title must not be empty".into()).into());
    }
    if title.len() > 200 {
        return Err(AppError::BadRequest("title must be ≤ 200 characters".into()).into());
    }

    let reports = state.db.collection::<Report>("reports");
    let result = reports
        .update_one(
            doc! {
                "_id": bson::serialize_to_bson(&report_id).unwrap(),
                "user_id": auth.user_id,
            },
            doc! { "$set": { "title": &title } },
        )
        .await?;

    if result.matched_count == 0 {
        return Err(AppError::NotFound.into());
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn delete(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(report_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let reports = state.db.collection::<Report>("reports");
    let result = reports
        .delete_one(doc! {
            "_id": bson::serialize_to_bson(&report_id).unwrap(),
            "user_id": auth.user_id,
        })
        .await?;

    if result.deleted_count == 0 {
        return Err(AppError::NotFound.into());
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_orgs(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(report_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let reports = state.db.collection::<Report>("reports");
    let report = reports
        .find_one(doc! {
            "_id": bson::serialize_to_bson(&report_id).unwrap(),
            "user_id": auth.user_id,
        })
        .await?
        .ok_or(AppError::NotFound)?;

    Ok(Json(json!({ "org_ids": report.org_ids })))
}

pub async fn update_orgs(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(report_id): Path<Uuid>,
    Json(req): Json<UpdateOrgsRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let reports = state.db.collection::<Report>("reports");

    // Verify ownership
    let exists = reports
        .find_one(doc! {
            "_id": bson::serialize_to_bson(&report_id).unwrap(),
            "user_id": auth.user_id,
        })
        .await?;

    if exists.is_none() {
        return Err(AppError::NotFound.into());
    }

    // Verify user is a member of all provided orgs
    if !req.org_ids.is_empty() {
        let memberships = state.db.collection::<OrgMembership>("org_memberships");
        let member_count = memberships
            .count_documents(doc! {
                "user_id": auth.user_id,
                "org_id": { "$in": bson::serialize_to_bson(&req.org_ids).unwrap() }
            })
            .await?;

        if member_count != req.org_ids.len() as u64 {
            return Err(AppError::BadRequest("one or more org_ids are invalid".into()).into());
        }
    }

    // Update the embedded org_ids array
    reports
        .update_one(
            doc! { "_id": bson::serialize_to_bson(&report_id).unwrap() },
            doc! { "$set": { "org_ids": bson::serialize_to_bson(&req.org_ids).unwrap() } },
        )
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

pub async fn share(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(report_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let reports = state.db.collection::<Report>("reports");

    // Fetch the report to check ownership and existing share_token
    let report = reports
        .find_one(doc! {
            "_id": bson::serialize_to_bson(&report_id).unwrap(),
            "user_id": auth.user_id,
        })
        .await?
        .ok_or(AppError::NotFound)?;

    let token = if let Some(ref existing_token) = report.share_token {
        // Already shared — reuse existing token (idempotent)
        existing_token.clone()
    } else {
        // Generate a short 16-char URL-safe token
        let new_token = Uuid::new_v4().simple().to_string()[..16].to_string();
        let now = Utc::now();

        reports
            .update_one(
                doc! { "_id": bson::serialize_to_bson(&report_id).unwrap() },
                doc! { "$set": {
                    "share_token": &new_token,
                    "shared_at": bson::serialize_to_bson(&now).unwrap(),
                }},
            )
            .await?;

        new_token
    };

    let url = format!("{}/share/{}", state.config.frontend_base_url, token);

    Ok(Json(json!({ "url": url, "token": token })))
}
