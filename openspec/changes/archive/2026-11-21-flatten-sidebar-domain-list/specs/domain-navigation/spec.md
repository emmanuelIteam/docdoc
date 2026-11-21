## MODIFIED Requirements

### Requirement: Display a collapsible left sidebar listing domains

The system SHALL display a left side panel that lists the active domains as a single-level list — one entry per domain, with no theme group header, no "Sans thème" section, and no theme color dot — highlights the active domain, allows the panel to be toggled hidden or shown, and SHALL persist the collapsed state across navigation. The list SHALL follow the manual order stored on the domains (`order` ascending, tie-broken by name); a domain created or restored later SHALL be appended at the end of the list. A domain that carries zero, one, or several theme labels SHALL appear exactly once in the list. The panel SHALL NOT offer any control to create, rename, recolor, delete, or archive a theme or a domain, nor any control to reorder a theme; those operations SHALL remain on the administration page. The panel SHALL offer, on each domain entry, an up and a down control that reorders the domains, as specified by the next requirement.

#### Scenario: The sidebar lists each domain exactly once

- **WHEN** any page is rendered for an authenticated account
- **THEN** the left panel shows exactly one entry per active domain, with no theme group header and no "Sans thème" section

#### Scenario: Theme labels do not regroup the list

- **WHEN** the palette holds several themes and some domains carry theme labels
- **THEN** the sidebar still renders a single flat list of domains, and no theme name appears as a list header

#### Scenario: A domain with several themes appears once

- **WHEN** a domain carries two or more theme labels
- **THEN** that domain is listed exactly once in the sidebar

#### Scenario: The list follows the manual order

- **WHEN** the domains have distinct `order` values
- **THEN** the sidebar lists them by `order` ascending, tie-broken by name

#### Scenario: A new or restored domain is appended

- **WHEN** a domain is created or restored from the archives
- **THEN** it appears at the end of the sidebar list

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
- **THEN** it contains no creation form and no rename, delete, archive, or theme-reorder control for a theme or a domain

#### Scenario: No domain means the empty state

- **WHEN** the space has no active domain
- **THEN** the sidebar shows the "Aucun domaine" empty state

## ADDED Requirements

### Requirement: Reorder domains from the sidebar

The system SHALL allow the user to move a domain one position up or one position down directly from the sidebar, using an up control and a down control on its entry, and SHALL persist the resulting order. That order SHALL be the same order used by the domain table of the administration page and by the homepage's open-task list. The first entry SHALL NOT move up and the last entry SHALL NOT move down: the corresponding control SHALL be disabled, and a request that would leave the list SHALL leave the order unchanged. A move SHALL return the user to the page they were viewing, SHALL keep the moved domain highlighted when it is the active one, and SHALL NOT fold the sidebar on a narrow screen. The controls SHALL work without JavaScript, as ordinary forms.

#### Scenario: Moving a domain up swaps it with its predecessor

- **WHEN** the user activates the up control of a domain that is not first
- **THEN** the domain takes the position of its predecessor, which takes its former position, and the order is persisted

#### Scenario: Moving a domain down swaps it with its successor

- **WHEN** the user activates the down control of a domain that is not last
- **THEN** the domain takes the position of its successor, which takes its former position, and the order is persisted

#### Scenario: The first domain cannot move up

- **WHEN** the sidebar lists a domain first
- **THEN** its up control is disabled and the order is unchanged

#### Scenario: The last domain cannot move down

- **WHEN** the sidebar lists a domain last
- **THEN** its down control is disabled and the order is unchanged

#### Scenario: The order is shared with the administration page

- **WHEN** the user moves a domain from the sidebar
- **THEN** the domain table of the administration page shows the same order

#### Scenario: The order is shared with the homepage

- **WHEN** the user moves a domain from the sidebar and then opens the homepage
- **THEN** the open tasks of the domains are listed in the new order

#### Scenario: The order is shared with the administration arrows

- **WHEN** the user moves a domain with the arrows of the administration page
- **THEN** the sidebar shows the same order

#### Scenario: The user stays on the current page

- **WHEN** the user moves a domain from a domain page, the homepage, the administration page, or the help page
- **THEN** the response returns to the same page and the sidebar shows the new order

#### Scenario: The move persists after a reload

- **WHEN** the page is reloaded after a move
- **THEN** the sidebar still shows the new order

#### Scenario: A narrow screen keeps the panel open

- **WHEN** in a 390 px wide window the user activates a move control of the sidebar
- **THEN** the page is rendered again with the sidebar still open, so the user can continue reordering

#### Scenario: The controls work without JavaScript

- **WHEN** `app.js` does not run and the user submits a move control
- **THEN** the domain moves and the response returns to the current page
