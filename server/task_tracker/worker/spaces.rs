use aws_credential_types::Credentials;
use aws_sdk_s3::{
    config::{Builder, Region},
    primitives::ByteStream,
    Client,
};

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

/// Upload raw bytes to DO Spaces under the given key.
pub async fn upload(
    config: &Config,
    key: &str,
    data: Vec<u8>,
    content_type: &str,
) -> anyhow::Result<()> {
    let client = s3_client(config);
    client
        .put_object()
        .bucket(&config.do_spaces_bucket)
        .key(key)
        .body(ByteStream::from(data))
        .content_type(content_type)
        .send()
        .await
        .map_err(|e| anyhow::anyhow!("S3 upload: {e}"))?;
    Ok(())
}
