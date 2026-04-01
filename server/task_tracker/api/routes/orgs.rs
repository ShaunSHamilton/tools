use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{Duration, Utc};
use futures_util::TryStreamExt;
use mongodb::{bson::doc, Database};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::task_tracker::shared::{
    error::AppError,
    models::{
        organisation::{OrgInvite, OrgMemberView, OrgMembership, OrgReportSummary, Organisation},
        report::Report,
    },
};
use crate::team_board::models::user::User;

use crate::task_tracker::api::{error::ApiError, middleware::auth::AuthUser, router::AppState};

// ─── Slug helpers ─────────────────────────────────────────────────────────────

fn slugify(name: &str) -> String {
    name.trim()
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

async fn unique_slug(db: &Database, name: &str) -> anyhow::Result<String> {
    let base = slugify(name);
    if base.is_empty() {
        anyhow::bail!("name produces an empty slug");
    }

    let orgs = db.collection::<Organisation>("organisations");

    let exists = orgs
        .find_one(doc! { "slug": &base })
        .await?
        .is_some();

    if !exists {
        return Ok(base);
    }

    for i in 2i32..=99 {
        let candidate = format!("{base}-{i}");
        let exists = orgs
            .find_one(doc! { "slug": &candidate })
            .await?
            .is_some();
        if !exists {
            return Ok(candidate);
        }
    }

    anyhow::bail!("could not generate a unique slug for '{name}'")
}

// ─── Create org ───────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct CreateOrgRequest {
    pub name: String,
}

pub async fn create(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(req): Json<CreateOrgRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let name = req.name.trim().to_owned();
    if name.is_empty() || name.len() > 100 {
        return Err(AppError::BadRequest("name must be 1–100 characters".into()).into());
    }

    let slug = unique_slug(&state.db, &name).await?;
    let now = Utc::now();

    let org = Organisation {
        id: Uuid::new_v4(),
        name,
        slug,
        created_at: now,
    };

    let orgs = state.db.collection::<Organisation>("organisations");
    orgs.insert_one(&org).await?;

    let membership = OrgMembership {
        id: Uuid::new_v4(),
        org_id: org.id,
        user_id: auth.user_id,
        role: "admin".to_string(),
        invited_by: None,
        created_at: now,
    };

    let memberships = state.db.collection::<OrgMembership>("org_memberships");
    memberships.insert_one(&membership).await?;

    Ok((StatusCode::CREATED, Json(org)))
}

// ─── List orgs ────────────────────────────────────────────────────────────────

pub async fn list(
    State(state): State<AppState>,
    auth: AuthUser,
) -> Result<impl IntoResponse, ApiError> {
    let memberships = state.db.collection::<OrgMembership>("org_memberships");
    let orgs_coll = state.db.collection::<Organisation>("organisations");

    // Find all org_ids the user belongs to
    let cursor = memberships
        .find(doc! { "user_id": auth.user_id })
        .await?;
    let member_docs: Vec<OrgMembership> = cursor.try_collect().await?;
    let org_ids: Vec<_> = member_docs.iter().map(|m| bson::serialize_to_bson(&m.org_id).unwrap()).collect();

    if org_ids.is_empty() {
        return Ok(Json(json!({ "orgs": Vec::<Organisation>::new() })));
    }

    let cursor = orgs_coll
        .find(doc! { "_id": { "$in": &org_ids } })
        .sort(doc! { "name": 1 })
        .await?;
    let orgs: Vec<Organisation> = cursor.try_collect().await?;

    Ok(Json(json!({ "orgs": orgs })))
}

// ─── Org detail (members) ─────────────────────────────────────────────────────

pub async fn detail(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(slug): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let orgs = state.db.collection::<Organisation>("organisations");
    let memberships = state.db.collection::<OrgMembership>("org_memberships");
    let users_coll = state.tb_db.collection::<User>("users");

    // Find the org by slug
    let org = orgs
        .find_one(doc! { "slug": &slug })
        .await?
        .ok_or(AppError::NotFound)?;

    // Verify caller is a member
    let caller_membership = memberships
        .find_one(doc! {
            "org_id": bson::serialize_to_bson(&org.id).unwrap(),
            "user_id": auth.user_id,
        })
        .await?
        .ok_or(AppError::NotFound)?;

    // Get all memberships for this org
    let cursor = memberships
        .find(doc! { "org_id": bson::serialize_to_bson(&org.id).unwrap() })
        .sort(doc! { "created_at": 1 })
        .await?;
    let all_memberships: Vec<OrgMembership> = cursor.try_collect().await?;

    // Fetch all member users
    let user_ids: Vec<_> = all_memberships.iter().map(|m| bson::serialize_to_bson(&m.user_id).unwrap()).collect();
    let cursor = users_coll
        .find(doc! { "_id": { "$in": &user_ids } })
        .await?;
    let all_users: Vec<User> = cursor.try_collect().await?;

    // Build member views by joining in code
    let members: Vec<OrgMemberView> = all_memberships
        .iter()
        .filter_map(|m| {
            let user = all_users.iter().find(|u| u.id == m.user_id)?;
            Some(OrgMemberView {
                user_id: user.id,
                email: user.email.clone(),
                name: user.name.clone(),
                picture: user.picture.clone(),
                role: m.role.clone(),
                joined_at: m.created_at,
            })
        })
        .collect();

    let caller_role = caller_membership.role;

    Ok(Json(json!({
        "org": org,
        "members": members,
        "caller_role": caller_role,
    })))
}

