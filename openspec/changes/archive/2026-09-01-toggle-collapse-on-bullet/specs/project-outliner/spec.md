## MODIFIED Requirements

### Requirement: Toggle collapse on double-click
The system SHALL allow a line that has children to be collapsed or expanded by double-clicking its selection button.

#### Scenario: Double-click collapses a node
- **WHEN** the user double-clicks the selection button of an expanded node that has children
- **THEN** the node is collapsed and its children are hidden

#### Scenario: Double-click expands a node
- **WHEN** the user double-clicks the selection button of a collapsed node that has children
- **THEN** the node is expanded and its children become visible

#### Scenario: Double-click on a leaf does nothing
- **WHEN** the user double-clicks the selection button of a node that has no children
- **THEN** the node's state is unchanged
