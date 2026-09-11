## ADDED Requirements

### Requirement: Apply a status to a line and its sub-lines
The system SHALL, when a task line and its sub-lines are selected and the line's context menu is displayed, apply the status chosen from one of the status actions (todo, in progress, done) to the selected line and recursively to all of its descendant sub-lines at every depth, and SHALL render the updated status on each affected line.

#### Scenario: A status action applies to the line and its sub-lines
- **WHEN** a task line and its sub-lines are selected, the line's context menu is shown, and the user selects a status action
- **THEN** the chosen status is applied to the line and to all of its sub-lines

#### Scenario: A status cascades to descendants at every depth
- **WHEN** a line whose sub-lines are nested at more than one depth is selected and the user selects a status action
- **THEN** the chosen status is applied to the line and to every descendant sub-line at every depth

#### Scenario: Each status action cascades to the sub-lines
- **WHEN** a line and its sub-lines are selected and the user selects the "todo", "in progress", or "done" status action
- **THEN** the chosen status is applied to the line and to all of its sub-lines

#### Scenario: A selected line without selected sub-lines changes only itself
- **WHEN** a selected line has no selected sub-lines and the user selects a status action
- **THEN** only that line's status is changed and none of its descendants are affected
