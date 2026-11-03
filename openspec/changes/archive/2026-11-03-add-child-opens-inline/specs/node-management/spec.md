## MODIFIED Requirements

### Requirement: Create a node

The system SHALL allow the user to create a new project as a level-1 line by adding a sibling to an existing level-1 line, and a new task or subtask as a child of an existing line, and SHALL reveal the newly created line immediately. When a child is created from the line's context menu, the system SHALL open the new line in edit mode with its default title `Nouvelle tâche` selected, so that typing replaces it. A domain SHALL already hold a default project when it is created (see "Keep at least one project line").

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

#### Scenario: Creating a child from the context menu opens its title for naming

- **WHEN** a line is selected, its context menu is open, and the user clicks the "+" action
- **THEN** a child line titled `Nouvelle tâche` is created, opened in edit mode with the whole title selected, so typing replaces the default title

#### Scenario: Creating a child under a collapsed line reveals it

- **WHEN** the user clicks the "+" action on a collapsed line
- **THEN** that line is expanded and the new child line is displayed immediately
