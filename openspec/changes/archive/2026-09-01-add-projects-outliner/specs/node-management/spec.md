## ADDED Requirements

### Requirement: Create a node
The system SHALL allow the user to create a new project as a level-1 line and a new task or subtask as a child of an existing line.

#### Scenario: Create a new project
- **WHEN** the user creates a new project
- **THEN** a new level-1 line is added to the outline

#### Scenario: Create a child node
- **WHEN** the user adds a child to an existing line
- **THEN** a new line is inserted nested beneath that line

### Requirement: Rename a node
The system SHALL allow the user to edit the title of an existing node.

#### Scenario: Edit a node title
- **WHEN** the user edits the title of a node
- **THEN** the node title is updated and displayed with the new text

### Requirement: Reindent a node
The system SHALL allow the user to move a node up or down one level in the hierarchy.

#### Scenario: Indent a node
- **WHEN** the user indents a node
- **THEN** the node becomes a child of the previous sibling (or its parent)

#### Scenario: Outdent a node
- **WHEN** the user outdents a node
- **THEN** the node moves up one level and becomes a sibling of its former parent

### Requirement: Delete a node
The system SHALL allow the user to delete a node together with all of its descendants.

#### Scenario: Delete a node removes its subtree
- **WHEN** the user deletes a node
- **THEN** that node and all of its descendants are removed from the outline
