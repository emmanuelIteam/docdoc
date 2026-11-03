## MODIFIED Requirements

### Requirement: Rename a node
The system SHALL allow the user to edit the title of an existing node. A click on an inline task link inside the title SHALL follow the link and SHALL NOT open the rename field; renaming SHALL remain available by clicking the title outside the link, by clicking the line's free space, or from the line's context menu.

#### Scenario: Edit a node title
- **WHEN** the user edits the title of a node
- **THEN** the node title is updated and displayed with the new text

#### Scenario: Caret opens at the click position
- **WHEN** the user clicks a line's title outside an inline task link to rename it
- **THEN** the edit field opens with the caret at the position of the click within the title, and the title is not selected

#### Scenario: Clicking a task link follows it
- **WHEN** the user clicks an inline task link inside a title
- **THEN** the browser follows the link and no rename field is opened

#### Scenario: A link-only title can still be renamed
- **WHEN** the user clicks the free space of a line whose whole title is an inline task link
- **THEN** the rename field opens on the source title so the label or the link can be edited
