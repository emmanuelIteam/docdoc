# domain-storage Specification

## Purpose
TBD - created by archiving change add-domains. Update Purpose after archive.
## Requirements
### Requirement: Store each domain in its own JSON file
The system SHALL persist each domain as its own object in the S3 bucket, keyed `users/{userId}/domains/{id}.json` where `userId` is the owning account's identifier, where the object describes a single domain as an object with a unique id, a display name, a slug, an order, a labels array of theme ids, and a projects array holding that domain's outline as an array of root nodes. A given object SHALL carry the data of only one domain.

#### Scenario: A domain is persisted in its own object
- **WHEN** a domain is created or modified
- **THEN** the domain's data is written to its own dedicated object under the owning account's domains prefix

#### Scenario: An object carries a single domain
- **WHEN** a domain object is read
- **THEN** it contains exactly one domain with the fields id, name, slug, order, labels, and projects

#### Scenario: Projects are exposed as the domain's root nodes
- **WHEN** a domain is loaded
- **THEN** its projects array is exposed as the root nodes of that domain's outline

### Requirement: Enumerate domains by scanning the data directory
The system SHALL enumerate an account's domains by listing the objects under that account's `domains/` prefix in the S3 bucket, ignoring any object that is not a valid domain object, and SHALL NOT enumerate objects belonging to another account or to the bucket root.

#### Scenario: Domains are discovered from the bucket
- **WHEN** the domain list is requested for an account
- **THEN** each valid domain object under that account's domains prefix becomes an entry in the list of domains

#### Scenario: Non-domain objects are ignored
- **WHEN** an object under the account's domains prefix is not a valid domain object
- **THEN** it is not listed as a domain

#### Scenario: Invalid JSON does not break the listing
- **WHEN** an object under the account's domains prefix cannot be parsed as JSON
- **THEN** it is skipped and the remaining domains are still listed

#### Scenario: Another account's domains are not listed
- **WHEN** the domain list is requested for one account while another account's domains exist
- **THEN** only the requesting account's domains are listed

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
The system SHALL, when an account's space is created and the bucket-root `domains/` prefix or the bucket-root `themes.json` key still holds data, move those objects into that account's space rather than leaving them at the bucket root. The system SHALL NOT create a seed or example outline: a new account whose space holds no domain starts with an empty space.

#### Scenario: Local domains are imported into the bucket
- **WHEN** the server starts with an empty bucket and local `data/*.json` domain files exist
- **THEN** these domains are written to the bucket as domain objects

#### Scenario: The local theme palette is imported
- **WHEN** the server starts with an empty bucket and local `data/themes.json` exists
- **THEN** the palette is written to the bucket

#### Scenario: No seed outline is created
- **WHEN** an account space is created and neither local files nor legacy bucket-root objects exist
- **THEN** the account's space is empty and no example domain or outline is written

### Requirement: Initialize missing labels on load
The system SHALL, when loading a domain file that has no `labels` field, initialize that domain's `labels` to an empty array, so existing domain files remain valid after this change.

#### Scenario: A legacy domain file defaults to no themes
- **WHEN** a domain file without a `labels` field is loaded
- **THEN** the domain's `labels` is an empty array

