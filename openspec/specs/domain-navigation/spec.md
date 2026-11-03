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

Le système SHALL, lorsque l'utilisateur active une entrée du panneau latéral qui ouvre une page — l'accueil, un domaine, l'administration, l'aide ou la gestion des passkeys — alors que la fenêtre est un écran étroit (largeur inférieure ou égale à 640 px), suivre cette entrée sans délai : la page demandée SHALL être chargée et affichée d'abord, avec le panneau latéral encore ouvert. Une fois la page affichée et son fondu d'apparition terminé, le système SHALL replier le panneau latéral par un mouvement continu et bref : la largeur utile du panneau SHALL diminuer progressivement et son contenu SHALL s'effacer en douceur. Le repli SHALL emprunter le même état que le bouton d'affichage/masquage du panneau, afin que ce bouton le rouvre et que l'état soit persisté comme celui du bouton ; l'état replié SHALL ensuite être conservé après un rechargement de la page ou un retour arrière. Si l'utilisateur a demandé la réduction des mouvements (`prefers-reduced-motion: reduce`), le panneau SHALL être replié dès l'affichage de la page, sans animation, et la navigation SHALL rester immédiate. Sur une fenêtre plus large que 640 px, l'activation de ces entrées SHALL laisser l'état du panneau inchangé. Seules les entrées qui ouvrent une page SHALL déclencher le repli : un clic modifié ouvrant un nouvel onglet, le bouton d'installation de l'application et le formulaire de déconnexion SHALL laisser l'état du panneau inchangé.

#### Scenario: L'accueil referme le panneau sur un smartphone
- **WHEN** dans une fenêtre de 390 px de large, le panneau est affiché et l'utilisateur active l'entrée Accueil
- **THEN** la page d'accueil est chargée, puis le panneau latéral est replié

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

