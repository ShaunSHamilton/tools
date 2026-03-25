use anyhow::Context;
use chrono::Utc;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

const CONNECT_STATE_TTL_SECS: i64 = 10 * 60; // 10 minutes

/// Short-lived token embedded in the GitHub OAuth `state` parameter during the
/// "Connect GitHub" flow. Lets us recover the user_id after the OAuth redirect
/// without storing server-side session state.
#[derive(Debug, Serialize, Deserialize)]
pub struct ConnectStateClaims {
    pub sub: String,     // user_id (ObjectId hex string)
    pub purpose: String, // must equal "github_connect"
    pub iat: i64,
    pub exp: i64,
}

pub fn encode_connect_state(user_id: ObjectId, secret: &str) -> anyhow::Result<String> {
    let now = Utc::now().timestamp();
    let claims = ConnectStateClaims {
        sub: user_id.to_hex(),
        purpose: "github_connect".to_string(),
        iat: now,
        exp: now + CONNECT_STATE_TTL_SECS,
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .context("encoding connect state jwt")
}

pub fn decode_connect_state(token: &str, secret: &str) -> anyhow::Result<ConnectStateClaims> {
    let data = decode::<ConnectStateClaims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .context("decoding connect state jwt")?;

    if data.claims.purpose != "github_connect" {
        anyhow::bail!("invalid connect state token purpose");
    }

    Ok(data.claims)
}
