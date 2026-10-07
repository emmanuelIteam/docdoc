# Tasks

## 1. Build context

- [x] 1.1 Create `.dockerignore` excluding `node_modules/`, `.npm-cache/`, `data/`, `.git/`, `.github/`, `openspec/`, and documentation files (`*.md`), keeping `package.json`, `package-lock.json`, `server.js`, and `public/`.
- [x] 1.2 Verify nothing sensitive or repo-local (real `data/`, local `node_modules`) is present in the build context.

## 2. Dockerfile

- [x] 2.1 Create `Dockerfile` based on `node:22-alpine` with `WORKDIR /app`.
- [x] 2.2 Copy `package*.json`, then run `npm ci --omit=dev` to install only runtime dependencies.
- [x] 2.3 Copy `server.js` and `public/` into the image.
- [x] 2.4 Pre-create the data directory and give it to the `node` user: `RUN mkdir -p /app/data && chown node:node /app/data`.
- [x] 2.5 Set `ENV NODE_ENV=production`, `EXPOSE 3000`, `USER node`, and `CMD ["node", "server.js"]`.

## 3. Docker Compose

- [x] 3.1 Create `docker-compose.yml` with a single `web` service (image built from the `Dockerfile`), host port mapping `${PORT:-3000}:3000`, and `replicas: 1`.
- [x] 3.2 Declare the persistent named volume mounted at `/app/data` (e.g. `projets-data`).
- [x] 3.3 Add a `healthcheck` that probes the application over HTTP (busybox `wget` on alpine) and a `restart` policy appropriate for a single-host deployment.

## 4. Validation

- [x] 4.1 Run `docker compose config` and confirm the file is valid.
- [ ] 4.2 Build the image and start the service with `docker compose up -d`.
- [ ] 4.3 Verify the app is served on the mapped host port and that a second restart keeps the data in the volume.
- [ ] 4.4 Confirm the container runs as the non-root `node` user and writes to `/app/data`.
