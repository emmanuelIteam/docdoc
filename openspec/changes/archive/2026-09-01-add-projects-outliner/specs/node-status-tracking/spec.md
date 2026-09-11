## ADDED Requirements

### Requirement: Mark a line as in progress (bold)
The system SHALL render a line in bold when it is marked as being in progress.

#### Scenario: Bold via context menu
- **WHEN** the user selects the "in progress" action in the context menu for a line
- **THEN** the line is rendered in bold

#### Scenario: Bold indicates in-progress state
- **WHEN** a line is rendered in bold
- **THEN** it visually indicates that the task is currently in progress

### Requirement: Mark a line as done (italic)
The system SHALL render a line in italic when it is marked as done.

#### Scenario: Italic via context menu
- **WHEN** the user selects the "done" action in the context menu for a line
- **THEN** the line is rendered in italic

#### Scenario: Italic indicates completed state
- **WHEN** a line is rendered in italic
- **THEN** it visually indicates that the task has been completed

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
