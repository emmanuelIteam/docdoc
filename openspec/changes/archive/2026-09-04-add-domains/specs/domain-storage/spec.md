## ADDED Requirements

### Requirement: Store each domain in its own JSON file
The system SHALL persist each domain in its own JSON file under the data directory, where the file describes a single domain as an object with a unique id, a display name, a slug, an order, and a projects array holding that domain's outline as an array of root nodes. A given JSON file SHALL carry the data of only one domain.

#### Scenario: A domain is persisted in its own file
- **WHEN** a domain is created or modified
- **THEN** the domain's data is written to its own dedicated JSON file

#### Scenario: A file carries a single domain
- **WHEN** a domain file is read
- **THEN** it contains exactly one domain with the fields id, name, slug, order, and projects

#### Scenario: Projects are exposed as the domain's root nodes
- **WHEN** a domain is loaded
- **THEN** its projects array is exposed as the root nodes of that domain's outline

### Requirement: Enumerate domains by scanning the data directory
The system SHALL enumerate the domains by scanning the data directory for JSON files, ignoring temporary or backup files and any file that is not a valid domain object.

#### Scenario: Domains are discovered from the files
- **WHEN** the domain list is requested
- **THEN** each valid domain file in the data directory becomes an entry in the list of domains

#### Scenario: Non-domain files are ignored
- **WHEN** a JSON file in the data directory is a temporary or backup file, or is not a valid domain object
- **THEN** it is not listed as a domain

#### Scenario: Invalid JSON does not break the listing
- **WHEN** a file in the data directory cannot be parsed as JSON
- **THEN** it is skipped and the remaining domains are still listed

### Requirement: Order domains for display
The system SHALL order the list of domains by their order field ascending, and SHALL tie-break equal orders by name, when displaying the domain list.

#### Scenario: Domains are sorted by order
- **WHEN** the domain list is rendered
- **THEN** domains are sorted by order ascending, then by name

### Requirement: Write domain files atomically
The system SHALL write each domain file atomically by writing to a temporary file then renaming it over the target, and SHALL serialize writes so concurrent mutations do not interleave on a file.

#### Scenario: Writes are atomic
- **WHEN** a domain is modified
- **THEN** the file is written to a temporary file and atomically renamed over the target

#### Scenario: Mutations are serialized
- **WHEN** multiple mutations occur in sequence
- **THEN** they are written one at a time, so a crash mid-write cannot corrupt a domain file

### Requirement: Migrate the legacy single-file outline
The system SHALL, on first run after this change, detect a legacy `data/projects.json` that holds a bare array of project nodes, wrap it into a single domain named "Projets" whose projects are those root nodes, and SHALL preserve the original file by renaming it to `projects.json.bak`. When neither a legacy file nor any domain file exists, the system SHALL seed a "Projets" domain with an example outline.

#### Scenario: Legacy outline becomes a default domain
- **WHEN** a legacy `data/projects.json` exists at startup
- **THEN** its projects are migrated into a domain named "Projets"

#### Scenario: The legacy file is preserved
- **WHEN** the legacy file is migrated
- **THEN** the original file is renamed to `data/projects.json.bak` and is not deleted

#### Scenario: Seed when no data exists
- **WHEN** the server starts and neither a legacy file nor any domain file exists
- **THEN** a "Projets" domain is created with an example seed outline
