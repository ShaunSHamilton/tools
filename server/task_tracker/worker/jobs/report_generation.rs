use anyhow::Context;
use chrono::Utc;
use mongodb::{bson::doc, Database};
use reqwest::Client;
use serde::Deserialize;
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
    pub github_client_id: String,
    pub github_client_secret: String,
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

    match run_generation(report_id, &state.db, &state.tb_db, &state.anthropic, &state.http, &state.github_client_id, &state.github_client_secret).await {
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
    github_client_id: &str,
    github_client_secret: &str,
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
            let access_token = if should_refresh(&conn) {
                refresh_github_token(&conn, db, http, github_client_id, github_client_secret)
                    .await
                    .context("refreshing GitHub token")?
            } else {
                conn.access_token.clone()
            };
            let client = GithubClient::new(access_token, http.clone());
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

fn should_refresh(conn: &GithubConnection) -> bool {
    conn.token_expires_at
        .map(|exp| exp - chrono::Duration::minutes(5) <= Utc::now())
        .unwrap_or(false)
}

async fn refresh_github_token(
    conn: &GithubConnection,
    db: &Database,
    http: &Client,
    client_id: &str,
    client_secret: &str,
) -> anyhow::Result<String> {
    if let Some(exp) = conn.refresh_token_expires_at {
        if exp <= Utc::now() {
            anyhow::bail!("GitHub refresh token has expired — please reconnect GitHub in settings");
        }
    }

    let refresh_token = conn.refresh_token.as_deref().ok_or_else(|| {
        anyhow::anyhow!(
            "GitHub token is expired but no refresh token is stored — please reconnect GitHub in settings"
        )
    })?;

    #[derive(Deserialize)]
    struct RefreshedToken {
        access_token: String,
        refresh_token: Option<String>,
        expires_in: Option<i64>,
        refresh_token_expires_in: Option<i64>,
    }

    let new_token: RefreshedToken = http
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .form(&[
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
        ])
        .send()
        .await
        .context("sending GitHub token refresh request")?
        .json()
        .await
        .context("parsing GitHub token refresh response")?;

    let now = Utc::now();
    let token_expires_at = new_token.expires_in.map(|s| now + chrono::Duration::seconds(s));
    let refresh_token_expires_at = new_token.refresh_token_expires_in.map(|s| now + chrono::Duration::seconds(s));

    let github_connections = db.collection::<GithubConnection>("github_connections");
    github_connections
        .update_one(
            doc! { "_id": conn.id },
            doc! { "$set": {
                "access_token": &new_token.access_token,
                "refresh_token": mongodb::bson::serialize_to_bson(&new_token.refresh_token).unwrap(),
                "token_expires_at": mongodb::bson::serialize_to_bson(&token_expires_at).unwrap(),
                "refresh_token_expires_at": mongodb::bson::serialize_to_bson(&refresh_token_expires_at).unwrap(),
            }},
        )
        .await
        .context("persisting refreshed GitHub token")?;

    Ok(new_token.access_token)
}
