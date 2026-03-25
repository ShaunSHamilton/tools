use mongodb::{Client, Database};

use crate::team_board::config::Config;

pub async fn connect(config: &Config) -> Database {
    let client = Client::with_uri_str(&config.mongodb_uri)
        .await
        .expect("invalid MongoDB URI");

    client
        .database("tools")
        .run_command(mongodb::bson::doc! { "ping": 1 })
        .await
        .expect("failed to connect to MongoDB — is it running?");

    tracing::info!("connected to MongoDB");

    client.database("tools")
}
