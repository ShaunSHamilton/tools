# Contributing

## Local Development

### Prerequisites

- [Bun](https://bun.sh) >= 1.3
- [Rust](https://rustup.rs) (stable, 2024 edition)
- MongoDB instance (local or remote)
- A registered [GitHub App](https://github.com/settings/apps)

### Setup

```sh
cp .env.example .env
# fill in .env — see comments in the file for each variable
```

### Frontend

```sh
bun install
bunx prisma generate
bun run dev          # Vite dev server on http://localhost:5173
```

The dev server proxies `/api` to the backend. See `vite.config.ts` for proxy rules.

### Backend

```sh
cargo run            # starts Axum server on $PORT (default 8080)
```

For hot-reloading, use [cargo-watch](https://crates.io/crates/cargo-watch):

```sh
cargo watch -x run
```

### Auth bypass

Set `MOCK_AUTH=true` in `.env` to skip GitHub OAuth during local development. All requests will be treated as authenticated with a mock user.

---

## Flight Manual

The application runs as a single container on **Digital Ocean App Platform**, backed by **MongoDB Atlas** for the database.

### Services and credentials

| Service | Purpose | Where to get it |
|---|---|---|
| Digital Ocean App Platform | Hosts the container | [cloud.digitalocean.com](https://cloud.digitalocean.com) |
| MongoDB Atlas | Shared database for all apps | [cloud.mongodb.com](https://cloud.mongodb.com) |
| GitHub App | Authentication (all apps) | [github.com/settings/apps](https://github.com/settings/apps) |
| Anthropic API | Task Tracker AI features | [console.anthropic.com](https://console.anthropic.com) |

### Deploying

The App Platform is configured to build and deploy from the `main` branch automatically. Pushing to `main` triggers a new build using the `Dockerfile`.

To deploy manually via the CLI:

```sh
doctl apps create --spec .do/app.yaml       # first time
doctl apps update <app-id> --spec .do/app.yaml
```

### Environment variables

Set all variables from `.env.example` in the App Platform dashboard under **Settings > App-Level Environment Variables**, plus:

```
ANTHROPIC_API_KEY=sk-ant-...   # task-tracker
```

Do not set `APP_ENV` — it defaults to `production` in the container.

Set `ALLOWED_ORIGINS` to the App Platform domain (e.g. `https://tools-xxxxx.ondigitalocean.app`).

The `GITHUB_APP_REDIRECT_URL` must match the callback URL configured in your GitHub App exactly.

### MongoDB Atlas

1. Create a cluster and a database user with read/write access.
2. Add the App Platform outbound IP range to the Atlas IP allowlist, or allow all (`0.0.0.0/0`) if static IPs are not available.
3. Set `MONGODB_URI` (and the exam-creator URIs) to the Atlas connection string with the `+srv` scheme.

### GitHub App

1. Create a GitHub App at [github.com/settings/apps](https://github.com/settings/apps).
2. Set the callback URL to `https://<your-domain>/api/auth/callback/github`.
3. Generate a private key and copy the PEM value into `GITHUB_APP_PRIVATE_KEY` (newlines as `\n`).
4. Set `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET` from the app's settings page.
