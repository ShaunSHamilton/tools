use chrono::{DateTime, NaiveDate, Utc};
use reqwest::{Client, Response};
use serde::Deserialize;

use super::normalize::{self, NormalizedEvent};
use crate::task_tracker::worker::error::WorkerError;

#[derive(Debug, Deserialize)]
pub struct RawEvent {
    pub id: String,
    #[serde(rename = "type")]
    pub event_type: String,
    pub repo: RawRepo,
    pub payload: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct RawRepo {
    /// Full name in the form "owner/repo"
    pub name: String,
}

pub struct GithubClient {
    token: String,
    http: Client,
}

impl GithubClient {
    pub fn new(token: String, http: Client) -> Self {
        Self { token, http }
    }

    /// Fetch a single page of the authenticated user's events (public and private).
    /// Returns an empty vec on 304 Not Modified.
    pub async fn fetch_events_page(&self, username: &str, page: u32) -> Result<Vec<RawEvent>, WorkerError> {
        let url = format!(
            "https://api.github.com/users/{}/events?per_page=30&page={}",
            username, page
        );

        let response: Response = self
            .http
            .get(&url)
            .bearer_auth(&self.token)
            .header("User-Agent", "task-tracker/1.0")
            .header("Accept", "application/vnd.github.v3+json")
            .send()
            .await?;

        let status = response.status();

        if status.as_u16() == 304 {
            return Ok(vec![]);
        }

        // Surface rate-limit errors so apalis can retry with backoff
        if status.as_u16() == 429 || status.as_u16() == 403 {
            let reset_ts = response
                .headers()
                .get("X-RateLimit-Reset")
                .and_then(|v| v.to_str().ok())
                .and_then(|s| s.parse::<i64>().ok())
                .unwrap_or(0);
            let wait = (reset_ts - Utc::now().timestamp()).max(0);
            return Err(WorkerError::Message(format!("GitHub rate limit hit, retry after {}s", wait)));
        }

        if !status.is_success() {
            if status.as_u16() == 401 {
                return Err(WorkerError::Message(
                    "GitHub access token rejected (401) — token may be expired or revoked, please reconnect GitHub in settings".into(),
                ));
            }
            return Err(WorkerError::Message(format!("GitHub API returned {}", status)));
        }

        // Warn when rate limit budget is low
        if let Some(remaining) = response
            .headers()
            .get("X-RateLimit-Remaining")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse::<u32>().ok())
        {
            if remaining < 10 {
                tracing::warn!(remaining, "GitHub rate limit running low");
            }
        }

        let events = response.json::<Vec<RawEvent>>().await?;

        Ok(events)
    }

    /// Fetch all events within a date range by paginating the Events API.
    /// Events are returned newest-first so we stop as soon as we hit an event
    /// older than `period_start`. GitHub caps history at 10 pages (1000 events).
    pub async fn fetch_events_for_period(
        &self,
        username: &str,
        period_start: NaiveDate,
        period_end: NaiveDate,
    ) -> Result<Vec<NormalizedEvent>, WorkerError> {
        let mut results = Vec::new();

        for page in 1u32..=10 {
            let raw_events = self.fetch_events_page(username, page).await?;

            if raw_events.is_empty() {
                tracing::debug!("exiting because events are empty");
                break;
            }

            for raw in &raw_events {
                let date = raw.created_at.date_naive();
                tracing::debug!(page, %date);
                if date < period_start || date > period_end {
                    continue;
                }
                if let Some(event) = normalize::normalize(raw) {
                    results.push(event);
                }
            }

            // GitHub returns events newest-first across pages. Once every event on
            // this page is before our window start, subsequent pages will only have
            // older events so there is nothing left to fetch.
            if raw_events
                .iter()
                .all(|e| e.created_at.date_naive() < period_start)
            {
                tracing::debug!(start = %period_start, "exiting because all events before start");
                break;
            }
        }

        Ok(results)
    }
}
