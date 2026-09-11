## MODIFIED Requirements

### Requirement: Select a line with its sub-lines and narrow to the head line
The system SHALL select a line together with all of its sub-lines (its entire descendant subtree) when the user clicks the line's selection button, and SHALL highlight every selected line. The context menu SHALL be shown for the selected head line only and not for its sub-lines. Clicking the selection button of the already-selected head line SHALL narrow the selection so that only the head line stays selected and its sub-lines are deselected. Clicking the selection button of the narrowed head line once more SHALL deselect it.

#### Scenario: Selecting a line selects its sub-lines
- **WHEN** the user clicks the selection button of a line that has child lines and the line is not selected
- **THEN** the line and all of its sub-lines are selected

#### Scenario: Sub-lines are highlighted but only the head shows its context menu
- **WHEN** a line and its sub-lines are selected by clicking the line's selection button
- **THEN** each selected sub-line is highlighted as selected, and the context menu is shown only on the clicked head line

#### Scenario: Selecting a line selects descendants at every depth
- **WHEN** the user clicks the selection button of a line whose sub-lines are nested at more than one depth
- **THEN** the line and all of its descendants at every depth are selected

#### Scenario: Clicking the selected head line again selects only the head line
- **WHEN** a line and its sub-lines are selected and the user clicks the selection button of the already-selected head line
- **THEN** only the head line stays selected and its sub-lines become deselected

#### Scenario: Clicking the narrowed head line again deselects it
- **WHEN** only the head line is selected and the user clicks its selection button again
- **THEN** the head line becomes deselected

#### Scenario: Selecting a leaf line selects only that line
- **WHEN** the user clicks the selection button of a line that has no children
- **THEN** only that line is selected
