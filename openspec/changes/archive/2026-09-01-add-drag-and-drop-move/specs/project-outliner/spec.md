## ADDED Requirements

### Requirement: Drag a task to move it into another task
The system SHALL let the user begin a drag only by pressing and moving a line's selection button, SHALL represent the dragged line together with its subtree as the drag ghost, SHALL highlight a valid drop target under the pointer and show whether the line would be inserted above it, below it, or as its last child, SHALL reject a drop onto the dragged line or onto one of its descendants, and SHALL re-render the outline after a successful drop.

#### Scenario: Drag starts only from the selection button
- **WHEN** the user presses the selection button on a line and then moves the pointer
- **THEN** a drag begins for that line; pressing and moving on the line's title does not begin a drag

#### Scenario: The drag ghost represents the line and its subtree
- **WHEN** a drag begins
- **THEN** the drag ghost shows the whole dragged line together with its descendants

#### Scenario: A valid drop target is highlighted
- **WHEN** the pointer hovers over a valid drop target during a drag
- **THEN** that target is highlighted as the current drop target

#### Scenario: The drop position is indicated
- **WHEN** the pointer hovers over a line during a drag
- **THEN** an indicator shows whether the dragged line would be inserted above that line, below it, or as its last child

#### Scenario: Dropping on the dragged line or a descendant is rejected
- **WHEN** the pointer hovers over the dragged line itself or over one of its descendants
- **THEN** the target is marked invalid and the drop does not move the line

#### Scenario: The outline re-renders after a successful drop
- **WHEN** a valid drop completes
- **THEN** the drag indicators are cleared and the outline is re-rendered with the line in its new place