// ─── Invite member ────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct InviteRequest {
    pub email: String,
}

pub async fn invite(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(slug): Path<String>,
    Json(req): Json<InviteRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let email_addr = req.email.trim().to_lowercase();
    if !email_addr.contains('@') || email_addr.len() > 254 {
        return Err(AppError::BadRequest("invalid email address".into()).into());
    }

    let orgs = state.db.collection::<Organisation>("organisations");
    let memberships = state.db.collection::<OrgMembership>("org_memberships");

    // Verify caller is an admin of this org
    let org = orgs
        .find_one(doc! { "slug": &slug })
        .await?
        .ok_or(AppError::Forbidden)?;

    let admin_membership = memberships
        .find_one(doc! {
            "org_id": bson::serialize_to_bson(&org.id).unwrap(),
            "user_id": auth.user_id,
            "role": "admin",
        })
        .await?
        .ok_or(AppError::Forbidden)?;
    let _ = admin_membership; // used for verification

    // Generate a 32-char URL-safe token
    let token = Uuid::new_v4().simple().to_string();
    let expires_at = Utc::now() + Duration::days(7);
    let now = Utc::now();

    let invite_doc = OrgInvite {
        id: Uuid::new_v4(),
        org_id: org.id,
        email: email_addr.clone(),
        token: token.clone(),
        invited_by: auth.user_id,
        expires_at,
        accepted_at: None,
        created_at: now,
    };

    let invites = state.db.collection::<OrgInvite>("org_invites");
    invites.insert_one(&invite_doc).await?;

    Ok(StatusCode::NO_CONTENT)
}

// ─── Accept invite ────────────────────────────────────────────────────────────

pub async fn accept_invite(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(token): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let invites = state.db.collection::<OrgInvite>("org_invites");

    let invite = invites
        .find_one(doc! { "token": &token })
        .await?
        .ok_or(AppError::NotFound)?;

    if invite.accepted_at.is_some() {
        return Err(AppError::BadRequest("invite already accepted".into()).into());
    }
    if invite.expires_at < Utc::now() {
        return Err(AppError::BadRequest("invite has expired".into()).into());
    }

    let memberships = state.db.collection::<OrgMembership>("org_memberships");

    // Insert membership if not already exists
    let existing = memberships
        .find_one(doc! {
            "org_id": bson::serialize_to_bson(&invite.org_id).unwrap(),
            "user_id": auth.user_id,
        })
        .await?;

    if existing.is_none() {
        let now = Utc::now();
        let membership = OrgMembership {
            id: Uuid::new_v4(),
            org_id: invite.org_id,
            user_id: auth.user_id,
            role: "member".to_string(),
            invited_by: Some(invite.invited_by),
            created_at: now,
        };
        memberships.insert_one(&membership).await?;
    }

    // Mark invite as accepted
    let now = Utc::now();
    invites
        .update_one(
            doc! { "_id": bson::serialize_to_bson(&invite.id).unwrap() },
            doc! { "$set": { "accepted_at": bson::serialize_to_bson(&now).unwrap() } },
        )
        .await?;

    let orgs = state.db.collection::<Organisation>("organisations");
    let org = orgs
        .find_one(doc! { "_id": bson::serialize_to_bson(&invite.org_id).unwrap() })
        .await?
        .ok_or(AppError::Internal(anyhow::anyhow!("org not found")))?;

    Ok(Json(org))
}

// ─── Org report listing ───────────────────────────────────────────────────────

pub async fn list_reports(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(slug): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let orgs = state.db.collection::<Organisation>("organisations");
    let memberships = state.db.collection::<OrgMembership>("org_memberships");

    // Find org by slug
    let org = orgs
        .find_one(doc! { "slug": &slug })
        .await?
        .ok_or(AppError::NotFound)?;

    // Verify membership
    let membership = memberships
        .find_one(doc! {
            "org_id": bson::serialize_to_bson(&org.id).unwrap(),
            "user_id": auth.user_id,
        })
        .await?
        .ok_or(AppError::NotFound)?;
    let _ = membership;

    // Find reports that have this org_id in their org_ids array
    let reports_coll = state.db.collection::<Report>("reports");
    let users_coll = state.tb_db.collection::<User>("users");

    let cursor = reports_coll
        .find(doc! { "org_ids": bson::serialize_to_bson(&org.id).unwrap() })
        .sort(doc! { "created_at": -1 })
        .limit(100)
        .await?;
    let reports: Vec<Report> = cursor.try_collect().await?;

    // Fetch authors
    let author_ids: Vec<_> = reports.iter().map(|r| bson::serialize_to_bson(&r.user_id).unwrap()).collect();
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
