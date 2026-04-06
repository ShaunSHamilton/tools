use chrono::{DateTime, Utc};
use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GithubConnection {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub user_id: ObjectId,
    pub github_user_id: i64,
    pub github_username: String,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub token_expires_at: Option<DateTime<Utc>>,
    pub refresh_token_expires_at: Option<DateTime<Utc>>,
    pub scopes: Option<Vec<String>>,
    pub connected_at: DateTime<Utc>,
}

/// Safe public representation — no access_token.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GithubConnectionDto {
    pub github_username: String,
    pub scopes: Vec<String>,
    pub connected_at: DateTime<Utc>,
}

impl From<GithubConnection> for GithubConnectionDto {
    fn from(c: GithubConnection) -> Self {
        GithubConnectionDto {
            github_username: c.github_username,
            scopes: c.scopes.unwrap_or_default(),
            connected_at: c.connected_at,
        }
    }
}
