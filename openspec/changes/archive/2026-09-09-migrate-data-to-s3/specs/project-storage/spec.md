# project-storage Specification

## MODIFIED Requirements

### Requirement: Persist the outline to a local JSON file
The system SHALL persist each domain's outline to its own object in the S3 bucket keyed `domains/{id}.json`, saving on change and reloading on startup, and SHALL not combine multiple domains into a single object.

#### Scenario: Changes are saved to the domain's object
- **WHEN** a domain's outline changes
- **THEN** the updated outline is written to that domain's object

#### Scenario: Outline is restored after restart
- **WHEN** the server restarts
- **THEN** each domain's outline is reloaded from its own object

#### Scenario: Only one domain is stored per object
- **WHEN** a domain object is read
- **THEN** it contains that single domain's outline only
