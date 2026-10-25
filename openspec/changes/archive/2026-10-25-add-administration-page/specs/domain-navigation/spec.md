## MODIFIED Requirements

### Requirement: Display a collapsible left sidebar listing domains

The system SHALL display a left side panel that lists the domains grouped by theme, highlights the active domain, allows the panel to be toggled hidden or shown, and SHALL persist the collapsed state across navigation. Each theme group SHALL show the theme's name and color as its header and SHALL group the domains that carry that theme's label; a domain carrying several theme labels SHALL appear under each corresponding theme group; a domain that carries no theme label SHALL appear under a "Sans thème" group. The sidebar SHALL be read-only: it SHALL NOT offer any control to create, rename, recolor, reorder, delete, or archive a theme or a domain, those operations being available on the administration page only.

#### Scenario: The sidebar groups domains by theme

- **WHEN** a page is rendered
- **THEN** the left panel shows a theme group header for each theme and lists the domains carrying that theme's label under it

#### Scenario: A domain appears under each of its themes

- **WHEN** a domain carries two theme labels
- **THEN** that domain is listed under both corresponding theme groups

#### Scenario: Unlabeled domains appear under Sans thème

- **WHEN** a domain carries no theme label
- **THEN** it is listed under the "Sans thème" group

#### Scenario: The active domain is highlighted

- **WHEN** the current page belongs to a domain
- **THEN** that domain is highlighted in the sidebar

#### Scenario: The sidebar can be toggled

- **WHEN** the user clicks the sidebar toggle control
- **THEN** the sidebar is shown or hidden accordingly

#### Scenario: The collapsed state persists

- **WHEN** the user hides the sidebar and then navigates to another page
- **THEN** the sidebar remains hidden

#### Scenario: The sidebar offers no management control

- **WHEN** the sidebar is rendered on any page
- **THEN** it contains no creation form and no rename, delete, archive, or reorder control for a theme or a domain

#### Scenario: No theme means only the untagged group

- **WHEN** the space has no theme
- **THEN** the sidebar lists all domains under the single "Sans thème" group

#### Scenario: The theme group colors come from the palette

- **WHEN** a theme group header is rendered
- **THEN** it shows the dot in the theme's current color, so a color changed on the administration page is reflected in the sidebar
