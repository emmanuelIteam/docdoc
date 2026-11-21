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

The system SHALL allow a line to have at most one status among `todo`, `in_progress`, `waiting`, `someday`, and `done`. Applying any status SHALL clear the previous one, including when the previous status is `waiting` or `someday`.

#### Scenario: Marking in progress clears done

- **WHEN** a line marked as done is marked in progress
- **THEN** the done marking is removed and the line becomes bold

#### Scenario: Marking done clears in progress

- **WHEN** a line marked as in progress is marked done
- **THEN** the in-progress marking is removed and the line becomes italic

#### Scenario: Marking waiting clears in progress

- **WHEN** a line marked as in progress is marked waiting
- **THEN** the in-progress marking is removed and the line is rendered with the waiting style

#### Scenario: Marking someday clears waiting

- **WHEN** a line marked as waiting is marked someday
- **THEN** the waiting marking is removed and the line is rendered with the someday style

#### Scenario: Returning to todo clears a GTD status

- **WHEN** a line marked as waiting or someday is marked todo
- **THEN** the GTD style is removed and the line is rendered in the normal style

### Requirement: Apply a status to a line and its sub-lines

The system SHALL apply the status chosen from the five status actions (`todo`, `in_progress`, `waiting`, `someday`, `done`) to the selected line and, when its sub-lines are selected, recursively to every descendant at every depth. When only the head line is selected, the status SHALL apply to that line only and its descendants SHALL be unaffected.

#### Scenario: A status action applies to the line and its sub-lines

- **WHEN** a task line and its sub-lines are selected, the line's context menu is shown, and the user selects a status action
- **THEN** the chosen status is applied to the line and to all of its sub-lines

#### Scenario: A status cascades to descendants at every depth

- **WHEN** a line whose sub-lines are nested at more than one depth is selected and the user selects a status action
- **THEN** the chosen status is applied to the line and to every descendant sub-line at every depth

#### Scenario: Each status action cascades to the sub-lines

- **WHEN** a line and its sub-lines are selected and the user selects the `todo`, `in_progress`, `waiting`, `someday`, or `done` status action
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

### Requirement: Provide five line statuses

The system SHALL accept exactly five line statuses: `todo`, `in_progress`, `waiting`, `someday`, and `done`. Any other value submitted to a status mutation SHALL be rejected without changing the line. A status mutation SHALL remain scoped to the active domain's outline.

#### Scenario: The two GTD statuses are accepted

- **WHEN** a status mutation sets a line to `waiting` or to `someday`
- **THEN** the mutation succeeds and the status is persisted

#### Scenario: An unknown status is rejected

- **WHEN** a status mutation submits a value outside the five statuses
- **THEN** the request is rejected, the line keeps its previous status, and nothing is persisted

#### Scenario: A GTD status stays within its domain

- **WHEN** a line is set to `waiting` through a domain-scoped route
- **THEN** no line of another domain is modified

### Requirement: Render the waiting and someday statuses distinctly

The system SHALL render a line whose status is `waiting` with a visual style distinct from `todo`, `in_progress`, and `done`, and a line whose status is `someday` with a visual style distinct from the other four statuses. Both styles SHALL be visible without hover and SHALL NOT rely on color alone to be distinguishable. Neither status SHALL be rendered as bold or italic, which remain the markings of `in_progress` and `done`.

#### Scenario: A waiting line is visually distinct

- **WHEN** a line has the status `waiting`
- **THEN** its title carries the waiting style, which differs from the normal, in-progress, and done renderings

#### Scenario: A someday line is visually distinct

- **WHEN** a line has the status `someday`
- **THEN** its title carries the someday style, which differs from the normal, in-progress, waiting, and done renderings

#### Scenario: The style is visible without hover

- **WHEN** a line with the status `waiting` or `someday` is displayed
- **THEN** its distinct rendering is visible without moving the pointer over the line

#### Scenario: The style survives a reload

- **WHEN** a line is marked `waiting` or `someday` and the domain page is reloaded
- **THEN** the line is rendered with the same status style

### Requirement: Offer every status in the line menu

The system SHALL offer the five statuses in the context menu of a line, each with a visible glyph and an accessible name, and SHALL mark the line's current status as active. Selecting a status SHALL follow the same head-or-subtree scope rules as the existing status actions.

#### Scenario: The menu contains the five statuses

- **WHEN** the context menu of a line is displayed
- **THEN** it offers `todo`, `in_progress`, `waiting`, `someday`, and `done`

#### Scenario: The current status is marked

- **WHEN** a line has the status `waiting` and its context menu is displayed
- **THEN** the waiting action is marked active and the other four are not

#### Scenario: A GTD action follows the scope rules

- **WHEN** a line and its sub-lines are selected and the user chooses `someday`
- **THEN** the status is applied to the head line and recursively to its sub-lines, exactly like the existing status actions

