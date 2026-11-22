## Context

L'application est un outliner rendu côté serveur, avec htmx pour les fragments et une implémentation Node de référence (`server.js`, utilisée par les tests Playwright) doublée d'une implémentation Rust de production (`rust/src/`). Les deux partagent les mêmes assets `public/` et le même format de données.

Un domaine porte une forêt de nœuds `{ id, title, status, collapsed, children }` et un `displayOrder` plat. Le statut est un champ persistant par nœud, aujourd'hui limité à cinq valeurs : `todo`, `in_progress`, `waiting`, `someday`, `done`. Le menu contextuel d'une ligne expose les cinq actions, et la page d'accueil (`GET /`) classe les feuilles actives dans trois rubriques — « En cours » (`in_progress`), « En attente » (`waiting`) et « Un jour peut-être » (`someday`).

La demande sépare deux niveaux qui sont aujourd'hui mélangés : la planification sur la page d'un domaine, qui ne distingue que trois états (En projet, En cours, Terminé), et le pilotage GTD depuis l'accueil, qui raffine « En cours » en « À faire » et « En attente ».

## Goals / Non-Goals

**Goals :**

- Réduire le menu d'une ligne à trois actions de statut : « En projet » (`todo`), « En cours » (`in_progress`) et « Terminé » (`done`).
- Conserver « À faire » (`in_progress`) et « En attente » (`waiting`) comme deux sous-états persistés d'« En cours », choisis uniquement depuis l'accueil.
- Réduire l'accueil à deux rubriques, « À faire » et « En attente », regroupées sous l'intitulé « En cours » ; retirer « Un jour peut-être ».
- Lire les tâches existantes au statut `someday` comme « En projet » (`todo`) sans perte de données ni migration de fichier.
- Rester à parité entre `server.js` et `rust/src/`, sans dépendance nouvelle ni changement du format de stockage.

**Non-Goals :**

- Aucun nouveau champ de données : le statut reste l'unique dimension de classification.
- Aucune nouvelle route d'API : la route de statut existante continue de valider et de persister le statut, avec un mode de réponse « accueil ».
- Aucun changement de la cascade sur les sous-lignes, de l'ordre d'affichage, de la grammaire des liens profonds ni du glisser-déposer.
- Aucune réintroduction d'un équivalent de « Un jour peut-être » : le statut `someday` est retiré, pas masqué.
- Aucun filtre, regroupement, pagination ou réordonnancement manuel des cartes.

## Decisions

### 1. Le statut persistant garde quatre valeurs : `todo`, `in_progress`, `waiting`, `done`

Le vocabulaire est réduit de cinq à quatre valeurs : `someday` disparaît, les trois états de projet et le sous-état `waiting` restent. `todo` porte le libellé « En projet » dans le menu du domaine, `in_progress` « En cours », `done` « Terminé ». Sur l'accueil, `in_progress` s'appelle « À faire » et `waiting` « En attente ».

Le libellé d'un statut dépend donc du contexte : le même `in_progress` est « En cours » sur la page du domaine et « À faire » dans une rubrique de l'accueil. Les tables de libellés sont séparées : une table des trois actions du menu et une table des deux rubriques de l'accueil, au lieu d'une table unique utilisée partout.

*Alternatives écartées :*

- **Un champ `gtd` séparé du statut** : deux dimensions à maintenir, des états contradictoires possibles et une migration de chaque nœud. Le statut suffit.
- **Un nouveau statut `planned` pour « En projet »** : ferait doublon avec `todo`, déjà l'état par défaut de toute ligne créée, et imposerait une migration des tâches existantes.
- **Conserver `someday` hors du menu** : le statut resterait une valeur morte, sans chemin pour le choisir ni le retirer, et l'accueil devrait continuer à le classer.

### 2. Le menu du domaine n'offre que trois actions, et « En cours » couvre `waiting`

