## MODIFIED Requirements

### Requirement: Show a context menu on hover or selection
The system SHALL display a context menu for a line only when that line is selected, and SHALL keep the menu open while the user interacts with it.

#### Scenario: Context menu appears only on selection
- **WHEN** a line is selected
- **THEN** a context menu appears offering the available formatting actions

#### Scenario: Context menu does not appear on hover
- **WHEN** a line is hovered but not selected
- **THEN** no context menu is shown

#### Scenario: Context menu offers formatting actions
- **WHEN** the context menu is shown
- **THEN** it offers an action to mark the line in progress and an action to mark the line done

## ADDED Requirements

### Requirement: Toggle collapse on double-click
The system SHALL allow a line that has children to be collapsed or expanded by double-clicking the line.

#### Scenario: Double-click collapses a node
- **WHEN** the user double-clicks an expanded node that has children
- **THEN** the node is collapsed and its children are hidden

#### Scenario: Double-click expands a node
- **WHEN** the user double-clicks a collapsed node that has children
- **THEN** the node is expanded and its children become visible

#### Scenario: Double-click on a leaf does nothing
- **WHEN** the user double-clicks a node that has no children
- **THEN** the node's state is unchanged

### Requirement: Render lines with compact vertical spacing
The system SHALL render outline lines with reduced vertical spacing so the outline is compact.

#### Scenario: Lines are compactly spaced
- **WHEN** the outline is rendered
- **THEN** the vertical spacing between adjacent lines is kept minimal
