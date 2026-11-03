## ADDED Requirements

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
