use axum::{
    Extension, Json,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
};
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
            notification::{Notification, NotificationPayload},
            org::OrgMember,
            suggestion::Suggestion,
            task::Task,
            user::User,
        },
        routes::orgs::parse_oid,
    },
};

// ── Request / response types ──────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CreateSuggestionRequest {
    pub content: String,
}

#[derive(Deserialize)]
pub struct ReorderSuggestionRequest {
    pub before_id: Option<String>,
    pub after_id: Option<String>,
}

#[derive(Serialize)]
pub struct ApiSuggestion {
    pub id: String,
    pub task_id: String,
    pub org_id: String,
    pub created_by: String,
    pub content: String,
    pub vote_count: i32,
    pub user_has_voted: bool,
    pub dismissed: bool,
    pub position: String,
    pub author: ApiUser,
    pub created_at: String,
    pub updated_at: String,
}

async fn suggestion_to_api(
    db: &mongodb::Database,
    suggestion: &Suggestion,
    user_id: &ObjectId,
) -> Result<ApiSuggestion, ApiError> {
    let author = db
        .collection::<User>("users")
        .find_one(mongodb::bson::doc! { "_id": suggestion.created_by })
        .await?
        .map(|u| ApiUser::without_email(&u))
        .ok_or(ApiError::Internal("internal server error".into()))?;

    Ok(ApiSuggestion {
        id: suggestion.id.to_hex(),
        task_id: suggestion.task_id.to_hex(),
        org_id: suggestion.org_id.to_hex(),
        created_by: suggestion.created_by.to_hex(),
        content: suggestion.content.clone(),
        vote_count: suggestion.votes.len() as i32,
        user_has_voted: suggestion.votes.contains(user_id),
        dismissed: suggestion.dismissed,
        position: suggestion.position.clone(),
        author,
        created_at: suggestion.created_at.to_string(),
        updated_at: suggestion.updated_at.to_string(),
    })
}

// ── Handlers ──────────────────────────────────────────────────────────────────

pub async fn create_suggestion(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
    Path(task_id): Path<String>,
    Json(body): Json<CreateSuggestionRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let task_oid = parse_oid(&task_id)?;

    let task = Task::find_by_id(&state.db, &task_oid)
        .await?
        .ok_or(ApiError::NotFound("task not found".into()))?;

    OrgMember::find(&state.db, &task.org_id, &user_id.0)
        .await?
        .ok_or(ApiError::Unauthorized("unauthorized".into()))?;

    let content = body.content.trim().to_string();
    if content.is_empty() {
        return Err(ApiError::BadRequest("content is required".into()));
    }
    if content.chars().count() > 50 {
        return Err(ApiError::BadRequest("content must be 50 characters or fewer".into()));
    }

    let suggestion = Suggestion::create(
        &state.db,
        task_oid,
        task.org_id.clone(),
        user_id.0,
        content,
    )
    .await?;

    let api = suggestion_to_api(&state.db, &suggestion, &user_id.0).await?;
    state.presence.broadcast(
        &task.org_id.to_hex(),
        &json!({ "type": "suggestion_created", "payload": &api }).to_string(),
    );

    // Notify the task assignee if someone else added a suggestion
    if user_id.0 != task.assignee_id {
        let db = state.db.clone();
        let presence = state.presence.clone();
        let org_id_hex = task.org_id.to_hex();
        let assignee_id = task.assignee_id;
        let task_id = task.id;
        let task_title = task.title.clone();
        let suggestion_content = suggestion.content.clone();
        let suggester_id = user_id.0;
        tokio::spawn(async move {
            let suggested_by = User::find_by_id(&db, &suggester_id)
                .await
                .ok()
                .flatten()
                .map(|u| u.name)
                .unwrap_or_else(|| "someone".to_string());
            match Notification::create(
                &db,
                assignee_id,
                NotificationPayload::SuggestionAdded {
                    task_id,
                    task_title,
                    suggestion_content,
                    suggested_by,
                },
            )
            .await
            {
                Ok(_) => {
                    let msg = serde_json::json!({ "type": "notification" }).to_string();
                    presence.send_to_user(&org_id_hex, &assignee_id, &msg);
                }
                Err(e) => tracing::error!(error = %e, "failed to create SuggestionAdded notification"),
            }
        });
    }

    Ok((StatusCode::CREATED, Json(api)))
}

pub async fn list_suggestions(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
    Path(task_id): Path<String>,
) -> Result<Json<Vec<ApiSuggestion>>, ApiError> {
    let task_oid = parse_oid(&task_id)?;

    let task = Task::find_by_id(&state.db, &task_oid)
        .await?
        .ok_or(ApiError::NotFound("task not found".into()))?;

    OrgMember::find(&state.db, &task.org_id, &user_id.0)
        .await?
        .ok_or(ApiError::Unauthorized("unauthorized".into()))?;

    let suggestions = Suggestion::find_by_task(&state.db, &task_oid).await?;
    let mut api_suggestions = Vec::with_capacity(suggestions.len());
    for s in &suggestions {
        api_suggestions.push(suggestion_to_api(&state.db, s, &user_id.0).await?);
    }
    Ok(Json(api_suggestions))
}

