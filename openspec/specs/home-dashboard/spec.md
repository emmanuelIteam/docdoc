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

Le système SHALL afficher les cartes de chaque rubrique selon un ordre manuel propre à la rubrique et au compte. Tant qu'aucun ordre manuel n'a été enregistré pour une rubrique, les cartes SHALL suivre l'ordre des domaines du panneau latéral puis, dans un domaine, l'ordre d'affichage de l'outline. Dès qu'un ordre manuel est enregistré pour une rubrique, il SHALL primer sur l'ordre des domaines et de l'outline. Une carte listée qui n'a pas de position enregistrée dans sa rubrique SHALL être ajoutée à la fin de cette rubrique, dans l'ordre naturel. L'ordre SHALL être conservé d'un chargement à l'autre, SHALL être propre au compte de la session et SHALL NOT être partagé entre les deux rubriques.

#### Scenario: L'ordre initial suit le panneau latéral et l'outline

- **WHEN** aucun ordre manuel n'est enregistré et que les domaines sont affichés dans l'ordre A puis B dans le panneau latéral
- **THEN** les cartes de chaque rubrique suivent l'ordre des domaines puis, dans un domaine, l'ordre d'affichage de l'outline

#### Scenario: L'ordre manuel prime sur l'ordre des domaines

- **WHEN** la carte d'une tâche du domaine B est déplacée avant celle d'une tâche du domaine A dans la même rubrique
- **THEN** la carte du domaine B précède celle du domaine A, même si le domaine A vient avant le domaine B dans le panneau latéral

#### Scenario: L'ordre manuel survit à un rechargement

- **WHEN** une carte a été déplacée dans sa rubrique puis que la page d'accueil est rechargée
- **THEN** la carte occupe la même position qu'avant le rechargement

#### Scenario: Chaque rubrique a son propre ordre

- **WHEN** une carte de la rubrique « À faire » est déplacée
- **THEN** l'ordre des cartes de la rubrique « En attente » reste inchangé

#### Scenario: Une carte sans position enregistrée est ajoutée en fin de rubrique

- **WHEN** une tâche devient `in_progress` alors qu'aucune position ne lui est enregistrée dans « À faire »
- **THEN** sa carte apparaît à la fin de la rubrique « À faire »

#### Scenario: L'ordre d'un autre compte est ignoré

- **WHEN** le compte A a enregistré un ordre manuel et que la session du compte B ouvre `/`
- **THEN** les cartes du compte B suivent son propre ordre, sans référence à celui du compte A

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

### Requirement: Afficher un état vide sans domaine

Le système SHALL afficher, lorsqu'il n'existe aucun domaine, un état vide invitant l'utilisateur à en créer un depuis la page Administration. Dans ce cas, aucun tableau de rubriques n'a besoin d'être affiché.

#### Scenario: Aucun domaine

- **WHEN** le compte n'a aucun domaine et que l'utilisateur ouvre `/`
- **THEN** la page d'accueil affiche un état vide invitant à créer un domaine depuis Administration

### Requirement: Rattacher une tâche à une rubrique par glisser-déposer

Le système SHALL permettre de déplacer une carte d'une rubrique à une autre par glisser-déposer à la souris, au doigt ou au stylet. Le dépôt SHALL persister le statut de la rubrique cible — `in_progress` pour « À faire », `waiting` pour « En attente » — sur la seule tâche visée, SHALL placer la carte au point de dépôt — avant ou après la carte survolée, ou en fin de rubrique lorsque le dépôt ne vise aucune carte — et SHALL rafraîchir le tableau.

#### Scenario: Une carte passe de À faire à En attente

- **WHEN** l'utilisateur glisse une carte de la rubrique « À faire » et la dépose dans « En attente »
- **THEN** le statut de la tâche devient `waiting`, sa carte apparaît dans « En attente » et le tableau est rafraîchi

#### Scenario: Une carte revient dans À faire

- **WHEN** l'utilisateur glisse une carte de « En attente » et la dépose dans « À faire »
- **THEN** le statut de la tâche devient `in_progress` et sa carte apparaît dans « À faire »

#### Scenario: La carte déposée entre deux cartes s'insère à cette position

- **WHEN** l'utilisateur dépose une carte entre deux cartes de la rubrique cible
- **THEN** la carte déplacée apparaît entre ces deux cartes

#### Scenario: Le dépôt en fin de rubrique place la carte en dernier

- **WHEN** l'utilisateur dépose une carte sous la dernière carte de la rubrique cible
- **THEN** la carte déplacée apparaît en dernière position de cette rubrique

#### Scenario: Le dépôt ne modifie que la tâche visée

