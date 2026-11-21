## MODIFIED Requirements

### Requirement: Ordonner les tâches par domaine puis par ordre d'affichage

Le système SHALL ordonner les cartes de chaque rubrique de la page d'accueil par domaine selon l'ordre d'affichage des domaines du panneau latéral, puis, à l'intérieur d'un domaine, selon l'ordre d'affichage de l'outline. Cet ordre SHALL être recalculé à chaque rendu et SHALL NOT dépendre de l'ordre chronologique des déplacements ni d'un ordre manuel propre à une rubrique.

#### Scenario: L'ordre des domaines suit le panneau latéral

- **WHEN** les domaines sont affichés dans l'ordre A puis B dans le panneau latéral et que chacun a une tâche dans la même rubrique
- **THEN** la carte de A précède la carte de B dans cette rubrique

#### Scenario: L'ordre des tâches suit l'outline

- **WHEN** deux tâches d'un même domaine et de la même rubrique sont affichées dans un ordre donné sur la page du domaine
- **THEN** elles apparaissent dans le même ordre relatif dans la rubrique de la page d'accueil

#### Scenario: Chaque rubrique a son propre ordre

- **WHEN** trois tâches d'un même domaine sont classées dans les trois rubriques
- **THEN** chaque rubrique les ordonne selon l'ordre de l'outline, sans référence aux deux autres rubriques

#### Scenario: Un déplacement ne crée pas d'ordre manuel

- **WHEN** une tâche est déplacée vers une autre rubrique puis que la page d'accueil est rechargée
- **THEN** sa position dans la nouvelle rubrique est celle que lui donne l'ordre des domaines puis de l'outline

### Requirement: Ouvrir la tâche dans son contexte au clic

Le titre de chaque carte de la page d'accueil SHALL être un lien dont la cible est `/domaine/<slug>?reveal=<id>#node-<id>`, où `<slug>` et `<id>` sont le slug du domaine et l'id de la tâche. L'activation du lien SHALL charger la page du domaine avec les ancêtres de la tâche dépliés, défiler jusqu'à la ligne cible et la surligner, et SHALL NOT ouvrir le champ de renommage de la ligne ni modifier son statut. Le lien SHALL être activable au clavier.

#### Scenario: Un clic ouvre la tâche dans son domaine

- **WHEN** l'utilisateur clique sur le titre d'une carte de la page d'accueil
- **THEN** la page du domaine de cette tâche est affichée, la ligne cible est dépliée, défilée dans le champ de vision et surlignée

#### Scenario: Le lien pointe vers le bon domaine et le bon nœud

- **WHEN** une carte est rendue pour la tâche `<id>` du domaine `<slug>`
- **THEN** le `href` de son titre est `/domaine/<slug>?reveal=<id>#node-<id>`

#### Scenario: Le clic n'ouvre pas le renommage

- **WHEN** l'utilisateur active le titre d'une carte de la page d'accueil
- **THEN** aucun champ de renommage ne s'ouvre et aucun statut n'est modifié

#### Scenario: Le lien est activable au clavier

- **WHEN** le titre d'une carte reçoit le focus au clavier et que l'utilisateur appuie sur `Entrée`
- **THEN** la page navigue vers la tâche cible

## REMOVED Requirements

### Requirement: Lister les tâches feuilles en cours de tous les domaines

**Reason**: La page d'accueil ne liste plus seulement les tâches « En cours » : elle classe toutes les tâches feuilles non terminées dans trois rubriques GTD. Le filtre « statut `in_progress` uniquement » est remplacé par le classement décrit dans la nouvelle exigence « Classer les tâches feuilles dans trois rubriques GTD ».

**Migration**: Utiliser la page d'accueil telle que décrite par la nouvelle exigence ; les tâches `in_progress` existantes apparaissent dans « À faire » avec un badge « En cours », les tâches `todo` dans « À faire », et les nouveaux statuts `waiting` et `someday` dans leurs rubriques respectives.

### Requirement: Afficher un état vide sur la page d'accueil

**Reason**: L'état vide global « Aucune tâche en cours » n'a plus de sens : avec des domaines, la page doit toujours montrer les trois rubriques, même vides, pour que l'utilisateur puisse y déposer une tâche. Le cas sans domaine reste couvert par une exigence dédiée.

