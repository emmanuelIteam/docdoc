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

### Requirement: Render the active domain's outline on its page
The system SHALL render the outline of the active domain (its projects as level-1 lines) inside that domain's page.

#### Scenario: The outline shown is the active domain's
- **WHEN** a domain page is rendered
- **THEN** the outline shown is that domain's projects

### Requirement: Replier le panneau après l'ouverture d'une page depuis le panneau

Le système SHALL, lorsque l'utilisateur active une entrée du panneau latéral qui ouvre une page — la page GTD, un domaine, l'administration, l'aide ou la gestion des passkeys — alors que la fenêtre est un écran étroit (largeur inférieure ou égale à 640 px), suivre cette entrée sans délai : la page demandée SHALL être chargée et affichée d'abord, avec le panneau latéral encore ouvert. Une fois la page affichée et son fondu d'apparition terminé, le système SHALL replier le panneau latéral par un mouvement continu et bref : la largeur utile du panneau SHALL diminuer progressivement et son contenu SHALL s'effacer en douceur. Le repli SHALL emprunter le même état que le bouton d'affichage/masquage du panneau, afin que ce bouton le rouvre et que l'état soit persisté comme celui du bouton ; l'état replié SHALL ensuite être conservé après un rechargement de la page ou un retour arrière. Si l'utilisateur a demandé la réduction des mouvements (`prefers-reduced-motion: reduce`), le panneau SHALL être replié dès l'affichage de la page, sans animation, et la navigation SHALL rester immédiate. Sur une fenêtre plus large que 640 px, l'activation de ces entrées SHALL laisser l'état du panneau inchangé. Seules les entrées qui ouvrent une page SHALL déclencher le repli : un clic modifié ouvrant un nouvel onglet, le bouton d'installation de l'application et le formulaire de déconnexion SHALL laisser l'état du panneau inchangé.

#### Scenario: La page GTD referme le panneau sur un smartphone

- **WHEN** dans une fenêtre de 390 px de large, le panneau est affiché et l'utilisateur active l'entrée GTD
- **THEN** la page GTD est chargée, puis le panneau latéral est replié

#### Scenario: Un domaine referme le panneau sur un smartphone

- **WHEN** dans une fenêtre de 390 px de large, le panneau est affiché et l'utilisateur sélectionne un domaine
- **THEN** la page de ce domaine est chargée, puis le panneau latéral est replié

#### Scenario: La page apparaît avant le repli

- **WHEN** dans une fenêtre de 390 px de large, le panneau est affiché et l'utilisateur active une entrée qui ouvre une page
- **THEN** la page demandée est chargée et affichée avec le panneau encore ouvert et son contenu qui apparaît, et le panneau ne commence à se replier qu'après l'apparition de la page

#### Scenario: Le repli est un mouvement, après le fondu

- **WHEN** la page demandée vient d'être affichée après l'activation d'une entrée sur un écran étroit
- **THEN** le fondu d'apparition se termine d'abord, puis la largeur du panneau diminue progressivement et son contenu s'efface, au lieu de disparaître d'un coup

#### Scenario: Le repli persiste après rechargement

- **WHEN** la page demandée est rechargée sur un écran étroit après le repli
- **THEN** le panneau reste replié

#### Scenario: Le bouton rouvre le panneau

- **WHEN** après l'activation d'une entrée sur un écran étroit, l'utilisateur active le bouton d'affichage/masquage du panneau
- **THEN** le panneau se déplie comme après un repli manuel

#### Scenario: Le mouvement réduit supprime l'animation du repli

- **WHEN** l'utilisateur a demandé la réduction des mouvements et active une entrée sur un écran étroit
- **THEN** la page demandée est chargée sans délai et le panneau est replié dès son affichage, sans transition

#### Scenario: Un écran large garde le panneau dans son état

- **WHEN** dans une fenêtre de 1280 px de large, l'utilisateur active l'entrée GTD, un domaine, Administration ou Aide
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

### Requirement: Afficher chaque page en fondu au chargement

Le système SHALL faire apparaître le contenu de chaque page de travail — accueil, domaine, administration, aide — par un fondu d'opacité bref, de transparent à pleinement opaque, afin que le remplacement du document ne soit pas perçu comme un à-coup. Le fondu SHALL porter sur la zone de contenu — la barre de titre et le contenu principal — et SHALL rester purement visuel : il SHALL ni retarder la disponibilité de la page, ni modifier sa mise en page, ni empêcher d'utiliser son contenu dès le début du fondu. Les mises à jour faites en place dans une page déjà affichée — par exemple le rafraîchissement de l'outline — SHALL ne pas rejouer le fondu. Si l'utilisateur a demandé la réduction des mouvements (`prefers-reduced-motion: reduce`), la page SHALL apparaître sans fondu.

#### Scenario: La page demandée apparaît en fondu
- **WHEN** une entrée du panneau ouvre une nouvelle page sur un écran étroit
- **THEN** le contenu de la page demandée commence transparent et atteint son opacité pleine en un court fondu, sans décalage de mise en page

#### Scenario: Le contenu est utilisable pendant le fondu
- **WHEN** la page apparaît en fondu
- **THEN** son contenu est déjà en place et peut être utilisé, le fondu n'étant qu'une transition d'opacité

#### Scenario: Une mise à jour en place ne rejoue pas le fondu
- **WHEN** l'outline ou une autre zone de la page est remplacé par une réponse en place, sans rechargement du document
- **THEN** le fondu d'apparition de la page ne se rejoue pas

#### Scenario: Le mouvement réduit supprime le fondu
- **WHEN** l'utilisateur a demandé la réduction des mouvements et qu'une page est chargée
- **THEN** la page apparaît immédiatement à son opacité pleine, sans animation de fondu

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

