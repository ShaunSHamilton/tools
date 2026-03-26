use axum::{
    Extension, Json,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
};
use futures::TryStreamExt;
use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::auth::ApiUser;
use crate::team_board::{
    app::AppState,
    error::ApiError,
    middleware::auth::UserId,
    models::{
        invitation::{Invitation, InvitationStatus},
        notification::{Notification, NotificationPayload},
        org::{Org, OrgMember, Role},
        user::User,
    },
};

// ── Request / response types ──────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CreateOrgRequest {
    pub name: String,
}

#[derive(Serialize)]
pub struct ApiOrg {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub created_by: String,
}

impl From<&Org> for ApiOrg {
    fn from(o: &Org) -> Self {
        ApiOrg {
            id: o.id.to_hex(),
            name: o.name.clone(),
            slug: o.slug.clone(),
            created_by: o.created_by.to_hex(),
        }
    }
}

#[derive(Serialize)]
pub struct ApiMember {
    pub user: ApiUser,
    pub role: String,
    pub joined_at: String,
}

#[derive(Serialize)]
pub struct OrgDetailResponse {
    pub org: ApiOrg,
    pub members: Vec<ApiMember>,
}

#[derive(Deserialize)]
pub struct InviteRequest {
    pub email: String,
}

#[derive(Deserialize)]
pub struct ChangeRoleRequest {
    pub role: String,
}

// ── Handlers ──────────────────────────────────────────────────────────────────

/// Create a new organisation. The creator becomes the first admin.
pub async fn create_org(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
    Json(body): Json<CreateOrgRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let name = body.name.trim().to_string();
    if name.is_empty() {
        return Err(ApiError::BadRequest("name is required"));
    }

    let org = Org::create(&state.db, name, user_id.0).await?;

    Ok((StatusCode::CREATED, Json(ApiOrg::from(&org))))
}

/// List all organisations the current user belongs to.
pub async fn list_orgs(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
) -> Result<Json<Vec<ApiOrg>>, ApiError> {
    let orgs = Org::find_for_user(&state.db, &user_id.0).await?;
    Ok(Json(orgs.iter().map(ApiOrg::from).collect()))
}

/// Get org details and full member list. Must be a member.
pub async fn get_org(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
    Path(org_id): Path<String>,
) -> Result<Json<OrgDetailResponse>, ApiError> {
    let org = require_org(&state, &org_id).await?;
    let requester = require_member(&state, &org.id, &user_id.0).await?;
    let requester_is_admin = requester.role == Role::Admin;

    let members =
        OrgMember::find_members_with_users(&state.db, &org.id, requester_is_admin).await?;

    Ok(Json(OrgDetailResponse {
        org: ApiOrg::from(&org),
        members,
    }))
}

/// Invite a user by email. Admin only.
pub async fn invite_member(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
    Path(org_id): Path<String>,
    Json(body): Json<InviteRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let org = require_org(&state, &org_id).await?;
    require_role(&state, &org.id, &user_id.0, Role::Admin).await?;

    let email = body.email.trim().to_lowercase();
    if email.is_empty() {
        return Err(ApiError::BadRequest("email is required"));
    }

    // Check the target isn't already a member
    if let Some(target) = User::find_by_email(&state.db, &email).await?
        && OrgMember::find(&state.db, &org.id, &target.id)
            .await?
            .is_some()
    {
        return Err(ApiError::BadRequest("user is already a member"));
    }

    // Check no pending invite already exists
    if Invitation::find_pending(&state.db, &org.id, &email)
        .await?
        .is_some()
    {
        return Err(ApiError::BadRequest("a pending invitation already exists"));
    }

    let inviter = User::find_by_id(&state.db, &user_id.0)
        .await?
        .ok_or_else(|| {
            tracing::error!(user_id = %user_id.0, "inviter user not found in db");
            ApiError::Internal
        })?;

    let invitation = Invitation::create(&state.db, org.id, email.clone(), user_id.0).await?;

    // If the target user already has an account, create a notification immediately
    if let Some(target) = User::find_by_email(&state.db, &email).await? {
        Notification::create(
            &state.db,
            target.id,
            NotificationPayload::OrgInvite {
                invitation_id: invitation.id,
                org_id: org.id,
                org_name: org.name.clone(),
                invited_by: inviter.name.clone(),
            },
        )
        .await?;
    }

    Ok(StatusCode::CREATED)
}

