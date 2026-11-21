# Image de production de docdoc.
#
# Le serveur est l'implémentation Rust (`rust/`) ; l'étape `assets` reste Node
# uniquement pour minifier `public/` et inscrire le tag de release dans
# `CACHE_VERSION` du service worker, exactement comme avant. Le runtime ne
# contient ni Node ni npm.
#
# Release builds pass the git tag as `--build-arg APP_VERSION=<tag>`; it ends up
# in the service worker's cache version and in the Help page. See
# .github/workflows/release.yml.

# ---------------------------------------------------------------------------
# Asset stage: minify public/ and stamp the release tag into the worker.
# Debian (glibc) because esbuild and lightningcss load native binaries; their
# outputs are plain text files, copied into the runtime below.
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS assets

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY public ./public
COPY scripts ./scripts

# Release tag. Empty for a local `docker build`: the repository's
# CACHE_VERSION is then kept, as local development expects.
ARG APP_VERSION=""
RUN node scripts/build-assets.js

# ---------------------------------------------------------------------------
# Rust builder: dependencies are compiled in a layer that only depends on the
# manifests, so a change under `rust/src/` does not reinstall them.
# ---------------------------------------------------------------------------
FROM rust:1.100-bookworm AS builder

WORKDIR /build

COPY rust/Cargo.toml rust/Cargo.lock ./
RUN mkdir src && printf 'fn main() {}' > src/main.rs && cargo build --release --locked
RUN rm -rf src

COPY rust/src ./src
RUN touch src/main.rs && cargo build --release --locked

# ---------------------------------------------------------------------------
# Runtime image: Debian slim, non-root, CA certificates (S3/SMTP/HTTP APIs) and
# curl for the healthcheck.
# ---------------------------------------------------------------------------
FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl passwd \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --home-dir /app docdoc

WORKDIR /app

COPY --from=builder /build/target/release/docdoc /app/docdoc
COPY --from=assets /app/public ./public

# Le volume Compose monte les données historiques ici ; le dossier doit exister
# et être accessible à l'utilisateur non privilégié.
RUN mkdir -p /app/data && chown -R docdoc:docdoc /app

# Release tag, published to the running application: the Help page displays it.
ARG APP_VERSION=""
ENV APP_VERSION=$APP_VERSION \
    HOST=0.0.0.0 \
    PORT=3000 \
    NODE_ENV=production \
    DOCDOC_PUBLIC_DIR=/app/public \
    DOCDOC_DATA_DIR=/app/data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -fsS http://127.0.0.1:3000/ || exit 1

# Run as the non-root user.
USER docdoc

CMD ["/app/docdoc"]