**Migration**: Utiliser les nouvelles exigences « Afficher les trois rubriques GTD de la page d'accueil » et « Afficher un état vide sans domaine ». Les messages par colonne remplacent l'état vide global ; l'état vide sans domaine reste inchangé.

## ADDED Requirements

### Requirement: Afficher les trois rubriques GTD de la page d'accueil

Le système SHALL afficher les trois rubriques « À faire », « En attente » et « Un jour peut-être » dès qu'au moins un domaine existe, y compris lorsque les trois sont vides. Chaque rubrique vide SHALL afficher un message indiquant qu'aucune tâche n'y est classée. Le système SHALL NOT remplacer les trois rubriques par un état vide global quand des domaines existent. La page SHALL rester servie à la racine, sans redirection.

#### Scenario: Des domaines mais aucune tâche

- **WHEN** le compte a des domaines mais aucune ligne feuille non terminée
- **THEN** la page d'accueil affiche les trois rubriques, chacune avec un message indiquant qu'aucune tâche n'y est classée

#### Scenario: Seules des tâches mères existent

- **WHEN** le compte a des domaines et que leurs seules lignes non terminées possèdent des enfants
- **THEN** les trois rubriques sont affichées et aucune carte n'y figure

#### Scenario: Seules des tâches terminées existent

- **WHEN** le compte a des domaines et que toutes leurs lignes feuilles sont terminées
- **THEN** les trois rubriques sont affichées et aucune carte n'y figure

#### Scenario: La page reste servie à la racine

- **WHEN** l'utilisateur ouvre `/` avec au moins un domaine
- **THEN** la réponse est le tableau des trois rubriques, sans redirection

### Requirement: Afficher un état vide sans domaine

Le système SHALL afficher, lorsqu'il n'existe aucun domaine, un état vide invitant l'utilisateur à en créer un depuis la page Administration. Dans ce cas, aucun tableau de rubriques n'a besoin d'être affiché.

#### Scenario: Aucun domaine

- **WHEN** le compte n'a aucun domaine et que l'utilisateur ouvre `/`
- **THEN** la page d'accueil affiche un état vide invitant à créer un domaine depuis Administration

### Requirement: Classer les tâches feuilles dans trois rubriques GTD

Le système SHALL classer chaque ligne feuille non terminée d'un domaine actif dans exactement une rubrique GTD : « À faire » pour `todo` et `in_progress`, « En attente » pour `waiting`, et « Un jour peut-être » pour `someday`. Une ligne feuille est une ligne dont la liste `children` est vide ou absente. Le système SHALL NOT lister une ligne mère, une ligne `done` ni une ligne d'un domaine archivé.

#### Scenario: Une tâche à faire est classée dans À faire

- **WHEN** une ligne feuille a le statut `todo`
- **THEN** sa carte apparaît dans la rubrique « À faire »

#### Scenario: Une tâche en cours reste dans À faire

- **WHEN** une ligne feuille a le statut `in_progress`
- **THEN** sa carte apparaît dans la rubrique « À faire »

#### Scenario: Une tâche en attente est classée dans En attente

- **WHEN** une ligne feuille a le statut `waiting`
- **THEN** sa carte apparaît dans la rubrique « En attente »

#### Scenario: Une tâche un jour peut-être est classée dans sa rubrique

- **WHEN** une ligne feuille a le statut `someday`
- **THEN** sa carte apparaît dans la rubrique « Un jour peut-être »

#### Scenario: Une tâche terminée n'est listée nulle part

- **WHEN** une ligne feuille a le statut `done`
- **THEN** aucune carte ne la représente dans l'une des trois rubriques

#### Scenario: Une tâche mère n'est pas listée

- **WHEN** une ligne possède au moins un enfant, quel que soit son statut
- **THEN** elle n'apparaît dans aucune des trois rubriques

#### Scenario: Une sous-tâche feuille profonde est listée

- **WHEN** une sous-tâche sans enfant de profondeur 2 a le statut `todo`
- **THEN** sa carte apparaît dans « À faire », avec sa chaîne de parents

