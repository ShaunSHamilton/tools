FROM oven/bun:1 AS frontend_builder
WORKDIR /app

# Copy dependency information first for better caching
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy Prisma schema
COPY prisma/ prisma/
COPY prisma.config.ts .

# Generate Prisma client
RUN bunx prisma generate

# Copy the rest of the frontend files
COPY tsconfig.json vite.config.ts index.html ./
COPY client/ client/
COPY public/ public/

# Build frontend
RUN bun run build

FROM rust:1-alpine AS builder
WORKDIR /app

RUN apk add --no-cache musl-dev openssl-dev openssl-libs-static pkgconf

COPY server/ server/
COPY prisma/ prisma/
COPY Cargo.toml Cargo.lock ./
COPY CHANGELOG.md .
# Copy frontend build to the 'dist' directory for the server to use
COPY --from=frontend_builder /app/dist /app/dist

# Build application with static linking via musl
RUN OPENSSL_STATIC=1 RUSTFLAGS="-C target-feature=+crt-static" cargo build --release --target x86_64-unknown-linux-musl

FROM debian:bookworm-slim AS runtime
RUN apt-get update -y && \
    apt-get install -y --no-install-recommends ca-certificates && \
    apt-get autoremove -y && \
    apt-get clean -y && \
    rm -rf /var/lib/apt/lists/*

# Metadata labels for container management and documentation
LABEL org.opencontainers.image.title="tools" \
      org.opencontainers.image.description="freeCodeCamp internal tooling" \
      org.opencontainers.image.source="https://github.com/ShaunSHamilton/tools" \
      org.opencontainers.image.vendor="tools" \
      org.opencontainers.image.licenses="BSD-3-Clause"

# Copy the compiled application from the builder stage
COPY --from=builder /app/target/x86_64-unknown-linux-musl/release/server /server
# Copy static assets from the 'dist' directory
COPY --from=builder /app/dist /dist

# Set the entrypoint for the container
ENTRYPOINT ["/server"]
