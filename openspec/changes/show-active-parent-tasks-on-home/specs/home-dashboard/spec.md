## RENAMED Requirements

- FROM: `### Requirement: Classer les tâches feuilles dans deux rubriques GTD`
- TO: `### Requirement: Classer les lignes actives dans deux rubriques GTD`

## MODIFIED Requirements

### Requirement: Afficher les deux rubriques GTD de la page d'accueil

Le système SHALL afficher les deux rubriques GTD « À faire » et « En attente » dès qu'au moins un domaine existe, y compris lorsque les deux sont vides, regroupées sous l'intitulé « En cours ». Chaque rubrique vide SHALL afficher un message indiquant qu'aucune tâche n'y est classée. Le système SHALL NOT remplacer les deux rubriques par un état vide global quand des domaines existent. La page SHALL rester servie à la racine, sans redirection.

#### Scenario: Des domaines mais aucune tâche

- **WHEN** le compte a des domaines mais aucune ligne active, feuille ou mère
- **THEN** la page d'accueil affiche les deux rubriques, chacune avec un message indiquant qu'aucune tâche n'y est classée

#### Scenario: Seules des tâches mères existent

- **WHEN** le compte a des domaines et que leurs seules lignes actives sont des tâches mères dont aucun descendant n'est actif
- **THEN** les deux rubriques sont affichées et une carte représente chaque tâche mère active

#### Scenario: Seules des tâches En projet existent

- **WHEN** le compte a des domaines et que toutes leurs lignes ont le statut `todo`
- **THEN** les deux rubriques sont affichées et aucune carte n'y figure

#### Scenario: Seules des tâches terminées existent

- **WHEN** le compte a des domaines et que toutes leurs lignes sont terminées
- **THEN** les deux rubriques sont affichées et aucune carte n'y figure

#### Scenario: Les deux rubriques sont regroupées sous En cours

- **WHEN** la page d'accueil est affichée alors qu'au moins un domaine existe
- **THEN** les rubriques « À faire » et « En attente » apparaissent sous un intitulé « En cours » visible

#### Scenario: La page reste servie à la racine

- **WHEN** l'utilisateur ouvre `/` avec au moins un domaine
- **THEN** la réponse est le tableau des deux rubriques, sans redirection

### Requirement: Classer les lignes actives dans deux rubriques GTD

Le système SHALL classer chaque ligne active sans descendant actif dans exactement une rubrique GTD : « À faire » pour `in_progress`, « En attente » pour `waiting`. Une ligne mère active dont aucun descendant n'est actif est donc listée. Une ligne active dont au moins un descendant est actif SHALL NOT l'être : la branche est représentée par sa ligne active la plus profonde. Le système SHALL NOT lister une ligne `todo` (« En projet »), une ligne `done`, une ligne d'un domaine archivé, ni une ligne héritée au statut `someday`, qui est lue comme `todo`.

#### Scenario: Une tâche À faire est classée dans À faire

- **WHEN** une ligne feuille a le statut `in_progress`
- **THEN** sa carte apparaît dans la rubrique « À faire »

#### Scenario: Une tâche en attente est classée dans En attente

- **WHEN** une ligne feuille a le statut `waiting`
- **THEN** sa carte apparaît dans la rubrique « En attente »

#### Scenario: Une tâche mère active sans descendant actif est listée

- **WHEN** une ligne mère a le statut `in_progress` et que toutes ses sous-tâches sont `todo` ou `done`
- **THEN** sa carte apparaît dans « À faire », avec le nom du domaine puis ses propres ancêtres sur la seconde ligne

#### Scenario: Une tâche mère dont un descendant est actif n'est pas listée

- **WHEN** une ligne mère a le statut `in_progress` et qu'au moins un de ses descendants a le statut `in_progress` ou `waiting`
- **THEN** aucune carte ne représente la mère, et la branche est représentée par la carte de sa ligne active la plus profonde

#### Scenario: Une branche active ne produit qu'une carte

