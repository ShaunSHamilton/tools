use axum::{
    Extension, Json,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
};
use futures::TryStreamExt;
use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::{
    auth::ApiUser,
    team_board::{
        app::AppState,
        error::ApiError,
        middleware::auth::UserId,
        models::{
            org::OrgMember,
            task::{Task, TaskStatus},
            user::User,
        },
        routes::orgs::{parse_oid, require_org},
    },
};

// ── Request / response types ──────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CreateTaskRequest {
    pub assignee_id: String,
    pub title: String,
    pub description: Option<String>,
    pub url: Option<String>,
    pub color: Option<String>,
    pub collaborator_ids: Option<Vec<String>>,
}

#[derive(Deserialize)]
pub struct UpdateTaskRequest {
    pub title: Option<String>,
    pub description: Option<Option<String>>,
    pub url: Option<Option<String>>,
    pub status: Option<String>,
    pub drop_reason: Option<Option<String>>,
    pub color: Option<String>,
    pub assignee_id: Option<String>,
    pub collaborator_ids: Option<Vec<String>>,
}

#[derive(Deserialize)]
pub struct ReorderRequest {
    pub before_id: Option<String>,
    pub after_id: Option<String>,
}

#[derive(Serialize)]
pub struct ApiTask {
    pub id: String,
    pub org_id: String,
    pub assignee_id: String,
    pub created_by: String,
    pub title: String,
    pub description: Option<String>,
    pub url: Option<String>,
    pub status: String,
    pub drop_reason: Option<String>,
    pub color: String,
    pub position: String,
    pub upvote_count: i32,
    pub user_has_upvoted: bool,
    pub collaborators: Vec<ApiUser>,
    pub created_at: String,
    pub updated_at: String,
}

pub struct ApiTaskContext<'a> {
    pub task: &'a Task,
    pub requesting_user_id: &'a mongodb::bson::oid::ObjectId,
    pub collaborator_users: Vec<ApiUser>,
}

impl<'a> From<ApiTaskContext<'a>> for ApiTask {
    fn from(ctx: ApiTaskContext<'a>) -> Self {
        let t = ctx.task;
        ApiTask {
            id: t.id.to_hex(),
            org_id: t.org_id.to_hex(),
            assignee_id: t.assignee_id.to_hex(),
            created_by: t.created_by.to_hex(),
            title: t.title.clone(),
            description: t.description.clone(),
            url: t.url.clone(),
            status: match t.status {
                TaskStatus::Idea => "idea",
                TaskStatus::InProgress => "in_progress",
                TaskStatus::Complete => "complete",
                TaskStatus::Dropped => "dropped",
            }
            .to_string(),
            drop_reason: t.drop_reason.clone(),
            color: t.color.clone(),
            position: t.position.clone(),
            upvote_count: t.upvotes.len() as i32,
            user_has_upvoted: t.upvotes.contains(ctx.requesting_user_id),
            collaborators: ctx.collaborator_users,
            created_at: t.created_at.to_string(),
            updated_at: t.updated_at.to_string(),
        }
    }
}

/// Fetch collaborator User docs and convert to ApiUser (no email).
async fn resolve_collaborators(
    db: &mongodb::Database,
    task: &Task,
) -> Result<Vec<ApiUser>, ApiError> {
    if task.collaborator_ids.is_empty() {
        return Ok(vec![]);
    }
    let users: Vec<User> = db
        .collection::<User>("users")
        .find(mongodb::bson::doc! { "_id": { "$in": &task.collaborator_ids } })
        .await?
        .try_collect()
        .await?;

    // Preserve order of collaborator_ids
    let result = task
        .collaborator_ids
        .iter()
        .filter_map(|cid| {
            users
                .iter()
                .find(|u| &u.id == cid)
                .map(ApiUser::without_email)
        })
        .collect();
    Ok(result)
}

async fn task_to_api(
    db: &mongodb::Database,
    task: &Task,
    user_id: &mongodb::bson::oid::ObjectId,
) -> Result<ApiTask, ApiError> {
    let collaborator_users = resolve_collaborators(db, task).await?;
    Ok(ApiTask::from(ApiTaskContext {
        task,
        requesting_user_id: user_id,
        collaborator_users,
    }))
}

const DEFAULT_COLOR: &str = "#6366f1";

const ALLOWED_COLORS: &[&str] = &[
    "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6",
    "#06b6d4", "#3b82f6", "#64748b", "#a3a3a3",
];

fn default_color() -> &'static str {
    DEFAULT_COLOR
}

fn validate_color(color: &str) -> bool {
    ALLOWED_COLORS.contains(&color)
}

// ── Handlers ──────────────────────────────────────────────────────────────────

