## ADDED Requirements

### Requirement: Create a theme
The system SHALL allow the user to create a theme by entering a name and choosing a color, and SHALL add it to the palette with a fresh id. A theme name SHALL be unique within the palette; creating a theme whose name already exists SHALL be rejected.

#### Scenario: Create a theme by name and color
- **WHEN** the user creates a theme with a name and a color
- **THEN** a new theme is added to the palette with that name and color

#### Scenario: Duplicate theme names are rejected
- **WHEN** the user creates a theme with a name that already exists in the palette
- **THEN** the creation is rejected

### Requirement: Rename a theme
The system SHALL allow the user to change a theme's name and color in place, keeping the same id and leaving all domain references valid.

#### Scenario: Rename updates the name and color
- **WHEN** the user renames a theme
- **THEN** the theme's name and color are updated under the same id

### Requirement: Delete a theme
The system SHALL allow the user to delete a theme, removing it from the palette and removing its id from the `labels` of every domain that carries it.

#### Scenario: Delete removes the theme from the palette
- **WHEN** the user deletes a theme
- **THEN** the theme is no longer present in the palette

#### Scenario: Delete prunes the theme from domains
- **WHEN** a theme is deleted
- **THEN** the theme's id is removed from the `labels` of every domain that carried it

### Requirement: Paste a theme label on a domain
The system SHALL allow attaching a theme to a domain, adding the theme's id to the domain's `labels` without duplicating it; attaching an unknown theme id SHALL be rejected.

#### Scenario: A theme is attached to a domain
- **WHEN** the user attaches a theme to a domain
- **THEN** the theme's id is added to that domain's `labels`

#### Scenario: Pasting the same theme twice is a no-op
- **WHEN** the user attaches a theme that is already on the domain
- **THEN** the domain's `labels` still contains that theme id exactly once

#### Scenario: An unknown theme is not attached
- **WHEN** the user attaches a theme id that does not exist in the palette
- **THEN** the attach is rejected

### Requirement: Remove a theme label from a domain
The system SHALL allow detaching a theme from a domain, removing the theme's id from the domain's `labels`.

#### Scenario: A theme is detached from a domain
- **WHEN** the user removes a theme from a domain
- **THEN** the theme's id is removed from the domain's `labels`
