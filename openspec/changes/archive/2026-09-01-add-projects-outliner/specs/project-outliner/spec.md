## ADDED Requirements

### Requirement: Render projects as a hierarchical bullet list
The system SHALL render the project outline as a bullet list where each project is a level-1 line, its tasks are level-2 lines, and deeper subtasks nest one level per depth.

#### Scenario: Show all projects as top-level bullets
- **WHEN** the user opens the page
- **THEN** all projects are displayed as level-1 bullet lines

#### Scenario: Show subtasks nested under their parent
- **WHEN** a project or task has child items
- **THEN** each child is indented one level beneath its parent

### Requirement: Collapse and expand outline lines
The system SHALL allow each line to be collapsed to hide its children and expanded to show them.

#### Scenario: Collapse a node hides its children
- **WHEN** the user collapses a node
- **THEN** all descendants of that node are hidden from the view

#### Scenario: Expand a node shows its children
- **WHEN** the user expands a previously collapsed node
- **THEN** its children become visible again

#### Scenario: Collapsed state is preserved on reload
- **WHEN** a node was collapsed and the user reloads the page
- **THEN** the node remains collapsed

### Requirement: Reveal a selection button on hover
The system SHALL show a selection button on a line when the pointer hovers over it.

#### Scenario: Selection button appears on hover
- **WHEN** the pointer hovers over a line
- **THEN** a selection button becomes visible on that line

#### Scenario: Selection button hides when pointer leaves
- **WHEN** the pointer moves off the line
- **THEN** the selection button is no longer visible

### Requirement: Show a context menu on hover or selection
The system SHALL display a context menu for a line when that line is hovered or selected.

#### Scenario: Context menu appears on hover or selection
- **WHEN** a line is hovered or selected
- **THEN** a context menu appears offering the available formatting actions

#### Scenario: Context menu offers formatting actions
- **WHEN** the context menu is shown
- **THEN** it offers an action to mark the line in progress and an action to mark the line done
