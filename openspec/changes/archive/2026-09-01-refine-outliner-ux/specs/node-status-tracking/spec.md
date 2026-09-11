## MODIFIED Requirements

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
