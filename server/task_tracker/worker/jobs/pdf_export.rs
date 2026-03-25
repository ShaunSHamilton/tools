use chrono::{DateTime, Utc};
use mongodb::{Database, bson::doc};
use pulldown_cmark::{Options, Parser, html};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::task_tracker::shared::{
    config::Config, jobs::pdf_export::PdfExportJob, models::report::Report,
};

use crate::task_tracker::worker::spaces;

/// MongoDB document for report exports.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportExport {
    #[serde(rename = "_id")]
    pub id: Uuid,
    pub report_id: Uuid,
    pub format: String,
    pub status: String,
    pub storage_key: Option<String>,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// HTML template for the PDF — print-friendly light theme.
fn render_html(title: &str, period: &str, content_md: &str) -> String {
    let mut opts = Options::empty();
    opts.insert(Options::ENABLE_TABLES);
    opts.insert(Options::ENABLE_STRIKETHROUGH);
    let parser = Parser::new_ext(content_md, opts);
    let mut content_html = String::new();
    html::push_html(&mut content_html, parser);

    format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  *, *::before, *::after {{ box-sizing: border-box; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    max-width: 780px;
    margin: 40px auto;
    padding: 0 24px;
    color: #111;
    background: #fff;
    line-height: 1.65;
    font-size: 14px;
  }}
  .header {{
    margin-bottom: 2em;
    padding-bottom: 1em;
    border-bottom: 3px solid #111;
  }}
  h1 {{ font-size: 1.9em; margin: 0 0 0.2em; }}
  .period {{ color: #555; font-size: 0.9em; margin: 0; }}
  h2 {{ font-size: 1.35em; margin-top: 1.8em; border-bottom: 1px solid #ddd; padding-bottom: 0.25em; }}
  h3 {{ font-size: 1.1em; margin-top: 1.4em; }}
  p {{ margin: 0.7em 0; }}
  ul, ol {{ padding-left: 1.6em; }}
  li {{ margin: 0.3em 0; }}
  code {{
    background: #f5f5f5;
    border: 1px solid #e0e0e0;
    padding: 0.15em 0.4em;
    border-radius: 3px;
    font-family: "SFMono-Regular", Consolas, monospace;
    font-size: 0.88em;
  }}
  pre {{
    background: #f5f5f5;
    border: 1px solid #e0e0e0;
    padding: 1em;
    border-radius: 5px;
    overflow-x: auto;
  }}
  pre code {{ background: none; border: none; padding: 0; }}
  blockquote {{
    margin: 1em 0;
    padding-left: 1em;
    border-left: 4px solid #ddd;
    color: #555;
  }}
  table {{ border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 0.93em; }}
  th, td {{ border: 1px solid #ddd; padding: 0.5em 0.8em; text-align: left; }}
  th {{ background: #f5f5f5; font-weight: 600; }}
  tr:nth-child(even) td {{ background: #fafafa; }}
  @media print {{
    body {{ margin: 0; }}
    .header {{ page-break-after: avoid; }}
    h2, h3 {{ page-break-after: avoid; }}
  }}
</style>
</head>
<body>
<div class="header">
  <h1>{title}</h1>
  <p class="period">{period}</p>
</div>
{content_html}
</body>
</html>"#
    )
}

pub struct PdfWorkerState {
    pub db: Database,
    pub config: Config,
}

pub async fn handle(
    job: PdfExportJob,
    state: std::sync::Arc<PdfWorkerState>,
) -> Result<(), anyhow::Error> {
    let result = run_export(&job, &state).await;

    let exports = state.db.collection::<ReportExport>("report_exports");

    match result {
        Ok(storage_key) => {
            exports
                .update_one(
                    doc! { "_id": bson::serialize_to_bson(&job.export_id).unwrap() },
                    doc! { "$set": { "status": "completed", "storage_key": &storage_key } },
                )
                .await?;
        }
        Err(e) => {
            let msg = format!("{e:#}");
            tracing::error!(export_id = %job.export_id, error = %msg, "pdf export failed");
            exports
                .update_one(
                    doc! { "_id": bson::serialize_to_bson(&job.export_id).unwrap() },
                    doc! { "$set": { "status": "failed", "error_message": &msg } },
                )
                .await?;
        }
    }

    // Return Ok always — failures are surfaced via DB status, not apalis retries
    Ok(())
}

async fn run_export(job: &PdfExportJob, state: &PdfWorkerState) -> anyhow::Result<String> {
    // Fetch the export record to get the report_id
    let exports = state.db.collection::<ReportExport>("report_exports");
    let export = exports
        .find_one(doc! { "_id": bson::serialize_to_bson(&job.export_id).unwrap() })
        .await?
        .ok_or_else(|| anyhow::anyhow!("export record not found: {}", job.export_id))?;

    // Fetch the report
    let reports = state.db.collection::<Report>("reports");
    let report = reports
        .find_one(doc! { "_id": bson::serialize_to_bson(&export.report_id).unwrap() })
        .await?
        .ok_or_else(|| anyhow::anyhow!("report not found: {}", export.report_id))?;

    let content_md = report
        .content_md
        .ok_or_else(|| anyhow::anyhow!("report has no content"))?;

    let period = format!("{} – {}", report.period_start, report.period_end);
    let html = render_html(&report.title, &period, &content_md);

    // Call Gotenberg to render HTML → PDF
    let pdf_bytes = render_pdf(&state.config, html).await?;

    // Upload to DO Spaces
    let storage_key = format!("exports/{}.pdf", job.export_id);
    spaces::upload(&state.config, &storage_key, pdf_bytes, "application/pdf").await?;

    Ok(storage_key)
}

async fn render_pdf(config: &Config, html: String) -> anyhow::Result<Vec<u8>> {
    let client = reqwest::Client::new();

    let form = reqwest::multipart::Form::new().part(
        "files",
        reqwest::multipart::Part::text(html)
            .file_name("index.html")
            .mime_str("text/html; charset=utf-8")
            .map_err(|e| anyhow::anyhow!("mime: {e}"))?,
    );

    let url = format!("{}/forms/chromium/convert/html", config.gotenberg_url);
    let res = client
        .post(&url)
        .multipart(form)
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("Gotenberg request: {e}"))?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        anyhow::bail!("Gotenberg {status}: {body}");
    }

    Ok(res.bytes().await?.to_vec())
}
