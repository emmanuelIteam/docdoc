# home-dashboard Specification

## Purpose
TBD - created by archiving change add-homepage-open-tasks. Update Purpose after archive.
## Requirements
### Requirement: Servir la page d'accueil à la racine

Le système SHALL servir la page d'accueil sur `GET /` pour un compte authentifié, sous la forme d'un document HTML rendu côté serveur, et SHALL NOT rediriger la racine vers un domaine. La page SHALL être limitée au compte de la session : aucune tâche d'un autre compte ne SHALL y apparaître.

#### Scenario: La racine rend la page d'accueil

- **WHEN** un utilisateur connecté ouvre `/`
- **THEN** la réponse est la page d'accueil, sans redirection vers `/domaine/<slug>`

#### Scenario: Les tâches d'un autre compte sont absentes

- **WHEN** le compte A a des tâches en cours et que la session du compte B ouvre `/`
- **THEN** la page ne liste que les tâches du compte B, et aucune tâche du compte A n'apparaît

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

### Requirement: Afficher le libellé d'un titre contenant un lien de tâche

Le système SHALL afficher sur la page d'accueil le texte visible d'un titre qui contient un ou plusieurs liens de tâche inline — le libellé de chaque lien et le texte qui l'entoure —, qu'il s'agisse du titre de la tâche listée ou du titre d'une tâche mère de sa chaîne de parents, et SHALL NOT rendre d'ancre à l'intérieur du lien de l'entrée.

#### Scenario: Un titre lié est affiché comme du texte

- **WHEN** une tâche « En cours » a pour titre `Voir [Tache 3](/domaine/projets?reveal=a1b2#node-a1b2) pour la suite`
- **THEN** son entrée affiche « Voir Tache 3 pour la suite » comme texte, sans ancre imbriquée

#### Scenario: Le texte autour du lien est conservé

- **WHEN** le titre contient du texte avant et après un lien de tâche
- **THEN** ce texte encadrant apparaît dans l'ordre, autour du libellé du lien

#### Scenario: Un titre de tâche mère lié est affiché comme du texte

- **WHEN** une tâche mère de la chaîne a pour titre `Voir [Tache 3](/domaine/projets?reveal=a1b2#node-a1b2)`
- **THEN** sa seconde ligne affiche « Voir Tache 3 » comme texte, sans ancre imbriquée dans le lien de l'entrée

### Requirement: Atteindre la page d'accueil depuis le panneau latéral

Le système SHALL afficher une entrée « Accueil » pointant vers `/` dans une rubrique propre, en tête du panneau latéral, placée avant le titre « Domaines » et avant la liste des domaines. L'entrée SHALL NOT être répétée dans le pied du panneau. L'entrée SHALL être marquée active (classe `active` et `aria-current="page"`) sur la page d'accueil et SHALL NOT l'être sur les autres pages. La sélection de l'entrée SHALL NOT replier le panneau latéral, y compris sur un écran étroit, comme celles d'Administration et d'Aide.

#### Scenario: L'entrée Accueil est présente sur toute page

- **WHEN** une page est rendue pour un compte authentifié
- **THEN** le panneau latéral contient une entrée « Accueil » dont le `href` est `/`

#### Scenario: L'entrée est en tête du panneau

- **WHEN** une page est rendue pour un compte authentifié
- **THEN** l'entrée « Accueil » précède le titre « Domaines » et la liste des domaines dans le panneau latéral

#### Scenario: L'entrée n'est pas répétée dans le pied du panneau

- **WHEN** une page est rendue pour un compte authentifié
- **THEN** le pied du panneau ne contient aucune entrée « Accueil »

#### Scenario: L'entrée est active sur la page d'accueil

- **WHEN** la page d'accueil est affichée
- **THEN** l'entrée « Accueil » porte la classe `active` et `aria-current="page"`

#### Scenario: L'entrée n'est pas active sur une page de domaine

- **WHEN** la page d'un domaine est affichée
- **THEN** l'entrée « Accueil » ne porte ni la classe `active` ni `aria-current`

#### Scenario: L'entrée mène à l'accueil

- **WHEN** l'utilisateur active l'entrée « Accueil » depuis une page de domaine
- **THEN** la page d'accueil est affichée à la racine

#### Scenario: Le panneau reste ouvert au clic sur un écran étroit

- **WHEN** dans une fenêtre de 390 px de large, le panneau latéral est ouvert et l'utilisateur active l'entrée « Accueil »
- **THEN** la page d'accueil est affichée et le panneau latéral reste ouvert

### Requirement: Rappeler le domaine et la hiérarchie des tâches mères de chaque tâche

Le système SHALL afficher sur chaque entrée de la page d'accueil, sur une seconde ligne distincte de celle du titre, le nom du domaine de la tâche puis la hiérarchie de ses tâches mères : la chaîne de ses ancêtres depuis le projet de niveau 1 jusqu'à son parent immédiat, dans l'ordre de lecture de haut en bas. Le nom du domaine et la chaîne SHALL être visibles sans survol et sans interaction. Lorsque la tâche n'a aucun parent, la seconde ligne SHALL afficher le nom du domaine seul. Le nom du domaine SHALL permettre de distinguer deux tâches de même titre appartenant à des domaines différents, et la chaîne de parents SHALL distinguer deux tâches de même titre appartenant à deux branches d'un même domaine. La chaîne SHALL NOT être tronquée : elle revient à la ligne lorsque la largeur disponible ne suffit pas.

#### Scenario: Le domaine et la chaîne des parents figurent sur la seconde ligne

- **WHEN** la page d'accueil liste une tâche feuille située sous un projet puis une tâche mère
- **THEN** le titre de la tâche occupe la première ligne, et la seconde ligne affiche le nom du domaine puis, dans l'ordre, les titres du projet et de la tâche mère

#### Scenario: Une feuille sans parent n'affiche que son domaine

- **WHEN** la page d'accueil liste une tâche feuille qui n'a aucun parent
- **THEN** sa seconde ligne affiche le nom de son domaine et aucune tâche mère

#### Scenario: La chaîne suit la hiérarchie après un déplacement

- **WHEN** une tâche feuille est déplacée sous une autre tâche mère puis que la page d'accueil est rechargée
- **THEN** sa seconde ligne affiche la nouvelle chaîne de parents

#### Scenario: Deux tâches de même titre restent distinguables

- **WHEN** deux branches d'un même domaine possèdent chacune une tâche feuille « En cours » portant le même titre
- **THEN** leurs secondes lignes affichent des chaînes de parents différentes, qui les distinguent

#### Scenario: Un domaine renommé est rappelé sous son nouveau nom

- **WHEN** un domaine est renommé puis que la page d'accueil est rechargée
- **THEN** les entrées de ses tâches affichent le nouveau nom du domaine sur leur seconde ligne

#### Scenario: Un chemin long revient à la ligne

- **WHEN** une tâche feuille a une chaîne de parents longue et que la fenêtre fait 390 px de large
- **THEN** la seconde ligne revient à la ligne sous le titre, sans troncature ni défilement horizontal de la page

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

