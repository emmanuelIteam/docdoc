## MODIFIED Requirements

### Requirement: Render projects as a hierarchical bullet list
The system SHALL render the active domain's outline as a bullet list on that domain's page, where each project of the domain is a level-1 line, its tasks are level-2 lines, and deeper subtasks nest one level per depth.

#### Scenario: Show the domain's projects as top-level bullets
- **WHEN** the user opens a domain page
- **THEN** that domain's projects are displayed as level-1 bullet lines

#### Scenario: Show subtasks nested under their parent
- **WHEN** a project or task has child items
- **THEN** each child is indented one level beneath its parent

#### Scenario: Only the active domain's outline is shown
- **WHEN** a domain page is rendered
- **THEN** the outline shows the projects of that domain only, and not those of another domain
