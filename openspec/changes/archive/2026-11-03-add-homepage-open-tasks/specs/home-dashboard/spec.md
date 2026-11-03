## ADDED Requirements

### Requirement: Servir la page d'accueil à la racine

Le système SHALL servir la page d'accueil sur `GET /` pour un compte authentifié, sous la forme d'un document HTML rendu côté serveur, et SHALL NOT rediriger la racine vers un domaine. La page SHALL être limitée au compte de la session : aucune tâche d'un autre compte ne SHALL y apparaître.

#### Scenario: La racine rend la page d'accueil

- **WHEN** un utilisateur connecté ouvre `/`
- **THEN** la réponse est la page d'accueil, sans redirection vers `/domaine/<slug>`

#### Scenario: Les tâches d'un autre compte sont absentes

- **WHEN** le compte A a des tâches en cours et que la session du compte B ouvre `/`
- **THEN** la page ne liste que les tâches du compte B, et aucune tâche du compte A n'apparaît

### Requirement: Lister toutes les tâches en cours de tous les domaines

Le système SHALL lister sur la page d'accueil chaque ligne dont le statut est « En cours » (`in_progress`), de tous les domaines du compte, à toute profondeur (projet, tâche ou sous-tâche), y compris une ligne dont un ancêtre est replié. Il SHALL NOT lister les lignes « À faire » (`todo`) ni « Terminé » (`done`), ni les lignes d'un domaine archivé.

#### Scenario: Les tâches en cours de plusieurs domaines sont réunies

- **WHEN** deux domaines possèdent chacun au moins une ligne « En cours »
- **THEN** les lignes en cours des deux domaines figurent sur la même page d'accueil

#### Scenario: Une sous-tâche profonde est listée

- **WHEN** une sous-tâche de profondeur 2 est « En cours »
- **THEN** elle apparaît sur la page d'accueil comme les autres tâches en cours

#### Scenario: Une tâche sous un ancêtre replié est listée

- **WHEN** une ligne « En cours » est masquée parce que son parent est replié sur la page du domaine
- **THEN** elle apparaît tout de même sur la page d'accueil

#### Scenario: Une ligne à faire ou terminée n'est pas listée

- **WHEN** un domaine contient une ligne « À faire » et une ligne « Terminé »
- **THEN** aucune des deux n'apparaît sur la page d'accueil

#### Scenario: Une tâche d'un domaine archivé est absente

- **WHEN** un domaine est archivé alors qu'il contenait une tâche « En cours »
- **THEN** cette tâche n'apparaît plus sur la page d'accueil

### Requirement: Ordonner les tâches par domaine puis par ordre d'affichage

Le système SHALL ordonner les tâches de la page d'accueil par domaine selon l'ordre d'affichage des domaines du panneau latéral, puis, à l'intérieur d'un domaine, selon l'ordre d'affichage de l'outline.

#### Scenario: L'ordre des domaines suit le panneau latéral

- **WHEN** les domaines sont affichés dans l'ordre A puis B dans le panneau latéral et que chacun a une tâche en cours
- **THEN** la tâche de A précède la tâche de B sur la page d'accueil

#### Scenario: L'ordre des tâches suit l'outline

- **WHEN** deux tâches en cours d'un même domaine sont affichées dans un ordre donné sur la page du domaine
- **THEN** elles apparaissent dans le même ordre relatif sur la page d'accueil

### Requirement: Rappeler le nom du domaine de chaque tâche

Le système SHALL afficher, sur chaque entrée de la page d'accueil, le nom du domaine auquel appartient la tâche. Ce nom SHALL être visible sans survol et sans interaction, et SHALL permettre de distinguer deux tâches de même titre appartenant à des domaines différents.

#### Scenario: Le nom du domaine est visible sur chaque entrée

- **WHEN** la page d'accueil liste une tâche d'un domaine
- **THEN** l'entrée affiche le nom de ce domaine en plus du titre de la tâche

#### Scenario: Deux tâches de même titre restent distinguables

- **WHEN** deux domaines possèdent chacun une tâche « En cours » portant le même titre
- **THEN** les deux entrées restent identifiables par le nom de leur domaine respectif

#### Scenario: Un domaine renommé est rappelé sous son nouveau nom

- **WHEN** un domaine est renommé puis que la page d'accueil est rechargée
- **THEN** les entrées de ses tâches affichent le nouveau nom du domaine

### Requirement: Ouvrir la tâche dans son contexte au clic

