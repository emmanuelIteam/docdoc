## MODIFIED Requirements

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

## ADDED Requirements

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
