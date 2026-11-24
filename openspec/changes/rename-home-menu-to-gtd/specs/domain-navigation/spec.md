## MODIFIED Requirements

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
