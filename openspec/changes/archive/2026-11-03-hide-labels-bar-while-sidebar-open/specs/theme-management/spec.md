## ADDED Requirements

### Requirement: Effacer la barre d'étiquettes derrière le panneau latéral sur un écran étroit

Le système SHALL, dans une fenêtre de 640 px de large ou moins, ne pas afficher la barre d'étiquettes tant que le panneau latéral est affiché, afin qu'elle ne recouvre ni le panneau ni ses commandes. Il SHALL la réafficher dès que le panneau est replié, et SHALL continuer à l'afficher quand le panneau est affiché sur une fenêtre plus large que 640 px. Tant qu'elle est affichée, la barre SHALL conserver son contenu, sa position fixe en bas à droite et son comportement de rattachement et de détachement des étiquettes.

#### Scenario: La barre s'efface quand le panneau est affiché sur un smartphone
- **WHEN** dans une fenêtre de 390 px de large, une page de domaine est affichée et le panneau latéral est déployé
- **THEN** la barre d'étiquettes n'est pas affichée et le bas du panneau (gestion des passkeys, déconnexion) reste cliquable

#### Scenario: La barre revient quand le panneau est replié
- **WHEN** l'utilisateur replie le panneau sur cette même page
- **THEN** la barre d'étiquettes est de nouveau affichée, en bas à droite, avec ses étiquettes et son contrôle d'ajout

#### Scenario: La barre reste affichée sur un écran large
- **WHEN** dans une fenêtre de 1280 px de large, le panneau est déployé sur une page de domaine
- **THEN** la barre d'étiquettes reste affichée

#### Scenario: La barre est intacte après le repli du panneau
- **WHEN** le panneau a été replié et que l'utilisateur active le contrôle d'ajout de la barre
- **THEN** le sélecteur de thème s'ouvre au-dessus de la barre, comme avant
