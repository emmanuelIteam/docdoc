# docker-deployment Specification

## ADDED Requirements

### Requirement: Provide a containerized runtime
The system SHALL provide a Docker image that runs the outliner server as a single Node.js process listening on `PORT` (default `3000`).

#### Scenario: Container serves the app
- **WHEN** the image is built and run
- **THEN** the server listens on `PORT` (default `3000`) and serves the application

#### Scenario: Port is configurable
- **WHEN** `PORT` is set in the environment
- **THEN** the server binds to that port instead of the default

### Requirement: Run as a non-root user
The system SHALL run the container as the non-root `node` user, with write access only to the persistent data directory.

#### Scenario: Container runs as node user
- **WHEN** the container starts
- **THEN** the process runs as the `node` user (not root)

#### Scenario: Data directory is writable
- **WHEN** the persistent data directory is mounted
- **THEN** the `node` user can write to it

### Requirement: Persist state in a mounted volume at /app/data
The system SHALL store the outline in a Docker volume mounted at `/app/data`, so data survives container restarts and rebuilds.

#### Scenario: Data survives a restart
- **WHEN** the container is restarted
- **THEN** the previously written `projects.json` is still present and reloaded

#### Scenario: State is initialized on a fresh volume
- **WHEN** the mounted volume is empty
- **THEN** the system creates the data file with the example seed content

### Requirement: Install only production dependencies
The system SHALL install dependencies from the lockfile with dev dependencies omitted when building the image.

#### Scenario: Build installs runtime dependencies only
- **WHEN** the image is built and no devDependencies are declared
- **THEN** the runtime dependencies (`express`, `htmx.org`) are installed from `package-lock.json`

### Requirement: Keep the build context minimal
The system SHALL exclude non-runtime files (local `node_modules`, caches, git metadata, the data directory, and repository documentation) from the Docker build context.

#### Scenario: Local node_modules are not copied
- **WHEN** the image is built
- **THEN** the host's `node_modules` and `.npm-cache` are not sent to the build context

#### Scenario: Data directory is not baked into the image
- **WHEN** the image is built
- **THEN** `data/` is excluded and the state is provided by the mounted volume instead

### Requirement: Start with a single-host Docker Compose service
The system SHALL provide a `docker-compose.yml` that starts a single `web` service bound to a host port, backed by the persistent volume, with exactly one replica.

#### Scenario: Single service starts
- **WHEN** `docker compose up` is run
- **THEN** a single `web` container starts and is reachable on the mapped host port

#### Scenario: Health is checked
- **WHEN** the compose file declares a healthcheck
- **THEN** the container performs an HTTP check against the application
