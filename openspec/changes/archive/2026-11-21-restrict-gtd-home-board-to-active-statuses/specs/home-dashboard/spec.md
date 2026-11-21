## MODIFIED Requirements

### Requirement: Afficher les trois rubriques GTD de la page d'accueil

Le système SHALL afficher les trois rubriques « En cours », « En attente » et « Un jour peut-être » dès qu'au moins un domaine existe, y compris lorsque les trois sont vides. Chaque rubrique vide SHALL afficher un message indiquant qu'aucune tâche n'y est classée. Le système SHALL NOT remplacer les trois rubriques par un état vide global quand des domaines existent. La page SHALL rester servie à la racine, sans redirection.

#### Scenario: Des domaines mais aucune tâche

- **WHEN** le compte a des domaines mais aucune ligne feuille active
- **THEN** la page d'accueil affiche les trois rubriques, chacune avec un message indiquant qu'aucune tâche n'y est classée

#### Scenario: Seules des tâches mères existent

- **WHEN** le compte a des domaines et que leurs seules lignes actives possèdent des enfants
- **THEN** les trois rubriques sont affichées et aucune carte n'y figure

#### Scenario: Seules des tâches à faire existent

- **WHEN** le compte a des domaines et que toutes leurs lignes feuilles ont le statut `todo`
- **THEN** les trois rubriques sont affichées et aucune carte n'y figure

#### Scenario: Seules des tâches terminées existent

- **WHEN** le compte a des domaines et que toutes leurs lignes feuilles sont terminées
- **THEN** les trois rubriques sont affichées et aucune carte n'y figure

#### Scenario: La page reste servie à la racine

- **WHEN** l'utilisateur ouvre `/` avec au moins un domaine
- **THEN** la réponse est le tableau des trois rubriques, sans redirection

### Requirement: Classer les tâches feuilles dans trois rubriques GTD

Le système SHALL classer chaque ligne feuille active d'un domaine actif dans exactement une rubrique GTD : « En cours » pour `in_progress`, « En attente » pour `waiting`, et « Un jour peut-être » pour `someday`. Une ligne feuille est une ligne dont la liste `children` est vide ou absente. Le système SHALL NOT lister une ligne `todo`, une ligne mère, une ligne `done` ni une ligne d'un domaine archivé.

#### Scenario: Une tâche en cours est classée dans En cours

- **WHEN** une ligne feuille a le statut `in_progress`
- **THEN** sa carte apparaît dans la rubrique « En cours »

#### Scenario: Une tâche en attente est classée dans En attente

- **WHEN** une ligne feuille a le statut `waiting`
- **THEN** sa carte apparaît dans la rubrique « En attente »

#### Scenario: Une tâche un jour peut-être est classée dans sa rubrique

- **WHEN** une ligne feuille a le statut `someday`
- **THEN** sa carte apparaît dans la rubrique « Un jour peut-être »

#### Scenario: Une tâche à faire n'est pas listée

- **WHEN** une ligne feuille a le statut `todo`
- **THEN** aucune carte ne la représente dans l'une des trois rubriques

#### Scenario: Une tâche terminée n'est listée nulle part

- **WHEN** une ligne feuille a le statut `done`
- **THEN** aucune carte ne la représente dans l'une des trois rubriques

#### Scenario: Une tâche mère n'est pas listée

- **WHEN** une ligne possède au moins un enfant, quel que soit son statut
- **THEN** elle n'apparaît dans aucune des trois rubriques

#### Scenario: Une sous-tâche feuille profonde est listée

- **WHEN** une sous-tâche sans enfant de profondeur 2 a le statut `in_progress`
- **THEN** sa carte apparaît dans « En cours », avec sa chaîne de parents

#### Scenario: Une feuille sous un ancêtre replié est listée

- **WHEN** une ligne feuille active est masquée parce que son parent est replié sur la page du domaine
- **THEN** sa carte apparaît tout de même dans sa rubrique sur la page d'accueil

#### Scenario: Un projet sans sous-ligne est listé comme feuille

- **WHEN** un projet de niveau 1 n'a aucun enfant et a le statut `in_progress`
- **THEN** sa carte apparaît dans « En cours »

