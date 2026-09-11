## 1. Dependency & Configuration

- [x] 1.1 Add `@aws-sdk/client-s3` to `package.json` dependencies and run `npm install`.
- [x] 1.2 Document the S3 environment variables (`S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) and the MinIO local dev setup in `Readme.md`.

## 2. S3 Storage Module

- [x] 2.1 Create `storage.js` that builds an `S3Client` from the environment (endpoint, region, static credentials) and resolves the bucket name.
- [x] 2.2 Implement `ensureBucket()`: `HeadBucket`, and `CreateBucket` when the bucket is missing (self-bootstrapping, safe no-op when it exists).
- [x] 2.3 Implement `readJson(key)`: return the parsed JSON object, or `null` when the object is missing or cannot be parsed.
- [x] 2.4 Implement `writeJson(key, data)`: serialize to JSON and write with a single atomic `PutObject`.
- [x] 2.5 Implement `listKeys(prefix)`: return the object keys under a prefix (`ListObjectsV2`) for domain enumeration.
- [x] 2.6 Implement `moveObject(srcKey, destKey)`: copy to the destination then delete the source (used for archive).

## 3. Refactor `server.js` Persistence

- [x] 3.1 Replace the filesystem helpers (`tryRead`, `atomicWrite`) and `persistDomain`/`persistThemes` to write through `storage.js` (`writeJson`), keeping the existing `writeQueue` serialization.
- [x] 3.2 Update `loadDomains()` to enumerate via `listKeys('domains/')` and load each object with `readJson`, keeping the in-memory map and the seed/empty logic.
- [x] 3.3 Update `loadThemes()` to read the `themes.json` object (missing/unparseable ⇒ empty palette).
- [x] 3.4 Update the domain archive route to `moveObject('domains/{id}.json', 'archive/{id}.json')`.
- [x] 3.5 Add the one-time local → S3 import: when the `domains/` prefix is empty and local `data/*.json` domain files exist, import them and `data/themes.json` into the bucket.
- [x] 3.6 Update the startup sequence to call `ensureBucket()` before loading, list domains from the bucket, and fail fast with a clear error when S3 is configured but unusable.

## 4. Docker Compose (MinIO local dev)

- [x] 4.1 Add a `minio` service to `docker-compose.yml` (`minio/minio`) with `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`, a named volume, and ports `9000`/`9001`.
- [x] 4.2 Point the `web` service's S3 env vars at the MinIO endpoint/credentials and add a `depends_on` + MinIO healthcheck so the app waits for it.

## 5. Verification

- [x] 5.1 Start `docker-compose` and confirm the app creates the bucket and imports the existing `data/` domain files and `themes.json` into MinIO on first run.
  - Verified against a local S3-compatible mock (s3rver): the bucket was created, the existing `data/` domains (`maison`, `Projets`) and `themes.json` were imported into `domains/` + `themes.json` objects.
- [x] 5.2 Exercise domain and theme CRUD (create, rename, archive, attach label) and restart to confirm persistence is served from S3 objects.
  - Verified create domain/theme/node, rename, archive (object moved to `archive/`), and a full restart: all domains and the theme are reloaded from the bucket.
- [x] 5.3 Confirm the production environment variables (Scaleway endpoint/region/bucket/credentials) are honoured — no code change expected.
  - The `storage.js` adapter reads `S3_ENDPOINT`/`S3_REGION`/`S3_BUCKET`/`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` (already injected by `main.tf`) and uses path-style addressing, compatible with Scaleway Object Storage. No code change was required.
