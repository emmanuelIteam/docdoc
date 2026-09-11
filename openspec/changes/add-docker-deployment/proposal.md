## Why

The outliner currently runs only via a local `npm start` (Node + Express) and stores its state in a local `data/projects.json`. To prepare it for deployment on a single host, we want a containerized, reproducible runtime: a Docker image that can be built once and run anywhere, with persistent data surviving container restarts. `npm ci`-installed native modules are absent, there is no build step, and the state is file-based — so the deployment is simple, but the data volume handling must be explicit.

## What Changes

- **Add a `Dockerfile`** that builds a non-root, minimal Node image running `server.js` on `PORT` (default `3000`).
- **Add a `.dockerignore`** so the build context excludes `node_modules/`, `.npm-cache/`, `data/`, `.git/`, and repo documentation — avoiding cross-platform node_modules and accidental inclusion of real data.
- **Add a `docker-compose.yml`** for single-host deployment: a `web` service, a host port mapping, and a named volume mounted at `/app/data` for persistence.
- **Container layout**: application code in `/app`, static assets in `/app/public`, state in `/app/data`. The image runs as the non-root `node` user.
- **No changes to application logic**: existing endpoints and file-based persistence semantics stay identical.

## Capabilities

### New Capabilities
- `docker-deployment`: containerized runtime for the outliner — a non-root Node image that serves the app on `PORT`, persists state to a mounted volume at `/app/data`, and is started with Docker Compose on a single host.

### Modified Capabilities
- (none) — the existing `project-storage` capability is unchanged; the deployment only relocates the same JSON file into a mounted volume.

## Impact

- **New files**: `Dockerfile`, `.dockerignore`, `docker-compose.yml`.
- **No changes** to `server.js`, `public/*`, `package.json`, or existing API endpoints.
- **Runtime behavior**: the app still seeds `data/projects.json` on first boot when the volume is empty; the only change is that the data directory is provided by a Docker volume instead of the working tree.
- **Deployment target**: single host with Docker Compose (no orchestrator, no multi-replica scaling — the file-based store is single-writer).
