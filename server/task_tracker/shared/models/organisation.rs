use chrono::{DateTime, NaiveDate, Utc};
use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Organisation {
    #[serde(rename = "_id")]
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub created_at: DateTime<Utc>,
}

/// A membership document linking a user to an org.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrgMembership {
    #[serde(rename = "_id")]
    pub id: Uuid,
    pub org_id: Uuid,
    pub user_id: ObjectId,
    pub role: String,
    pub invited_by: Option<ObjectId>,
    pub created_at: DateTime<Utc>,
}

/// An invite document.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrgInvite {
    #[serde(rename = "_id")]
    pub id: Uuid,
    pub org_id: Uuid,
    pub email: String,
    pub token: String,
    pub invited_by: ObjectId,
    pub expires_at: DateTime<Utc>,
    pub accepted_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// Joined view: org_memberships + team_board users columns
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrgMemberView {
    pub user_id: ObjectId,
    pub email: String,
    pub name: String,
    pub picture: Option<String>,
    pub role: String,
    pub joined_at: DateTime<Utc>,
}

/// Report summary enriched with author name, used in org report listings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrgReportSummary {
    pub id: String,
    pub title: String,
    pub period_start: NaiveDate,
    pub period_end: NaiveDate,
    pub status: String,
    pub generated_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub author_name: String,
}