- **WHEN** une carte est déposée dans une rubrique
- **THEN** seul le statut de cette tâche est modifié, et les autres tâches du domaine conservent le leur

#### Scenario: Un second dépôt pendant une requête est ignoré

- **WHEN** une requête de déplacement est en cours et que l'utilisateur tente un nouveau dépôt
- **THEN** le second dépôt est ignoré jusqu'à la fin du rafraîchissement

### Requirement: Ne rien changer sur un dépôt sans cible

Le système SHALL NOT modifier le statut d'une carte déposée en dehors des deux rubriques, sur sa rubrique d'origine, ou lorsqu'un glissement est annulé ou interrompu. Un dépôt dans la rubrique d'origine SHALL réordonner la carte lorsque le point de dépôt diffère de sa position courante, et SHALL NOT envoyer de requête lorsqu'il ne la change pas. Les indicateurs de dépôt SHALL être retirés dans tous ces cas.

#### Scenario: Le dépôt à la position courante ne change rien

- **WHEN** l'utilisateur dépose une carte sur sa position actuelle dans sa rubrique
- **THEN** aucun statut n'est modifié, aucune requête de mutation n'est envoyée et l'ordre reste le même

#### Scenario: Le dépôt ailleurs dans la même rubrique ne change que l'ordre

- **WHEN** l'utilisateur dépose une carte à une autre position de sa rubrique d'origine
- **THEN** le statut de la tâche n'est pas modifié, sa position change et le tableau est rafraîchi

#### Scenario: Un dépôt hors rubrique ne change rien

- **WHEN** l'utilisateur relâche une carte en dehors des deux rubriques
- **THEN** aucun statut et aucun ordre ne sont modifiés, et la carte reste à sa place

#### Scenario: Un glisser annulé ne change rien

- **WHEN** l'utilisateur annule le glissement avant de déposer la carte
- **THEN** aucun statut et aucun ordre ne sont modifiés et les indicateurs de dépôt disparaissent

### Requirement: Signaler la rubrique survolée pendant un glissement

Pendant un glissement, le système SHALL mettre en évidence la rubrique survolée et SHALL retirer l'indicateur des rubriques qui ne sont plus survolées.

#### Scenario: La rubrique survolée est signalée

- **WHEN** une carte survole une rubrique pendant le glissement
- **THEN** cette rubrique est visuellement mise en évidence et les rubriques qui ne sont plus survolées ne le sont plus

### Requirement: Déplacer une carte au doigt

Sur un appareil tactile, le système SHALL permettre de démarrer un glissement depuis la poignée d'une carte et de la déposer dans une autre rubrique ou à une autre position de sa rubrique, avec le même effet qu'à la souris.

#### Scenario: Le doigt déplace la carte depuis sa poignée

- **WHEN** sur un appareil tactile, l'utilisateur fait glisser la poignée d'une carte puis la dépose dans une autre rubrique
- **THEN** la carte rejoint cette rubrique, comme avec une souris

#### Scenario: Le doigt réordonne dans la même rubrique

- **WHEN** sur un appareil tactile, l'utilisateur fait glisser la poignée d'une carte et la dépose à une autre position de sa rubrique
- **THEN** la carte occupe cette position, comme avec une souris

### Requirement: Ne pas activer le lien pendant un glissement

Le système SHALL NOT naviguer vers la page du domaine lorsqu'un glissement de carte se termine par un dépôt.

#### Scenario: Le glisser ne suit pas le lien

- **WHEN** l'utilisateur commence un glisser depuis une carte puis la dépose dans une rubrique
- **THEN** aucune navigation vers la page du domaine n'a lieu

### Requirement: Changer de rubrique sans glisser

Le système SHALL offrir sur chaque carte un contrôle accessible permettant de choisir l'une des deux rubriques sans utiliser le glisser-déposer. Le contrôle SHALL être activable au clavier, SHALL nommer la tâche et SHALL présenter les deux rubriques « À faire » et « En attente ». La rubrique courante SHALL être désactivée ou marquée comme courante. L'activation d'une autre rubrique SHALL persister le statut correspondant sur la seule tâche visée, SHALL placer la carte en fin de la rubrique cible et rafraîchir le tableau, avec le même effet qu'un dépôt.

#### Scenario: Le menu liste les deux rubriques

- **WHEN** l'utilisateur ouvre le contrôle de rubrique d'une carte
- **THEN** les choix « À faire » et « En attente » sont présentés

#### Scenario: La rubrique courante est désactivée

- **WHEN** une carte est dans « En attente » et que l'utilisateur ouvre son contrôle de rubrique
- **THEN** le choix « En attente » est désactivé ou marqué comme courant

