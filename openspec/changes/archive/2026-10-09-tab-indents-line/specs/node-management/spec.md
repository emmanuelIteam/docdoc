## MODIFIED Requirements

### Requirement: Reindent a node
The system SHALL allow the user to move a node up or down one level in the hierarchy, through the line's indent/outdent context-menu actions as well as through the keyboard shortcuts `Tab` (indent) and `Shift+Tab` (outdent) applied to the current line.

#### Scenario: Indent a node
- **WHEN** the user indents a node
- **THEN** the node becomes a child of the previous sibling (or its parent)

#### Scenario: Outdent a node
- **WHEN** the user outdents a node
- **THEN** the node moves up one level and becomes a sibling of its former parent

#### Scenario: Tab indents the line being edited
- **WHEN** the user is editing a line's title and presses Tab
- **THEN** that line is indented one level, the browser's default focus move is prevented, and the edit field stays open on that same line

#### Scenario: Shift+Tab outdents the line being edited
- **WHEN** the user is editing a line's title and presses Shift+Tab
- **THEN** that line is outdented one level, the browser's default focus move is prevented, and the edit field stays open on that same line

#### Scenario: Tab indents a selected line
- **WHEN** a line is selected and is not being edited, and the user presses Tab
- **THEN** that line is indented one level and stays selected

#### Scenario: Shift+Tab outdents a selected line
- **WHEN** a line is selected and is not being edited, and the user presses Shift+Tab
- **THEN** that line is outdented one level and stays selected

#### Scenario: The typed title survives a keyboard reindent
- **WHEN** the user presses Tab or Shift+Tab while a line's title has been modified in the edit field but not yet committed
- **THEN** the modified title is saved, and the edit field reopens on the same line with the caret at the same position

#### Scenario: Keyboard reindent can be repeated
- **WHEN** the user presses Tab twice in a row on the same line, having a previous sibling whose own previous sibling also exists
- **THEN** the line is indented two levels, and the editing or selection context is still active on that line

#### Scenario: Indenting the first child does nothing
- **WHEN** the user presses Tab on a line that has no previous sibling
- **THEN** nothing happens: no request is sent, the hierarchy is unchanged, and the line stays in its current editing or selection state

#### Scenario: Outdenting a top-level line does nothing
- **WHEN** the user presses Shift+Tab on a line that is already at the top level
- **THEN** nothing happens: no request is sent, the hierarchy is unchanged, and the line stays in its current editing or selection state

#### Scenario: Tab keeps its normal meaning outside an outline line
- **WHEN** the user presses Tab while the focus is in a field that is not an outline line (such as a sidebar or theme form field), or presses Tab with Ctrl, Alt, or Meta held
- **THEN** the browser's normal tab navigation applies and no line is reindented
