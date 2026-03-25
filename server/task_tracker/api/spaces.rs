use aws_credential_types::Credentials;
use aws_sdk_s3::{
    config::{Builder, Region},
    presigning::PresigningConfig,
    Client,
};
use std::time::Duration;

use crate::task_tracker::shared::config::Config;

fn s3_client(config: &Config) -> Client {
    let creds = Credentials::new(
        &config.do_spaces_key,
        &config.do_spaces_secret,
        None,
        None,
        "do-spaces",
    );
    let sdk_config = Builder::new()
        .behavior_version_latest()
        .region(Region::new("us-east-1"))
        .endpoint_url(&config.do_spaces_endpoint)
        .credentials_provider(creds)
        .build();
    Client::from_conf(sdk_config)
}

/// Generate a presigned GET URL valid for 24 hours.
pub async fn presigned_download_url(
    config: &Config,
    storage_key: &str,
) -> anyhow::Result<String> {
    let client = s3_client(config);
    let presigning = PresigningConfig::expires_in(Duration::from_secs(86400))
        .map_err(|e| anyhow::anyhow!("presigning config: {e}"))?;

    let req = client
        .get_object()
        .bucket(&config.do_spaces_bucket)
        .key(storage_key)
        .presigned(presigning)
        .await
        .map_err(|e| anyhow::anyhow!("presign_get: {e}"))?;

    Ok(req.uri().to_string())
}
