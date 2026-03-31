use anyhow::Context;

#[derive(Debug, Clone)]
pub struct Config {
    pub mongodb_uri: String,
    pub jwt_secret: String,
    pub app_env: String,
    pub api_port: u16,

    // GitHub connect OAuth (for fetching events for report generation)
    pub github_client_id: String,
    pub github_client_secret: String,

    // Storage
    pub do_spaces_key: String,
    pub do_spaces_secret: String,
    pub do_spaces_bucket: String,
    pub do_spaces_endpoint: String,

    // LLM
    pub anthropic_api_key: String,

    // Services
    pub gotenberg_url: String,

    // URLs
    pub app_base_url: String,
    pub frontend_base_url: String,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        Ok(Config {
            mongodb_uri: required("TT_MONGODB_URI")?,
            jwt_secret: required("JWT_SECRET")?,
            app_env: std::env::var("APP_ENV").unwrap_or_else(|_| "development".into()),
            api_port: std::env::var("API_PORT")
                .unwrap_or_else(|_| "8080".into())
                .parse()
                .context("API_PORT must be a number")?,

            github_client_id: required("GITHUB_CLIENT_ID")?,
            github_client_secret: required("GITHUB_CLIENT_SECRET")?,

            do_spaces_key: required("DO_SPACES_KEY")?,
            do_spaces_secret: required("DO_SPACES_SECRET")?,
            do_spaces_bucket: required("DO_SPACES_BUCKET")?,
            do_spaces_endpoint: required("DO_SPACES_ENDPOINT")?,

            anthropic_api_key: required("ANTHROPIC_API_KEY")?,

            gotenberg_url: std::env::var("GOTENBERG_URL")
                .unwrap_or_else(|_| "http://localhost:3000".into()),

            app_base_url: std::env::var("APP_BASE_URL")
                .unwrap_or_else(|_| "http://localhost:8080".into()),
            frontend_base_url: std::env::var("FRONTEND_BASE_URL")
                .unwrap_or_else(|_| "http://localhost:5173".into()),
        })
    }

    pub fn is_production(&self) -> bool {
        self.app_env == "production"
    }
}

fn required(key: &str) -> anyhow::Result<String> {
    std::env::var(key).with_context(|| format!("missing required env var: {key}"))
}
