## ADDED Requirements

### Requirement: Documenter l'ajout d'un projet depuis la page du domaine

Le système SHALL documenter dans la page « Aide » l'ajout d'un projet depuis la page d'un domaine : le bouton `+` de l'en-tête, le fait que le projet est inséré en tête de l'outline, et le fait que son titre s'ouvre en édition avec `Nouveau projet` entièrement sélectionné. Cette documentation SHALL être rendue dans une section titrée de la page et rester entièrement lisible sans JavaScript.

#### Scenario: The guide documents the add-project control

- **WHEN** la page « Aide » est rendue
- **THEN** elle décrit le bouton `+` de l'en-tête d'une page de domaine et son nom « Ajouter un projet »

#### Scenario: The guide explains the head insertion

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique que le nouveau projet est inséré en tête de la liste du domaine

#### Scenario: The guide explains the immediate naming

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique que le titre du nouveau projet s'ouvre en édition avec `Nouveau projet` sélectionné, de sorte que la frappe le remplace

#### Scenario: The section is readable without JavaScript

- **WHEN** la page « Aide » est affichée alors que `app.js` ne s'exécute pas
- **THEN** la section sur l'ajout d'un projet reste entièrement affichée
