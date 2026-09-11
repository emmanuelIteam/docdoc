## ADDED Requirements

### Requirement: Scope node operations to the active domain
The system SHALL scope create, rename, reindent, delete, and move operations to the outline of the active domain, accessed through domain-scoped routes under `/domaine/:slug/...`, so that an operation never affects another domain.

#### Scenario: Create within the active domain
- **WHEN** the user creates a project or task on a domain page
- **THEN** it is added to that domain's outline and persisted in that domain's file

#### Scenario: Rename within the active domain
- **WHEN** the user renames a node on a domain page
- **THEN** the node's title is updated in that domain's outline only

#### Scenario: Delete within the active domain
- **WHEN** the user deletes a node on a domain page
- **THEN** the node is removed from that domain's outline only

#### Scenario: Move within the active domain
- **WHEN** the user moves a node on a domain page
- **THEN** the node is reordered within that domain's outline only
