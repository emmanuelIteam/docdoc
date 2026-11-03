## MODIFIED Requirements

### Requirement: Rename a node

The system SHALL allow the user to edit the title of an existing node. A click on an inline task link inside the title SHALL follow the link and SHALL NOT open the rename field; renaming SHALL remain available by clicking the title outside the link, by clicking the line's free space, or from the line's context menu. Editing SHALL be a continuous, anchored mode: the edited line SHALL remain identifiable for the whole edit through a persistent visual state distinct from hover and from selection. The line SHALL keep at least the height of its displayed title and SHALL NOT collapse a title that wraps over several lines into a single line: the edit field SHALL wrap the text as the title did, and the lines below SHALL NOT move when the field opens or closes, except that a title whose source is longer than its displayed label may grow. The caret SHALL stay on the visual line the user clicked. Leaving the field without a structural action SHALL update the line in place, without re-rendering the outline and without moving the other lines; saving SHALL be allowed to complete in the background. A commit SHALL NOT replace an edit field opened later: a field already open SHALL keep its content and its focus even when an earlier edit's save completes after it opened. On a touch device, the on-screen keyboard appearing or disappearing SHALL move the edited line at most once, and only when the line is not visible above the keyboard: a line already visible SHALL stay where it is, and a line hidden by the keyboard SHALL be brought just above it in a single continuous movement. Closing the field SHALL NOT scroll the page back to its previous position.

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

#### Scenario: The edited line stays marked

- **WHEN** a line's title is opened for editing
- **THEN** the line displays a persistent editing state, distinct from hover and from selection, until the field closes

#### Scenario: A wrapped title keeps its height while edited

- **WHEN** a line whose displayed title wraps over two lines is opened for editing
- **THEN** the line keeps at least the height of its displayed title, the edit field wraps the text over the same lines, and the lines below do not move

#### Scenario: Committing a title does not re-render the outline

- **WHEN** the user changes a line's title and leaves the edit field without pressing `Enter` or `Tab`
- **THEN** the line shows the new title in place, the other lines keep their position, and the outline is not re-rendered

#### Scenario: A newly opened field is never replaced by an earlier save

- **WHEN** the user edits line A, changes its title, then opens line B before A's save completes
- **THEN** B's field stays open with its content and its focus

#### Scenario: An already visible line does not move when the keyboard opens

- **WHEN** on a touch device the user opens the title of a line that is already fully visible above the on-screen keyboard
- **THEN** the line stays at the same position on screen

#### Scenario: A line hidden by the keyboard is revealed once

- **WHEN** on a touch device the user opens the title of a line that the on-screen keyboard would hide
- **THEN** the line is brought just above the keyboard in a single continuous movement, and does not move again once the keyboard is fully open

#### Scenario: Closing the field does not scroll the page back

- **WHEN** the user closes the edit field
- **THEN** the page keeps its current scroll position and the line stays where it is
