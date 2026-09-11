## MODIFIED Requirements

### Requirement: Persist the outline to a local JSON file
The system SHALL persist each domain's outline to its own local JSON file in the data directory, saving on change and reloading on startup, and SHALL not combine multiple domains into a single JSON file.

#### Scenario: Changes are saved to the domain's file
- **WHEN** a domain's outline changes
- **THEN** the updated outline is written to that domain's JSON file

#### Scenario: Outline is restored after restart
- **WHEN** the server restarts
- **THEN** each domain's outline is reloaded from its own JSON file

#### Scenario: Only one domain is stored per file
- **WHEN** a domain file is read
- **THEN** it contains that single domain's outline only

## REMOVED Requirements

### Requirement: Create initial seed data
**Reason**: Initial content is now created as a "Projets" domain (see the `domain-storage` capability) rather than as a bare data file.
**Migration**: On first run the system creates a "Projets" domain containing the example seed outline; no separate seed data file is written.
