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

The system SHALL allow a line to have at most one status among `todo` (« En projet »), `in_progress` (« En cours » / « À faire »), `waiting` (« En attente ») and `done` (« Terminé »). Applying any status SHALL clear the previous one, including when the previous status is `waiting`.

#### Scenario: Marking in progress clears done

- **WHEN** a line marked as done is marked in progress
- **THEN** the done marking is removed and the line becomes bold

#### Scenario: Marking done clears in progress

- **WHEN** a line marked as in progress is marked done
- **THEN** the in-progress marking is removed and the line becomes italic

#### Scenario: Marking waiting clears in progress

- **WHEN** a line marked as in progress is marked waiting from the home page
- **THEN** the in-progress marking is removed and the line is rendered with the waiting style

#### Scenario: Marking in progress clears waiting

- **WHEN** a line marked as waiting is marked in progress
- **THEN** the waiting marking is removed and the line becomes bold

#### Scenario: Marking En projet clears waiting

- **WHEN** a line marked as waiting is marked En projet (`todo`)
- **THEN** the waiting marking is removed and the line is rendered in the normal style

#### Scenario: Returning to En projet clears a sub-state

- **WHEN** a line marked as waiting or in progress is marked En projet
- **THEN** the previous marking is removed and the line is rendered in the normal style

### Requirement: Apply a status to a line and its sub-lines

The system SHALL apply the status chosen from the three project actions (`todo` « En projet », `in_progress` « En cours », `done` « Terminé ») to the selected line and, when its sub-lines are selected, recursively to every descendant at every depth. When only the head line is selected, the status SHALL apply to that line only and its descendants SHALL be unaffected. The `waiting` sub-state SHALL NOT be applied from the line menu: it is set from the home page, on the head line only.

#### Scenario: A status action applies to the line and its sub-lines

- **WHEN** a task line and its sub-lines are selected, the line's context menu is shown, and the user selects a status action
- **THEN** the chosen status is applied to the line and to all of its sub-lines

#### Scenario: A status cascades to descendants at every depth

- **WHEN** a line whose sub-lines are nested at more than one depth is selected and the user selects a status action
- **THEN** the chosen status is applied to the line and to every descendant sub-line at every depth

#### Scenario: Each of the three actions cascades to the sub-lines

- **WHEN** a line and its sub-lines are selected and the user selects the `todo`, `in_progress` or `done` status action
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

### Requirement: Provide four line statuses

The system SHALL accept exactly four line statuses: `todo`, `in_progress`, `waiting` and `done`. Any other value submitted to a status mutation SHALL be rejected without changing the line. A status mutation SHALL remain scoped to the active domain's outline.

#### Scenario: The waiting sub-state is accepted

- **WHEN** a status mutation sets a line to `waiting`
- **THEN** the mutation succeeds and the status is persisted

#### Scenario: The legacy someday value is rejected by a mutation

- **WHEN** a status mutation submits `someday`
- **THEN** the request is rejected, the line keeps its previous status, and nothing is persisted

#### Scenario: An unknown status is rejected

- **WHEN** a status mutation submits a value outside the four statuses
- **THEN** the request is rejected, the line keeps its previous status, and nothing is persisted

#### Scenario: A sub-state stays within its domain

- **WHEN** a line is set to `waiting` through a domain-scoped route
- **THEN** no line of another domain is modified

### Requirement: Render the waiting sub-state distinctly

The system SHALL render a line whose status is `waiting` with a visual style distinct from `todo`, `in_progress` and `done`. The style SHALL be visible without hover and SHALL NOT rely on color alone to be distinguishable. The `waiting` line SHALL NOT be rendered as bold or italic, which remain the markings of `in_progress` and `done`. A line whose persisted status is `someday` SHALL be read as `todo` and rendered with the normal style of « En projet ».

#### Scenario: A waiting line is visually distinct

- **WHEN** a line has the status `waiting`
- **THEN** its title carries the waiting style, which differs from the normal, in-progress and done renderings

#### Scenario: The style is visible without hover

- **WHEN** a line with the status `waiting` is displayed
- **THEN** its distinct rendering is visible without moving the pointer over the line

#### Scenario: The style survives a reload

- **WHEN** a line is marked `waiting` and the domain page is reloaded
- **THEN** the line is rendered with the same waiting style

#### Scenario: A line is never both bold and waiting

- **WHEN** a line has the status `waiting`
- **THEN** its title is not bold and not italic

### Requirement: Offer the three project states in the line menu

The system SHALL offer exactly three status actions in the context menu of a line — `todo` (« En projet »), `in_progress` (« En cours ») and `done` (« Terminé ») —, each with a visible glyph and an accessible name, and SHALL mark the line's current status as active. For a line whose status is `waiting`, the `in_progress` action SHALL be marked active. The menu SHALL NOT offer `waiting` or `someday`. Selecting a status SHALL follow the same head-or-subtree scope rules as the existing status actions.

#### Scenario: The menu contains the three project states

- **WHEN** the context menu of a line is displayed
- **THEN** it offers `todo`, `in_progress` and `done`

#### Scenario: The menu offers no sub-state or legacy status

- **WHEN** the context menu of a line is displayed
- **THEN** it contains no `waiting` action and no `someday` action

#### Scenario: The current status is marked

- **WHEN** a line has the status `in_progress` and its context menu is displayed
- **THEN** the `in_progress` action is marked active and the `todo` and `done` actions are not

#### Scenario: A waiting line marks En cours active

- **WHEN** a line has the status `waiting` and its context menu is displayed
- **THEN** the `in_progress` action is marked active and the `todo` and `done` actions are not

#### Scenario: Choosing En cours on a waiting line sets À faire

- **WHEN** a line has the status `waiting` and the user chooses the `in_progress` action
- **THEN** the line's status becomes `in_progress`, its waiting style is removed and it is rendered in bold

#### Scenario: A menu action follows the scope rules

- **WHEN** a line and its sub-lines are selected and the user chooses `done`
- **THEN** the status is applied to the head line and recursively to its sub-lines, exactly like the other status actions

### Requirement: Read a legacy someday status as En projet

The system SHALL read a line whose persisted status is `someday` as the status `todo` (« En projet ») when loading a domain. It SHALL accept a JSON backup containing `someday` and restore that line as `todo`. The normalization SHALL preserve the line and all of its other fields, and the next persisted write of the domain SHALL store `todo`.

#### Scenario: A stored someday line loads as En projet

- **WHEN** a domain file contains a line whose status is `someday`
- **THEN** the line is loaded with the status `todo` and rendered with the normal style of « En projet »

#### Scenario: A backup containing someday restores as En projet

- **WHEN** a JSON backup contains a line whose status is `someday` and the backup is restored
- **THEN** the restored line has the status `todo` and none of its other fields is lost

#### Scenario: The normalization is persisted on the next write

- **WHEN** a domain containing a legacy `someday` line is saved after being loaded
- **THEN** the persisted line carries the status `todo`

