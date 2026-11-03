## MODIFIED Requirements

### Requirement: Réduire le pas d'indentation sur écran étroit

Le système SHALL afficher les lignes de l'outline avec un pas d'indentation de 1,6 rem par niveau lorsque la largeur de la fenêtre est supérieure à 640 px, et de 0,8 rem par niveau — la moitié — lorsque cette largeur est inférieure ou égale à 640 px. Le pas SHALL s'appliquer à partir des lignes de profondeur 1 : une ligne de profondeur 1 est décalée de 0,8 rem par rapport au bord gauche de l'outline, une ligne de profondeur 2 de 1,6 rem, et ainsi de suite. La marge gauche des lignes de premier rang (profondeur 0) sur un écran étroit relève de l'exigence **Réduire la marge gauche des lignes de premier rang sur écran étroit** et ne SHALL PAS être déduite de ce pas. La réduction SHALL être purement visuelle : la profondeur portée par chaque ligne (`data-depth`), son parent (`data-parent`), l'ordre d'affichage et la hiérarchie SHALL rester inchangés. Le changement de pas SHALL suivre un redimensionnement de la fenêtre sans rechargement de la page.

#### Scenario: Pas plein sur un écran large

- **WHEN** la fenêtre fait 1280 px de large
- **THEN** chaque niveau d'indentation vaut 1,6 rem : une ligne de profondeur 1 est décalée de 25,6 px et une ligne de profondeur 2 de 51,2 px par rapport au bord gauche de l'outline (à la taille de police par défaut de 16 px)

#### Scenario: Moitié sur un écran étroit

- **WHEN** la fenêtre fait 390 px de large
- **THEN** chaque niveau d'indentation vaut 0,8 rem à partir des lignes de profondeur 1 : une ligne de profondeur 1 est décalée de 12,8 px et une ligne de profondeur 2 de 25,6 px par rapport au bord gauche de l'outline

#### Scenario: Le seuil de 640 px est inclusif

- **WHEN** la fenêtre fait exactement 640 px de large
- **THEN** le pas est réduit de moitié ; à 641 px, il reprend sa valeur pleine

#### Scenario: La profondeur, le parent et l'ordre sont inchangés

- **WHEN** le pas d'indentation change à cause de la largeur de la fenêtre
- **THEN** chaque ligne conserve son `data-depth`, son `data-parent` et sa place dans l'ordre affiché ; seule sa position horizontale change

#### Scenario: La bascule suit un redimensionnement sans rechargement

- **WHEN** la fenêtre est redimensionnée de 1280 px à 390 px puis de nouveau à 1280 px
- **THEN** le pas d'indentation devient la moitié puis redevient plein, sans rechargement de la page ni requête au serveur

## ADDED Requirements

### Requirement: Réduire la marge gauche des lignes de premier rang sur écran étroit

Le système SHALL, lorsque la largeur de la fenêtre est inférieure ou égale à 640 px, décaler les lignes de profondeur 0 (les projets) de 1 rem vers la gauche par rapport à leur position sur un écran large : leur marge gauche passe ainsi de 1,5 rem — la gouttière du contenu — à 0,5 rem, et leur titre dispose de 1 rem (16 px à la taille de police par défaut de 16 px) de largeur supplémentaire. Sur un écran de plus de 640 px, une ligne de profondeur 0 SHALL conserver la marge de 0 rem qu'elle avait (la gouttière de 1,5 rem du contenu reste la seule marge à gauche). Le décalage SHALL être purement visuel et en CSS : la profondeur portée par chaque ligne (`data-depth`), son parent (`data-parent`), l'ordre d'affichage et la hiérarchie SHALL rester inchangés, et les lignes de profondeur 1 et plus SHALL conserver exactement leur position. Le décalage SHALL suivre un redimensionnement de la fenêtre sans rechargement de la page. La ligne épinglée qui représente un projet dans la barre de hiérarchie SHALL recevoir le même décalage, afin de rester exactement alignée avec la ligne qu'elle représente, et SHALL rester entièrement visible : sa puce et son libellé ne SHALL PAS être rognés par la barre. L'anneau qui signale un dépôt à la racine SHALL rester aligné sur le bord gauche des lignes de premier rang et SHALL entourer toutes les lignes.

#### Scenario: Lignes de premier rang sur un écran étroit

- **WHEN** la fenêtre fait 390 px de large
- **THEN** chaque ligne de profondeur 0 a une marge gauche calculée de −1 rem (−16 px), son bord gauche se trouve à 8 px du bord de la fenêtre et son titre est 16 px plus large qu'à 1280 px, pour un même titre et une même ouverture de panneau

#### Scenario: Marge de bureau conservée

- **WHEN** la fenêtre fait 1280 px de large
- **THEN** chaque ligne de profondeur 0 a une marge gauche de 0 rem : la gouttière de 1,5 rem du contenu reste la seule marge à gauche

#### Scenario: Le seuil de 640 px est inclusif

- **WHEN** la fenêtre fait exactement 640 px de large
- **THEN** les lignes de premier rang sont décalées de −1 rem ; à 641 px, elles retrouvent leur marge de 0 rem

#### Scenario: Les lignes de tâches ne bougent pas

- **WHEN** la fenêtre fait 390 px de large
- **THEN** les lignes de profondeur 1 et 2 conservent une marge gauche de 12,8 px et de 25,6 px par rapport au bord de l'outline, identique à leur marge avant le changement

#### Scenario: La profondeur, le parent et l'ordre sont inchangés

- **WHEN** la marge des lignes de premier rang change à cause de la largeur de la fenêtre
- **THEN** chaque ligne conserve son `data-depth`, son `data-parent` et sa place dans l'ordre affiché, et l'indentation comme la désindentation se comportent comme avant

#### Scenario: La bascule suit un redimensionnement sans rechargement

- **WHEN** la fenêtre est redimensionnée de 1280 px à 390 px puis de nouveau à 1280 px
- **THEN** la marge des lignes de premier rang passe de 0 rem à −1 rem puis revient à 0 rem, sans rechargement de la page ni requête au serveur

#### Scenario: La ligne épinglée d'un projet est alignée sur sa ligne

- **WHEN** la fenêtre fait 390 px de large et qu'un projet est à cheval sur la barre de hiérarchie
- **THEN** la ligne épinglée qui représente ce projet commence à la même abscisse que le titre de la ligne qu'elle représente, à 1 px près, et sa puce est entièrement visible (non rognée par la barre)

#### Scenario: La barre de hiérarchie ne déborde pas de la page

- **WHEN** la fenêtre fait 390 px de large et que des lignes épinglées sont affichées
- **THEN** la barre conserve la largeur du contenu et n'ajoute aucun défilement horizontal à la page

#### Scenario: L'anneau de dépôt racine entoure les lignes de premier rang

- **WHEN** un glisser vers la racine survole l'outline dans une fenêtre de 390 px de large
- **THEN** l'anneau de dépôt a son bord gauche au même niveau que le bord gauche des lignes de premier rang et entoure toutes les lignes de l'outline