#### Scenario: Une feuille sous un ancêtre replié est listée

- **WHEN** une ligne feuille non terminée est masquée parce que son parent est replié sur la page du domaine
- **THEN** sa carte apparaît tout de même dans sa rubrique sur la page d'accueil

#### Scenario: Un projet sans sous-ligne est listé comme feuille

- **WHEN** un projet de niveau 1 n'a aucun enfant et a le statut `todo`
- **THEN** sa carte apparaît dans « À faire »

#### Scenario: Une tâche d'un domaine archivé est absente

- **WHEN** un domaine est archivé alors qu'il contenait une ligne feuille non terminée
- **THEN** cette tâche n'apparaît dans aucune rubrique de la page d'accueil

### Requirement: Afficher un badge En cours sur une carte

Le système SHALL afficher sur la carte d'une tâche `in_progress` classée dans « À faire » un badge « En cours » visible sans survol, en plus du style de son titre.

#### Scenario: Une tâche en cours porte le badge

- **WHEN** une carte représente une ligne feuille `in_progress`
- **THEN** elle affiche un badge « En cours »

#### Scenario: Une tâche à faire n'a pas le badge

- **WHEN** une carte représente une ligne feuille `todo`
- **THEN** elle n'affiche pas le badge « En cours »

#### Scenario: Le badge est visible sans survol

- **WHEN** une carte d'une tâche `in_progress` est affichée
- **THEN** le badge « En cours » est visible sans déplacer le pointeur sur la carte

### Requirement: Rattacher une tâche à une rubrique par glisser-déposer

Le système SHALL permettre de déplacer une carte d'une rubrique à une autre par glisser-déposer à la souris, au doigt ou au stylet. Le dépôt SHALL persister le statut de la rubrique cible — `todo` pour « À faire », `waiting` pour « En attente », `someday` pour « Un jour peut-être » — sur la seule tâche visée, et SHALL rafraîchir le tableau.

#### Scenario: Une carte passe de À faire à En attente

- **WHEN** l'utilisateur glisse une carte de la rubrique « À faire » et la dépose dans « En attente »
- **THEN** le statut de la tâche devient `waiting`, sa carte apparaît dans « En attente » et le tableau est rafraîchi

#### Scenario: Une carte passe de En attente à Un jour peut-être

- **WHEN** l'utilisateur glisse une carte de « En attente » et la dépose dans « Un jour peut-être »
- **THEN** le statut de la tâche devient `someday` et sa carte apparaît dans « Un jour peut-être »

#### Scenario: Une carte revient dans À faire

- **WHEN** l'utilisateur glisse une carte de « Un jour peut-être » ou « En attente » et la dépose dans « À faire »
- **THEN** le statut de la tâche devient `todo` et sa carte apparaît dans « À faire »

#### Scenario: Le dépôt ne modifie que la tâche visée

- **WHEN** une carte est déposée dans une rubrique
- **THEN** seul le statut de cette tâche est modifié, et les autres tâches du domaine conservent le leur

#### Scenario: Un second dépôt pendant une requête est ignoré

- **WHEN** une requête de déplacement est en cours et que l'utilisateur tente un nouveau dépôt
- **THEN** le second dépôt est ignoré jusqu'à la fin du rafraîchissement

### Requirement: Ne rien changer sur un dépôt sans cible

Le système SHALL NOT modifier le statut lorsqu'une carte est déposée sur sa rubrique d'origine, en dehors des trois rubriques, ou lorsque le glissement est annulé ou interrompu. Les indicateurs de dépôt SHALL être retirés dans ces cas.

#### Scenario: Le dépôt sur la rubrique d'origine ne change rien

- **WHEN** l'utilisateur dépose une carte sur la rubrique où elle se trouve déjà
- **THEN** aucun statut n'est modifié et aucune requête de mutation n'est envoyée

#### Scenario: Un dépôt hors rubrique ne change rien

- **WHEN** l'utilisateur relâche une carte en dehors des trois rubriques
- **THEN** aucun statut n'est modifié et la carte reste dans sa rubrique d'origine

#### Scenario: Un glisser annulé ne change rien

