## ADDED Requirements

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
