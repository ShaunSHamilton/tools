use anyhow::Context;
use mongodb::{bson::doc, Database};
use reqwest::Client;
use std::sync::Arc;
use tracing::{error, info};

use crate::task_tracker::shared::{
    jobs::report_generation::ReportGenerationJob,
    models::{github_connection::GithubConnection, report::Report},
};
use crate::team_board::models::{
    notification::{Notification, NotificationPayload},
    user::User,
};

use crate::task_tracker::worker::{
    github::client::GithubClient,
    report::{
        anthropic::AnthropicProvider,
        generator::{EventSummary, ReportContext, ReportGenerator},
    },
};

pub struct ReportWorkerState {
    pub db: Database,
    pub tb_db: Database,
    pub anthropic: AnthropicProvider,
    pub http: Client,
}

pub async fn handle(
    job: ReportGenerationJob,
    state: Arc<ReportWorkerState>,
) -> Result<(), anyhow::Error> {
    let report_id = job.report_id;
    info!(%report_id, "starting report generation");

    let reports = state.db.collection::<Report>("reports");
    let now = chrono::Utc::now();

    reports
        .update_one(
            doc! { "_id": report_id },
            doc! { "$set": { "status": "generating", "updated_at": bson::serialize_to_bson(&now).unwrap() } },
        )
        .await
        .context("setting report status to generating")?;

    match run_generation(report_id, &state.db, &state.tb_db, &state.anthropic, &state.http).await {
        Ok((content_md, user_id, report_title)) => {
            let now = chrono::Utc::now();
            reports
                .update_one(
                    doc! { "_id": report_id },
                    doc! { "$set": {
                        "status": "completed",
                        "content_md": &content_md,
                        "generated_at": bson::serialize_to_bson(&now).unwrap(),
                        "updated_at": bson::serialize_to_bson(&now).unwrap(),
                    }},
                )
                .await
                .context("saving completed report")?;

            info!(%report_id, "report generation completed");

            let tb_db = state.tb_db.clone();
            tokio::spawn(async move {
                if let Err(e) = Notification::create(
                    &tb_db,
                    user_id,
                    NotificationPayload::ReportGenerated {
                        report_id,
                        report_title,
                    },
                )
                .await
                {
                    error!(%report_id, error = %e, "failed to create report generated notification");
                }
            });
        }
        Err(e) => {
            error!(%report_id, error = %e, "report generation failed");

            let msg = e.to_string();
            let now = chrono::Utc::now();
            reports
                .update_one(
                    doc! { "_id": report_id },
                    doc! { "$set": {
                        "status": "failed",
                        "error_message": &msg,
                        "updated_at": bson::serialize_to_bson(&now).unwrap(),
                    }},
                )
                .await
                .context("saving failed report status")?;
        }
    }

    // Always return Ok — failures are surfaced via the report's status field.
    Ok(())
}

async fn run_generation(
    report_id: mongodb::bson::oid::ObjectId,
    db: &Database,
    tb_db: &Database,
    anthropic: &AnthropicProvider,
    http: &Client,
) -> anyhow::Result<(String, mongodb::bson::oid::ObjectId, String)> {
    let reports = db.collection::<Report>("reports");
    let report = reports
        .find_one(doc! { "_id": report_id })
        .await
        .context("fetching report")?
        .ok_or_else(|| anyhow::anyhow!("report {} not found", report_id))?;

    let user_id = report.user_id;
    let report_title = report.title.clone();

    let user = User::find_by_id(tb_db, &report.user_id)
        .await
        .context("fetching user")?
        .ok_or_else(|| anyhow::anyhow!("user not found"))?;

    let display_name = user.name;

    // Fetch GitHub events on-demand for the report period
    let github_connections = db.collection::<GithubConnection>("github_connections");
    let events = match github_connections
        .find_one(doc! { "user_id": report.user_id })
        .await
        .context("fetching github connection")?
    {
        Some(conn) => {
            let client = GithubClient::new(conn.access_token, http.clone());
            client
                .fetch_events_for_period(
                    &conn.github_username,
                    report.period_start,
                    report.period_end,
                )
                .await
                .context("fetching github events for period")?
                .into_iter()
                .map(|e| EventSummary {
                    event_type: e.event_type,
                    repo_full_name: e.repo_full_name,
                    title: e.title,
                    occurred_at: e.occurred_at,
                })
                .collect()
        }
        None => vec![],
    };

    let ctx = ReportContext {
        user_display_name: display_name,
        period_start: report.period_start,
        period_end: report.period_end,
        events,
        custom_instructions: report.custom_instructions,
    };

    let content_md = anthropic.generate(&ctx).await?;
    Ok((content_md, user_id, report_title))
}
