## MODIFIED Requirements

### Requirement: Create a node

The system SHALL allow the user to create a new project as a level-1 line by adding a sibling to an existing level-1 line, and a new task or subtask as a child of an existing line, and SHALL reveal the newly created line immediately. A domain SHALL already hold a default project when it is created (see "Keep at least one project line").

#### Scenario: Create a new project

- **WHEN** the user creates a new project
- **THEN** a new level-1 line is added to the outline

#### Scenario: Create a project from a root line

- **WHEN** the user presses Enter on a level-1 line
- **THEN** a new level-1 line is inserted right after it, at the same level

#### Scenario: Create a child node

- **WHEN** the user invokes the add-child action on a line
- **THEN** a new line is inserted nested beneath that line

#### Scenario: Creating a child node reveals it

- **WHEN** a child node is created under an expanded line
- **THEN** the new child line is displayed immediately

## ADDED Requirements

### Requirement: Keep at least one project line

The system SHALL never render a domain with an empty outline: a domain SHALL always contain at least one level-1 project line. A newly created domain SHALL start with one line titled "Nouveau projet". When the user deletes the last remaining project line, a new line titled "Nouveau projet" SHALL replace it. When a domain whose stored outline is empty is first rendered, a default project line SHALL be created and persisted.

#### Scenario: A new domain starts with a default project

- **WHEN** a domain is created
- **THEN** its outline contains one level-1 line titled "Nouveau projet"

#### Scenario: Deleting the last project replaces it

- **WHEN** the user deletes the only remaining project line of a domain
- **THEN** the outline shows a new level-1 line titled "Nouveau projet"

#### Scenario: An empty stored domain is materialized on first render

- **WHEN** a domain whose stored outline has no project line is first displayed
- **THEN** a level-1 line titled "Nouveau projet" is created, persisted, and displayed

#### Scenario: An empty outline is never rendered

- **WHEN** any domain page or outline fragment is rendered
- **THEN** the outline contains at least one level-1 line
