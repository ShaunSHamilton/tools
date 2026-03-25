use std::env;

#[derive(Debug, Clone)]
pub struct Config {
    pub port: u16,
    pub mongodb_uri: String,
    pub log_level: String,
    pub app_env: AppEnv,
    pub allowed_origins: Vec<String>,
    pub cookie_key: String,
    pub session_ttl_in_s: u64,
    pub mock_auth: bool,
    pub github_client_id: String,
    pub github_client_secret: String,
    pub github_redirect_url: String,
    /// GitHub App RSA private key in PEM format. Literal `\n` sequences are
    /// converted to real newlines so the value can be stored on one line in .env.
    pub github_app_private_key: String,
}

#[derive(Debug, Clone, PartialEq)]
pub enum AppEnv {
    Development,
    Production,
}

impl Config {
    pub fn from_env() -> Self {
        let app_env = match env::var("APP_ENV").as_deref() {
            Ok("production") => AppEnv::Production,
            _ => AppEnv::Development,
        };

        let is_dev = app_env == AppEnv::Development;

        let port = env::var("PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(8080u16);

        let default_origins = match app_env {
            AppEnv::Development => "http://localhost:5173".to_string(),
            AppEnv::Production => String::new(),
        };

        let mock_auth = env::var("MOCK_AUTH")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(false);

        let github_client_id = match env::var("GITHUB_APP_CLIENT_ID") {
            Ok(v) => v,
            Err(_) => {
                if !mock_auth {
                    panic!("GITHUB_APP_CLIENT_ID required");
                }
                "mock-client-id".to_string()
            }
        };

        let github_client_secret = match env::var("GITHUB_APP_CLIENT_SECRET") {
            Ok(v) => v,
            Err(_) => {
                if !mock_auth {
                    panic!("GITHUB_APP_CLIENT_SECRET required");
                }
                "mock-client-secret".to_string()
            }
        };

        let github_redirect_url = env::var("GITHUB_APP_REDIRECT_URL").unwrap_or_else(|_| {
            format!("http://localhost:{port}/api/auth/callback/github")
        });

        let cookie_key = env::var("COOKIE_KEY").unwrap_or_else(|_| {
            if is_dev {
                "a".repeat(64)
            } else {
                panic!("COOKIE_KEY required in production")
            }
        });
        assert!(
            cookie_key.len() >= 64,
            "COOKIE_KEY must be at least 64 characters"
        );

        let github_app_private_key = env::var("GITHUB_APP_PRIVATE_KEY")
            .map(|s| s.replace("\\n", "\n"))
            .unwrap_or_else(|_| {
                if !mock_auth {
                    panic!("GITHUB_APP_PRIVATE_KEY required");
                }
                String::new()
            });

        Config {
            port,
            mongodb_uri: env::var("MONGODB_URI")
                .unwrap_or_else(|_| "mongodb://localhost:27017".to_string()),
            log_level: env::var("LOG_LEVEL").unwrap_or_else(|_| "team_board=info".to_string()),
            app_env,
            allowed_origins: env::var("ALLOWED_ORIGINS")
                .unwrap_or(default_origins)
                .split(',')
                .filter(|s| !s.is_empty())
                .map(str::to_string)
                .collect(),
            cookie_key,
            session_ttl_in_s: env::var("SESSION_TTL_IN_S")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(43200),
            mock_auth,
            github_client_id,
            github_client_secret,
            github_redirect_url,
            github_app_private_key,
        }
    }
}
