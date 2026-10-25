## ADDED Requirements

### Requirement: Réduire le pas d'indentation sur écran étroit

Le système SHALL afficher les lignes de l'outline avec un pas d'indentation de 1,6 rem par niveau lorsque la largeur de la fenêtre est supérieure à 640 px, et de 0,8 rem par niveau — la moitié — lorsque cette largeur est inférieure ou égale à 640 px. La réduction SHALL être purement visuelle : la profondeur portée par chaque ligne (`data-depth`), son parent (`data-parent`), l'ordre d'affichage et la hiérarchie SHALL rester inchangés. Le changement de pas SHALL suivre un redimensionnement de la fenêtre sans rechargement de la page.

#### Scenario: Pas plein sur un écran large
- **WHEN** la fenêtre fait 1280 px de large
- **THEN** chaque niveau d'indentation vaut 1,6 rem : une ligne de profondeur 1 est décalée de 25,6 px et une ligne de profondeur 2 de 51,2 px (à la taille de police par défaut de 16 px)

#### Scenario: Moitié sur un écran étroit
- **WHEN** la fenêtre fait 390 px de large
- **THEN** chaque niveau d'indentation vaut 0,8 rem : une ligne de profondeur 1 est décalée de 12,8 px et une ligne de profondeur 2 de 25,6 px

#### Scenario: Le seuil de 640 px est inclusif
- **WHEN** la fenêtre fait exactement 640 px de large
- **THEN** le pas est réduit de moitié ; à 641 px, il reprend sa valeur pleine

#### Scenario: La profondeur, le parent et l'ordre sont inchangés
- **WHEN** le pas d'indentation change à cause de la largeur de la fenêtre
- **THEN** chaque ligne conserve son `data-depth`, son `data-parent` et sa place dans l'ordre affiché ; seule sa position horizontale change

#### Scenario: La bascule suit un redimensionnement sans rechargement
- **WHEN** la fenêtre est redimensionnée de 1280 px à 390 px puis de nouveau à 1280 px
- **THEN** le pas d'indentation devient la moitié puis redevient plein, sans rechargement de la page ni requête au serveur
