## MODIFIED Requirements

### Requirement: Document the GTD rubriques of the home page

Le système SHALL documenter dans la page « Aide » les trois rubriques GTD de la page d'accueil — « En cours », « En attente » et « Un jour peut-être » —, leur signification, le rattachement d'une tâche à une autre rubrique par glisser-déposer et l'alternative accessible par le menu de rubrique. La documentation SHALL rappeler que le titre d'une carte ouvre la tâche dans son domaine et SHALL indiquer qu'une tâche non commencée (`todo`) n'est pas listée tant qu'elle n'a pas été passée à « En cours ».

#### Scenario: The guide explains the three rubriques

- **WHEN** la page « Aide » est rendue
- **THEN** elle nomme « En cours », « En attente » et « Un jour peut-être » et explique ce que chacune regroupe

#### Scenario: The guide explains the drag and drop

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique qu'une carte se déplace d'une rubrique à une autre par glisser-déposer, à la souris comme au doigt

#### Scenario: The guide explains the keyboard alternative

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique que le menu de rubrique d'une carte permet le même classement sans glisser

#### Scenario: The guide explains how to open a task

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique que le titre d'une carte ouvre la tâche dans son domaine, avec ses ancêtres dépliés et la ligne mise en évidence

#### Scenario: The guide explains how a task becomes listed

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique qu'une tâche à faire n'apparaît sur l'accueil qu'une fois passée à « En cours » depuis son domaine

### Requirement: Document what the GTD board excludes

Le système SHALL indiquer dans la page « Aide » que seules les tâches feuilles actives — `in_progress`, `waiting` et `someday` — appartiennent à exactement une rubrique, et que les tâches à faire (`todo`), les tâches terminées et les lignes mères ne sont pas listées.

#### Scenario: The guide explains what is not listed

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique que les tâches à faire, les tâches terminées et les lignes mères ne figurent pas dans les rubriques

#### Scenario: An active task belongs to exactly one rubrique

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique qu'une tâche feuille active est classée dans une seule des trois rubriques