pub async fn create_task(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
    Path(org_id): Path<String>,
    Json(body): Json<CreateTaskRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let org = require_org(&state, &org_id).await?;
    // Must be a member of the org
    OrgMember::find(&state.db, &org.id, &user_id.0)
        .await?
        .ok_or(ApiError::Unauthorized("unauthorized"))?;

    let title = body.title.trim().to_string();
    if title.is_empty() {
        return Err(ApiError::BadRequest("title is required"));
    }

    let assignee_oid = parse_oid(&body.assignee_id)?;
    // Assignee must also be a member
    OrgMember::find(&state.db, &org.id, &assignee_oid)
        .await?
        .ok_or(ApiError::BadRequest("assignee is not a member of this org"))?;

    let color = body.color.as_deref().unwrap_or(default_color()).to_string();
    if !validate_color(&color) {
        return Err(ApiError::BadRequest("invalid color"));
    }

    // Validate collaborators
    let collaborator_oids = parse_and_validate_collaborators(
        &state.db,
        &org.id,
        body.collaborator_ids.as_deref().unwrap_or(&[]),
    )
    .await?;

    let task = Task::create(
        &state.db,
        org.id,
        assignee_oid,
        user_id.0,
        title,
        body.description,
        body.url,
        color,
        collaborator_oids,
    )
    .await?;

    let api = task_to_api(&state.db, &task, &user_id.0).await?;
    state.presence.broadcast(
        &org.id.to_hex(),
        &json!({ "type": "task_created", "payload": &api }).to_string(),
    );

    Ok((StatusCode::CREATED, Json(api)))
}

pub async fn list_tasks(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
    Path(org_id): Path<String>,
) -> Result<Json<Vec<ApiTask>>, ApiError> {
    let org = require_org(&state, &org_id).await?;
    OrgMember::find(&state.db, &org.id, &user_id.0)
        .await?
        .ok_or(ApiError::Unauthorized("unauthorized"))?;

    let tasks = Task::find_for_org(&state.db, &org.id).await?;
    let mut api_tasks = Vec::with_capacity(tasks.len());
    for task in &tasks {
        api_tasks.push(task_to_api(&state.db, task, &user_id.0).await?);
    }
    Ok(Json(api_tasks))
}

pub async fn update_task(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
    Path(task_id): Path<String>,
    Json(body): Json<UpdateTaskRequest>,
) -> Result<Json<ApiTask>, ApiError> {
    let task_oid = parse_oid(&task_id)?;

    let task = Task::find_by_id(&state.db, &task_oid)
        .await?
        .ok_or(ApiError::NotFound("task not found"))?;

    // Must be a member of the task's org
    OrgMember::find(&state.db, &task.org_id, &user_id.0)
        .await?
        .ok_or(ApiError::Unauthorized("unauthorized"))?;

    // Parse status
    let new_status = body
        .status
        .as_deref()
        .map(|s| TaskStatus::from_str(s).ok_or(ApiError::BadRequest("invalid status")))
        .transpose()?;

    // Validate drop_reason invariant
    let effective_status = new_status.as_ref().unwrap_or(&task.status);
    let effective_drop_reason = match &body.drop_reason {
        Some(dr) => dr.clone(),
        None => task.drop_reason.clone(),
    };

    if *effective_status == TaskStatus::Dropped
        && effective_drop_reason.as_deref().is_none_or(str::is_empty)
    {
        return Err(ApiError::BadRequest(
            "drop_reason is required when status is dropped",
        ));
    }

    // When status moves away from dropped, clear drop_reason
    let drop_reason_override = if *effective_status != TaskStatus::Dropped
        && task.status == TaskStatus::Dropped
        && body.drop_reason.is_none()
    {
        Some(None) // explicitly clear
    } else {
        body.drop_reason
    };

    if let Some(c) = &body.color
        && !validate_color(c)
    {
        return Err(ApiError::BadRequest("invalid color"));
    }

    let new_assignee = body
        .assignee_id
        .as_deref()
        .map(|s| {
            let oid = parse_oid(s)?;
            Ok::<ObjectId, ApiError>(oid)
        })
        .transpose()?;

    // Verify new assignee is a member
    if let Some(new_aid) = &new_assignee {
        OrgMember::find(&state.db, &task.org_id, new_aid)
            .await?
            .ok_or(ApiError::BadRequest("assignee is not a member of this org"))?;
    }

    // Validate collaborators if provided
    let new_collaborator_ids = match body.collaborator_ids {
        Some(ref ids) => Some(
            parse_and_validate_collaborators(&state.db, &task.org_id, ids).await?,
        ),
        None => None,
    };

    let updated = Task::update(
        &state.db,
        &task_oid,
        body.title.map(|t| t.trim().to_string()),
        body.description,
        body.url,
        new_status,
        drop_reason_override,
        body.color,
        new_assignee,
        new_collaborator_ids,
    )
    .await?
    .ok_or(ApiError::NotFound("task not found"))?;

    let api = task_to_api(&state.db, &updated, &user_id.0).await?;
    state.presence.broadcast(
        &updated.org_id.to_hex(),
        &json!({ "type": "task_updated", "payload": &api }).to_string(),
    );

    Ok(Json(api))
}

