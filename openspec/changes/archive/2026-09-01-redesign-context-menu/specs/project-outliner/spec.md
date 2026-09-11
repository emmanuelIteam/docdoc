## MODIFIED Requirements

### Requirement: Show a context menu on hover or selection
The system SHALL display a context menu for a line only when that line is selected, and SHALL keep the menu open while the user interacts with it. The menu SHALL be laid out as a single horizontal row of icon-only action buttons with no visible text labels, each action button SHALL expose its action name through a `title` tooltip, and the menu SHALL be positioned above the selected line.

#### Scenario: Context menu appears only on selection
- **WHEN** a line is selected
- **THEN** a context menu appears offering the available formatting actions

#### Scenario: Context menu does not appear on hover
- **WHEN** a line is hovered but not selected
- **THEN** no context menu is shown

#### Scenario: Context menu is horizontal and above the line
- **WHEN** a line is selected and its context menu is shown
- **THEN** the menu is laid out as a single horizontal row and is positioned above the selected line

#### Scenario: Context menu actions are icon-only
- **WHEN** the context menu is shown
- **THEN** each action is displayed as an icon without a visible text label, and each action icon exposes a `title` tooltip with its action name

#### Scenario: Context menu offers formatting actions
- **WHEN** the context menu is shown
- **THEN** it offers an action to mark the line in progress and an action to mark the line done
