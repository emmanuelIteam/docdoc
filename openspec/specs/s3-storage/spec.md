# s3-storage Specification

## Purpose
TBD - created by archiving change migrate-data-to-s3. Update Purpose after archive.
## Requirements
### Requirement: Configure the S3 client from environment variables
The system SHALL configure the S3-compatible client from the `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` environment variables, so the same code path works against Scaleway Object Storage in production and a MinIO instance locally.

#### Scenario: The client is configured for the configured endpoint
- **WHEN** the server starts with the S3 environment variables set
- **THEN** the S3 client targets `S3_ENDPOINT` with the provided credentials and region

#### Scenario: No credentials means no S3 operations
- **WHEN** the S3 environment variables are absent
- **THEN** the app does not attempt S3 operations and continues without a configured bucket

### Requirement: Provision the bucket on startup
The system SHALL create the configured bucket on startup if it does not already exist, so local dev/MinIO needs no pre-created bucket.

#### Scenario: A missing bucket is created
- **WHEN** the server starts and the configured bucket does not exist
- **THEN** the bucket is created

#### Scenario: An existing bucket is left untouched
- **WHEN** the server starts and the configured bucket already exists
- **THEN** the bucket is not recreated or modified

### Requirement: Read and write JSON objects
The system SHALL read and write objects as JSON under a given key in the configured bucket.

#### Scenario: Write an object as JSON
- **WHEN** a domain outline or the theme palette is persisted
- **THEN** its JSON representation is stored under the corresponding key

#### Scenario: Read a JSON object
- **WHEN** storage is asked for a key
- **THEN** the parsed JSON is returned, or null when the object does not exist or cannot be parsed

### Requirement: List objects by prefix
The system SHALL list the object keys under a given prefix for domain enumeration.

#### Scenario: List objects under the domains prefix
- **WHEN** domains are enumerated
- **THEN** the keys under the `domains/` prefix are returned

### Requirement: Move an object
The system SHALL move an object from a source key to a destination key (copy then delete) for archive operations.

#### Scenario: Archive moves an object to the archive prefix
- **WHEN** a domain is archived
- **THEN** its object is moved from `domains/{id}.json` to `archive/{id}.json`

