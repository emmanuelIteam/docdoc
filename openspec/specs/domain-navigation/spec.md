# domain-navigation Specification

## Purpose
TBD - created by archiving change add-domains. Update Purpose after archive.
## Requirements
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

### Requirement: Render the active domain's outline on its page
The system SHALL render the outline of the active domain (its projects as level-1 lines) inside that domain's page.

#### Scenario: The outline shown is the active domain's
- **WHEN** a domain page is rendered
- **THEN** the outline shown is that domain's projects

### Requirement: Replier le panneau après l'ouverture d'une page depuis le panneau

Le système SHALL, lorsque l'utilisateur active une entrée du panneau latéral qui ouvre une page — l'accueil, un domaine, l'administration, l'aide ou la gestion des passkeys — alors que la fenêtre est un écran étroit (largeur inférieure ou égale à 640 px), replier le panneau latéral. Le repli SHALL emprunter le même état que le bouton d'affichage/masquage du panneau, afin que ce bouton le rouvre et que l'état soit persisté comme celui du bouton. La page demandée SHALL être rendue avec le panneau déjà replié, et ce repli SHALL être conservé après un rechargement de la page ou un retour arrière. Sur une fenêtre plus large que 640 px, l'activation de ces entrées SHALL laisser l'état du panneau inchangé. Seules les entrées qui ouvrent une page SHALL déclencher le repli : un clic modifié ouvrant un nouvel onglet, le bouton d'installation de l'application et le formulaire de déconnexion SHALL laisser l'état du panneau inchangé.

#### Scenario: L'accueil referme le panneau sur un smartphone
- **WHEN** dans une fenêtre de 390 px de large, le panneau est affiché et l'utilisateur active l'entrée Accueil
- **THEN** la page d'accueil est chargée et le panneau latéral est replié

#### Scenario: Un domaine referme le panneau sur un smartphone
- **WHEN** dans une fenêtre de 390 px de large, le panneau est affiché et l'utilisateur sélectionne un domaine
- **THEN** la page de ce domaine est chargée et le panneau latéral est replié

#### Scenario: Administration et Aide referment le panneau
- **WHEN** dans une fenêtre de 390 px de large, le panneau est affiché et l'utilisateur active l'entrée Administration ou l'entrée Aide
- **THEN** la page demandée est chargée et le panneau latéral est replié

#### Scenario: La gestion des passkeys referme le panneau
- **WHEN** dans une fenêtre de 390 px de large, le panneau est affiché et l'utilisateur active l'accès à la gestion des passkeys
- **THEN** la page de gestion des passkeys est chargée et le panneau latéral reste replié en revenant sur une page qui l'affiche

#### Scenario: La page demandée arrive panneau replié
- **WHEN** la page demandée est affichée après l'activation d'une entrée sur un écran étroit
- **THEN** le panneau est replié dès le rendu de la page et le contenu occupe la largeur disponible

#### Scenario: Le repli persiste après rechargement
- **WHEN** la page demandée est rechargée sur un écran étroit
- **THEN** le panneau reste replié

#### Scenario: Le bouton rouvre le panneau
- **WHEN** après l'activation d'une entrée sur un écran étroit, l'utilisateur active le bouton d'affichage/masquage du panneau
- **THEN** le panneau se déplie comme après un repli manuel

#### Scenario: Un écran large garde le panneau dans son état
- **WHEN** dans une fenêtre de 1280 px de large, l'utilisateur active l'entrée Accueil, un domaine, Administration ou Aide
- **THEN** la page demandée est chargée et le panneau reste ouvert

#### Scenario: Les commandes qui ne naviguent pas ne referment pas le panneau
- **WHEN** dans une fenêtre de 390 px de large, l'utilisateur active le bouton d'installation de l'application ou le formulaire de déconnexion
- **THEN** le panneau conserve son état d'ouverture

#### Scenario: Un clic modifié laisse l'état du panneau
- **WHEN** l'utilisateur active une entrée avec `Ctrl`, `Cmd`, `Shift` ou `Alt` pour ouvrir un nouvel onglet ou une nouvelle fenêtre
- **THEN** le panneau de la page courante conserve son état

### Requirement: Garder le bloc bas du panneau visible au bas de l'écran

Le système SHALL afficher le panneau latéral sur exactement une hauteur d'écran et SHALL l'épingler en haut de la fenêtre pendant que la page défile, afin que le bloc bas du panneau — Administration, Aide, installation de l'application et session (identité, gestion des passkeys, déconnexion) — reste affiché au bas de l'écran quelle que soit la longueur de la liste des domaines. Seule la liste des domaines SHALL défiler, à l'intérieur du panneau, lorsque son contenu dépasse la hauteur disponible : ni la page, ni le panneau entier, ni le bloc bas SHALL défiler pour laisser voir la fin de la liste. Le bloc bas SHALL conserver sa hauteur et rester sous la liste ; il SHALL ne jamais être comprimé pour faire place aux domaines. Lorsque la liste des domaines tient dans la hauteur disponible, le bloc bas SHALL reposer au bas de l'écran. Le repli du panneau SHALL rester inchangé : replié, le panneau ne réserve aucune largeur et n'affiche ni la liste ni le bloc bas.

#### Scenario: Une liste courte laisse le bloc bas au bas de l'écran

- **WHEN** la liste des domaines tient dans la hauteur de la fenêtre
- **THEN** le bloc bas est affiché sous la liste, au bas de l'écran, et la liste ne défile pas

#### Scenario: Une liste longue fait défiler la liste, pas le bloc bas

- **WHEN** la liste des domaines dépasse la hauteur disponible
- **THEN** seule la liste défile à l'intérieur du panneau, et le bloc bas reste affiché au bas de l'écran, sous la liste

#### Scenario: Le bloc bas reste affiché pendant le défilement de la page

- **WHEN** la page de contenu est plus haute que la fenêtre et que l'utilisateur la fait défiler
- **THEN** le panneau reste épinglé en haut de la fenêtre et le bloc bas reste affiché au bas de l'écran

#### Scenario: Le bloc bas reste affiché sur un écran étroit

- **WHEN** la fenêtre est un écran étroit (largeur inférieure ou égale à 640 px) et que la liste des domaines dépasse la hauteur disponible
- **THEN** la liste défile à l'intérieur du panneau et le bloc bas reste affiché au bas de l'écran

#### Scenario: Le panneau replié n'affiche ni liste ni bloc bas

- **WHEN** le panneau est replié
- **THEN** il ne réserve aucune largeur et n'affiche ni la liste des domaines ni le bloc bas, comme avant le changement

