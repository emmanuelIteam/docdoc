# node-management Specification

## Purpose
TBD - created by archiving change add-projects-outliner. Update Purpose after archive.
## Requirements
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

### Requirement: Rename a node
The system SHALL allow the user to edit the title of an existing node.

#### Scenario: Edit a node title
- **WHEN** the user edits the title of a node
- **THEN** the node title is updated and displayed with the new text

#### Scenario: Caret opens at the click position
- **WHEN** the user clicks a line's title to rename it
- **THEN** the edit field opens with the caret at the position of the click within the title, and the title is not selected

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

### Requirement: Move a node to a new parent or sibling position
The system SHALL move a node together with its entire descendant subtree when the user drops it onto another node (as that node's last child), above or below another node (as its immediate previous or next sibling), or onto the outline root (as a top-level project), and SHALL reject any move that would place a node inside itself or inside one of its own descendants.

#### Scenario: Move a node onto another node as its last child
- **WHEN** a node is dropped onto another node
- **THEN** the node becomes the last child of that node

#### Scenario: Move a node above another node as its previous sibling
- **WHEN** a node is dropped just above another node
- **THEN** the node is inserted immediately before that node at the same level

#### Scenario: Move a node below another node as its next sibling
- **WHEN** a node is dropped just below another node
- **THEN** the node is inserted immediately after that node at the same level

#### Scenario: Moving a node carries its whole subtree
- **WHEN** a node that has descendants is moved
- **THEN** all of its descendants move with it, unchanged, at every depth

#### Scenario: Move a node to the root level
- **WHEN** a node is dropped onto the outline's root area
- **THEN** the node becomes a top-level project

#### Scenario: A root project can be moved into another project
- **WHEN** a project is dropped onto another project
- **THEN** it becomes a subtask of that project

#### Scenario: A node cannot be moved inside itself or a descendant
- **WHEN** the user tries to move a node onto itself or onto one of its descendants
- **THEN** the move is rejected and the tree is unchanged

### Requirement: Scope node operations to the active domain
The system SHALL scope create, rename, reindent, delete, and move operations to the outline of the active domain, accessed through domain-scoped routes under `/domaine/:slug/...`, so that an operation never affects another domain.

#### Scenario: Create within the active domain
- **WHEN** the user creates a project or task on a domain page
- **THEN** it is added to that domain's outline and persisted in that domain's file

#### Scenario: Rename within the active domain
- **WHEN** the user renames a node on a domain page
- **THEN** the node's title is updated in that domain's outline only

#### Scenario: Delete within the active domain
- **WHEN** the user deletes a node on a domain page
- **THEN** the node is removed from that domain's outline only

#### Scenario: Move within the active domain
- **WHEN** the user moves a node on a domain page
- **THEN** the node is reordered within that domain's outline only

