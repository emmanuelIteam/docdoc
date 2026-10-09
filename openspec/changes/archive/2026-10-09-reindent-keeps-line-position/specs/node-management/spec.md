## MODIFIED Requirements

### Requirement: Reindent a node
The system SHALL allow the user to move a node up or down one level in the hierarchy, through the line's indent/outdent context-menu actions as well as through the keyboard shortcuts `Tab` (indent) and `Shift+Tab` (outdent) applied to the current line. Reindenting SHALL NOT reorder the outline: outdenting a node SHALL change its depth only and SHALL leave the node displayed at the position it already occupied — it SHALL NOT be displayed above the lines it followed; indenting a node SHALL make it the last child of its previous sibling and display it at the end of that sibling's block, never above that sibling.

#### Scenario: Indent a node
- **WHEN** the user indents a node
- **THEN** the node becomes a child of the previous sibling (or its parent)

#### Scenario: Outdent a node
- **WHEN** the user outdents a node
- **THEN** the node moves up one level and becomes a sibling of its former parent

#### Scenario: Outdenting a line leaves it where it is
- **WHEN** the user outdents a line that is displayed after other lines of its former parent, with `Shift+Tab` or with the line's outdent menu action
- **THEN** the line is outdented one level and stays displayed at the same position, after the lines it followed: it is not moved above them

#### Scenario: Indenting a line leaves it where it is under a leaf previous sibling
- **WHEN** the user indents a line whose previous sibling has no sub-line
- **THEN** the line becomes that sibling's child, is indented one level, and stays displayed at the same position

#### Scenario: Reindenting keeps the line on its line
- **WHEN** the outline shows a task A on line 1 with two sub-tasks B1 on line 2 and B2 on line 3, the caret is on line 3, and the user presses `Shift+Tab` and then `Tab`
- **THEN** B2 loses one level and then gains it back, while remaining on line 3 after each of the two keystrokes

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
