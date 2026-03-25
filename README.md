# tools

Internal tooling for freeCodeCamp, served as a single container with three path-prefixed apps.

| App | Path prefix | Description |
|---|---|---|
| exam-creator | `/exam-creator` | Authoring and managing certification exams |
| task-tracker | `/task-tracker` | Team task management |
| team-board | `/team-board` | Team kanban board |

## Stack

- **Frontend** — React 19, Vite, TanStack Router/Query, shadcn/ui, Tailwind CSS, Bun
- **Backend** — Rust, Axum, MongoDB
- **Auth** — GitHub OAuth (shared across all apps)

## Running with Docker

```sh
cp .env.example .env
# fill in .env

docker build -t tools .
docker run --env-file .env -p 8080:8080 tools
```

The server listens on `PORT` (default `8080`) and serves the frontend from `/dist`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

BSD-3-Clause
