## ADDED Requirements

### Requirement: Serve a page per domain at a direct URL
The system SHALL serve each domain on its own page at the URL `GET /domaine/:slug`, where the page shows the domain's name and its outline, and the URL is direct and shareable.

#### Scenario: A domain page is reachable by direct URL
- **WHEN** the user navigates to `/domaine/<slug>` for an existing domain
- **THEN** the page for that domain is displayed with its name and outline

#### Scenario: An unknown slug returns not found
- **WHEN** the user navigates to `/domaine/<slug>` for a slug that does not exist
- **THEN** a "Domaine introuvable" response is returned

### Requirement: Generate and resolve slugs
The system SHALL generate a domain's slug from its name by lowercasing, stripping accents, replacing spaces and other non-alphanumeric characters with hyphens, collapsing consecutive hyphens, and deduplicating against existing slugs; and SHALL resolve the active domain from the slug in the URL.

#### Scenario: The slug is normalized from the name
- **WHEN** a domain is created with the name "Rénovation Cuisine"
- **THEN** its slug is "renovation-cuisine"

#### Scenario: Duplicate slugs are deduplicated
- **WHEN** two domains would share the same slug
- **THEN** the later one is given a unique suffix such as "-2"

#### Scenario: The active domain is resolved from the slug
- **WHEN** a request targets `/domaine/<slug>`
- **THEN** the matching domain is resolved from that slug

### Requirement: Redirect the homepage to the default domain
The system SHALL redirect requests to `/` to the domain with the lowest order (the default domain) using a 302 redirect.

#### Scenario: The homepage redirects to the default domain
- **WHEN** the user visits `/`
- **THEN** the system redirects them to `/domaine/<slug>` of the lowest-order domain

### Requirement: Display a collapsible left sidebar listing domains
The system SHALL display a left side panel that lists the domains, highlights the active domain, allows the panel to be toggled hidden or shown, and SHALL persist the collapsed state across navigation.

#### Scenario: The sidebar lists the domains
- **WHEN** a page is rendered
- **THEN** a left panel shows a link for each domain

#### Scenario: The active domain is highlighted
- **WHEN** the current page belongs to a domain
- **THEN** that domain is highlighted in the sidebar

#### Scenario: The sidebar can be toggled
- **WHEN** the user clicks the sidebar toggle control
- **THEN** the sidebar is shown or hidden accordingly

#### Scenario: The collapsed state persists
- **WHEN** the user hides the sidebar and then navigates to another page
- **THEN** the sidebar remains hidden

### Requirement: Render the active domain's outline on its page
The system SHALL render the outline of the active domain (its projects as level-1 lines) inside that domain's page.

#### Scenario: The outline shown is the active domain's
- **WHEN** a domain page is rendered
- **THEN** the outline shown is that domain's projects