#### Scenario: Un choix au clavier déplace la tâche

- **WHEN** l'utilisateur ouvre le contrôle au clavier et choisit « En attente »
- **THEN** la tâche prend le statut `waiting` et sa carte apparaît dans « En attente »

#### Scenario: La carte choisie rejoint la fin de la rubrique

- **WHEN** l'utilisateur choisit une autre rubrique depuis le menu d'une carte
- **THEN** la carte apparaît en dernière position de la rubrique cible

#### Scenario: Le contrôle nomme la tâche

- **WHEN** une carte est rendue
- **THEN** son contrôle de rubrique porte un nom accessible qui inclut le titre de la tâche

### Requirement: Conserver le focus et annoncer un déplacement

Après un déplacement ou un réordonnancement réussi, le système SHALL remettre le focus sur le contrôle qui a déclenché l'action : le lien du titre de la carte pour un glisser-déposer ou un choix de rubrique, la flèche utilisée pour un déplacement aux flèches — ou l'autre flèche lorsqu'elle devient désactivée, à défaut le lien du titre. Le système SHALL annoncer l'action dans une région `aria-live` polie en nommant la tâche et, pour un réordonnancement, sa nouvelle position dans la rubrique. En cas d'échec de la requête, le système SHALL annoncer l'échec et SHALL laisser le tableau dans un état cohérent avec les données du serveur.

#### Scenario: Le focus revient sur la carte déplacée

- **WHEN** une carte est déplacée au clavier par le menu de rubrique ou par glisser-déposer
- **THEN** après le rafraîchissement, le focus est sur le lien du titre de cette carte dans sa nouvelle rubrique

#### Scenario: Le focus reste sur la flèche utilisée

- **WHEN** une carte est déplacée avec la flèche haut ou la flèche bas
- **THEN** après le rafraîchissement, le focus est sur la même flèche de la carte déplacée, ou sur l'autre flèche si la première est devenue désactivée

#### Scenario: Le déplacement est annoncé

- **WHEN** une carte passe dans une autre rubrique
- **THEN** une région `aria-live` annonce le titre de la tâche et la rubrique cible

#### Scenario: Le réordonnancement est annoncé

- **WHEN** une carte change de position dans sa rubrique
- **THEN** une région `aria-live` annonce le titre de la tâche et sa nouvelle position

#### Scenario: Un échec est annoncé

- **WHEN** la requête de déplacement échoue
- **THEN** une région `aria-live` annonce l'échec et le tableau reste cohérent avec les données du serveur

#### Scenario: Le focus reste utilisable après un rafraîchissement

- **WHEN** le tableau est remplacé après un déplacement
- **THEN** le focus ne reste pas sur un élément supprimé du document

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

### Requirement: Réordonner une carte par glisser-déposer dans sa rubrique

Le système SHALL permettre de réordonner une carte à l'intérieur de sa rubrique par glisser-déposer à la souris, au doigt ou au stylet. Pendant le glissement, le système SHALL signaler le point d'insertion — un repère entre deux cartes, ou la fin de la liste — et SHALL retirer ce repère lorsque le pointeur quitte la zone de dépôt. Le dépôt SHALL enregistrer le nouvel ordre et SHALL rafraîchir le tableau ; il SHALL NOT modifier le statut de la tâche.

#### Scenario: La carte déposée au-dessus remonte

- **WHEN** l'utilisateur glisse une carte et la dépose au-dessus d'une carte qui la précède
- **THEN** la carte déplacée précède cette carte et le tableau est rafraîchi

#### Scenario: La carte déposée en dessous descend

- **WHEN** l'utilisateur glisse une carte et la dépose en dessous d'une carte qui la suit
- **THEN** la carte déplacée suit cette carte et le tableau est rafraîchi

#### Scenario: Le point d'insertion est signalé

- **WHEN** une carte survole l'espace entre deux cartes de sa rubrique pendant un glissement
- **THEN** un repère visible indique où la carte sera insérée, et les autres repères disparaissent

#### Scenario: Le statut n'est pas modifié

- **WHEN** une carte est réordonnée dans sa rubrique
- **THEN** le statut de sa tâche reste celui de la rubrique et aucun autre statut n'est modifié

#### Scenario: L'ordre réordonné est conservé après un rechargement

- **WHEN** une carte a été réordonnée puis que la page d'accueil est rechargée
- **THEN** la carte occupe la nouvelle position

#### Scenario: Un glisser hors d'une rubrique ne réordonne pas

