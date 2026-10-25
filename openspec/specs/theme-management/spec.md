# theme-management Specification

## Purpose
TBD - created by archiving change add-themes. Update Purpose after archive.
## Requirements
### Requirement: Create a theme

The system SHALL allow the user to create a theme from the administration page by entering a name and choosing a color, and SHALL add it to the palette with a fresh id. A theme name SHALL be unique within the palette; creating a theme whose name already exists SHALL be rejected. A new theme SHALL be appended at the end of the palette.

#### Scenario: Create a theme by name and color

- **WHEN** the user creates a theme with a name and a color from the administration page
- **THEN** a new theme is added to the end of the palette with that name and color

#### Scenario: Duplicate theme names are rejected

- **WHEN** the user creates a theme with a name that already exists in the palette
- **THEN** the creation is rejected and the palette is unchanged

### Requirement: Rename a theme

The system SHALL allow the user to change a theme's name and color in place from the administration page, keeping the same id and leaving all domain references valid. A rename to a name already carried by another theme SHALL be rejected.

#### Scenario: Rename updates the name and color

- **WHEN** the user renames a theme and submits a new color
- **THEN** the theme's name and color are updated under the same id

#### Scenario: A colliding name is rejected

- **WHEN** the user renames a theme to a name already carried by another theme
- **THEN** the rename is rejected and the theme keeps its previous name and color

#### Scenario: The theme's domains keep their label

- **WHEN** a theme is renamed
- **THEN** every domain that carried it still carries it, now displayed with the new name and color

### Requirement: Delete a theme

The system SHALL allow the user to delete a theme from the administration page, removing it from the palette and removing its id from the `labels` of every domain that carries it.

#### Scenario: Delete removes the theme from the palette

- **WHEN** the user deletes a theme
- **THEN** the theme is no longer present in the palette

#### Scenario: Delete prunes the theme from domains

- **WHEN** a theme is deleted
- **THEN** the theme's id is removed from the `labels` of every domain that carried it

#### Scenario: The deleted theme disappears from the sidebar and the matrix

- **WHEN** a theme is deleted
- **THEN** its group is no longer rendered in the sidebar and its row is no longer rendered in the matrix

### Requirement: Paste a theme label on a domain

The system SHALL allow attaching a theme to a domain from the label bar at the bottom right of the domain's page or from the theme × domain matrix of the administration page, adding the theme's id to the domain's `labels` without duplicating it; attaching an unknown theme id SHALL be rejected.

#### Scenario: A theme is attached from the domain page

- **WHEN** the user attaches a theme from the domain page's label bar
- **THEN** the theme's id is added to that domain's `labels`

#### Scenario: A theme is attached from the matrix

- **WHEN** the user toggles the cell of a theme and a domain in the matrix
- **THEN** the theme's id is added to that domain's `labels`

#### Scenario: Pasting the same theme twice is a no-op

- **WHEN** the user attaches a theme that is already on the domain
- **THEN** the domain's `labels` still contains that theme id exactly once

#### Scenario: An unknown theme is not attached

- **WHEN** the user attaches a theme id that does not exist in the palette
- **THEN** the attach is rejected and the domain is unchanged

### Requirement: Remove a theme label from a domain

The system SHALL allow detaching a theme from a domain from the label chips of the domain page's label bar or from the theme × domain matrix of the administration page, removing the theme's id from the domain's `labels`.

#### Scenario: A theme is detached from the domain page

- **WHEN** the user removes a theme from the domain page's label chips
- **THEN** the theme's id is removed from that domain's `labels`

#### Scenario: A theme is detached from the matrix

- **WHEN** the user toggles the filled cell of a theme and a domain in the matrix
- **THEN** the theme's id is removed from that domain's `labels`

### Requirement: Reorder themes

The system SHALL allow moving a theme one position up or down in the palette from the administration page, and SHALL persist the resulting palette order, which governs the order of the theme groups in the sidebar and of the theme rows in the matrix.

#### Scenario: Moving a theme up swaps it with its predecessor

- **WHEN** the user moves a theme up
- **THEN** it takes the position of the preceding theme, which takes its former position

#### Scenario: The first theme cannot move up

- **WHEN** the user moves the first theme of the palette up
- **THEN** the palette order is unchanged

#### Scenario: The last theme cannot move down

- **WHEN** the user moves the last theme of the palette down
- **THEN** the palette order is unchanged

#### Scenario: The new order is reflected in the sidebar

- **WHEN** the palette order changes
- **THEN** the sidebar renders the theme groups in the new order

### Requirement: Show the theme × domain matrix

The system SHALL display, in the themes section of the administration page, a matrix whose rows are the themes and whose columns are the domains, where each cell shows whether the domain carries the theme, and SHALL allow toggling that membership from the cell.

#### Scenario: A cell reflects the membership

- **WHEN** the matrix is rendered
- **THEN** each cell is marked when the column's domain carries an id of the row's theme in its `labels`, and unmarked otherwise

#### Scenario: Toggling a cell attaches the theme

- **WHEN** the user toggles an unmarked cell
- **THEN** the theme is added to that domain's `labels`

#### Scenario: Toggling a cell detaches the theme

- **WHEN** the user toggles a marked cell
- **THEN** the theme is removed from that domain's `labels`

#### Scenario: The matrix has an empty state

- **WHEN** the space has no theme or no domain
- **THEN** the matrix shows an explicit empty message instead of a grid

### Requirement: Manage labels from a floating bar

The system SHALL render the active domain's labels in a floating bar fixed at the bottom right of the domain page. The bar SHALL show one removable chip per attached theme. When the palette has at least one theme, it SHALL also show an add control that reveals the theme picker; when the palette is empty, it SHALL show a message linking to the administration page. Attaching or detaching a theme from the bar SHALL update the bar and the sidebar in place, without reloading the page or losing the scroll position.

#### Scenario: The bar is fixed at the bottom right

- **WHEN** a domain page is rendered
- **THEN** its labels are shown in a bar fixed at the bottom right of the viewport, outside the outline's flow

#### Scenario: The add control reveals the picker

- **WHEN** the palette has at least one theme and the user activates the add control of the bar
- **THEN** the theme picker is revealed, opening above the bar so it stays visible

#### Scenario: A chip removes its theme

- **WHEN** the user activates the remove control of a chip
- **THEN** the corresponding theme is detached and its chip disappears from the bar

#### Scenario: The bar updates without reloading

- **WHEN** the user attaches or detaches a theme from the bar
- **THEN** the bar reflects the change without a page reload and the scroll position is preserved

#### Scenario: The sidebar follows in the same response

- **WHEN** the user attaches or detaches a theme from the bar
- **THEN** the sidebar immediately groups the domain under the new theme group, or under "Sans thème" when it has no label left

#### Scenario: An empty palette points to the administration

- **WHEN** the space has no theme
- **THEN** the bar states that no theme exists and links to the administration page to create one

