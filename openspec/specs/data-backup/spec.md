# data-backup Specification

## Purpose
Export et restauration de l'espace d'un compte au format JSON : document versionné, remplacement intégral, validation stricte et section « Sauvegarde » de la page Administration.
## Requirements
### Requirement: Exporter les données du compte en un fichier JSON

Le système SHALL servir `GET /api/backup` à une session authentifiée et SHALL renvoyer un document JSON téléchargeable décrivant exclusivement l'espace du compte de la session, avec `Content-Disposition`, `application/json` et `Cache-Control: no-store`. Le document SHALL contenir les thèmes, les domaines actifs, les archives et l'ordre manuel des tâches de l'accueil du compte, et SHALL NOT contenir l'adresse email, les passkeys, `account.json` ni aucun index de compte.

#### Scenario: Le fichier est téléchargé

- **WHEN** un utilisateur authentifié demande `GET /api/backup`
- **THEN** la réponse est un document JSON en pièce jointe dont le nom de fichier suit `docdoc-sauvegarde-<AAAA-MM-JJ>.json`, avec `Cache-Control: no-store`

#### Scenario: Le contenu couvre tout l'espace

- **WHEN** le compte possède des thèmes, des domaines actifs et des archives et que l'utilisateur demande son export
- **THEN** le document contient tous les thèmes, tous les domaines actifs et toutes les archives du compte

#### Scenario: L'ordre manuel est exporté

- **WHEN** le compte a réordonné des cartes dans les rubriques « À faire » et « En attente » et que l'utilisateur demande son export
- **THEN** le document contient l'ordre de chaque rubrique, avec les identifiants des tâches dans l'ordre affiché

#### Scenario: Un autre compte est absent

- **WHEN** deux comptes possèdent chacun des thèmes, des domaines et des archives et que l'un demande son export
- **THEN** seuls les objets du compte de la session figurent dans le document, y compris son ordre manuel et non celui de l'autre compte

#### Scenario: Les identifiants sont exclus

- **WHEN** le compte possède une adresse email et une ou plusieurs passkeys et que l'utilisateur demande son export
- **THEN** le document ne contient ni l'adresse email, ni les passkeys, ni `account.json`, ni aucun index de compte

### Requirement: Décrire le format d'une sauvegarde

Le système SHALL produire un document dont l'objet racine porte `format` (`docdoc-backup`), `version` (`1`), `exportedAt`, les tableaux `themes`, `domains` et `archives`, et l'objet `homeOrder`, toujours présents. Chaque thème SHALL porter `id`, `name` et `color` ; chaque domaine SHALL porter `id`, `name`, `slug`, `order`, `labels`, `projects` et `displayOrder` ; chaque archive SHALL conserver la forme d'un domaine. L'objet `homeOrder` SHALL porter deux tableaux d'identifiants de tâches, `in_progress` et `waiting`, qui donnent l'ordre d'affichage de chaque rubrique ; un espace sans ordre manuel SHALL produire deux tableaux vides. À la lecture, l'absence de `homeOrder` SHALL être acceptée et traitée comme deux tableaux vides, afin qu'une sauvegarde antérieure reste restaurable.

#### Scenario: Le document se décrit lui-même

- **WHEN** un export est téléchargé
- **THEN** son objet racine porte `format: "docdoc-backup"`, `version: 1`, `exportedAt`, les trois tableaux `themes`, `domains` et `archives`, et l'objet `homeOrder`

#### Scenario: Chaque objet porte ses champs

- **WHEN** le document contient un thème, un domaine et une archive
- **THEN** le thème porte `id`, `name` et `color`, le domaine porte `id`, `name`, `slug`, `order`, `labels`, `projects` et `displayOrder`, et l'archive porte la forme d'un domaine

#### Scenario: L'ordre manuel est décrit

- **WHEN** le document contient un ordre manuel
- **THEN** `homeOrder` porte les tableaux `in_progress` et `waiting`, chacun composé d'identifiants de tâches dans l'ordre affiché

#### Scenario: Un espace vide produit des tableaux vides

- **WHEN** l'espace du compte ne contient aucun thème, aucun domaine et aucune archive
- **THEN** l'export réussit, les tableaux `themes`, `domains` et `archives` sont vides et `homeOrder` porte deux tableaux vides

#### Scenario: Une sauvegarde sans ordre manuel reste lisible

- **WHEN** un document exporté avant l'existence de `homeOrder` est restauré
- **THEN** il est accepté et l'ordre manuel résultant est vide

### Requirement: Préserver les identifiants et l'ordre dans la sauvegarde

