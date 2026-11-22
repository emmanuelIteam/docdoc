## ADDED Requirements

### Requirement: Documenter l'ordre manuel des tâches de l'accueil

Le système SHALL documenter dans la page « Aide » le classement manuel des cartes de la page d'accueil : le glisser-déposer d'une carte à une autre position de sa rubrique, les flèches `↑` et `↓` de chaque carte avec leur désactivation en première et en dernière position, le fait qu'un dépôt dans l'autre rubrique conserve le point de dépôt, et le fait que l'ordre est mémorisé par compte et conservé d'une visite à l'autre. Cette documentation SHALL être rendue dans une section titrée de la page et rester entièrement lisible sans JavaScript.

#### Scenario: Le guide documente le réordonnancement par glisser-déposer

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique qu'une carte se glisse à une autre position de sa rubrique, à la souris comme au doigt

#### Scenario: Le guide documente les flèches

- **WHEN** la page « Aide » est rendue
- **THEN** elle décrit les flèches `↑` et `↓` de chaque carte, le déplacement d'un cran et leur désactivation aux extrémités

#### Scenario: Le guide documente le dépôt entre rubriques

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique qu'une carte déposée dans l'autre rubrique y prend la position du dépôt, et que le menu de rubrique la place en fin de liste

#### Scenario: Le guide documente la persistance de l'ordre

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique que l'ordre choisi est mémorisé pour le compte et conservé d'une visite à l'autre

#### Scenario: La section reste lisible sans JavaScript

- **WHEN** la page « Aide » est affichée alors que `app.js` ne s'exécute pas
- **THEN** la section sur l'ordre manuel des tâches reste entièrement affichée
