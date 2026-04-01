use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Json,
};
use futures_util::TryStreamExt;
use mongodb::bson::{doc, oid::ObjectId};
use serde_json::json;

use crate::task_tracker::shared::{
    error::AppError,
    models::report::Report,
};
use crate::team_board::models::{org::OrgMember, user::User};

use crate::task_tracker::api::{error::ApiError, middleware::auth::AuthUser, router::AppState};

// ─── OrgReportSummary ─────────────────────────────────────────────────────────

#[derive(serde::Serialize)]
struct OrgReportSummary {
    id: String,
    title: String,
    period_start: chrono::NaiveDate,
    period_end: chrono::NaiveDate,
    status: String,
    generated_at: Option<chrono::DateTime<chrono::Utc>>,
    created_at: chrono::DateTime<chrono::Utc>,
    author_name: String,
}

// ─── List reports for an org ──────────────────────────────────────────────────

pub async fn list_reports(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(org_id): Path<ObjectId>,
) -> Result<impl IntoResponse, ApiError> {
    // Verify caller is a member of this org (using team board's org_members)
    let org_members = state.tb_db.collection::<OrgMember>("org_members");
    let is_member = org_members
        .find_one(doc! { "org_id": org_id, "user_id": auth.user_id })
        .await?
        .is_some();

    if !is_member {
        return Err(AppError::NotFound.into());
    }

    // Find reports that include this org_id
    let reports_coll = state.db.collection::<Report>("reports");
    let users_coll = state.tb_db.collection::<User>("users");

    let cursor = reports_coll
        .find(doc! { "org_ids": org_id })
        .sort(doc! { "created_at": -1 })
        .limit(100)
        .await?;
    let reports: Vec<Report> = cursor.try_collect().await?;

    // Fetch authors
    let author_ids: Vec<ObjectId> = reports.iter().map(|r| r.user_id).collect();
    let cursor = users_coll
        .find(doc! { "_id": { "$in": &author_ids } })
        .await?;
    let authors: Vec<User> = cursor.try_collect().await?;

    let summaries: Vec<OrgReportSummary> = reports
        .iter()
        .map(|r| {
            let author_name = authors
                .iter()
                .find(|u| u.id == r.user_id)
                .map(|u| u.name.clone())
                .unwrap_or_else(|| "Unknown".to_string());
            OrgReportSummary {
                id: r.id.to_hex(),
                title: r.title.clone(),
                period_start: r.period_start,
                period_end: r.period_end,
                status: r.status.clone(),
                generated_at: r.generated_at,
                created_at: r.created_at,
                author_name,
            }
        })
        .collect();

    Ok(Json(json!({ "reports": summaries })))
}
