## ADDED Requirements

### Requirement: Scope status application to the active domain
The system SHALL apply status changes to lines of the active domain's outline, accessed through domain-scoped routes under `/domaine/:slug/...`, so that changing a status never affects another domain.

#### Scenario: Status applies within the active domain
- **WHEN** the user changes a status on a domain page
- **THEN** the status is applied to lines of that domain's outline only

#### Scenario: A status cascade stays within the active domain
- **WHEN** a status cascades to a line's descendants
- **THEN** it cascades within that domain's outline and does not affect another domain