Chaque entrée de la page d'accueil SHALL être un lien dont la cible est `/domaine/<slug>?reveal=<id>#node-<id>`, où `<slug>` est le slug du domaine de la tâche et `<id>` son id persistant. L'activation du lien SHALL charger la page du domaine avec les ancêtres de la tâche dépliés, défiler jusqu'à la ligne cible et la surligner, et SHALL NOT ouvrir le champ de renommage de la ligne ni modifier son statut. Le lien SHALL être activable au clavier par focus puis `Entrée`.

#### Scenario: Un clic ouvre la tâche dans son domaine

- **WHEN** l'utilisateur clique sur une tâche de la page d'accueil
- **THEN** la page du domaine de cette tâche est affichée, la ligne cible est dépliée, défilée dans le champ de vision et surlignée

#### Scenario: Le lien pointe vers le bon domaine et le bon nœud

- **WHEN** une entrée est rendue pour la tâche `<id>` du domaine `<slug>`
- **THEN** son `href` est `/domaine/<slug>?reveal=<id>#node-<id>`

#### Scenario: Le clic n'ouvre pas le renommage

- **WHEN** l'utilisateur active une entrée de la page d'accueil
- **THEN** aucun champ de renommage ne s'ouvre et aucun statut n'est modifié

#### Scenario: Le lien est activable au clavier

- **WHEN** l'entrée reçoit le focus au clavier et que l'utilisateur appuie sur `Entrée`
- **THEN** la page navigue vers la tâche cible

### Requirement: Afficher le libellé d'un titre contenant un lien de tâche

Le système SHALL afficher sur la page d'accueil le texte visible d'un titre qui contient un ou plusieurs liens de tâche inline — le libellé de chaque lien et le texte qui l'entoure — et SHALL NOT rendre d'ancre à l'intérieur du lien de l'entrée.

#### Scenario: Un titre lié est affiché comme du texte

- **WHEN** une tâche « En cours » a pour titre `Voir [Tache 3](/domaine/projets?reveal=a1b2#node-a1b2) pour la suite`
- **THEN** son entrée affiche « Voir Tache 3 pour la suite » comme texte, sans ancre imbriquée

#### Scenario: Le texte autour du lien est conservé

- **WHEN** le titre contient du texte avant et après un lien de tâche
- **THEN** ce texte encadrant apparaît dans l'ordre, autour du libellé du lien

### Requirement: Atteindre la page d'accueil depuis le panneau latéral

Le système SHALL afficher dans le pied du panneau latéral une entrée « Accueil » pointant vers `/`, placée avant l'entrée Administration. Cette entrée SHALL être marquée active (classe `active` et `aria-current="page"`) sur la page d'accueil et SHALL NOT l'être sur les autres pages.

#### Scenario: L'entrée Accueil est présente sur toute page

- **WHEN** une page est rendue pour un compte authentifié
- **THEN** le pied du panneau latéral contient une entrée « Accueil » dont le `href` est `/`

#### Scenario: L'entrée est active sur la page d'accueil

- **WHEN** la page d'accueil est affichée
- **THEN** l'entrée « Accueil » porte la classe `active` et `aria-current="page"`

#### Scenario: L'entrée n'est pas active sur une page de domaine

- **WHEN** la page d'un domaine est affichée
- **THEN** l'entrée « Accueil » ne porte ni la classe `active` ni `aria-current`

#### Scenario: L'entrée mène à l'accueil

- **WHEN** l'utilisateur active l'entrée « Accueil » depuis une page de domaine
- **THEN** la page d'accueil est affichée à la racine

### Requirement: Afficher un état vide sur la page d'accueil

Le système SHALL afficher un état vide sur la page d'accueil lorsqu'il n'y a rien à lister : sans aucun domaine, un message invitant à en créer un depuis la page Administration ; avec des domaines mais aucune tâche en cours, un message indiquant qu'aucune tâche n'est en cours et rappelant comment en marquer une. La page SHALL rester servie à la racine dans ces deux cas, sans redirection.

#### Scenario: Aucun domaine

- **WHEN** le compte n'a aucun domaine et que l'utilisateur ouvre `/`
- **THEN** la page d'accueil affiche un état vide invitant à créer un domaine depuis Administration

#### Scenario: Aucune tâche en cours

- **WHEN** le compte a des domaines mais aucune ligne « En cours »
- **THEN** la page d'accueil affiche un état vide expliquant qu'aucune tâche n'est en cours