Le système SHALL préserver dans le document les identifiants, les slugs, les ordres, les libellés, les statuts, l'état de repli, l'ordre d'affichage et l'ordre manuel des deux rubriques de l'accueil, afin qu'une restauration reproduise l'espace à l'identique. Les thèmes SHALL suivre l'ordre de la palette, les domaines l'ordre `order` puis nom, les archives l'ordre nom puis identifiant, et les tableaux de `homeOrder` l'ordre affiché de chaque rubrique.

#### Scenario: Les identifiants et les slugs sont conservés

- **WHEN** un domaine et ses tâches sont exportés puis restaurés
- **THEN** leurs identifiants et le slug du domaine restent ceux du document

#### Scenario: L'état de l'outline est conservé

- **WHEN** un domaine contient des tâches avec des statuts différents, une ligne repliée et un ordre d'affichage personnalisé
- **THEN** l'export conserve les statuts, l'état de repli, les libellés et l'ordre d'affichage de ces lignes

#### Scenario: L'ordre manuel est conservé

- **WHEN** les deux rubriques de l'accueil ont un ordre manuel et que l'espace est exporté puis restauré
- **THEN** chaque rubrique retrouve exactement la séquence d'identifiants du document

#### Scenario: L'ordre du document est déterministe

- **WHEN** deux exports sont produits sans modification entre les deux
- **THEN** les thèmes, les domaines, les archives et les tableaux de `homeOrder` apparaissent dans le même ordre relatif

### Requirement: Restaurer l'espace par remplacement

Le système SHALL accepter `POST /api/restore?confirm=replace` avec un document de sauvegarde en corps `application/json` pour une session authentifiée, et SHALL remplacer intégralement les thèmes, domaines actifs, archives et ordre manuel des tâches de l'accueil du compte par le contenu du document. Les objets absents du document SHALL être supprimés, et un document sans `homeOrder` SHALL laisser l'ordre manuel vide. La restauration SHALL NOT modifier `account.json`, les passkeys ni les index, et SHALL NOT écrire hors du préfixe du compte. Sans `confirm=replace`, la requête SHALL être refusée.

#### Scenario: Une sauvegarde remplace tout l'espace

- **WHEN** un compte possède un domaine A et une archive B et qu'il restaure un document contenant un domaine C et une archive D
- **THEN** l'espace ne contient plus que le domaine C, l'archive D et les thèmes du document, et le domaine A et l'archive B ont disparu

#### Scenario: L'ordre manuel est remplacé

- **WHEN** le compte a un ordre manuel et restaure un document qui en contient un autre
- **THEN** l'ordre de chaque rubrique est celui du document et l'ancien ordre a disparu

#### Scenario: Une sauvegarde sans ordre manuel vide l'ordre

- **WHEN** le compte a un ordre manuel et restaure un document dépourvu de `homeOrder`
- **THEN** les deux rubriques de l'accueil sont affichées dans l'ordre des domaines et de l'outline

#### Scenario: Un domaine restauré garde son URL

- **WHEN** le document contient un domaine de slug `voyages` et que l'utilisateur ouvre `/domaine/voyages` après la restauration
- **THEN** le domaine du document est affiché à cette URL

#### Scenario: La confirmation est obligatoire

- **WHEN** une requête `POST /api/restore` ne porte pas `confirm=replace`
- **THEN** la requête est refusée et aucune donnée n'est modifiée

#### Scenario: Un autre compte est intact

- **WHEN** le compte A restaure un document alors que le compte B possède des thèmes, des domaines et des archives
- **THEN** aucun objet du compte B n'est créé, modifié ou supprimé, et son ordre manuel reste inchangé

### Requirement: Signaler et rejouer une restauration

En cas de succès, le système SHALL recharger l'espace, rediriger vers `/administration?restaure=ok#admin-backup` et afficher un message de succès. La restauration SHALL être idempotente et SHALL NOT modifier les identifiants du compte, qui restent utilisables après l'opération.

#### Scenario: Les identifiants du compte survivent

- **WHEN** un compte restaure une sauvegarde
- **THEN** la session reste valide, `account.json` et les passkeys sont inchangés, et l'utilisateur peut continuer à se connecter

#### Scenario: Le succès est signalé

- **WHEN** la restauration réussit
- **THEN** la réponse redirige vers `/administration?restaure=ok#admin-backup` et la page Administration affiche un message de succès

#### Scenario: La restauration est idempotente

- **WHEN** le même document est restauré deux fois de suite
- **THEN** l'espace résultant est identique après les deux restaurations et aucune erreur n'est signalée

### Requirement: Refuser une sauvegarde invalide sans rien modifier