pub async fn reorder_task(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
    Path(task_id): Path<String>,
    Json(body): Json<ReorderRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let task_oid = parse_oid(&task_id)?;

    let task = Task::find_by_id(&state.db, &task_oid)
        .await?
        .ok_or(ApiError::NotFound("task not found"))?;

    OrgMember::find(&state.db, &task.org_id, &user_id.0)
        .await?
        .ok_or(ApiError::Unauthorized("unauthorized"))?;

    let before_oid = body.before_id.as_deref().map(parse_oid).transpose()?;
    let after_oid = body.after_id.as_deref().map(parse_oid).transpose()?;

    let new_position = Task::reorder(
        &state.db,
        &task_oid,
        before_oid.as_ref(),
        after_oid.as_ref(),
    )
    .await?
    .ok_or(ApiError::NotFound("task not found"))?;

    state.presence.broadcast(
        &task.org_id.to_hex(),
        &json!({
            "type": "task_reordered",
            "payload": {
                "id": task_oid.to_hex(),
                "position": new_position,
                "assignee_id": task.assignee_id.to_hex(),
            }
        })
        .to_string(),
    );

    Ok(StatusCode::NO_CONTENT)
}

pub async fn delete_task(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
    Path(task_id): Path<String>,
) -> Result<StatusCode, ApiError> {
    let task_oid = parse_oid(&task_id)?;

    let task = Task::find_by_id(&state.db, &task_oid)
        .await?
        .ok_or(ApiError::NotFound("task not found"))?;

    OrgMember::find(&state.db, &task.org_id, &user_id.0)
        .await?
        .ok_or(ApiError::Unauthorized("unauthorized"))?;

    let deleted = Task::delete(&state.db, &task_oid, &task.org_id).await?;
    if deleted {
        state.presence.broadcast(
            &task.org_id.to_hex(),
            &json!({ "type": "task_deleted", "payload": { "id": task_oid.to_hex() } }).to_string(),
        );
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(ApiError::NotFound("task not found"))
    }
}

pub async fn upvote_task(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
    Path(task_id): Path<String>,
) -> Result<Json<ApiTask>, ApiError> {
    let task_oid = parse_oid(&task_id)?;

    let task = Task::find_by_id(&state.db, &task_oid)
        .await?
        .ok_or(ApiError::NotFound("task not found"))?;

    OrgMember::find(&state.db, &task.org_id, &user_id.0)
        .await?
        .ok_or(ApiError::Unauthorized("unauthorized"))?;

    let updated = Task::add_upvote(&state.db, &task_oid, &user_id.0)
        .await?
        .ok_or(ApiError::NotFound("task not found"))?;

    let api = task_to_api(&state.db, &updated, &user_id.0).await?;
    state.presence.broadcast(
        &updated.org_id.to_hex(),
        &json!({ "type": "task_updated", "payload": &api }).to_string(),
    );

    Ok(Json(api))
}

pub async fn remove_upvote(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
    Path(task_id): Path<String>,
) -> Result<Json<ApiTask>, ApiError> {
    let task_oid = parse_oid(&task_id)?;

    let task = Task::find_by_id(&state.db, &task_oid)
        .await?
        .ok_or(ApiError::NotFound("task not found"))?;

    OrgMember::find(&state.db, &task.org_id, &user_id.0)
        .await?
        .ok_or(ApiError::Unauthorized("unauthorized"))?;

    let updated = Task::remove_upvote(&state.db, &task_oid, &user_id.0)
        .await?
        .ok_or(ApiError::NotFound("task not found"))?;

    let api = task_to_api(&state.db, &updated, &user_id.0).await?;
    state.presence.broadcast(
        &updated.org_id.to_hex(),
        &json!({ "type": "task_updated", "payload": &api }).to_string(),
    );

    Ok(Json(api))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Parse a list of string IDs as ObjectIds and verify each is an org member.
async fn parse_and_validate_collaborators(
    db: &mongodb::Database,
    org_id: &ObjectId,
    ids: &[String],
) -> Result<Vec<ObjectId>, ApiError> {
    let mut oids = Vec::with_capacity(ids.len());
    for s in ids {
        let oid = parse_oid(s)?;
        OrgMember::find(db, org_id, &oid)
            .await?
            .ok_or(ApiError::BadRequest("collaborator is not a member of this org"))?;
        oids.push(oid);
    }
    Ok(oids)
}
