## MODIFIED Requirements

### Requirement: Document the GTD rubriques of the home page

Le système SHALL documenter dans la page « Aide » les deux sous-états d'« En cours » — « À faire » et « En attente » —, leur signification, le fait qu'ils se gèrent depuis la page d'accueil, le rattachement d'une tâche à l'autre sous-état par glisser-déposer et l'alternative accessible par le menu de rubrique. La documentation SHALL rappeler que le titre d'une carte ouvre la tâche dans son domaine et SHALL indiquer qu'une tâche « En projet » (`todo`) n'est pas listée tant qu'elle n'a pas été passée à « En cours ».

#### Scenario: The guide explains the two sub-states

- **WHEN** la page « Aide » est rendue
- **THEN** elle nomme « À faire » et « En attente » comme les deux sous-états d'« En cours » et explique ce que chacun regroupe

#### Scenario: The guide explains the En cours grouping

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique que les rubriques « À faire » et « En attente » de l'accueil sont les deux sous-états d'« En cours »

#### Scenario: The guide no longer names Un jour peut-être

- **WHEN** la page « Aide » est rendue
- **THEN** elle ne présente plus « Un jour peut-être » comme une rubrique de l'accueil

#### Scenario: The guide explains the drag and drop

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique qu'une carte se déplace d'une rubrique à l'autre par glisser-déposer, à la souris comme au doigt

#### Scenario: The guide explains the keyboard alternative

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique que le menu de rubrique d'une carte permet le même classement sans glisser

#### Scenario: The guide explains how to open a task

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique que le titre d'une carte ouvre la tâche dans son domaine, avec ses ancêtres dépliés et la ligne mise en évidence

#### Scenario: The guide explains how a task becomes listed

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique qu'une tâche « En projet » n'apparaît sur l'accueil qu'une fois passée à « En cours » depuis son domaine

### Requirement: Document what the GTD board excludes

Le système SHALL indiquer dans la page « Aide » que seules les tâches feuilles actives — `in_progress` et `waiting` — appartiennent à exactement une rubrique, et que les tâches « En projet » (`todo`), les tâches terminées et les lignes mères ne sont pas listées. Il SHALL préciser que le statut hérité « Un jour peut-être » est lu comme « En projet » et n'est donc pas listé non plus.

#### Scenario: The guide explains what is not listed

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique que les tâches « En projet », les tâches terminées et les lignes mères ne figurent pas dans les rubriques

#### Scenario: An active task belongs to exactly one rubrique

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique qu'une tâche feuille active est classée dans une seule des deux rubriques

#### Scenario: The legacy someday value is documented

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique qu'une tâche « Un jour peut-être » est désormais lue comme « En projet » et n'apparaît pas sur l'accueil

## ADDED Requirements

### Requirement: Document the three project states of a line

Le système SHALL documenter dans la page « Aide » que le menu contextuel d'une ligne propose trois états — « En projet », « En cours » et « Terminé » —, et que les sous-états « À faire » et « En attente » d'« En cours » ne se choisissent que depuis la page d'accueil. La documentation SHALL rester lisible sans JavaScript et SHALL tenir dans une section titrée de la page.

#### Scenario: The guide names the three project states

- **WHEN** la page « Aide » est rendue
- **THEN** elle nomme « En projet », « En cours » et « Terminé » comme les trois états proposés par le menu d'une ligne

#### Scenario: The guide locates the sub-states

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique que « À faire » et « En attente » se choisissent depuis la page d'accueil et non depuis le menu d'une ligne

#### Scenario: The section is readable without JavaScript

- **WHEN** la page « Aide » est affichée alors que `app.js` ne s'exécute pas
- **THEN** la section sur les trois états et les deux sous-états reste entièrement affichée