- **WHEN** une tâche mère et sa sous-tâche sont toutes deux `in_progress` et que la sous-tâche n'a aucun enfant actif
- **THEN** seule la carte de la sous-tâche est listée, et sa seconde ligne rappelle la tâche mère

#### Scenario: Une sous-tâche active sous une mère En projet est listée

- **WHEN** une ligne mère a le statut `todo` et que sa sous-tâche a le statut `waiting`
- **THEN** seule la carte de la sous-tâche est listée, dans « En attente »

#### Scenario: Une tâche En projet n'est pas listée

- **WHEN** une ligne a le statut `todo`, qu'elle soit feuille ou mère
- **THEN** aucune carte ne la représente dans l'une des deux rubriques

#### Scenario: Une tâche héritée Un jour peut-être n'est pas listée

- **WHEN** une ligne porte le statut hérité `someday`
- **THEN** elle est lue comme `todo` et aucune carte ne la représente dans l'une des deux rubriques

#### Scenario: Une tâche terminée n'est listée nulle part

- **WHEN** une ligne a le statut `done`
- **THEN** aucune carte ne la représente dans l'une des deux rubriques

#### Scenario: Une tâche mère n'est pas listée

- **WHEN** une ligne mère a le statut `todo` ou `done`, qu'elle ait des enfants ou non
- **THEN** elle n'apparaît dans aucune des deux rubriques

#### Scenario: Une sous-tâche feuille profonde est listée

- **WHEN** une sous-tâche sans enfant de profondeur 2 a le statut `in_progress` et qu'aucun de ses descendants n'est actif
- **THEN** sa carte apparaît dans « À faire », avec sa chaîne de parents

#### Scenario: Une feuille sous un ancêtre replié est listée

- **WHEN** une ligne feuille active est masquée parce que son parent est replié sur la page du domaine
- **THEN** sa carte apparaît tout de même dans sa rubrique sur la page d'accueil

#### Scenario: Un projet sans sous-ligne est listé comme feuille

- **WHEN** un projet de niveau 1 n'a aucun enfant et a le statut `in_progress`
- **THEN** sa carte apparaît dans « À faire »

#### Scenario: Une tâche d'un domaine archivé est absente

- **WHEN** un domaine est archivé alors qu'il contenait une ligne active
- **THEN** cette tâche n'apparaît dans aucune rubrique de la page d'accueil

### Requirement: Refuser un positionnement invalide sans rien modifier

Le système SHALL refuser sans rien modifier une demande de positionnement dont la rubrique n'est pas l'une des deux rubriques, dont la tâche n'appartient pas au compte ou dont la tâche n'est pas une ligne active listée sur le tableau — une ligne active sans descendant actif. Une position numérique hors bornes SHALL être ramenée à la première ou à la dernière position de la rubrique. Le refus SHALL répondre 400 ou 404 selon le cas.

#### Scenario: Une rubrique inconnue est refusée

- **WHEN** une demande de positionnement porte une rubrique autre que « À faire » ou « En attente »
- **THEN** la réponse est 400 et aucun ordre n'est modifié

#### Scenario: Une tâche non listée est refusée

- **WHEN** une demande de positionnement vise une tâche terminée, en projet, ou une tâche mère dont un descendant est actif
- **THEN** la réponse est 400 et aucun ordre n'est modifié

#### Scenario: Une tâche mère listée est acceptée

- **WHEN** une demande de positionnement vise une tâche mère active sans descendant actif
- **THEN** le positionnement est accepté et l'ordre est enregistré

#### Scenario: Une tâche d'un autre compte est refusée

- **WHEN** une demande de positionnement vise l'identifiant d'une tâche d'un autre compte
- **THEN** la réponse est 404 et aucun ordre n'est modifié

#### Scenario: Une position hors bornes est ramenée dans la rubrique

- **WHEN** une demande de positionnement porte une position supérieure au nombre de cartes de la rubrique
- **THEN** la carte est placée en dernière position et aucun autre ordre n'est modifié
