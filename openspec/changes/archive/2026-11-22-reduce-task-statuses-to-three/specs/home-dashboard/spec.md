## RENAMED Requirements

- FROM: `### Requirement: Afficher les trois rubriques GTD de la page d'accueil`
- TO: `### Requirement: Afficher les deux rubriques GTD de la page d'accueil`

- FROM: `### Requirement: Classer les tâches feuilles dans trois rubriques GTD`
- TO: `### Requirement: Classer les tâches feuilles dans deux rubriques GTD`

## MODIFIED Requirements

### Requirement: Afficher les deux rubriques GTD de la page d'accueil

Le système SHALL afficher les deux rubriques GTD « À faire » et « En attente » dès qu'au moins un domaine existe, y compris lorsque les deux sont vides, regroupées sous l'intitulé « En cours ». Chaque rubrique vide SHALL afficher un message indiquant qu'aucune tâche n'y est classée. Le système SHALL NOT remplacer les deux rubriques par un état vide global quand des domaines existent. La page SHALL rester servie à la racine, sans redirection.

#### Scenario: Des domaines mais aucune tâche

- **WHEN** le compte a des domaines mais aucune ligne feuille active
- **THEN** la page d'accueil affiche les deux rubriques, chacune avec un message indiquant qu'aucune tâche n'y est classée

#### Scenario: Seules des tâches mères existent

- **WHEN** le compte a des domaines et que leurs seules lignes actives possèdent des enfants
- **THEN** les deux rubriques sont affichées et aucune carte n'y figure

#### Scenario: Seules des tâches En projet existent

- **WHEN** le compte a des domaines et que toutes leurs lignes feuilles ont le statut `todo`
- **THEN** les deux rubriques sont affichées et aucune carte n'y figure

#### Scenario: Seules des tâches terminées existent

- **WHEN** le compte a des domaines et que toutes leurs lignes feuilles sont terminées
- **THEN** les deux rubriques sont affichées et aucune carte n'y figure

#### Scenario: Les deux rubriques sont regroupées sous En cours

- **WHEN** la page d'accueil est affichée alors qu'au moins un domaine existe
- **THEN** les rubriques « À faire » et « En attente » apparaissent sous un intitulé « En cours » visible

#### Scenario: La page reste servie à la racine

- **WHEN** l'utilisateur ouvre `/` avec au moins un domaine
- **THEN** la réponse est le tableau des deux rubriques, sans redirection

### Requirement: Classer les tâches feuilles dans deux rubriques GTD

Le système SHALL classer chaque ligne feuille active d'un domaine actif dans exactement une rubrique GTD : « À faire » pour `in_progress` et « En attente » pour `waiting`. Une ligne feuille est une ligne dont la liste `children` est vide ou absente. Le système SHALL NOT lister une ligne `todo` (« En projet »), une ligne mère, une ligne `done`, une ligne d'un domaine archivé, ni une ligne héritée au statut `someday`, qui est lue comme `todo`.

#### Scenario: Une tâche À faire est classée dans À faire

- **WHEN** une ligne feuille a le statut `in_progress`
- **THEN** sa carte apparaît dans la rubrique « À faire »

#### Scenario: Une tâche en attente est classée dans En attente

- **WHEN** une ligne feuille a le statut `waiting`
- **THEN** sa carte apparaît dans la rubrique « En attente »

#### Scenario: Une tâche En projet n'est pas listée

- **WHEN** une ligne feuille a le statut `todo`
- **THEN** aucune carte ne la représente dans l'une des deux rubriques

#### Scenario: Une tâche héritée Un jour peut-être n'est pas listée

- **WHEN** une ligne feuille porte le statut hérité `someday`
- **THEN** elle est lue comme `todo` et aucune carte ne la représente dans l'une des deux rubriques

#### Scenario: Une tâche terminée n'est listée nulle part

- **WHEN** une ligne feuille a le statut `done`
- **THEN** aucune carte ne la représente dans l'une des deux rubriques

#### Scenario: Une tâche mère n'est pas listée

- **WHEN** une ligne possède au moins un enfant, quel que soit son statut
- **THEN** elle n'apparaît dans aucune des deux rubriques

#### Scenario: Une sous-tâche feuille profonde est listée

- **WHEN** une sous-tâche sans enfant de profondeur 2 a le statut `in_progress`
- **THEN** sa carte apparaît dans « À faire », avec sa chaîne de parents

#### Scenario: Une feuille sous un ancêtre replié est listée