/// Remove a member from an org. Admin only. Cannot remove the last admin.
pub async fn remove_member(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
    Path((org_id, target_user_id)): Path<(String, String)>,
) -> Result<StatusCode, ApiError> {
    let org = require_org(&state, &org_id).await?;
    require_role(&state, &org.id, &user_id.0, Role::Admin).await?;

    let target_oid = parse_oid(&target_user_id)?;

    let target_member = OrgMember::find(&state.db, &org.id, &target_oid)
        .await?
        .ok_or(ApiError::NotFound("member not found"))?;

    // Prevent removing the last admin
    if target_member.role == Role::Admin {
        let admin_count = OrgMember::count_admins(&state.db, &org.id).await?;
        if admin_count <= 1 {
            return Err(ApiError::BadRequest("cannot remove the last admin"));
        }
    }

    OrgMember::remove(&state.db, &org.id, &target_oid).await?;

    state.presence.broadcast(
        &org.id.to_hex(),
        &json!({ "type": "member_removed", "payload": { "user_id": target_oid.to_hex() } })
            .to_string(),
    );

    Ok(StatusCode::NO_CONTENT)
}

/// Change a member's role. Admin only. Cannot demote the last admin.
pub async fn change_role(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
    Path((org_id, target_user_id)): Path<(String, String)>,
    Json(body): Json<ChangeRoleRequest>,
) -> Result<StatusCode, ApiError> {
    let org = require_org(&state, &org_id).await?;
    require_role(&state, &org.id, &user_id.0, Role::Admin).await?;

    let new_role = match body.role.as_str() {
        "admin" => Role::Admin,
        "member" => Role::Member,
        _ => return Err(ApiError::BadRequest("role must be 'admin' or 'member'")),
    };

    let target_oid = parse_oid(&target_user_id)?;

    // Prevent demoting the last admin
    if new_role == Role::Member {
        let target_member = OrgMember::find(&state.db, &org.id, &target_oid)
            .await?
            .ok_or(ApiError::NotFound("member not found"))?;

        if target_member.role == Role::Admin {
            let admin_count = OrgMember::count_admins(&state.db, &org.id).await?;
            if admin_count <= 1 {
                return Err(ApiError::BadRequest("cannot demote the last admin"));
            }
        }
    }

    OrgMember::set_role(&state.db, &org.id, &target_oid, new_role).await?;

    Ok(StatusCode::NO_CONTENT)
}

// ── Invitation list / cancel (admin) ─────────────────────────────────────────

#[derive(Serialize)]
pub struct ApiInvitation {
    pub id: String,
    pub invited_email: String,
    pub invited_by: String, // display name of inviter
    pub created_at: String,
}

/// List pending invitations for an org. Admin only.
pub async fn list_invitations(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
    Path(org_id): Path<String>,
) -> Result<Json<Vec<ApiInvitation>>, ApiError> {
    let org = require_org(&state, &org_id).await?;
    require_role(&state, &org.id, &user_id.0, Role::Admin).await?;

    let invitations =
        crate::team_board::models::invitation::Invitation::find_pending_for_org(&state.db, &org.id).await?;

    // Resolve inviter names in a single query
    let inviter_ids: Vec<_> = invitations.iter().map(|i| i.invited_by).collect();
    let inviters: Vec<User> = state
        .db
        .collection::<User>("users")
        .find(mongodb::bson::doc! { "_id": { "$in": &inviter_ids } })
        .await?
        .try_collect()
        .await?;

    let api = invitations
        .iter()
        .map(|inv| {
            let name = inviters
                .iter()
                .find(|u| u.id == inv.invited_by)
                .map(|u| u.name.clone())
                .unwrap_or_else(|| "Unknown".into());
            ApiInvitation {
                id: inv.id.to_hex(),
                invited_email: inv.invited_email.clone(),
                invited_by: name,
                created_at: inv.created_at.to_string(),
            }
        })
        .collect();

    Ok(Json(api))
}

/// Cancel (delete) a pending invitation. Admin only.
pub async fn cancel_invitation(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
    Path((org_id, invite_id)): Path<(String, String)>,
) -> Result<StatusCode, ApiError> {
    let org = require_org(&state, &org_id).await?;
    require_role(&state, &org.id, &user_id.0, Role::Admin).await?;

    let invite_oid = parse_oid(&invite_id)?;
    let invite = crate::team_board::models::invitation::Invitation::find_by_id(&state.db, &invite_oid)
        .await?
        .ok_or(ApiError::NotFound("invitation not found"))?;

    if invite.org_id != org.id {
        return Err(ApiError::NotFound("invitation not found"));
    }

    crate::team_board::models::invitation::Invitation::delete(&state.db, &invite_oid).await?;

    Ok(StatusCode::NO_CONTENT)
}

