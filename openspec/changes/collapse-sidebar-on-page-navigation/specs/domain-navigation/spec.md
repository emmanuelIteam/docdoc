## REMOVED Requirements

### Requirement: Replier le panneau après la sélection d'un domaine sur un écran étroit
**Reason**: Le repli ne concerne plus seulement les domaines : toute entrée du panneau qui ouvre une page (accueil, domaine, administration, aide, gestion des passkeys) referme le panneau sur un écran étroit. L'exigence est remplacée par une version qui décrit ce périmètre élargi ; la conserver en parallèle contredirait la nouvelle sur le cas des entrées Administration et Aide.
**Migration**: Aucune donnée à migrer. Le comportement observable sur un écran large et sur un clic modifié est inchangé ; sur un écran étroit, les entrées autres qu'un domaine referment désormais le panneau au lieu de le laisser ouvert.

## ADDED Requirements

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
