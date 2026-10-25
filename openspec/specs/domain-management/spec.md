# domain-management Specification

## Purpose
TBD - created by archiving change add-domains. Update Purpose after archive.
## Requirements
### Requirement: Rename a domain

The system SHALL allow the user to rename a domain from the administration page through an edit control next to the domain's name, updating its display name and regenerating its slug; the rename form SHALL NOT be visible until that control is activated. After a rename the domain keeps the same id and file, the previous slug is no longer resolvable, and the user is returned to the administration page. The revealed form SHALL warn that the domain's URL will be regenerated. The domain page SHALL NOT offer any renaming control.

#### Scenario: Rename updates the name and slug

- **WHEN** the user renames a domain
- **THEN** its name is updated, its slug is regenerated, and it is kept under the same id and file

#### Scenario: The old URL is no longer valid

- **WHEN** the user visits the previous slug after a rename
- **THEN** a "Domaine introuvable" response is returned

#### Scenario: Renaming from the administration page returns to it

- **WHEN** the user renames a domain from the administration page
- **THEN** the response redirects to the administration page

#### Scenario: The edit control reveals the form

- **WHEN** the administration page renders a domain row
- **THEN** the name is displayed with an edit control, and the rename form is not visible until the control is activated

#### Scenario: The URL change is announced

- **WHEN** the user activates the edit control of a domain
- **THEN** the revealed form states that the domain's URL will be regenerated from the new name

#### Scenario: The domain page offers no renaming

- **WHEN** a domain page is rendered
- **THEN** its title is read-only and no rename field or edit control is present

### Requirement: Delete a domain by archiving it

The system SHALL allow the user to archive a domain from the administration page, moving its object to the account's archive prefix (preserving its data rather than permanently removing it), removing it from the active list and its URL, and returning the user to the administration page.

#### Scenario: Archiving moves the domain object

- **WHEN** the user archives a domain
- **THEN** its object is moved to the account's archive prefix and the domain is no longer listed

#### Scenario: An archived domain is not reachable at its URL

- **WHEN** an archived domain is accessed at its former URL
- **THEN** a "Domaine introuvable" response is returned

#### Scenario: Archiving from the administration page returns to it

- **WHEN** the user archives a domain from the administration page
- **THEN** the response redirects to the administration page

### Requirement: Guide the user when no domain exists

The system SHALL show an empty state prompting the user to create a domain from the administration page when no domain exists, and that empty state SHALL link to the administration page.

#### Scenario: Empty prompt when there are no domains

- **WHEN** there are no domains
- **THEN** the app prompts the user to create a domain from the administration page instead of failing

#### Scenario: The homepage empty state links to the administration page

- **WHEN** the homepage is visited with an empty space
- **THEN** the empty state offers a link to `/administration`

### Requirement: Create a domain from the administration page

The system SHALL allow the user to create a new domain by entering its name in the domains section of the administration page, and SHALL create the domain with a fresh id, a generated slug, the next order, and one level-1 project line titled "Nouveau projet", then keep the user on the administration page.

#### Scenario: Create a domain by name

- **WHEN** the user creates a domain with a name from the administration page
- **THEN** a new domain object is created with that name and appears in the domains section

#### Scenario: A new domain contains a default project

- **WHEN** a domain is created
- **THEN** its outline contains exactly one root line titled "Nouveau projet"

#### Scenario: The new domain appears in the sidebar

- **WHEN** a domain is created
- **THEN** it is listed in the sidebar

#### Scenario: An empty name is rejected

- **WHEN** the user submits an empty domain name
- **THEN** the creation is rejected and no domain object is written

#### Scenario: The user stays on the administration page

- **WHEN** a domain is created from the administration page
- **THEN** the response returns the user to the administration page rather than to the new domain's page

### Requirement: Reorder domains

The system SHALL allow moving a domain one position up or down in the sidebar order from the administration page by exchanging its `order` with that of its displayed neighbour, and SHALL persist the resulting order; domains that share the same `order` SHALL be renumbered before the exchange so the move is always effective.

#### Scenario: Moving a domain up swaps it with its predecessor

- **WHEN** the user moves a domain up
- **THEN** it takes the display position of the preceding domain and both orders are persisted

#### Scenario: Moving a domain down swaps it with its successor

- **WHEN** the user moves a domain down
- **THEN** it takes the display position of the following domain and both orders are persisted

#### Scenario: The first domain cannot move up

- **WHEN** the user moves the first domain of the list up
- **THEN** the order is unchanged

#### Scenario: The last domain cannot move down

- **WHEN** the user moves the last domain of the list down
- **THEN** the order is unchanged

#### Scenario: Duplicate orders are renumbered

- **WHEN** a move is requested while several domains share the same `order`
- **THEN** the domains are renumbered in display order before the exchange, so the requested move still changes their relative positions

#### Scenario: The sidebar follows the new order

- **WHEN** the order of domains changes
- **THEN** the sidebar lists the domains in the new order within their theme groups

