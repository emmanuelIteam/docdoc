## MODIFIED Requirements

### Requirement: Present the guide as readable sections

Le système SHALL présenter la documentation de la page « Aide » en sections titrées — au moins la sélection et le menu, le repli, le déplacement, le renommage, l'ajout d'une sous-tâche, les liens de tâche, l'indentation, les étiquettes, le tableau GTD et ses rubriques, et l'administration — plutôt qu'en un paragraphe unique. Le contenu SHALL rester lisible sans JavaScript et SHALL ne rien tronquer.

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
- **THEN** le tableau GTD et ses rubriques sont documentés dans une section titrée distincte des autres sujets

### Requirement: Document the GTD rubriques of the home page

Le système SHALL documenter dans la page « Aide » les deux sous-états d'« En cours » — « À faire » et « En attente » —, leur signification, le fait qu'ils se gèrent depuis la page GTD, le rattachement d'une tâche à l'autre sous-état par glisser-déposer et l'alternative accessible par le menu de rubrique. La documentation SHALL rappeler que le titre d'une carte ouvre la tâche dans son domaine et SHALL indiquer qu'une tâche « En projet » (`todo`) n'est pas listée tant qu'elle n'a pas été passée à « En cours ».

#### Scenario: The guide explains the two sub-states

- **WHEN** la page « Aide » est rendue
- **THEN** elle nomme « À faire » et « En attente » comme les deux sous-états d'« En cours » et explique ce que chacun regroupe

#### Scenario: The guide explains the En cours grouping

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique que les rubriques « À faire » et « En attente » de la page GTD sont les deux sous-états d'« En cours »

#### Scenario: The guide no longer names Un jour peut-être

- **WHEN** la page « Aide » est rendue
- **THEN** elle ne présente plus « Un jour peut-être » comme une rubrique de la page GTD

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
- **THEN** elle indique qu'une tâche « En projet » n'apparaît sur la page GTD qu'une fois passée à « En cours » depuis son domaine

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
- **THEN** elle indique qu'une tâche « Un jour peut-être » est désormais lue comme « En projet » et n'apparaît pas sur la page GTD

## ADDED Requirements

### Requirement: Nommer la page GTD dans la page Aide

Le système SHALL désigner la page servie à la racine sous le nom « page GTD » dans la page « Aide », et SHALL NOT l'appeler « page d'accueil » ni « accueil ». La section consacrée à l'ordonnancement des cartes du tableau SHALL s'intituler « Ordonner les tâches GTD ». Ces mentions SHALL rester entièrement lisibles sans JavaScript.

#### Scenario: The guide names the GTD page

- **WHEN** la page « Aide » est rendue
- **THEN** elle désigne la page servie à la racine comme « la page GTD »

#### Scenario: The guide no longer says page d'accueil

- **WHEN** la page « Aide » est rendue
- **THEN** son contenu ne contient plus l'expression « page d'accueil »

#### Scenario: The ordering section is named GTD

- **WHEN** la page « Aide » est rendue
- **THEN** la section qui documente l'ordre des cartes s'intitule « Ordonner les tâches GTD »

#### Scenario: The renamed section is readable without JavaScript

- **WHEN** la page « Aide » est rendue alors que `app.js` ne s'exécute pas
- **THEN** la section « Ordonner les tâches GTD » et son texte restent entièrement affichés
