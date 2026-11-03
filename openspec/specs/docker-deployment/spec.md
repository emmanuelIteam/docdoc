# docker-deployment Specification

## Purpose
TBD - created by archiving change add-docker-deployment. Update Purpose after archive.
## Requirements
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

### Requirement: Exposer le tag de release à l'application

Le système SHALL embarquer dans l'image finale le tag de la release comme variable d'environnement `APP_VERSION`, afin que l'application en cours d'exécution connaisse la version qu'elle sert. La valeur SHALL être celle de l'argument de build `APP_VERSION` transmis par la pipeline de release — le même que celui inscrit dans `CACHE_VERSION` du service worker, de sorte que les deux désignent toujours la même version. Un build sans argument SHALL produire une image dont `APP_VERSION` est vide, que l'application traite comme un build de développement. Le runtime SHALL lire la valeur dans l'environnement de l'image : le démarrage du conteneur ne SHALL demander aucune variable supplémentaire pour l'exposer.

#### Scenario: L'image de release expose son tag
- **WHEN** l'image est construite avec `--build-arg APP_VERSION=2.0.1`
- **THEN** un conteneur démarré depuis cette image sert une page « Aide » qui annonce « Version 2.0.1 »

#### Scenario: Le tag et la version de cache restent alignés
- **WHEN** une image de release est construite avec un tag
- **THEN** `sw.js` déclare `CACHE_VERSION = '<tag>'` et l'application rapporte le même tag sur la page « Aide »

#### Scenario: Un build local ne prétend pas être une release
- **WHEN** l'image est construite sans argument `APP_VERSION`
- **THEN** `APP_VERSION` est vide dans le conteneur et la page « Aide » affiche « Version développement »

#### Scenario: Aucune configuration du conteneur n'est nécessaire
- **WHEN** le conteneur est démarré sur Scaleway sans variable `APP_VERSION` définie dans sa configuration
- **THEN** la valeur employée pour la page « Aide » est celle que porte l'image

### Requirement: Ship minified static assets under their existing URLs

The image SHALL be built in two stages: an asset stage that installs the build dependencies and produces the static files, and the runtime stage that copies those files into `/app/public`. The asset stage SHALL minify `app.js`, `auth.js`, `pwa.js` and `style.css` while keeping each file's name and URL, and SHALL leave `htmx.min.js`, `simplewebauthn.js` (both already minified bundles that carry their licence banner), `offline.html`, `manifest.webmanifest`, `icons/` and `sw.js` otherwise unchanged. The runtime stage SHALL remain the non-root `node:22-alpine` image whose installed dependencies are the production ones only.

#### Scenario: The built image serves minified assets at the same paths

- **WHEN** the image is built and the container serves `/app.js` and `/style.css`
- **THEN** both responses are 200 with their original content types, their bodies are smaller than the repository sources, and the files are minified (no comments, no indentation)

#### Scenario: The build dependencies stay out of the runtime image

- **WHEN** the published image is inspected
- **THEN** `esbuild` and `lightningcss` are absent from `/app/node_modules` and their binaries are not present in the image

#### Scenario: Assets that must not be rebuilt are untouched

- **WHEN** `/htmx.min.js`, `/simplewebauthn.js`, `/icons/icon-192.png` and `/manifest.webmanifest` are compared with the repository files
- **THEN** they are byte-identical, because re-minifying an already compressed bundle would only strip its licence banner, and the page and the service worker reference these files by content

#### Scenario: The runtime contract is unchanged

- **WHEN** the built image runs
- **THEN** the server listens on `PORT` (default `3000`) as the non-root `node` user, and the build stage's tools and files are not needed at runtime

### Requirement: Fail the image build when an asset cannot be produced

The asset stage SHALL fail the build when an expected source file is missing, when a minified output is empty, or when the service worker's cache-version pattern cannot be found. A failed build SHALL NOT produce a published image.

#### Scenario: A missing source aborts the build

- **WHEN** one of the listed static files is absent from the build context
- **THEN** `docker build` fails before the runtime stage starts

#### Scenario: An empty output aborts the build

- **WHEN** minification produces an empty file
- **THEN** the build fails instead of shipping an empty asset

