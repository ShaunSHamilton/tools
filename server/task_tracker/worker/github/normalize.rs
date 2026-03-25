use chrono::{DateTime, Utc};
use serde_json::Value;

use super::client::RawEvent;

pub struct NormalizedEvent {
    pub github_event_id: String,
    pub event_type: String,
    pub repo_full_name: String,
    pub title: Option<String>,
    pub url: String,
    pub occurred_at: DateTime<Utc>,
    pub metadata: Value,
}

/// Convert a raw GitHub API event into our normalised representation.
/// Returns `None` for event types we don't track.
pub fn normalize(event: &RawEvent) -> Option<NormalizedEvent> {
    match event.event_type.as_str() {
        "PushEvent" => normalize_push(event),
        "PullRequestEvent" => normalize_pull_request(event),
        "PullRequestReviewEvent" => normalize_pr_review(event),
        "IssuesEvent" => normalize_issue(event),
        "IssueCommentEvent" => normalize_issue_comment(event),
        "PullRequestReviewCommentEvent" => normalize_pr_review_comment(event),
        "CreateEvent" => normalize_create(event),
        _ => None,
    }
}

fn normalize_push(event: &RawEvent) -> Option<NormalizedEvent> {
    let payload = &event.payload;
    let commits = payload["commits"].as_array()?;
    let count = commits.len();
    let branch = payload["ref"]
        .as_str()
        .unwrap_or("")
        .trim_start_matches("refs/heads/");

    let title = format!(
        "Pushed {} commit{} to {}",
        count,
        if count == 1 { "" } else { "s" },
        branch
    );

    let url = format!("https://github.com/{}/commits/{}", event.repo.name, branch);

    Some(NormalizedEvent {
        github_event_id: event.id.clone(),
        event_type: "push".to_string(),
        repo_full_name: event.repo.name.clone(),
        title: Some(title),
        url,
        occurred_at: event.created_at,
        metadata: serde_json::json!({
            "commit_count": count,
            "branch": branch,
            "commits": commits.iter().take(5).collect::<Vec<_>>(),
        }),
    })
}

fn normalize_pull_request(event: &RawEvent) -> Option<NormalizedEvent> {
    let payload = &event.payload;
    let action = payload["action"].as_str().unwrap_or("updated");
    let pr = &payload["pull_request"];
    let number = pr["number"].as_i64()?;
    let pr_title = pr["title"].as_str().unwrap_or("(no title)");
    let url = pr["html_url"].as_str().unwrap_or("").to_string();
    let merged = pr["merged"].as_bool().unwrap_or(false);

    let effective_action = if action == "closed" && merged {
        "merged"
    } else {
        action
    };

    let title = format!("{} PR #{}: {}", capitalize(effective_action), number, pr_title);

    Some(NormalizedEvent {
        github_event_id: event.id.clone(),
        event_type: "pull_request".to_string(),
        repo_full_name: event.repo.name.clone(),
        title: Some(title),
        url,
        occurred_at: event.created_at,
        metadata: serde_json::json!({
            "action": effective_action,
            "number": number,
            "pr_title": pr_title,
            "state": pr["state"].as_str(),
            "merged": merged,
        }),
    })
}

fn normalize_pr_review(event: &RawEvent) -> Option<NormalizedEvent> {
    let payload = &event.payload;
    let review = &payload["review"];
    let pr = &payload["pull_request"];
    let number = pr["number"].as_i64()?;
    let pr_title = pr["title"].as_str().unwrap_or("(no title)");
    let state = review["state"].as_str().unwrap_or("reviewed");
    let url = review["html_url"].as_str().unwrap_or("").to_string();

    let title = format!("Reviewed PR #{}: {} ({})", number, pr_title, state);

    Some(NormalizedEvent {
        github_event_id: event.id.clone(),
        event_type: "pull_request_review".to_string(),
        repo_full_name: event.repo.name.clone(),
        title: Some(title),
        url,
        occurred_at: event.created_at,
        metadata: serde_json::json!({
            "number": number,
            "pr_title": pr_title,
            "state": state,
        }),
    })
}

fn normalize_issue(event: &RawEvent) -> Option<NormalizedEvent> {
    let payload = &event.payload;
    let action = payload["action"].as_str().unwrap_or("updated");
    let issue = &payload["issue"];
    let number = issue["number"].as_i64()?;
    let issue_title = issue["title"].as_str().unwrap_or("(no title)");
    let url = issue["html_url"].as_str().unwrap_or("").to_string();

    let title = format!("{} issue #{}: {}", capitalize(action), number, issue_title);

    Some(NormalizedEvent {
        github_event_id: event.id.clone(),
        event_type: "issue".to_string(),
        repo_full_name: event.repo.name.clone(),
        title: Some(title),
        url,
        occurred_at: event.created_at,
        metadata: serde_json::json!({
            "action": action,
            "number": number,
            "issue_title": issue_title,
        }),
    })
}

fn normalize_issue_comment(event: &RawEvent) -> Option<NormalizedEvent> {
    let payload = &event.payload;
    let issue = &payload["issue"];
    let comment = &payload["comment"];
    let number = issue["number"].as_i64()?;
    let issue_title = issue["title"].as_str().unwrap_or("(no title)");
    let url = comment["html_url"].as_str().unwrap_or("").to_string();
    let is_pr = issue["pull_request"].is_object();
    let kind = if is_pr { "PR" } else { "issue" };

    let title = format!("Commented on {} #{}: {}", kind, number, issue_title);

    Some(NormalizedEvent {
        github_event_id: event.id.clone(),
        event_type: "issue_comment".to_string(),
        repo_full_name: event.repo.name.clone(),
        title: Some(title),
        url,
        occurred_at: event.created_at,
        metadata: serde_json::json!({
            "number": number,
            "issue_title": issue_title,
            "is_pr": is_pr,
        }),
    })
}

fn normalize_pr_review_comment(event: &RawEvent) -> Option<NormalizedEvent> {
    let payload = &event.payload;
    let pr = &payload["pull_request"];
    let comment = &payload["comment"];
    let number = pr["number"].as_i64()?;
    let pr_title = pr["title"].as_str().unwrap_or("(no title)");
    let url = comment["html_url"].as_str().unwrap_or("").to_string();

    let title = format!("Commented on PR #{}: {}", number, pr_title);

    Some(NormalizedEvent {
        github_event_id: event.id.clone(),
        event_type: "pr_review_comment".to_string(),
        repo_full_name: event.repo.name.clone(),
        title: Some(title),
        url,
        occurred_at: event.created_at,
        metadata: serde_json::json!({
            "number": number,
            "pr_title": pr_title,
        }),
    })
}

fn normalize_create(event: &RawEvent) -> Option<NormalizedEvent> {
    let payload = &event.payload;
    let ref_type = payload["ref_type"].as_str().unwrap_or("ref");
    let ref_name = payload["ref"].as_str().unwrap_or("");

    // Skip repository creation (not very useful for weekly summaries)
    if ref_type == "repository" {
        return None;
    }

    let title = format!("Created {} {}", ref_type, ref_name);
    let url = format!("https://github.com/{}", event.repo.name);

    Some(NormalizedEvent {
        github_event_id: event.id.clone(),
        event_type: "create".to_string(),
        repo_full_name: event.repo.name.clone(),
        title: Some(title),
        url,
        occurred_at: event.created_at,
        metadata: serde_json::json!({
            "ref_type": ref_type,
            "ref": ref_name,
        }),
    })
}

fn capitalize(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(c) => c.to_uppercase().collect::<String>() + chars.as_str(),
    }
}
