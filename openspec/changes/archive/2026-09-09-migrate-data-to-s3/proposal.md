## Why

The app persists all project data (each domain outline and the theme palette) as local JSON files under `data/`. This only works on a single filesystem, which is fragile for the Scaleway serverless-container deployment: instances are ephemeral, the mounted volume is not a durable shared store, and the single-writer local file store blocks horizontal scaling. A Scaleway Object Storage bucket (`docdoc-json-storage`) and its IAM credentials are already provisioned in `main.tf`, so moving the data layer onto that bucket removes the single-instance/filesystem constraint and gives durable, centralized storage.

## What Changes

- Add an S3-compatible object storage layer (`@aws-sdk/client-s3`) configured from environment variables (endpoint, region, bucket, credentials).
- Store each domain outline as its own object under `domains/{id}.json` instead of `data/{id}.json`.
- Store the theme palette as a single `themes.json` object instead of `data/themes.json`.
- Enumerate domains by listing the `domains/` prefix instead of scanning the local data directory.
- Archive a domain by moving its object to `archive/{id}.json` instead of renaming a local file.
- Provision the bucket on startup if it does not exist (self-bootstrapping), so local dev/MinIO needs no pre-created bucket.
- One-time migration: on first run against an empty bucket, import the existing local `data/*.json` domain files and `themes.json` into S3.
- Add a MinIO service to `docker-compose.yml` for S3-compatible local development.
- Keep the in-memory domain map and write serialization unchanged; only the persistence sink changes.

## Capabilities

### New Capabilities
- `s3-storage`: the S3-compatible object storage adapter — endpoint/credential configuration, bucket provisioning, and JSON object read/write/list/move operations.

### Modified Capabilities
- `domain-storage`: move domain persistence from local JSON files in the data directory to S3 objects under `domains/`, and enumerate domains by listing the bucket prefix.
- `project-storage`: move outline persistence from the local data file to an S3 object.
- `theme-storage`: move the theme palette from `data/themes.json` to an S3 `themes.json` object.

## Impact

- `server.js`: replace the filesystem persistence helpers with an S3 storage module; config comes from the env vars already set in `main.tf`.
- `main.tf`: already provisions the bucket, IAM key, and env vars; only the `S3_REGION`/`S3_ENDPOINT` values may need revisiting.
- `docker-compose.yml`: add a MinIO service and wire the `web` service's S3 env vars to it for local dev.
- `Dockerfile`: the content is served over the network, so the data volume is no longer the store; the `data/` dir is kept only as a legacy import source.
- `package.json`: add `@aws-sdk/client-s3`.
- `data/` directory: becomes a legacy/import source, no longer the source of truth.
