## MODIFIED Requirements

### Requirement: Version caches and remove outdated ones

The service worker's cache name SHALL embed an explicit version constant kept next to the worker's source (`CACHE_VERSION` in `public/sw.js`). On `activate`, the worker SHALL delete every cache whose name carries the application cache prefix but is not the current version, while keeping the current cache intact. In a published image, the build SHALL replace that constant with the release tag (the pushed git tag), so every release activates a new cache without a manual edit. A run from the repository SHALL keep the repository's constant, and changing a precached static asset without releasing SHALL require bumping it. The repository documentation SHALL state both rules.

#### Scenario: A new version removes the previous cache

- **WHEN** a worker with a newer cache version activates
- **THEN** the previous `docdoc-static-*` cache is deleted and the current one remains

#### Scenario: The current cache survives activation

- **WHEN** the worker activates with an already current cache
- **THEN** that cache and its entries are preserved

#### Scenario: Unrelated caches are not touched

- **WHEN** the worker activates
- **THEN** caches whose names do not carry the application prefix are left untouched

#### Scenario: A release carries its tag as cache version

- **WHEN** the image is built for the release tag `1.10` and `/sw.js` is served from that image
- **THEN** the worker declares `CACHE_VERSION` `1.10` and its cache name is `docdoc-static-1.10`

#### Scenario: A run from the repository keeps the source version

- **WHEN** the application is started from the working tree (`pnpm start` or `docker compose up`) without a release build argument
- **THEN** `/sw.js` still declares the repository's `CACHE_VERSION` and no build substitution occurs

#### Scenario: A deployment invalidates the previous cache without a manual edit

- **WHEN** a newer release is deployed and its worker activates in a browser that cached the previous version
- **THEN** the previous `docdoc-static-*` cache is deleted even though no one edited the worker's constant