pub async fn delete_suggestion(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
    Path(suggestion_id): Path<String>,
) -> Result<StatusCode, ApiError> {
    let suggestion_oid = parse_oid(&suggestion_id)?;

    let suggestion = Suggestion::find_by_id(&state.db, &suggestion_oid)
        .await?
        .ok_or(ApiError::NotFound("suggestion not found".into()))?;

    let task = Task::find_by_id(&state.db, &suggestion.task_id)
        .await?
        .ok_or(ApiError::NotFound("task not found".into()))?;

    // Only the suggestion author or the task assignee (owner) can delete
    let is_author = suggestion.created_by == user_id.0;
    let is_task_owner = task.assignee_id == user_id.0;
    if !is_author && !is_task_owner {
        return Err(ApiError::Unauthorized("unauthorized".into()));
    }

    let deleted = Suggestion::delete(&state.db, &suggestion_oid).await?;
    if deleted {
        state.presence.broadcast(
            &task.org_id.to_hex(),
            &json!({
                "type": "suggestion_deleted",
                "payload": { "id": suggestion_oid.to_hex(), "task_id": task.id.to_hex() }
            })
            .to_string(),
        );
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(ApiError::NotFound("suggestion not found".into()))
    }
}

pub async fn dismiss_suggestion(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
    Path(suggestion_id): Path<String>,
) -> Result<Json<ApiSuggestion>, ApiError> {
    let suggestion_oid = parse_oid(&suggestion_id)?;

    let suggestion = Suggestion::find_by_id(&state.db, &suggestion_oid)
        .await?
        .ok_or(ApiError::NotFound("suggestion not found".into()))?;

    let task = Task::find_by_id(&state.db, &suggestion.task_id)
        .await?
        .ok_or(ApiError::NotFound("task not found".into()))?;

    // Only the task assignee (owner) can dismiss
    if task.assignee_id != user_id.0 {
        return Err(ApiError::Unauthorized("only the task owner can dismiss suggestions".into()));
    }

    let updated = Suggestion::set_dismissed(&state.db, &suggestion_oid, !suggestion.dismissed)
        .await?
        .ok_or(ApiError::NotFound("suggestion not found".into()))?;

    let api = suggestion_to_api(&state.db, &updated, &user_id.0).await?;
    state.presence.broadcast(
        &task.org_id.to_hex(),
        &json!({ "type": "suggestion_updated", "payload": &api }).to_string(),
    );

    Ok(Json(api))
}

pub async fn vote_suggestion(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
    Path(suggestion_id): Path<String>,
) -> Result<Json<ApiSuggestion>, ApiError> {
    let suggestion_oid = parse_oid(&suggestion_id)?;

    let suggestion = Suggestion::find_by_id(&state.db, &suggestion_oid)
        .await?
        .ok_or(ApiError::NotFound("suggestion not found".into()))?;

    let task = Task::find_by_id(&state.db, &suggestion.task_id)
        .await?
        .ok_or(ApiError::NotFound("task not found".into()))?;

    OrgMember::find(&state.db, &task.org_id, &user_id.0)
        .await?
        .ok_or(ApiError::Unauthorized("unauthorized".into()))?;

    let updated = Suggestion::add_vote(&state.db, &suggestion_oid, &user_id.0)
        .await?
        .ok_or(ApiError::NotFound("suggestion not found".into()))?;

    let api = suggestion_to_api(&state.db, &updated, &user_id.0).await?;
    state.presence.broadcast(
        &task.org_id.to_hex(),
        &json!({ "type": "suggestion_updated", "payload": &api }).to_string(),
    );

    Ok(Json(api))
}

pub async fn remove_vote_suggestion(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
    Path(suggestion_id): Path<String>,
) -> Result<Json<ApiSuggestion>, ApiError> {
    let suggestion_oid = parse_oid(&suggestion_id)?;

    let suggestion = Suggestion::find_by_id(&state.db, &suggestion_oid)
        .await?
        .ok_or(ApiError::NotFound("suggestion not found".into()))?;

    let task = Task::find_by_id(&state.db, &suggestion.task_id)
        .await?
        .ok_or(ApiError::NotFound("task not found".into()))?;

    OrgMember::find(&state.db, &task.org_id, &user_id.0)
        .await?
        .ok_or(ApiError::Unauthorized("unauthorized".into()))?;

    let updated = Suggestion::remove_vote(&state.db, &suggestion_oid, &user_id.0)
        .await?
        .ok_or(ApiError::NotFound("suggestion not found".into()))?;

    let api = suggestion_to_api(&state.db, &updated, &user_id.0).await?;
    state.presence.broadcast(
        &task.org_id.to_hex(),
        &json!({ "type": "suggestion_updated", "payload": &api }).to_string(),
    );

    Ok(Json(api))
}

pub async fn reorder_suggestion(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
    Path(suggestion_id): Path<String>,
    Json(body): Json<ReorderSuggestionRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let suggestion_oid = parse_oid(&suggestion_id)?;

    let suggestion = Suggestion::find_by_id(&state.db, &suggestion_oid)
        .await?
        .ok_or(ApiError::NotFound("suggestion not found".into()))?;

    let task = Task::find_by_id(&state.db, &suggestion.task_id)
        .await?
        .ok_or(ApiError::NotFound("task not found".into()))?;

    // Only the task assignee (owner) can reorder
    if task.assignee_id != user_id.0 {
        return Err(ApiError::Unauthorized("only the task owner can reorder suggestions".into()));
    }

    let before_oid = body.before_id.as_deref().map(parse_oid).transpose()?;
    let after_oid = body.after_id.as_deref().map(parse_oid).transpose()?;

    let new_position = Suggestion::reorder(
        &state.db,
        &suggestion_oid,
        before_oid.as_ref(),
        after_oid.as_ref(),
    )
    .await?
    .ok_or(ApiError::NotFound("suggestion not found".into()))?;

    state.presence.broadcast(
        &task.org_id.to_hex(),
        &json!({
            "type": "suggestion_reordered",
            "payload": {
                "id": suggestion_oid.to_hex(),
                "task_id": task.id.to_hex(),
                "position": new_position,
            }
        })
        .to_string(),
    );

    Ok(StatusCode::NO_CONTENT)
}
