# Runtime for the personal projects outliner (Node + Express + htmx).
# No application build: the app renders HTML server-side and serves vendored
# static assets. The `assets` stage minifies those assets, so the repository
# keeps its readable sources while the published image ships compressed files
# under the same URLs.
#
# Release builds pass the git tag as `--build-arg APP_VERSION=<tag>`; it ends up
# in the service worker's cache version. See .github/workflows/release.yml.

# ---------------------------------------------------------------------------
# Asset stage: minify public/ and stamp the release tag into the worker.
# Debian (glibc) because esbuild and lightningcss load native binaries; their
# outputs are plain text files, copied into the Alpine runtime below.
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
# Runtime image
# ---------------------------------------------------------------------------
FROM node:22-alpine

# Application working directory.
WORKDIR /app

# Install only production dependencies from the lockfile for a clean layer.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Application code and static assets (minified by the `assets` stage).
COPY server.js storage.js env.js accounts.js otp.js mailer.js passkeys.js authpages.js authroutes.js migration.js pwa-head.js ./
COPY --from=assets /app/public ./public
COPY scripts ./scripts

# Persistent data directory, writable by the non-root node user so the
# mounted volume at /app/data stays writable at runtime.
RUN mkdir -p /app/data && chown node:node /app/data

# Release tag, published to the running application: the Help page displays it.
# Empty for a local `docker build`, as in the asset stage above; the app then
# reports a development build.
ARG APP_VERSION=""
ENV APP_VERSION=$APP_VERSION

ENV NODE_ENV=production
EXPOSE 3000

# Run as the non-root node user.
USER node

CMD ["node", "server.js"]