`renderLine`/`render_line` n'émettent plus que les boutons `todo`, `in_progress` et `done`, avec les libellés « En projet », « En cours » et « Terminé ». Le bouton « En cours » est marqué actif lorsque le statut de la ligne est `in_progress` **ou** `waiting` : « En attente » est un sous-état d'« En cours », pas un état de planification concurrent. Le sélectionner sur une ligne `waiting` écrit `in_progress`, ce qui la ramène à « À faire ».

`waiting` reste une valeur valide pour les mutations : l'accueil en a besoin pour déplacer une carte vers « En attente ». Le menu ne la propose simplement jamais.

*Alternatives écartées :*

- **Un sous-menu « En cours » dans le menu de ligne** : ajoute une interaction à deux niveaux pour un choix qui appartient à l'accueil ; le menu devait au contraire se raccourcir.
- **Retirer `waiting` des valeurs acceptées** : l'accueil ne pourrait plus distinguer « À faire » d'« En attente », et les tâches déjà `waiting` n'auraient plus de représentation.
- **Afficher un quatrième bouton « En attente » inactif** : le menu resterait à quatre entrées et laisserait croire qu'on peut choisir le sous-état depuis le domaine.

### 3. L'accueil présente deux rubriques sous l'intitulé « En cours »

`GTD_RUBRIQUES` devient deux couples `{ id, label }` : `in_progress` → « À faire », `waiting` → « En attente ». Les deux colonnes sont rendues sous un titre de groupe « En cours », chacune avec son compteur et son état vide, comme aujourd'hui. La correspondance rubrique ↔ statut reste un-à-un, donc `data-gtd`, `data-rubrique`, la valeur postée par le glisser et par le menu restent la même chaîne, et le code de déplacement ne gagne aucun cas particulier.

`todo` (En projet), `done`, les lignes mères et les domaines archivés ne sont pas listés. Une tâche `someday` n'existe plus : elle a été normalisée en `todo` à la lecture et n'apparaît donc pas non plus.

*Alternatives écartées :*

- **Une seule colonne « En cours » avec les deux sous-états mélangés** : perdrait la distinction actionnable / bloqué, qui est la raison d'être de l'accueil.
- **Trois colonnes en gardant « Un jour peut-être »** : contredirait la réduction à trois états de projet et laisserait une rubrique sans statut de planification correspondant.
- **Deux groupes dans une seule colonne avec deux listes** : compliquerait le glisser-déposer et les cibles de dépôt pour un gain visuel marginal.

### 4. `someday` est normalisé en `todo` à la lecture, et rejeté en mutation

Une fonction `normalizeStatus(status)` renvoie le statut s'il fait partie des quatre valeurs, et `todo` sinon. Elle est appliquée à chaque nœud lu depuis le stockage — dans `normalizeDomain` (Node) et `node_from_value` (Rust) —, donc une tâche `someday` est chargée en `todo` et rendue « En projet ». La normalisation est paresseuse : aucune écriture n'a lieu tant que le domaine n'est pas sauvegardé ; la première écriture persistante (`persistDomain`) enregistre `todo`.

La validation d'une sauvegarde JSON accepte encore `someday` comme valeur héritée et la normalise en `todo`, afin qu'une sauvegarde exportée avant le changement reste restaurable. En revanche, une mutation de statut qui envoie `someday` est rejetée (400), comme toute valeur hors des quatre statuts.

*Alternatives écartées :*

- **Une migration de tous les fichiers au démarrage** : coûteuse, écrivant sur des lectures, et inutile puisque la normalisation à la lecture suffit.
- **Rejeter `someday` à la restauration** : rendrait les anciennes sauvegardes inutilisables.
- **Conserver `someday` accepté en mutation** : laisserait une porte dérobée vers un statut que l'interface ne sait plus afficher ni classer.

### 5. Rendu de l'outline : trois états de projet et un sous-état distinct

`todo` garde le rendu normal (aucune classe), `in_progress` reste en gras, `done` reste en italique. `waiting` conserve son style propre — couleur et soulignement non coloré distincts, sans gras ni italique —, ce qui continue de le distinguer d'« À faire » sur la page du domaine. Le style `.title.status-someday` est supprimé.

