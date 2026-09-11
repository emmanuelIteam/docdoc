# domain-management Specification

## Purpose
TBD - created by archiving change add-domains. Update Purpose after archive.

## Requirements

### Requirement: Create a domain from the sidebar
The system SHALL allow the user to create a new domain by entering its name from the sidebar, and SHALL create the domain with a fresh id, a generated slug, the next order, and an empty projects array, then navigate to its page.

#### Scenario: Create a domain by name
- **WHEN** the user creates a domain with a name
- **THEN** a new domain file is created with that name and an empty outline, and the user lands on its page

#### Scenario: The new domain appears in the sidebar
- **WHEN** a domain is created
- **THEN** it is listed in the sidebar

### Requirement: Rename a domain
The system SHALL allow the user to rename a domain, updating its display name and regenerating its slug; after a rename the domain keeps the same id and file, and the previous slug is no longer resolvable.

#### Scenario: Rename updates the name and slug
- **WHEN** the user renames a domain
- **THEN** its name is updated, its slug is regenerated, and it is kept under the same id and file

#### Scenario: The old URL is no longer valid
- **WHEN** the user visits the previous slug after a rename
- **THEN** a "Domaine introuvable" response is returned

### Requirement: Delete a domain by archiving it
The system SHALL allow the user to delete a domain by moving its file to an archive directory `data/archive/` (preserving its data rather than permanently removing it), and SHALL remove the domain from the active list and its URL.

#### Scenario: Delete archives the domain file
- **WHEN** the user deletes a domain
- **THEN** its file is moved to `data/archive/` and the domain is no longer listed

#### Scenario: A deleted domain is not reachable at its URL
- **WHEN** a deleted domain is accessed at its former URL
- **THEN** a "Domaine introuvable" response is returned

### Requirement: Guide the user when no domain exists
The system SHALL show an empty state prompting the user to create a domain when no domain exists.

#### Scenario: Empty prompt when there are no domains
- **WHEN** there are no domains
- **THEN** the app prompts the user to create a domain instead of failing