// ── Invitation handlers ───────────────────────────────────────────────────────

pub async fn accept_invite(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
    Path(invite_id): Path<String>,
) -> Result<StatusCode, ApiError> {
    let invite_oid = parse_oid(&invite_id)?;
    let invite = Invitation::find_by_id(&state.db, &invite_oid)
        .await?
        .ok_or(ApiError::NotFound("invitation not found"))?;

    if invite.status != InvitationStatus::Pending {
        return Err(ApiError::BadRequest("invitation is no longer pending"));
    }

    // Verify the current user's email matches the invitation
    let user = User::find_by_id(&state.db, &user_id.0)
        .await?
        .ok_or_else(|| {
            tracing::error!(user_id = %user_id.0, "user not found in db during invite accept");
            ApiError::Internal
        })?;

    if user.email != invite.invited_email {
        return Err(ApiError::Unauthorized("unauthorized"));
    }

    OrgMember::add(&state.db, invite.org_id, user_id.0, Role::Member).await?;
    Invitation::set_status(&state.db, &invite_oid, InvitationStatus::Accepted).await?;

    // Broadcast the new member to all connections in the org.
    // Emails are hidden in the broadcast payload (requester_is_admin = false) because
    // the WebSocket message is fanned out to every connected client regardless of role.
    let members = OrgMember::find_members_with_users(&state.db, &invite.org_id, false).await?;
    if let Some(new_member) = members.iter().find(|m| m.user.id == user_id.0.to_hex()) {
        state.presence.broadcast(
            &invite.org_id.to_hex(),
            &json!({ "type": "member_added", "payload": new_member }).to_string(),
        );
    }

    Ok(StatusCode::NO_CONTENT)
}

pub async fn decline_invite(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
    Path(invite_id): Path<String>,
) -> Result<StatusCode, ApiError> {
    let invite_oid = parse_oid(&invite_id)?;
    let invite = Invitation::find_by_id(&state.db, &invite_oid)
        .await?
        .ok_or(ApiError::NotFound("invitation not found"))?;

    if invite.status != InvitationStatus::Pending {
        return Err(ApiError::BadRequest("invitation is no longer pending"));
    }

    let user = User::find_by_id(&state.db, &user_id.0)
        .await?
        .ok_or_else(|| {
            tracing::error!(user_id = %user_id.0, "user not found in db during invite decline");
            ApiError::Internal
        })?;

    if user.email != invite.invited_email {
        return Err(ApiError::Unauthorized("unauthorized"));
    }

    Invitation::set_status(&state.db, &invite_oid, InvitationStatus::Declined).await?;

    Ok(StatusCode::NO_CONTENT)
}

// ── Notification handlers ─────────────────────────────────────────────────────

pub async fn list_notifications(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
) -> Result<Json<Vec<serde_json::Value>>, ApiError> {
    let notifications = Notification::find_for_user(&state.db, &user_id.0).await?;
    Ok(Json(notifications))
}

pub async fn mark_notification_read(
    State(state): State<AppState>,
    Extension(user_id): Extension<UserId>,
    Path(notif_id): Path<String>,
) -> Result<StatusCode, ApiError> {
    let notif_oid = parse_oid(&notif_id)?;
    // Scoped by user_id to prevent marking another user's notification
    Notification::mark_read(&state.db, &notif_oid, &user_id.0).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── Guard helpers ─────────────────────────────────────────────────────────────

pub async fn require_org(state: &AppState, org_id: &str) -> Result<Org, ApiError> {
    let oid = parse_oid(org_id)?;
    Org::find_by_id(&state.db, &oid)
        .await?
        .ok_or(ApiError::NotFound("organisation not found"))
}

async fn require_member(
    state: &AppState,
    org_id: &mongodb::bson::oid::ObjectId,
    user_id: &mongodb::bson::oid::ObjectId,
) -> Result<OrgMember, ApiError> {
    OrgMember::find(&state.db, org_id, user_id)
        .await?
        .ok_or(ApiError::Unauthorized("unauthorized"))
}

async fn require_role(
    state: &AppState,
    org_id: &mongodb::bson::oid::ObjectId,
    user_id: &mongodb::bson::oid::ObjectId,
    required: Role,
) -> Result<(), ApiError> {
    let member = require_member(state, org_id, user_id).await?;
    if member.role != required {
        return Err(ApiError::Unauthorized("unauthorized"));
    }
    Ok(())
}

pub fn parse_oid(s: &str) -> Result<mongodb::bson::oid::ObjectId, ApiError> {
    s.parse().map_err(|_| ApiError::BadRequest("invalid id"))
}
