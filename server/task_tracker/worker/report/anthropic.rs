use anyhow::{anyhow, Context};
use reqwest::Client;
use serde::{Deserialize, Serialize};

use super::generator::{EventSummary, ReportContext, ReportGenerator};

const MODEL: &str = "claude-haiku-4-5-20251001";
const MAX_TOKENS: u32 = 2048;

const SYSTEM_PROMPT: &str =
    "You are an AI assistant helping software engineers write professional weekly activity \
     reports based on their GitHub activity. Write in a clear, professional tone. \
     Use markdown formatting.";

const DEFAULT_STRUCTURE: &str = "\
Please structure the report with these sections:

## Summary
A 2-3 sentence overview of the week's activity.

## Highlights
The most significant work items and achievements.

## Pull Requests & Reviews
PRs opened, merged, or reviewed this week.

## Issues
Issues opened, closed, or worked on.

## Commits & Pushes
Notable commits and code pushes.

Be concise and professional. Focus on impact over volume.";

pub struct AnthropicProvider {
    api_key: String,
    http: Client,
}

impl AnthropicProvider {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            http: Client::new(),
        }
    }
}

impl ReportGenerator for AnthropicProvider {
    async fn generate(&self, ctx: &ReportContext) -> anyhow::Result<String> {
        let event_text = format_events(&ctx.events);
        let instructions = ctx
            .custom_instructions
            .as_deref()
            .unwrap_or(DEFAULT_STRUCTURE);

        let user_message = format!(
            "Generate a weekly activity report for {} for the period {} to {}.\n\n\
             GitHub Activity:\n{}\n\n{}",
            ctx.user_display_name,
            ctx.period_start,
            ctx.period_end,
            event_text,
            instructions,
        );

        #[derive(Serialize)]
        struct Message {
            role: &'static str,
            content: String,
        }

        #[derive(Serialize)]
        struct Request {
            model: &'static str,
            max_tokens: u32,
            system: &'static str,
            messages: Vec<Message>,
        }

        #[derive(Deserialize)]
        struct ContentBlock {
            #[serde(rename = "type")]
            block_type: String,
            text: Option<String>,
        }

        #[derive(Deserialize)]
        struct Response {
            content: Vec<ContentBlock>,
        }

        let response: Response = self
            .http
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&Request {
                model: MODEL,
                max_tokens: MAX_TOKENS,
                system: SYSTEM_PROMPT,
                messages: vec![Message {
                    role: "user",
                    content: user_message,
                }],
            })
            .send()
            .await
            .context("sending request to Anthropic API")?
            .error_for_status()
            .context("Anthropic API returned an error status")?
            .json()
            .await
            .context("parsing Anthropic API response")?;

        response
            .content
            .into_iter()
            .find(|b| b.block_type == "text")
            .and_then(|b| b.text)
            .ok_or_else(|| anyhow!("Anthropic response contained no text content"))
    }
}

fn format_events(events: &[EventSummary]) -> String {
    if events.is_empty() {
        return "No GitHub activity found for this period.".to_string();
    }

    let mut pushes: Vec<&EventSummary> = Vec::new();
    let mut prs: Vec<&EventSummary> = Vec::new();
    let mut reviews: Vec<&EventSummary> = Vec::new();
    let mut issues: Vec<&EventSummary> = Vec::new();
    let mut comments: Vec<&EventSummary> = Vec::new();

    for event in events {
        match event.event_type.as_str() {
            "push" => pushes.push(event),
            "pull_request" => prs.push(event),
            "pull_request_review" | "pr_review_comment" => reviews.push(event),
            "issue" => issues.push(event),
            "issue_comment" => comments.push(event),
            _ => {}
        }
    }

    let mut sections = Vec::new();

    if !pushes.is_empty() {
        let lines: Vec<String> = pushes
            .iter()
            .filter_map(|e| e.title.as_ref().map(|t| format!("  - [{}] {}", e.repo_full_name, t)))
            .collect();
        sections.push(format!("Pushes ({}):\n{}", pushes.len(), lines.join("\n")));
    }
    if !prs.is_empty() {
        let lines: Vec<String> = prs
            .iter()
            .filter_map(|e| e.title.as_ref().map(|t| format!("  - [{}] {}", e.repo_full_name, t)))
            .collect();
        sections.push(format!("Pull Requests ({}):\n{}", prs.len(), lines.join("\n")));
    }
    if !reviews.is_empty() {
        let lines: Vec<String> = reviews
            .iter()
            .filter_map(|e| e.title.as_ref().map(|t| format!("  - [{}] {}", e.repo_full_name, t)))
            .collect();
        sections.push(format!("Reviews ({}):\n{}", reviews.len(), lines.join("\n")));
    }
    if !issues.is_empty() {
        let lines: Vec<String> = issues
            .iter()
            .filter_map(|e| e.title.as_ref().map(|t| format!("  - [{}] {}", e.repo_full_name, t)))
            .collect();
        sections.push(format!("Issues ({}):\n{}", issues.len(), lines.join("\n")));
    }
    if !comments.is_empty() {
        sections.push(format!("Comments: {}", comments.len()));
    }

    sections.join("\n\n")
}
