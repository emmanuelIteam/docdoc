## ADDED Requirements

### Requirement: Select a line with its sub-lines
The system SHALL select a line together with all of its sub-lines (its entire descendant subtree) when the user clicks the line's selection button, and SHALL fully select every descendant so that each selected line is highlighted and shows its context menu. Clicking the selection button of an already-selected line SHALL deselect the line and all of its sub-lines.

#### Scenario: Selecting a line selects its sub-lines
- **WHEN** the user clicks the selection button of a line that has child lines and the line is not selected
- **THEN** the line and all of its sub-lines are selected

#### Scenario: Sub-lines are fully selected and show their context menu
- **WHEN** a line and its sub-lines are selected by clicking the line's selection button
- **THEN** each selected sub-line is highlighted as selected and shows its own context menu

#### Scenario: Selecting a line selects descendants at every depth
- **WHEN** the user clicks the selection button of a line whose sub-lines are nested at more than one depth
- **THEN** the line and all of its descendants at every depth are selected

#### Scenario: Clicking the selection button again deselects the whole subtree
- **WHEN** the user clicks the selection button of a line that is already selected together with its sub-lines
- **THEN** the line and all of its sub-lines become deselected

#### Scenario: Selecting a leaf line selects only that line
- **WHEN** the user clicks the selection button of a line that has no children
- **THEN** only that line is selected
