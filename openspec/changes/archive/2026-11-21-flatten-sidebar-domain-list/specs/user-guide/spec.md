## ADDED Requirements

### Requirement: Document domain ordering in the guide

Le système SHALL documenter dans la page « Aide » le classement manuel des domaines depuis le panneau latéral : les contrôles ↑/↓ présents sur chaque entrée, le fait que l'ordre obtenu est partagé avec la page Administration et la page d'accueil, et le fait que les thèmes restent des étiquettes sans regrouper les domaines du panneau. Cette documentation SHALL être rendue dans une section titrée de la page, rester entièrement lisible sans JavaScript, et ne SHALL pas ajouter de second lien vers `/administration`.

#### Scenario: The guide documents the reordering controls

- **WHEN** la page « Aide » est rendue
- **THEN** elle décrit les contrôles ↑/↓ du panneau latéral et le déplacement d'un domaine d'un cran vers le haut ou vers le bas

#### Scenario: The guide explains the shared order

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique que l'ordre des domaines est le même dans le panneau, dans la page Administration et sur la page d'accueil

#### Scenario: The guide keeps themes as labels

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique que les thèmes restent des étiquettes et ne regroupent plus les domaines du panneau

#### Scenario: The section is readable without JavaScript

- **WHEN** la page « Aide » est affichée alors que `app.js` ne s'exécute pas
- **THEN** la section sur le classement des domaines reste entièrement affichée

#### Scenario: The guide keeps a single administration link

- **WHEN** la page « Aide » est rendue
- **THEN** elle contient un seul lien vers `/administration`