- **WHEN** une ligne feuille active est masquée parce que son parent est replié sur la page du domaine
- **THEN** sa carte apparaît tout de même dans sa rubrique sur la page d'accueil

#### Scenario: Un projet sans sous-ligne est listé comme feuille

- **WHEN** un projet de niveau 1 n'a aucun enfant et a le statut `in_progress`
- **THEN** sa carte apparaît dans « À faire »

#### Scenario: Une tâche d'un domaine archivé est absente

- **WHEN** un domaine est archivé alors qu'il contenait une ligne feuille `in_progress`
- **THEN** cette tâche n'apparaît dans aucune rubrique de la page d'accueil

### Requirement: Rattacher une tâche à une rubrique par glisser-déposer

Le système SHALL permettre de déplacer une carte d'une rubrique à une autre par glisser-déposer à la souris, au doigt ou au stylet. Le dépôt SHALL persister le statut de la rubrique cible — `in_progress` pour « À faire », `waiting` pour « En attente » — sur la seule tâche visée, et SHALL rafraîchir le tableau.

#### Scenario: Une carte passe de À faire à En attente

- **WHEN** l'utilisateur glisse une carte de la rubrique « À faire » et la dépose dans « En attente »
- **THEN** le statut de la tâche devient `waiting`, sa carte apparaît dans « En attente » et le tableau est rafraîchi

#### Scenario: Une carte revient dans À faire

- **WHEN** l'utilisateur glisse une carte de « En attente » et la dépose dans « À faire »
- **THEN** le statut de la tâche devient `in_progress` et sa carte apparaît dans « À faire »

#### Scenario: Le dépôt ne modifie que la tâche visée

- **WHEN** une carte est déposée dans une rubrique
- **THEN** seul le statut de cette tâche est modifié, et les autres tâches du domaine conservent le leur

#### Scenario: Un second dépôt pendant une requête est ignoré

- **WHEN** une requête de déplacement est en cours et que l'utilisateur tente un nouveau dépôt
- **THEN** le second dépôt est ignoré jusqu'à la fin du rafraîchissement

### Requirement: Ne rien changer sur un dépôt sans cible

Le système SHALL NOT modifier le statut lorsqu'une carte est déposée sur sa rubrique d'origine, en dehors des deux rubriques, ou lorsque le glissement est annulé ou interrompu. Les indicateurs de dépôt SHALL être retirés dans ces cas.

#### Scenario: Le dépôt sur la rubrique d'origine ne change rien

- **WHEN** l'utilisateur dépose une carte sur la rubrique où elle se trouve déjà
- **THEN** aucun statut n'est modifié et aucune requête de mutation n'est envoyée

#### Scenario: Un dépôt hors rubrique ne change rien

- **WHEN** l'utilisateur relâche une carte en dehors des deux rubriques
- **THEN** aucun statut n'est modifié et la carte reste dans sa rubrique d'origine

#### Scenario: Un glisser annulé ne change rien

- **WHEN** l'utilisateur annule le glissement avant de déposer la carte
- **THEN** aucun statut n'est modifié et les indicateurs de dépôt disparaissent

### Requirement: Changer de rubrique sans glisser

Le système SHALL offrir sur chaque carte un contrôle accessible permettant de choisir l'une des deux rubriques sans utiliser le glisser-déposer. Le contrôle SHALL être activable au clavier, SHALL nommer la tâche et SHALL présenter les deux rubriques « À faire » et « En attente ». La rubrique courante SHALL être désactivée ou marquée comme courante. L'activation d'une autre rubrique SHALL persister le statut correspondant sur la seule tâche visée et rafraîchir le tableau, avec le même effet qu'un dépôt.

#### Scenario: Le menu liste les deux rubriques

- **WHEN** l'utilisateur ouvre le contrôle de rubrique d'une carte
- **THEN** les choix « À faire » et « En attente » sont présentés

#### Scenario: La rubrique courante est désactivée

- **WHEN** une carte est dans « En attente » et que l'utilisateur ouvre son contrôle de rubrique
- **THEN** le choix « En attente » est désactivé ou marqué comme courant

#### Scenario: Un choix au clavier déplace la tâche

- **WHEN** l'utilisateur ouvre le contrôle au clavier et choisit « En attente »
- **THEN** la tâche prend le statut `waiting` et sa carte apparaît dans « En attente »

#### Scenario: Le contrôle nomme la tâche

- **WHEN** une carte est rendue
- **THEN** son contrôle de rubrique porte un nom accessible qui inclut le titre de la tâche