- **WHEN** l'utilisateur relâche une carte en dehors de toute rubrique
- **THEN** l'ordre reste inchangé et le repère d'insertion disparaît

### Requirement: Réordonner une carte avec des flèches haut et bas

Le système SHALL afficher sur chaque carte deux contrôles accessibles, une flèche haut et une flèche bas, dont le nom accessible inclut le titre de la tâche. Leur activation SHALL déplacer la carte d'un cran vers le haut ou vers le bas dans sa rubrique, SHALL enregistrer le nouvel ordre et SHALL rafraîchir le tableau sans modifier le statut de la tâche. La flèche haut SHALL être désactivée sur la première carte de la rubrique et la flèche bas sur la dernière. Les deux contrôles SHALL être activables au clavier.

#### Scenario: La flèche haut remonte la carte d'un cran

- **WHEN** l'utilisateur active la flèche haut d'une carte qui n'est pas la première
- **THEN** la carte échange sa position avec la carte qui la précède et le tableau est rafraîchi

#### Scenario: La flèche bas descend la carte d'un cran

- **WHEN** l'utilisateur active la flèche bas d'une carte qui n'est pas la dernière
- **THEN** la carte échange sa position avec la carte qui la suit et le tableau est rafraîchi

#### Scenario: La première carte ne peut pas monter

- **WHEN** la première carte d'une rubrique est rendue
- **THEN** sa flèche haut est désactivée et son activation ne change rien

#### Scenario: La dernière carte ne peut pas descendre

- **WHEN** la dernière carte d'une rubrique est rendue
- **THEN** sa flèche bas est désactivée et son activation ne change rien

#### Scenario: Les flèches s'activent au clavier

- **WHEN** l'utilisateur atteint une flèche au clavier et appuie sur `Entrée` ou `Espace`
- **THEN** la carte est déplacée d'un cran dans la direction de la flèche

#### Scenario: Le statut n'est pas modifié par une flèche

- **WHEN** une carte est déplacée avec une flèche
- **THEN** sa tâche conserve le statut de la rubrique

#### Scenario: Les deux flèches nomment la tâche

- **WHEN** une carte est rendue
- **THEN** ses flèches portent des noms accessibles qui incluent le titre de la tâche et la direction

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

### Requirement: Atteindre la page GTD depuis le panneau latéral

Le système SHALL afficher une entrée « GTD » pointant vers `/` dans une rubrique propre, en tête du panneau latéral, placée avant le titre « Domaines » et avant la liste des domaines. L'entrée SHALL NOT être répétée dans le pied du panneau. L'entrée SHALL être marquée active (classe `active` et `aria-current="page"`) sur la page GTD et SHALL NOT l'être sur les autres pages. Comme les autres entrées du panneau qui ouvrent une page, sa sélection SHALL suivre la règle de repli du panneau définie par l'exigence de navigation du panneau : sur un écran étroit, la page demandée est chargée puis le panneau se replie ; sur un écran large, l'état du panneau reste inchangé.

#### Scenario: L'entrée GTD est présente sur toute page

- **WHEN** une page est rendue pour un compte authentifié
- **THEN** le panneau latéral contient une entrée « GTD » dont le `href` est `/`

#### Scenario: L'entrée est en tête du panneau

- **WHEN** une page est rendue pour un compte authentifié
- **THEN** l'entrée « GTD » précède le titre « Domaines » et la liste des domaines dans le panneau latéral

#### Scenario: L'entrée n'est pas répétée dans le pied du panneau

- **WHEN** une page est rendue pour un compte authentifié
- **THEN** le pied du panneau ne contient aucune entrée « GTD »

#### Scenario: L'entrée est active sur la page GTD

- **WHEN** la page GTD est affichée à la racine
- **THEN** l'entrée « GTD » porte la classe `active` et `aria-current="page"`

#### Scenario: L'entrée n'est pas active sur une page de domaine

- **WHEN** la page d'un domaine est affichée
- **THEN** l'entrée « GTD » ne porte ni la classe `active` ni `aria-current`

#### Scenario: L'entrée mène à la page GTD

- **WHEN** l'utilisateur active l'entrée « GTD » depuis une page de domaine
- **THEN** la page GTD est affichée à la racine

#### Scenario: Le panneau se replie après le clic sur un écran étroit

- **WHEN** dans une fenêtre de 390 px de large, le panneau latéral est ouvert et l'utilisateur active l'entrée « GTD »
- **THEN** la page GTD est chargée, puis le panneau latéral se replie

#### Scenario: Un écran large garde le panneau ouvert

- **WHEN** dans une fenêtre de 1280 px de large, l'utilisateur active l'entrée « GTD »
- **THEN** la page GTD est affichée et le panneau latéral reste ouvert

