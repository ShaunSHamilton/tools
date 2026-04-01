use chrono::{DateTime, NaiveDate, Utc};

/// All the information the report generator needs about a single GitHub event.
pub struct EventSummary {
    pub event_type: String,
    pub repo_full_name: String,
    pub title: Option<String>,
    /// Retained for future prompt enrichment (e.g. ordering events by date).
    #[allow(dead_code)]
    pub occurred_at: DateTime<Utc>,
}

/// Input context passed to a `ReportGenerator` implementation.
pub struct ReportContext {
    pub user_display_name: String,
    pub period_start: NaiveDate,
    pub period_end: NaiveDate,
    pub events: Vec<EventSummary>,
    /// When `Some`, replaces the default structured-sections prompt.
    pub custom_instructions: Option<String>,
}

pub trait ReportGenerator: Send + Sync {
    #[allow(async_fn_in_trait)]
    async fn generate(&self, ctx: &ReportContext) -> anyhow::Result<String>;
}
