## MODIFIED Requirements

### Requirement: Store each domain in its own JSON file
The system SHALL persist each domain in its own JSON file under the data directory, where the file describes a single domain as an object with a unique id, a display name, a slug, an order, a labels array of theme ids, and a projects array holding that domain's outline as an array of root nodes. A given JSON file SHALL carry the data of only one domain.

#### Scenario: A domain is persisted in its own file
- **WHEN** a domain is created or modified
- **THEN** the domain's data is written to its own dedicated JSON file

#### Scenario: A file carries a single domain
- **WHEN** a domain file is read
- **THEN** it contains exactly one domain with the fields id, name, slug, order, labels, and projects

#### Scenario: Projects are exposed as the domain's root nodes
- **WHEN** a domain is loaded
- **THEN** its projects array is exposed as the root nodes of that domain's outline

### Requirement: Enumerate domains by scanning the data directory
The system SHALL enumerate the domains by scanning the data directory for JSON files, ignoring temporary or backup files, the theme palette file `data/themes.json`, and any file that is not a valid domain object.

#### Scenario: Domains are discovered from the files
- **WHEN** the domain list is requested
- **THEN** each valid domain file in the data directory becomes an entry in the list of domains

#### Scenario: Non-domain files are ignored
- **WHEN** a JSON file in the data directory is a temporary or backup file, or is not a valid domain object
- **THEN** it is not listed as a domain

#### Scenario: The theme palette is not listed as a domain
- **WHEN** `data/themes.json` is present in the data directory
- **THEN** it is not listed as a domain

#### Scenario: Invalid JSON does not break the listing
- **WHEN** a file in the data directory cannot be parsed as JSON
- **THEN** it is skipped and the remaining domains are still listed

## ADDED Requirements

### Requirement: Initialize missing labels on load
The system SHALL, when loading a domain file that has no `labels` field, initialize that domain's `labels` to an empty array, so existing domain files remain valid after this change.

#### Scenario: A legacy domain file defaults to no themes
- **WHEN** a domain file without a `labels` field is loaded
- **THEN** the domain's `labels` is an empty array
