## MODIFIED Requirements

### Requirement: Create a node
The system SHALL allow the user to create a new project as a level-1 line and a new task or subtask as a child of an existing line, and SHALL reveal the newly created line immediately.

#### Scenario: Create a new project
- **WHEN** the user creates a new project
- **THEN** a new level-1 line is added to the outline

#### Scenario: Create a child node
- **WHEN** the user invokes the add-child action on a line
- **THEN** a new line is inserted nested beneath that line

#### Scenario: Creating a child node reveals it
- **WHEN** a child node is created under an expanded line
- **THEN** the new child line is displayed immediately