Le système SHALL valider le document entier avant la première écriture et SHALL refuser en bloc, sans modification, un document dont le JSON, le type de contenu, `format`, `version`, les tableaux, les formes, les identifiants, les slugs, les libellés, les statuts ou l'ordre manuel sont invalides. Le refus SHALL répondre 400 (corps illisible), 413 (plus de 10 Mo), 415 (type non JSON) ou 422 (document invalide), avec un message en texte clair pour 400 et 422.

#### Scenario: Un corps JSON mal formé est refusé

- **WHEN** le corps n'est pas du JSON
- **THEN** la réponse est 400 avec un message en texte clair et l'espace reste inchangé

#### Scenario: Un type de contenu non JSON est refusé

- **WHEN** le corps est envoyé avec un type de contenu autre que `application/json`
- **THEN** la réponse est 415 et l'espace reste inchangé

#### Scenario: Un document étranger est refusé

- **WHEN** le corps est un JSON valide qui ne porte pas `format: "docdoc-backup"`
- **THEN** la réponse est 422 et l'espace reste inchangé

#### Scenario: Une version future est refusée

- **WHEN** le document porte `version: 2`
- **THEN** la réponse est 422 avec un message indiquant que la version n'est pas prise en charge et l'espace reste inchangé

#### Scenario: Un identifiant dupliqué est refusé

- **WHEN** deux domaines du document partagent le même `id`, ou qu'un identifiant apparaît à la fois dans les domaines et dans les archives
- **THEN** la réponse est 422 et l'espace reste inchangé

#### Scenario: Deux domaines actifs partagent un slug

- **WHEN** deux domaines actifs du document portent le même `slug`
- **THEN** la réponse est 422 et l'espace reste inchangé

#### Scenario: Un libellé référence un thème absent

- **WHEN** un domaine ou une archive du document porte un libellé dont l'identifiant n'est pas dans les thèmes du document
- **THEN** la réponse est 422 et l'espace reste inchangé

#### Scenario: Un statut inconnu est refusé

- **WHEN** une tâche du document porte un statut qui n'appartient pas au modèle
- **THEN** la réponse est 422 et l'espace reste inchangé

#### Scenario: Un ordre manuel mal formé est refusé

- **WHEN** `homeOrder` n'est pas un objet, ou que l'un de ses tableaux contient autre chose qu'un identifiant textuel
- **THEN** la réponse est 422 et l'espace reste inchangé

#### Scenario: Une tâche mal formée est refusée

- **WHEN** une tâche du document n'a pas d'identifiant, a un titre qui n'est pas textuel ou a des enfants qui ne sont pas un tableau
- **THEN** la réponse est 422 avec un message désignant le domaine concerné et l'espace reste inchangé

#### Scenario: Un corps trop volumineux est refusé

- **WHEN** le corps dépasse 10 Mo
- **THEN** la réponse est 413 et l'espace reste inchangé

### Requirement: Piloter la sauvegarde depuis la page Administration

Le système SHALL rendre dans la page Administration une section `#admin-backup` intitulée « Sauvegarde », après la section Archives, avec un lien vers `/api/backup` et un formulaire de restauration. Le lien SHALL fonctionner sans JavaScript. Le formulaire SHALL exiger une case de confirmation et, avec JavaScript, SHALL envoyer le fichier en JSON, afficher l'erreur du serveur en cas de refus et signaler le succès. Sans JavaScript, la section SHALL indiquer que la restauration en dépend.

#### Scenario: La section est présente après les archives

- **WHEN** la page Administration est rendue
- **THEN** une section `#admin-backup` intitulée « Sauvegarde » suit la section Archives et contient un lien vers `/api/backup`

#### Scenario: Le lien d'export télécharge le fichier

- **WHEN** l'utilisateur active le lien d'export
- **THEN** le navigateur télécharge le document JSON de sauvegarde

#### Scenario: La restauration exige la confirmation

- **WHEN** l'utilisateur choisit un fichier sans cocher la case de confirmation
- **THEN** le formulaire ne peut pas être envoyé et aucune requête de restauration n'est émise

#### Scenario: Un refus est affiché

- **WHEN** le fichier choisi est refusé par le serveur
- **THEN** le message du serveur est affiché dans la section et les données restent inchangées

#### Scenario: Un succès est affiché

- **WHEN** la restauration réussit
- **THEN** la page Administration affiche un message de succès et les données restaurées sont visibles

#### Scenario: La section reste utilisable sans JavaScript

- **WHEN** `app.js` ne s'exécute pas
- **THEN** le lien d'export reste utilisable et la section indique que la restauration nécessite JavaScript

