use mongodb::options::ClientOptions;

pub async fn connect(uri: &str) -> anyhow::Result<mongodb::Database> {
    let client_options = ClientOptions::parse(uri).await?;
    let client = mongodb::Client::with_options(client_options)?;
    let db = client
        .default_database()
        .expect("database must be defined in MONGODB_URI");

    // Verify connectivity
    db.run_command(mongodb::bson::doc! { "ping": 1 }).await?;
    tracing::info!("connected to task-tracker MongoDB");

    Ok(db)
}
