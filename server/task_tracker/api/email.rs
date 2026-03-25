use reqwest::Client;
use serde_json::json;

/// Send an org invite email via the Postmark API.
/// Logs and skips (does not error) when `api_key` is `None` — useful in dev.
pub async fn send_invite_email(
    http: &Client,
    api_key: Option<&str>,
    from: Option<&str>,
    to: &str,
    org_name: &str,
    invite_url: &str,
    invited_by: &str,
) -> anyhow::Result<()> {
    let (Some(api_key), Some(from)) = (api_key, from) else {
        tracing::info!(
            to,
            invite_url,
            "Postmark not configured — skipping invite email"
        );
        return Ok(());
    };

    let body = json!({
        "From": from,
        "To": to,
        "Subject": format!("{invited_by} invited you to join {org_name} on Task Tracker"),
        "TextBody": format!(
            "{invited_by} has invited you to join {org_name} on Task Tracker.\n\n\
             Accept the invitation:\n{invite_url}\n\n\
             This invite expires in 7 days."
        ),
        "HtmlBody": format!(
            "<p><strong>{invited_by}</strong> has invited you to join \
             <strong>{org_name}</strong> on Task Tracker.</p>\
             <p><a href=\"{invite_url}\">Accept invitation</a></p>\
             <p>This invite expires in 7 days.</p>"
        ),
    });

    let res = http
        .post("https://api.postmarkapp.com/email")
        .header("X-Postmark-Server-Token", api_key)
        .header("Accept", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("Postmark request failed: {e}"))?;

    if !res.status().is_success() {
        let status = res.status();
        let text = res.text().await.unwrap_or_default();
        anyhow::bail!("Postmark returned {status}: {text}");
    }

    Ok(())
}
