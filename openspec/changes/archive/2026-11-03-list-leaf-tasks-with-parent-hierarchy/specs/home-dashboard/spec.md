## ADDED Requirements

### Requirement: Lister les tâches feuilles en cours de tous les domaines

Le système SHALL lister sur la page d'accueil chaque ligne feuille dont le statut est « En cours » (`in_progress`) — une ligne feuille étant une ligne qui n'a aucun enfant —, de tous les domaines du compte, à toute profondeur (projet, tâche ou sous-tâche), y compris une ligne dont un ancêtre est replié. Il SHALL NOT lister une ligne qui possède au moins un enfant, même lorsque cette ligne est « En cours ». Il SHALL NOT lister les lignes « À faire » (`todo`) ni « Terminé » (`done`), ni les lignes d'un domaine archivé. Le caractère feuille SHALL être déterminé par l'arbre (liste `children` vide ou absente), et non par l'état replié ou déplié de la ligne.

#### Scenario: Les tâches feuilles en cours de plusieurs domaines sont réunies

- **WHEN** deux domaines possèdent chacun au moins une ligne feuille « En cours »
- **THEN** les lignes feuilles en cours des deux domaines figurent sur la même page d'accueil

#### Scenario: Une sous-tâche feuille profonde est listée

- **WHEN** une sous-tâche sans enfant de profondeur 2 est « En cours »
- **THEN** elle apparaît sur la page d'accueil comme les autres tâches feuilles en cours

#### Scenario: Une feuille sous un ancêtre replié est listée

- **WHEN** une ligne feuille « En cours » est masquée parce que son parent est replié sur la page du domaine
- **THEN** elle apparaît tout de même sur la page d'accueil

#### Scenario: Une tâche mère « En cours » n'est pas listée

- **WHEN** une ligne « En cours » possède au moins un enfant
- **THEN** elle n'apparaît pas sur la page d'accueil, même si aucun de ses enfants n'est listé

#### Scenario: Une tâche mère en cours aux enfants terminés ne laisse rien dans la liste

- **WHEN** une ligne « En cours » possède un enfant « Terminé » et aucun enfant feuille « En cours »
- **THEN** ni la ligne mère ni son enfant n'apparaissent sur la page d'accueil

#### Scenario: Un projet sans sous-ligne est listé comme feuille

- **WHEN** un projet de niveau 1 n'a aucun enfant et est « En cours »
- **THEN** il apparaît sur la page d'accueil comme une tâche feuille

#### Scenario: Une ligne à faire ou terminée n'est pas listée

- **WHEN** un domaine contient une ligne feuille « À faire » et une ligne feuille « Terminé »
- **THEN** aucune des deux n'apparaît sur la page d'accueil

#### Scenario: Une tâche d'un domaine archivé est absente

- **WHEN** un domaine est archivé alors qu'il contenait une tâche feuille « En cours »
- **THEN** cette tâche n'apparaît plus sur la page d'accueil

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

## MODIFIED Requirements

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

### Requirement: Afficher un état vide sur la page d'accueil

Le système SHALL afficher un état vide sur la page d'accueil lorsqu'il n'y a rien à lister : sans aucun domaine, un message invitant à en créer un depuis la page Administration ; avec des domaines mais aucune tâche feuille en cours, un message indiquant qu'aucune tâche feuille n'est en cours — et non qu'aucune ligne n'est en cours, puisque des tâches mères peuvent l'être — et rappelant comment en marquer une, en passant « En cours » une ligne sans sous-tâche. La page SHALL rester servie à la racine dans ces deux cas, sans redirection.

#### Scenario: Aucun domaine

- **WHEN** le compte n'a aucun domaine et que l'utilisateur ouvre `/`
- **THEN** la page d'accueil affiche un état vide invitant à créer un domaine depuis Administration

#### Scenario: Aucune tâche en cours

- **WHEN** le compte a des domaines mais aucune ligne feuille « En cours »
- **THEN** la page d'accueil affiche un état vide expliquant qu'aucune tâche feuille n'est en cours et comment en marquer une

#### Scenario: Seules des tâches mères sont en cours

- **WHEN** le compte a des domaines et que leurs seules lignes « En cours » possèdent des enfants
- **THEN** la page d'accueil affiche l'état vide des tâches feuilles, sans affirmer qu'aucune ligne n'est marquée « En cours »

## REMOVED Requirements

### Requirement: Lister toutes les tâches en cours de tous les domaines

**Reason**: Remplacée par « Lister les tâches feuilles en cours de tous les domaines » : la page d'accueil ne liste plus les lignes mères, seules les lignes sans enfant sont actionnables.

**Migration**: Aucune migration de données ni d'URL. Les tâches mères « En cours » restent visibles sur la page de leur domaine et sont rappelées par la chaîne de parents de leurs feuilles.

### Requirement: Rappeler le nom du domaine de chaque tâche

**Reason**: Remplacée par « Rappeler le domaine et la hiérarchie des tâches mères de chaque tâche » : la seconde ligne de chaque entrée porte désormais le domaine **et** la chaîne des parents.

**Migration**: Aucune migration de données. Les entrées conservent leur lien profond et gagnent simplement une chaîne de parents sur leur seconde ligne.