### Requirement: Afficher le titre et le sous-titre de la page GTD

Le système SHALL afficher « GTD » comme titre de la page servie à la racine, à la fois dans l'en-tête de la page et dans le titre du document, et SHALL afficher, immédiatement sous ce titre, le sous-titre « Getting Things Done ». Le sous-titre SHALL être visible sans survol ni interaction et SHALL NOT apparaître sur une autre page. Le titre et le sous-titre SHALL être affichés y compris lorsque le compte n'a encore aucun domaine.

#### Scenario: La page GTD affiche son titre et son sous-titre

- **WHEN** un utilisateur connecté ouvre `/`
- **THEN** l'en-tête affiche le titre « GTD » et, sous lui, le sous-titre « Getting Things Done »

#### Scenario: Le sous-titre est placé sous le titre

- **WHEN** la page GTD est rendue
- **THEN** le sous-titre suit le titre dans l'en-tête, sur la ligne du dessous, sans être séparé de lui par le contenu principal

#### Scenario: Le titre du document est GTD

- **WHEN** la page GTD est rendue
- **THEN** le titre du document est « GTD »

#### Scenario: Le sous-titre est absent des autres pages

- **WHEN** une page de domaine, la page Administration ou la page Aide est rendue
- **THEN** aucune page n'affiche le sous-titre « Getting Things Done »

#### Scenario: L'état vide garde le titre et le sous-titre

- **WHEN** le compte n'a aucun domaine et que l'utilisateur ouvre `/`
- **THEN** l'en-tête affiche « GTD » et « Getting Things Done » au-dessus de l'état vide invitant à créer un domaine

### Requirement: Atteindre la page GTD depuis l'en-tête des autres pages

Le système SHALL afficher dans l'en-tête de chaque page rendue par la coque autre que la page GTD — une page de domaine, la page Administration et la page Aide — un raccourci « GTD » vers `/`, placé immédiatement à droite du bouton d'affichage/masquage du panneau (☰) et avant le titre de la page. La page GTD SHALL NOT afficher ce raccourci : son titre « GTD » occupe déjà cette position et désigne la page courante, de sorte qu'un lien vers elle-même n'y apporterait aucune information. Le raccourci SHALL être un lien dont le texte visible est « GTD », SHALL ne porter ni la classe `active` ni `aria-current="page"`, SHALL être activable au clavier, et SHALL rester visible et utilisable quand le panneau latéral est replié. Son activation SHALL charger la page GTD sans modifier l'état du panneau latéral. La page de gestion des passkeys, qui n'a ni en-tête ni bouton menu, n'est pas concernée.

#### Scenario: Le raccourci est présent sur les pages de la coque autres que la GTD

- **WHEN** une page de domaine, la page Administration ou la page Aide est rendue
- **THEN** l'en-tête contient un lien « GTD » vers `/`

#### Scenario: La page GTD n'affiche pas de raccourci vers elle-même

- **WHEN** la page GTD est rendue
- **THEN** son en-tête ne contient aucun lien vers `/` et affiche seulement le bouton ☰ puis le titre « GTD » et son sous-titre

#### Scenario: Le raccourci est à droite du bouton menu

- **WHEN** une page de la coque autre que la page GTD est rendue
- **THEN** le raccourci « GTD » suit immédiatement le bouton ☰ dans l'en-tête, avant le titre de la page

#### Scenario: Le raccourci mène à la page GTD

- **WHEN** l'utilisateur active le raccourci « GTD » depuis la page d'un domaine
- **THEN** la page GTD est affichée à la racine

#### Scenario: Le raccourci n'est pas marqué comme la page courante

- **WHEN** une page de la coque autre que la page GTD est rendue
- **THEN** le raccourci ne porte ni la classe `active` ni `aria-current="page"`

#### Scenario: Le raccourci reste visible quand le panneau est replié

- **WHEN** le panneau latéral est replié sur un écran de 390 px de large
- **THEN** le raccourci « GTD » reste affiché dans l'en-tête et activable

#### Scenario: Le raccourci s'active au clavier

- **WHEN** le raccourci « GTD » reçoit le focus au clavier et que l'utilisateur appuie sur `Entrée`
- **THEN** la page GTD est affichée

#### Scenario: Le raccourci ne change pas l'état du panneau

- **WHEN** dans une fenêtre de 390 px de large, le panneau latéral est ouvert et l'utilisateur active le raccourci « GTD »
- **THEN** la page GTD est chargée et l'état d'ouverture du panneau n'est pas modifié par le raccourci

