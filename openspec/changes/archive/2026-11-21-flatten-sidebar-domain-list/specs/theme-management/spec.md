## MODIFIED Requirements

### Requirement: Delete a theme

The system SHALL allow the user to delete a theme from the administration page, removing it from the palette and removing its id from the `labels` of every domain that carries it. The theme SHALL disappear from the matrix and from the theme picker; the sidebar's flat domain list SHALL remain unchanged, since it does not depend on themes.

#### Scenario: Delete removes the theme from the palette

- **WHEN** the user deletes a theme
- **THEN** the theme is no longer present in the palette

#### Scenario: Delete prunes the theme from domains

- **WHEN** a theme is deleted
- **THEN** the theme's id is removed from the `labels` of every domain that carried it

#### Scenario: The deleted theme disappears from the matrix and the picker

- **WHEN** a theme is deleted
- **THEN** its row is no longer rendered in the matrix and its option is no longer offered by the label picker

#### Scenario: The sidebar stays a flat list

- **WHEN** a theme is deleted
- **THEN** the sidebar still lists every domain exactly once, in the same order

### Requirement: Reorder themes

The system SHALL allow moving a theme one position up or down in the palette from the administration page, and SHALL persist the resulting palette order, which governs the order of the theme rows in the matrix and of the theme options in the label picker. The sidebar's domain list SHALL NOT depend on the palette order.

#### Scenario: Moving a theme up swaps it with its predecessor

- **WHEN** the user moves a theme up
- **THEN** it takes the position of the preceding theme, which takes its former position

#### Scenario: The first theme cannot move up

- **WHEN** the user moves the first theme of the palette up
- **THEN** the palette order is unchanged

#### Scenario: The last theme cannot move down

- **WHEN** the user moves the last theme of the palette down
- **THEN** the palette order is unchanged

#### Scenario: The new order is reflected in the matrix

- **WHEN** the palette order changes
- **THEN** the matrix renders the theme rows in the new order

#### Scenario: The picker follows the palette order

- **WHEN** the palette order changes
- **THEN** the label picker offers the themes in the new order

#### Scenario: The sidebar is unaffected

- **WHEN** the palette order changes
- **THEN** the sidebar's flat domain list keeps the same domain order

### Requirement: Manage labels from a floating bar

The system SHALL render the active domain's labels in a floating bar fixed at the bottom right of the domain page. The bar SHALL show one removable chip per attached theme. When the palette has at least one theme, it SHALL also show an add control that reveals the theme picker; when the palette is empty, it SHALL show a message linking to the administration page. Attaching or detaching a theme from the bar SHALL update the bar in place, without reloading the page or losing the scroll position. The sidebar's flat domain list SHALL NOT change, since it no longer depends on theme labels.

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

#### Scenario: The sidebar keeps its flat list

- **WHEN** the user attaches or detaches a theme from the bar
- **THEN** the sidebar still lists every domain exactly once, in the same order

#### Scenario: An empty palette points to the administration

- **WHEN** the space has no theme
- **THEN** the bar states that no theme exists and links to the administration page to create one
