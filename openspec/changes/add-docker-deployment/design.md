## Context

The outliner is a single-process Node + Express app (CommonJS, `server.js`) with no build step and no dev dependencies. It serves static assets from `public/` and persists the outline to `data/projects.json`. Today it only runs via `npm start`. The goal is a containerized runtime deployable on a single host with Docker Compose, keeping data in a persistent volume. The file-based store is single-writer, so the deployment assumes one replica.

## Goals / Non-Goals

**Goals:**
- A minimal, reproducible image that runs the app on `PORT` (default `3000`).
- Persistent state across container restarts/rebuilds via a named volume at `/app/data`.
- Non-root execution (the `node` user).
- A one-command single-host deployment via `docker compose up`.
- A `.dockerignore` that keeps the build context small and correct.

**Non-Goals:**
- No orchestrator (Kubernetes/Helm) and no multi-replica scaling — the file-based store is single-writer.
- No changes to application code, endpoints, or storage semantics (the existing `project-storage` capability is unchanged).
- No reverse-proxy / TLS termination configuration in this change.
- No dedicated `/health` route added to the app (liveness is checked via the container healthcheck against `/`).

## Decisions

**1. Base image: `node:22-alpine`**
The app uses no native modules, so a small image wins. `node:22-alpine` (~50 MB) is the active LTS line and carries the `node` user and busybox `wget`.
- *Alternatives considered*: `node:24-alpine` (matches the local v24 runtime, a bit newer), `node:22-slim` (Debian — larger), `node:current` (not reproducible). Chose the LTS alpine for stability and size.

**2. Single-stage build (no multi-stage)**
There is no compile step and no devDependencies, so `npm ci --omit=dev` plus a straight copy of the runtime files in one stage is sufficient. If a bundler (Vite/esbuild) is added later, splitting into a `builder` + `runner` two-stage is the intended extension.
- *Alternatives considered*: two-stage build — rejected as unnecessary complexity today.

**3. State in a named volume at `/app/data`**
The app writes `data/projects.json`. A named volume (e.g. `projets-data`) mounted at `/app/data` persists it across rebuilds/restarts. The image pre-creates the directory and `chown`s it to the `node` user *before* switching to `USER node`, so the mounted volume inherits writable ownership.
- *Alternatives considered*: bind mount (more manual permission handling, less portable), or baking `data/projects.json` into the image (rejected — stale data, lost on redeploy; and the file is already git-ignored).

**4. Run as non-root `node` user**
`WORKDIR /app`, `USER node`. The container does not run as root and has no root shell; only `data/` needs write access.

**5. Port and config**
`ENV NODE_ENV=production`, `EXPOSE 3000`, `CMD ["node", "server.js"]`. Compose maps `${PORT:-3000}:3000` so the host port is overrideable.

**6. Liveness via container healthcheck**
Compose `healthcheck` probes `GET /` using busybox `wget --spider`, which `node:alpine` ships. No app change required.
- *Alternative considered*: adding a `/health` route — deferred, since it would change application code and is out of scope for a deployment-only change.

**7. `.dockerignore`**
Exclude `node_modules/`, `.npm-cache/`, `data/`, `.git/`, `.github/`, `openspec/`, and `*.md` (docs) so the context stays small and the host's local `node_modules` is never copied into the image.

## Risks / Trade-offs

- **Empty volume seeds example data on first boot** → On a fresh volume, `ensureData()` creates sample content. *Mitigation*: document it; to preserve existing data, seed the volume once by copying a real `projects.json` into `/app/data`.
- **Missing `.dockerignore` copies host `node_modules`** → cross-platform path/permission issues and a bloated context. *Mitigation*: commit the `.dockerignore`.
- **Volume ownership/perms on an unmanaged bind mount** → writes could fail for the non-root user. *Mitigation*: pre-create + `chown node:node /app/data` in the image and prefer the named volume.
- **Single-writer file store** → two replicas could corrupt the file. *Mitigation*: `replicas: 1` in compose and no horizontal scaling documented.
- **busybox `wget` for healthcheck** → present in alpine but minimal. *Mitigation*: fallback to a `node -e` HTTP probe if a more portable check is wanted.

## Migration Plan

1. `docker compose config` to validate the compose file.
2. `docker build -t gestion-prj-perso .` to build the image.
3. `docker compose up -d` to start the service (creates the named volume on first run).
4. Verify `http://localhost:3000`.
- **Rollback**: `docker compose down` then `docker compose up -d` the previous image tag; the named volume preserves the data.
- **Bringing existing data**: copy a local `data/projects.json` into `projets-data` (e.g. `docker compose cp data/projects.json web:/app/data/projects.json`) before first start.

## Open Questions

- Should a real `/health` endpoint be added later (needs its own change proposal) or is the container-level healthcheck enough?
- Is a reverse proxy (TLS, domain) expected a follow-up, or is `localhost:3000` the only exposure for now?
