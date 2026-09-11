# domain-storage Specification

## Purpose
TBD - created by archiving change add-domains. Update Purpose after archive.
## Requirements
### Requirement: Store each domain in its own JSON file
The system SHALL persist each domain as its own object in the S3 bucket, keyed `domains/{id}.json`, where the object describes a single domain as an object with a unique id, a display name, a slug, an order, a labels array of theme ids, and a projects array holding that domain's outline as an array of root nodes. A given object SHALL carry the data of only one domain.

#### Scenario: A domain is persisted in its own object
- **WHEN** a domain is created or modified
- **THEN** the domain's data is written to its own dedicated object `domains/{id}.json`

#### Scenario: An object carries a single domain
- **WHEN** a domain object is read
- **THEN** it contains exactly one domain with the fields id, name, slug, order, labels, and projects

#### Scenario: Projects are exposed as the domain's root nodes
- **WHEN** a domain is loaded
- **THEN** its projects array is exposed as the root nodes of that domain's outline

### Requirement: Enumerate domains by scanning the data directory
The system SHALL enumerate the domains by listing the objects under the `domains/` prefix in the S3 bucket, ignoring any object that is not a valid domain object.

#### Scenario: Domains are discovered from the bucket
- **WHEN** the domain list is requested
- **THEN** each valid domain object under the `domains/` prefix becomes an entry in the list of domains

#### Scenario: Non-domain objects are ignored
- **WHEN** an object under the `domains/` prefix is not a valid domain object
- **THEN** it is not listed as a domain

#### Scenario: Invalid JSON does not break the listing
- **WHEN** an object under the `domains/` prefix cannot be parsed as JSON
- **THEN** it is skipped and the remaining domains are still listed

### Requirement: Order domains for display
The system SHALL order the list of domains by their order field ascending, and SHALL tie-break equal orders by name, when displaying the domain list.

#### Scenario: Domains are sorted by order
- **WHEN** the domain list is rendered
- **THEN** domains are sorted by order ascending, then by name

### Requirement: Write domain files atomically
The system SHALL write each domain object with a single atomic PUT and SHALL serialize writes so concurrent mutations do not interleave on an object.

#### Scenario: Writes are atomic
- **WHEN** a domain is modified
- **THEN** the object is written in a single PUT so a crash mid-write cannot leave a partial object

#### Scenario: Mutations are serialized
- **WHEN** multiple mutations occur in sequence
- **THEN** they are written one at a time

### Requirement: Migrate the legacy single-file outline
The system SHALL, on first run against an empty bucket, import the existing local `data/*.json` domain files and `data/themes.json` into the bucket as `domains/{id}.json` and `themes.json`, so existing filesystem data is preserved. When neither a local data file nor any domain object exists, the system SHALL seed a "Projets" domain with an example outline.

#### Scenario: Local domains are imported into the bucket
- **WHEN** the server starts with an empty bucket and local `data/*.json` domain files exist
- **THEN** these domains are written to the bucket as `domains/{id}.json`

#### Scenario: The local theme palette is imported
- **WHEN** the server starts with an empty bucket and local `data/themes.json` exists
- **THEN** the palette is written to the bucket as `themes.json`

#### Scenario: Seed when no data exists
- **WHEN** the server starts and neither local files nor domain objects exist
- **THEN** a "Projets" domain is created with an example seed outline

### Requirement: Initialize missing labels on load
The system SHALL, when loading a domain file that has no `labels` field, initialize that domain's `labels` to an empty array, so existing domain files remain valid after this change.

#### Scenario: A legacy domain file defaults to no themes
- **WHEN** a domain file without a `labels` field is loaded
- **THEN** the domain's `labels` is an empty array

