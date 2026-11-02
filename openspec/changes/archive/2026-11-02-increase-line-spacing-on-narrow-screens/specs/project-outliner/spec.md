## MODIFIED Requirements

### Requirement: Render lines with compact vertical spacing
Le système SHALL afficher les lignes de l'outline avec un espacement vertical compact lorsque la largeur de la fenêtre est supérieure à 640 px, et SHALL donner à chaque ligne une hauteur d'au moins 2,75 rem (44 px à la taille de police par défaut de 16 px) lorsque cette largeur est inférieure ou égale à 640 px, afin que chaque ligne offre une cible tactile utilisable au doigt. La hauteur SHALL être une hauteur minimale : une ligne dont le titre revient sur plusieurs lignes SHALL grandir au-delà de 2,75 rem sans que son texte soit tronqué. L'espacement SHALL être purement visuel : la profondeur portée par chaque ligne (`data-depth`), son parent (`data-parent`), l'ordre d'affichage et la hiérarchie SHALL rester inchangés. Le changement de hauteur SHALL suivre un redimensionnement de la fenêtre sans rechargement de la page.

#### Scenario: Lignes compactes sur un écran large
- **WHEN** la fenêtre fait 1280 px de large
- **THEN** chaque ligne conserve la hauteur compacte actuelle, d'environ 21 px (à la taille de police par défaut de 16 px), et l'espacement vertical entre lignes voisines reste minimal

#### Scenario: Hauteur tactile sur un écran étroit
- **WHEN** la fenêtre fait 390 px de large
- **THEN** chaque ligne mesure au moins 44 px de haut, son titre est centré verticalement, et deux lignes voisines ne se chevauchent pas

#### Scenario: Le seuil de 640 px est inclusif
- **WHEN** la fenêtre fait exactement 640 px de large
- **THEN** chaque ligne mesure au moins 44 px de haut ; à 641 px, elle retrouve la hauteur compacte

#### Scenario: Un titre sur plusieurs lignes n'est pas tronqué
- **WHEN** un titre revient sur plusieurs lignes dans une fenêtre étroite
- **THEN** la ligne grandit au-delà de 44 px et affiche le titre entier, sans troncature ni ellipse

#### Scenario: La profondeur, le parent et l'ordre sont inchangés
- **WHEN** l'espacement change à cause de la largeur de la fenêtre
- **THEN** chaque ligne conserve son `data-depth`, son `data-parent` et sa place dans l'ordre affiché ; seule sa hauteur change

#### Scenario: La bascule suit un redimensionnement sans rechargement
- **WHEN** la fenêtre est redimensionnée de 1280 px à 390 px puis de nouveau à 1280 px
- **THEN** les lignes passent de la hauteur compacte à la hauteur tactile puis reviennent à la hauteur compacte, sans rechargement de la page ni requête au serveur