- **WHEN** l'utilisateur annule le glissement avant de déposer la carte
- **THEN** aucun statut n'est modifié et les indicateurs de dépôt disparaissent

### Requirement: Signaler la rubrique survolée pendant un glissement

Pendant un glissement, le système SHALL mettre en évidence la rubrique survolée et SHALL retirer l'indicateur des rubriques qui ne sont plus survolées.

#### Scenario: La rubrique survolée est signalée

- **WHEN** une carte survole une rubrique pendant le glissement
- **THEN** cette rubrique est visuellement mise en évidence et les rubriques qui ne sont plus survolées ne le sont plus

### Requirement: Déplacer une carte au doigt

Sur un appareil tactile, le système SHALL permettre de démarrer un glissement depuis la poignée d'une carte et de la déposer dans une autre rubrique, avec le même effet qu'à la souris.

#### Scenario: Le doigt déplace la carte depuis sa poignée

- **WHEN** sur un appareil tactile, l'utilisateur fait glisser la poignée d'une carte puis la dépose dans une autre rubrique
- **THEN** la carte rejoint cette rubrique, comme avec une souris

### Requirement: Ne pas activer le lien pendant un glissement

Le système SHALL NOT naviguer vers la page du domaine lorsqu'un glissement de carte se termine par un dépôt.

#### Scenario: Le glisser ne suit pas le lien

- **WHEN** l'utilisateur commence un glisser depuis une carte puis la dépose dans une rubrique
- **THEN** aucune navigation vers la page du domaine n'a lieu

### Requirement: Changer de rubrique sans glisser

Le système SHALL offrir sur chaque carte un contrôle accessible permettant de choisir l'une des trois rubriques sans utiliser le glisser-déposer. Le contrôle SHALL être activable au clavier, SHALL nommer la tâche et SHALL présenter les trois rubriques. La rubrique courante SHALL être désactivée ou marquée comme courante. L'activation d'une autre rubrique SHALL persister le statut correspondant sur la seule tâche visée et rafraîchir le tableau, avec le même effet qu'un dépôt.

#### Scenario: Le menu liste les trois rubriques

- **WHEN** l'utilisateur ouvre le contrôle de rubrique d'une carte
- **THEN** les choix « À faire », « En attente » et « Un jour peut-être » sont présentés

#### Scenario: La rubrique courante est désactivée

- **WHEN** une carte est dans « En attente » et que l'utilisateur ouvre son contrôle de rubrique
- **THEN** le choix « En attente » est désactivé ou marqué comme courant

#### Scenario: Un choix au clavier déplace la tâche

- **WHEN** l'utilisateur ouvre le contrôle au clavier et choisit « Un jour peut-être »
- **THEN** la tâche prend le statut `someday` et sa carte apparaît dans « Un jour peut-être »

#### Scenario: Le contrôle nomme la tâche

- **WHEN** une carte est rendue
- **THEN** son contrôle de rubrique porte un nom accessible qui inclut le titre de la tâche

### Requirement: Conserver le focus et annoncer un déplacement

Après un déplacement réussi, le système SHALL remettre le focus sur le lien du titre de la carte déplacée, dans sa nouvelle rubrique, et SHALL annoncer le déplacement dans une région `aria-live` polie. En cas d'échec de la requête, le système SHALL annoncer l'échec et SHALL laisser le tableau dans un état cohérent avec les données du serveur.

#### Scenario: Le focus revient sur la carte déplacée

- **WHEN** une carte est déplacée au clavier ou par glisser-déposer
- **THEN** après le rafraîchissement, le focus est sur le lien du titre de cette carte dans sa nouvelle rubrique

#### Scenario: Le déplacement est annoncé

- **WHEN** une carte passe dans une autre rubrique
- **THEN** une région `aria-live` annonce le titre de la tâche et la rubrique cible

#### Scenario: Un échec est annoncé

- **WHEN** la requête de déplacement échoue
- **THEN** une région `aria-live` annonce l'échec et le tableau reste cohérent avec les données du serveur

#### Scenario: Le focus reste utilisable après un rafraîchissement

- **WHEN** le tableau est remplacé après un déplacement
- **THEN** le focus ne reste pas sur un élément supprimé du document
