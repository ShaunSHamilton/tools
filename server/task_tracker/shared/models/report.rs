use chrono::{DateTime, NaiveDate, Utc};
use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Report {
    #[serde(rename = "_id")]
    pub id: Uuid,
    pub user_id: ObjectId,
    pub org_id: Option<Uuid>,
    pub title: String,
    pub period_start: NaiveDate,
    pub period_end: NaiveDate,
    pub status: String,
    pub content_md: Option<String>,
    pub error_message: Option<String>,
    pub custom_instructions: Option<String>,
    pub share_token: Option<String>,
    pub generated_at: Option<DateTime<Utc>>,
    pub shared_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    /// Org IDs whose members can see this report.
    #[serde(default)]
    pub org_ids: Vec<Uuid>,
}

/// Lightweight representation for list views — omits the large `content_md` field.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportSummary {
    #[serde(rename = "_id")]
    pub id: Uuid,
    pub title: String,
    pub period_start: NaiveDate,
    pub period_end: NaiveDate,
    pub status: String,
    pub generated_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}
