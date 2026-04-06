#[derive(Debug, Clone)]
pub struct Config {
    pub mongodb_uri: String,
    // GitHub connect OAuth (for fetching events for report generation)
    pub github_client_id: String,
    pub github_client_secret: String,

    // LLM
    pub anthropic_api_key: String,

    // URLs
    pub app_base_url: String,
    pub frontend_base_url: String,
}

impl Config {
    pub fn from_env() -> Self {
        Config {
            mongodb_uri: required("MONGODB_URI"),
            github_client_id: required("GITHUB_APP_CLIENT_ID"),
            github_client_secret: required("GITHUB_APP_CLIENT_SECRET"),
            anthropic_api_key: required("ANTHROPIC_API_KEY"),
            app_base_url: std::env::var("APP_BASE_URL")
                .unwrap_or_else(|_| "http://localhost:8080/task-tracker".into()),
            frontend_base_url: std::env::var("FRONTEND_BASE_URL")
                .unwrap_or_else(|_| "http://localhost:5173/task-tracker".into()),
        }
    }
}

fn required(key: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| panic!("missing required env var: {key}"))
}