#### Scenario: Une tâche d'un domaine archivé est absente

- **WHEN** un domaine est archivé alors qu'il contenait une ligne feuille `in_progress`
- **THEN** cette tâche n'apparaît dans aucune rubrique de la page d'accueil

### Requirement: Rattacher une tâche à une rubrique par glisser-déposer

Le système SHALL permettre de déplacer une carte d'une rubrique à une autre par glisser-déposer à la souris, au doigt ou au stylet. Le dépôt SHALL persister le statut de la rubrique cible — `in_progress` pour « En cours », `waiting` pour « En attente », `someday` pour « Un jour peut-être » — sur la seule tâche visée, et SHALL rafraîchir le tableau.

#### Scenario: Une carte passe de En cours à En attente

- **WHEN** l'utilisateur glisse une carte de la rubrique « En cours » et la dépose dans « En attente »
- **THEN** le statut de la tâche devient `waiting`, sa carte apparaît dans « En attente » et le tableau est rafraîchi

#### Scenario: Une carte passe de En attente à Un jour peut-être

- **WHEN** l'utilisateur glisse une carte de « En attente » et la dépose dans « Un jour peut-être »
- **THEN** le statut de la tâche devient `someday` et sa carte apparaît dans « Un jour peut-être »

#### Scenario: Une carte revient dans En cours

- **WHEN** l'utilisateur glisse une carte de « Un jour peut-être » ou « En attente » et la dépose dans « En cours »
- **THEN** le statut de la tâche devient `in_progress` et sa carte apparaît dans « En cours »

#### Scenario: Le dépôt ne modifie que la tâche visée

- **WHEN** une carte est déposée dans une rubrique
- **THEN** seul le statut de cette tâche est modifié, et les autres tâches du domaine conservent le leur

#### Scenario: Un second dépôt pendant une requête est ignoré

- **WHEN** une requête de déplacement est en cours et que l'utilisateur tente un nouveau dépôt
- **THEN** le second dépôt est ignoré jusqu'à la fin du rafraîchissement

### Requirement: Changer de rubrique sans glisser

Le système SHALL offrir sur chaque carte un contrôle accessible permettant de choisir l'une des trois rubriques sans utiliser le glisser-déposer. Le contrôle SHALL être activable au clavier, SHALL nommer la tâche et SHALL présenter les trois rubriques « En cours », « En attente » et « Un jour peut-être ». La rubrique courante SHALL être désactivée ou marquée comme courante. L'activation d'une autre rubrique SHALL persister le statut correspondant sur la seule tâche visée et rafraîchir le tableau, avec le même effet qu'un dépôt.

#### Scenario: Le menu liste les trois rubriques

- **WHEN** l'utilisateur ouvre le contrôle de rubrique d'une carte
- **THEN** les choix « En cours », « En attente » et « Un jour peut-être » sont présentés

#### Scenario: La rubrique courante est désactivée

- **WHEN** une carte est dans « En attente » et que l'utilisateur ouvre son contrôle de rubrique
- **THEN** le choix « En attente » est désactivé ou marqué comme courant

#### Scenario: Un choix au clavier déplace la tâche

- **WHEN** l'utilisateur ouvre le contrôle au clavier et choisit « Un jour peut-être »
- **THEN** la tâche prend le statut `someday` et sa carte apparaît dans « Un jour peut-être »

#### Scenario: Le contrôle nomme la tâche

- **WHEN** une carte est rendue
- **THEN** son contrôle de rubrique porte un nom accessible qui inclut le titre de la tâche

## REMOVED Requirements

### Requirement: Afficher un badge En cours sur une carte

**Reason**: La rubrique qui contenait ce badge s'appelle désormais « En cours » et ne regroupe que des tâches `in_progress` : le badge répéterait le libellé de la colonne sur chaque carte sans apporter d'information.

**Migration**: Aucune action sur les données. Les cartes restent identifiées par leur rubrique « En cours » et par le style de leur titre ; aucun test ni consommateur ne doit attendre l'élément `.gtd-badge`.
