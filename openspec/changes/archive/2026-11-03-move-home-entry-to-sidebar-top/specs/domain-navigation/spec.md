## MODIFIED Requirements

### Requirement: Replier le panneau après la sélection d'un domaine sur un écran étroit

Le système SHALL, lorsque l'utilisateur choisit un domaine dans le panneau latéral alors que la fenêtre est un écran étroit (largeur inférieure ou égale à 640 px), replier le panneau latéral. Le repli SHALL emprunter le même état que le bouton d'affichage/masquage du panneau, afin que ce bouton le rouvre et que l'état soit persisté comme celui du bouton. La page du domaine choisi SHALL être rendue avec le panneau déjà replié, et ce repli SHALL être conservé après un rechargement de la page ou un retour arrière. Sur une fenêtre plus large que 640 px, choisir un domaine SHALL laisser l'état du panneau inchangé. Seule la sélection d'un domaine SHALL déclencher le repli : les autres entrées du panneau (Accueil, Administration, Aide) et un clic modifié ouvrant un nouvel onglet SHALL laisser l'état du panneau inchangé.

#### Scenario: Choisir un domaine referme le panneau sur un smartphone

- **WHEN** dans une fenêtre de 390 px de large, le panneau latéral est ouvert et l'utilisateur sélectionne un domaine
- **THEN** la page de ce domaine est chargée et le panneau latéral est replié

#### Scenario: La page du domaine choisi arrive panneau replié

- **WHEN** la page du domaine choisi est affichée après la sélection sur un écran étroit
- **THEN** le panneau est replié dès le rendu de la page et l'outline du domaine occupe la largeur disponible

#### Scenario: Le repli persiste après rechargement

- **WHEN** la page du domaine choisi est rechargée sur un écran étroit
- **THEN** le panneau reste replié

#### Scenario: Le bouton rouvre le panneau

- **WHEN** après une sélection sur un écran étroit, l'utilisateur active le bouton d'affichage/masquage du panneau
- **THEN** le panneau se déplie comme après un repli manuel

#### Scenario: Un écran large garde le panneau dans son état

- **WHEN** dans une fenêtre de 1280 px de large, le panneau est ouvert et l'utilisateur sélectionne un domaine
- **THEN** la page de ce domaine est chargée et le panneau reste ouvert

#### Scenario: Les autres entrées du panneau ne le referment pas

- **WHEN** sur un écran étroit, l'utilisateur active l'entrée Accueil, l'entrée Administration ou l'entrée Aide du panneau
- **THEN** le panneau conserve son état d'ouverture
