# node-status-tracking Specification

## Purpose
TBD - created by archiving change add-projects-outliner. Update Purpose after archive.

## Requirements

### Requirement: Mark a line as in progress (bold)
The system SHALL render the title text of a line in bold when it is marked as being in progress.

#### Scenario: Bold via context menu
- **WHEN** the user selects the "in progress" action in the context menu for a line
- **THEN** the line's title is rendered in bold

#### Scenario: Bold is visible on the line
- **WHEN** a line is marked in progress
- **THEN** its title is visibly bold on the page

### Requirement: Mark a line as done (italic)
The system SHALL render the title text of a line in italic when it is marked as done.

#### Scenario: Italic via context menu
- **WHEN** the user selects the "done" action in the context menu for a line
- **THEN** the line's title is rendered in italic

#### Scenario: Italic is visible on the line
- **WHEN** a line is marked done
- **THEN** its title is visibly italic on the page

### Requirement: Default line style is normal
The system SHALL render a line in its normal style when it has no active status, indicating the task has not been started.

#### Scenario: Newly created line is normal
- **WHEN** a new line is created
- **THEN** it is rendered in normal style, neither bold nor italic

### Requirement: Line statuses are mutually exclusive
The system SHALL allow a line to have at most one active marking from in progress and done.

#### Scenario: Marking in progress clears done
- **WHEN** a line marked as done is marked in progress
- **THEN** the done marking is removed and the line becomes bold

#### Scenario: Marking done clears in progress
- **WHEN** a line marked as in progress is marked done
- **THEN** the in-progress marking is removed and the line becomes italic

### Requirement: Apply a status to a line and its sub-lines
The system SHALL, when a task line and its sub-lines are selected and the line's context menu is displayed, apply the status chosen from one of the status actions (todo, in progress, done) to the selected line and recursively to all of its descendant sub-lines at every depth, and SHALL render the updated status on each affected line. When only the head line is selected (its sub-lines are not selected), the status SHALL be applied to that head line only and its descendants SHALL be unaffected.

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
- **WHEN** only the head line of a task is selected (its sub-lines are not selected) and the user selects a status action
- **THEN** only that head line's status is changed and none of its descendants are affected

### Requirement: Scope status application to the active domain
The system SHALL apply status changes to lines of the active domain's outline, accessed through domain-scoped routes under `/domaine/:slug/...`, so that changing a status never affects another domain.

#### Scenario: Status applies within the active domain
- **WHEN** the user changes a status on a domain page
- **THEN** the status is applied to lines of that domain's outline only

#### Scenario: A status cascade stays within the active domain
- **WHEN** a status cascades to a line's descendants
- **THEN** it cascades within that domain's outline and does not affect another domain
