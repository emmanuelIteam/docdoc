## MODIFIED Requirements

### Requirement: Present the guide as readable sections

Le système SHALL présenter la documentation de la page « Aide » en sections titrées — au moins la sélection et le menu, le repli, le déplacement, le renommage, l'ajout d'une sous-tâche, les liens de tâche, l'indentation, les étiquettes, les rubriques GTD de l'accueil et l'administration — plutôt qu'en un paragraphe unique. Le contenu SHALL rester lisible sans JavaScript et SHALL ne rien tronquer.

#### Scenario: Each topic has its own title

- **WHEN** la page « Aide » est rendue
- **THEN** chaque sujet documenté est porté par un titre de section, et son texte suit sous forme de liste ou de paragraphe

#### Scenario: The guide works without JavaScript

- **WHEN** la page « Aide » est rendue alors que `app.js` ne s'exécute pas
- **THEN** la documentation reste entièrement affichée et l'entrée « Aide » du panneau reste un lien fonctionnel

#### Scenario: The guide does not truncate the documentation

- **WHEN** la page « Aide » est affichée sur un écran étroit
- **THEN** le texte revient à la ligne et aucun contenu documenté n'est masqué ni tronqué

#### Scenario: The GTD board has its own section

- **WHEN** la page « Aide » est rendue
- **THEN** les rubriques GTD de la page d'accueil sont documentées dans une section titrée distincte des autres sujets

## ADDED Requirements

### Requirement: Document the GTD rubriques of the home page

Le système SHALL documenter dans la page « Aide » les trois rubriques GTD de la page d'accueil — « À faire », « En attente » et « Un jour peut-être » —, leur signification, le rattachement d'une tâche à une autre rubrique par glisser-déposer et l'alternative accessible par le menu de rubrique. La documentation SHALL rappeler que le titre d'une carte ouvre la tâche dans son domaine.

#### Scenario: The guide explains the three rubriques

- **WHEN** la page « Aide » est rendue
- **THEN** elle nomme « À faire », « En attente » et « Un jour peut-être » et explique ce que chacune regroupe

#### Scenario: The guide explains the drag and drop

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique qu'une carte se déplace d'une rubrique à une autre par glisser-déposer, à la souris comme au doigt

#### Scenario: The guide explains the keyboard alternative

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique que le menu de rubrique d'une carte permet le même classement sans glisser

#### Scenario: The guide explains how to open a task

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique que le titre d'une carte ouvre la tâche dans son domaine, avec ses ancêtres dépliés et la ligne mise en évidence

### Requirement: Document what the GTD board excludes

Le système SHALL indiquer dans la page « Aide » qu'une tâche feuille non terminée appartient à exactement une rubrique, et que les tâches terminées et les lignes mères ne sont pas listées.

#### Scenario: The guide explains what is not listed

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique que les tâches terminées et les lignes mères ne figurent pas dans les rubriques

#### Scenario: A task belongs to exactly one rubrique

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique qu'une tâche feuille non terminée est classée dans une seule des trois rubriques