*Alternatives écartées :*

- **Rendre `waiting` comme `in_progress`** : les deux sous-états deviendraient indiscernables sur la page du domaine.
- **Rendre `waiting` en gras** : le gras reste le marqueur d'« En cours » au sens de la planification ; un sous-état ne doit pas le usurper.

### 6. La page Aide et le cache suivent le nouveau vocabulaire

La section GTD de l'aide nomme les trois états de projet, explique que le menu du domaine ne propose que ceux-là, que « En cours » se décline sur l'accueil en « À faire » et « En attente », et que les tâches « En projet » ne sont pas listées. `public/sw.js` incrémente `CACHE_VERSION`, car `app.js` et `style.css` changent.

### 7. Parité Node/Rust

Les deux serveurs appliquent les mêmes règles : mêmes quatre statuts, mêmes libellés de menu et de rubrique, même normalisation `someday` → `todo`, même validation. Les noms restent alignés (`GTD_RUBRIQUES`/`GTD_RUBRIQUES`, `homeRubrique`/`home_rubrique`, `normalizeStatus`/`normalize_status`) pour que les assets partagés fonctionnent sans adaptation. Les tests unitaires Rust couvrent le modèle, le rendu et la route ; les tests Playwright couvrent le comportement navigateur sur le serveur Node.

## Risks / Trade-offs

- **Deux libellés pour `in_progress`** (« En cours » sur le domaine, « À faire » sur l'accueil) → le titre du groupe « En cours » et la section d'aide explicitent la hiérarchie ; les libellés restent séparés dans le code pour éviter une table ambiguë.
- **La normalisation `someday` → `todo` est irréversible une fois le domaine sauvegardé** → aucune sauvegarde de l'ancienne valeur n'est conservée ; c'est le prix de la réduction demandée. Les sauvegardes JSON antérieures restent restaurables, mais leur distinction « Un jour peut-être » est perdue à la restauration.
- **Des tâches « Un jour peut-être » disparaissent de l'accueil** → elles réapparaissent en « En projet » sur la page du domaine, où l'utilisateur peut les passer à « En cours ». L'aide le documente.
- **Un client resté ouvert pendant le déploiement peut envoyer `someday`** → la requête est refusée en 400 ; un rechargement de la page récupère le nouveau menu. Aucune donnée n'est corrompue.
- **Le menu de ligne reste chargé** (trois statuts + six actions structurelles) → il passe de onze à neuf boutons, ce qui répond à la gêne signalée sans refondre les actions structurelles.
- **Retour arrière après normalisation** → remettre `someday` dans le vocabulaire ne restaure pas les valeurs déjà converties en `todo` ; le retour arrière est sûr pour le code, pas pour la distinction perdue.
- **Deux implémentations à maintenir** → mêmes tables, mêmes tests de comportement ; la revue vérifie la parité du balisage et des libellés.

## Migration Plan

Aucune migration de fichier ni script de bascule. Les domaines existants sont lus avec `someday` normalisé en `todo` ; la valeur est persistée à la première écriture du domaine. Les sauvegardes JSON contenant `someday` sont acceptées et normalisées à la restauration.

Ordre de mise en œuvre : modèle et tables de libellés (Node puis Rust), normalisation à la lecture, menu et rendu de l'outline, tableau d'accueil à deux rubriques, page Aide, assets (`app.js`, `style.css`, `CACHE_VERSION`), tests.

Retour arrière : restaurer les cinq statuts, les trois rubriques de l'accueil, le menu à cinq boutons, les styles `someday` et les textes de l'aide. Les tâches converties en `todo` restent des tâches « En projet » valides ; aucune ne sera perdue, mais celles qui étaient « Un jour peut-être » ne pourront pas être distinguées après coup.

## Open Questions

Aucune question bloquante. Le sort de « Un jour peut-être » (suppression, sans équivalent) et le mapping « En projet » = `todo` ont été confirmés avec l'utilisateur.
