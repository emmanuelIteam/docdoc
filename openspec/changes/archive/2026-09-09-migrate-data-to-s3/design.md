## Context

The app is a single-file Express + htmx outliner. All mutable state is persisted as local JSON files under `data/`: one file per domain (`data/{id}.json`), the theme palette (`data/themes.json`), and an `archive/` sub-directory for archived domains. This filesystem store constrains the deployment to a single instance with a durable local volume.

The Scaleway infrastructure is already provisioned in `main.tf`: an object bucket `docdoc-json-storage`, a dedicated IAM API key, and the container environment variables `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`. Only the application code still reads and writes the local filesystem.

`docker-compose.yml` currently runs the app with a named volume (`projets-data`) for local development; there is no local S3 yet.

## Goals / Non-Goals

**Goals:**

- Move the persistence layer to an S3-compatible object store: Scaleway Object Storage in production, MinIO in local dev.
- Keep the in-memory model and the HTTP/htmx API unchanged — no client or contract change.
- Provide a one-time migration of the existing local data into the bucket.
- Keep the app runnable locally via `docker-compose.yml` with a local MinIO service.

**Non-Goals:**

- Multi-user authentication or any change to the rendering / API surface.
- Performance tuning for very large datasets (the stored objects are small JSON blobs).
- Object versioning, conflict resolution, or offline sync.
- Replacing or restructuring the already-provisioned Terraform infrastructure.

## Decisions

### 1. S3 client: `@aws-sdk/client-s3`
Use the official AWS SDK v3 for JavaScript. It is the maintained, minimal client, and it natively supports a custom endpoint (`endpoint`), region, static credentials, and path-style addressing, which is exactly what both Scaleway Object Storage and MinIO need.
- Alternatives considered: `aws-sdk` v2 (in maintenance, heavier) and a hand-rolled AWS Signature V4 signer (fragile, no value here).

### 2. One backend, endpoint switched by environment
There is no separate filesystem code path for the data layer. The same storage module talks to whatever `S3_ENDPOINT` points at: `https://s3.fr-par.scw.cloud` in production, `http://minio:9000` in dev. The filesystem is only used as a read-only import source for the one-time migration.
- Alternative considered: a local-filesystem fallback behind an interface. Rejected because the local MinIO service already provides a local S3 endpoint, so a fallback would add code without covering a real gap.

### 3. Key layout in the bucket
- Domains: `domains/{id}.json`
- Theme palette: `themes.json`
- Archived domains: `archive/{id}.json`

This keeps domain enumeration to a single prefix scan, and keeps archived domains out of the live listing.

### 4. Bucket self-provisioning on startup
On startup the module checks for the bucket (`HeadBucket`) and creates it (`CreateBucket`) if missing. This makes the MinIO local setup zero-config, and is a no-op in production where Terraform already created the bucket. MinIO reports a missing bucket with its own error shape, so the check catches broadly rather than matching a single error code.

### 5. Write serialization is retained
The existing `writeQueue` promise chain stays, so domain and theme writes remain ordered. An S3 PUT is atomic per object, but serialization preserves the existing "no partial object / no interleaved writes" guarantee without a code-behavior change for callers.

### 6. One-time local → S3 import
On startup, if the `domains/` prefix is empty while local `data/*.json` domain files exist, the module imports those domains and `themes.json` into the bucket. The "empty prefix" check is intentionally stateless (no marker object), so the migration is idempotent and self-describing.
- Alternative considered: writing a `migration-complete` marker object. Rejected for simplicity; the empty-prefix check is sufficient and avoids stale-marker bugs.

### 7. In-memory maps remain the read path
`domains` and `themes` stay the in-memory source for all rendering and mutations; S3 is the durable sink. Startup loads from S3 (or imports) into memory. This avoids any change to the routes.

## Risks / Trade-offs

- **Startup latency from reading all objects** vs. a local `readdir` → Mitigation: objects are small JSON blobs; domain object reads can be issued in parallel during load.
- **Wrong bucket/credentials can break startup** → Mitigation: fail fast with a clear error message when S3 is configured but unusable; behave as an empty store when no credentials are set.
- **Stale re-import if the bucket is later emptied** → Mitigation: local `data/` becomes a read-only legacy source; acceptable given the single-writer flow, and documented in the migration plan.
- **Local dev now depends on the MinIO service being up** → Mitigation: `docker-compose.yml` uses `depends_on` with a healthcheck for MinIO and the app waits for it.
- **Consistency model** → Both Scaleway and MinIO provide read-after-write consistency for the same object; no stale-read concern for this single-writer workload.

## Migration Plan

1. Add the `@aws-sdk/client-s3` dependency to `package.json`.
2. Add a `storage.js` module exposing `ensureBucket`, `readJson`, `writeJson`, `listKeys`, `moveObject`.
3. Refactor `server.js` persistence (domains, themes, archive) to use the storage module.
4. Add a MinIO service and S3 environment variables to `docker-compose.yml`, and point the `web` service at it.
5. Verify locally with MinIO: first run imports the existing `data/` files, then all CRUD persists to the bucket.
6. Run the legacy import once against an empty production bucket, then deploy. Local `data/` files are preserved as the rollback source.
7. Rollback: revert to the previous image; the app reads local `data/` again, so no data is lost.

## Open Questions

- Is the "empty `domains/` prefix" check sufficient to avoid an unwanted re-import in normal use, or should a marker object be added? Current leaning: the empty-prefix check is enough; revisit only if stale re-import becomes a real problem.
- Should `S3_BUCKET` differ per environment (e.g. `docdoc-json-storage` in prod, `docdoc-data` in dev)? It is read from env, so this is resolved by configuration, not code.
