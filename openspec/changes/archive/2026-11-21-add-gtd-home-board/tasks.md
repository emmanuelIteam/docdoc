## 1. Statuts et modèle

- [x] 1.1 Dans `server.js`, étendre `VALID_STATUSES` à `todo`, `in_progress`, `waiting`, `someday`, `done` et remonter au niveau module les tables `STATUS_ICONS` et `STATUS_LABELS` avec `waiting` (« En attente », `◷`) et `someday` (« Un jour peut-être », `✧`).
- [x] 1.2 Dans `server.js`, ajouter un helper `statusClass(status)` (`status-in-progress`, `status-done`, `status-waiting`, `status-someday`, sinon chaîne vide) et l'utiliser dans `renderLine` ; ajouter les boutons `waiting` et `someday` au menu de ligne.
- [x] 1.3 Dans `rust/src/model.rs`, étendre `VALID_STATUSES` à cinq valeurs et compléter `status_icon` et `status_label` pour `waiting` et `someday` ; vérifier que `set_status` rejette toujours toute valeur inconnue.
- [x] 1.4 Dans `rust/src/html.rs`, ajouter un helper de classe de statut et l'utiliser dans `render_line` ; ajouter les boutons `waiting` et `someday` au menu avec les mêmes `hx-post`, `scope` et cible que les trois existants.
- [x] 1.5 Ajouter dans `public/style.css` les styles `.title.status-waiting` et `.title.status-someday` : couleur propre et soulignement non coloré distinct (pointillé pour « En attente », double pour « Un jour peut-être »), sans gras ni italique, et autoriser le menu de ligne à revenir à la ligne avec une largeur maximale bornée à la fenêtre.

## 2. Tableau d'accueil côté Node

- [x] 2.1 Dans `server.js`, remplacer le filtre `homeTasks` par un helper `homeRubrique(node)` qui renvoie la rubrique d'une ligne feuille non terminée (`todo` pour `todo` et `in_progress`, `waiting`, `someday`), et par `homeBoard(space)` qui parcourt `space.domainList` puis `ensureDisplayOrder`/`indexOutline` et remplit trois listes ordonnées.
- [x] 2.2 Dans `server.js`, écrire `homeTaskCard(domain, node, ancestors, rubrique)` : `<li class="gtd-card" draggable="true">` portant les `data-domain`, `data-node` et `data-rubrique`, une poignée `.gtd-grip`, un lien `.gtd-card-title` vers `/domaine/<slug>?reveal=<id>#node-<id>`, le domaine et la chaîne de parents, un badge « En cours » pour `in_progress`, et un `<details class="gtd-move">` avec les trois choix `hx-post` (`scope=head`, `vue=accueil`, cible `#home-board`).
- [x] 2.3 Dans `server.js`, écrire `renderHomeBoard(space)` : conteneur `#home-board`, trois `<section class="gtd-column" data-gtd="todo|waiting|someday">`, en-têtes avec compteur, listes de cartes et message « Aucune tâche » par colonne vide ; échapper titres, noms, chaînes et URL.
- [x] 2.4 Dans `server.js`, faire appeler `renderHomeBoard` par `renderHomePage` dès qu'un domaine existe ; conserver l'état vide « Aucun domaine » sinon ; passer le titre de page à « Tableau de bord ».
- [x] 2.5 Dans `server.js`, après persistance dans `POST /domaine/:slug/api/nodes/:id/status`, renvoyer `renderHomeBoard(req.space)` lorsque `vue=accueil` est présent (corps ou requête), et le fragment d'outline sinon.

## 3. Tableau d'accueil côté Rust

- [x] 3.1 Dans `rust/src/html.rs`, remplacer `home_tasks` par un regroupement en trois listes (`todo`/`in_progress`, `waiting`, `someday`) qui ne retient que les feuilles non terminées des domaines actifs, dans l'ordre `domain_list` puis `ensure_display_order`.
- [x] 3.2 Dans `rust/src/html.rs`, écrire `render_home_board(space) -> String` (public) avec le même balisage que Node : `#home-board`, trois sections, compteurs, cartes, poignée, lien profond, badge « En cours », menu de rubrique et messages de colonne vide.
- [x] 3.3 Dans `rust/src/html.rs`, faire appeler `render_home_board` par `render_home_page` dès qu'un domaine existe, conserver l'état vide « Aucun domaine », et passer le titre de page à « Tableau de bord ».
- [x] 3.4 Dans `rust/src/app.rs`, après persistance dans `status_route`, renvoyer `html::render_home_board(&space)` lorsque `vue=accueil` est présent, et le fragment d'outline sinon.
- [x] 3.5 Ajouter dans `rust/src/html.rs` des tests unitaires : les trois rubriques, l'ordre, l'absence des mères et des `done`, le badge `in_progress`, l'échappement d'un titre et la présence du menu de rubrique.

## 4. Styles du tableau

- [x] 4.1 Dans `public/style.css`, styler `.gtd-board` en trois colonnes (`grid` ou `flex`) et en colonnes empilées sous le seuil défini ; borner la largeur et éviter tout défilement horizontal en 390 px.
- [x] 4.2 Styler `.gtd-column`, son en-tête, son compteur, ses listes et ses messages vides, ainsi que `.gtd-card` (carte, focus visible, titre non tronqué, contexte sur plusieurs lignes) et `.gtd-grip` (cible d'au moins 24 px, visible en permanence sous `(hover: none)`).
- [x] 4.3 Styler les états de glisser : `.gtd-card.dragging`, `.gtd-column.gtd-drop-target`, le fantôme de glisser, l'état interdit, la poignée au doigt, le badge « En cours », le menu `<details>` et la région `.sr-only` d'annonce.
- [x] 4.4 Incrémenter `CACHE_VERSION` dans `public/sw.js` (`app.js` et `style.css` changent).

## 5. Glisser-déposer et accessibilité

- [x] 5.1 Dans `public/app.js`, ajouter la section de glisser HTML5 : `dragstart` sur `.gtd-card` (lien neutralisé avec `draggable="false"`), fantôme, `dragover` sur `.gtd-column` avec indicateur, `drop` vers la rubrique cible, `dragend` qui nettoie, et aucun envoi si la rubrique est la même.
- [x] 5.2 Dans `public/app.js`, ajouter le glisser tactile : `pointerdown` sur `.gtd-grip`, seuil de 8 px, capture du pointeur, fantôme `pointer-events: none` au-dessus du doigt, résolution de la colonne par `elementFromPoint`, défilement automatique près des bords, annulation sur `pointercancel`, suppression du clic consécutif.
- [x] 5.3 Dans `public/app.js`, centraliser l'envoi d'un déplacement : `htmx.ajax('POST', '/domaine/<slug>/api/nodes/<id>/status', { target: '#home-board', swap: 'outerHTML', values: { status, scope: 'head', vue: 'accueil' } })`, avec verrou pendant la requête et rechargement du tableau en cas d'échec.
- [x] 5.4 Dans `public/app.js`, mémoriser la carte déplacée avant la requête, restaurer le focus sur son lien après `htmx:afterSwap`, et mettre à jour une région `aria-live` polie hors du fragment (succès et échec).
- [x] 5.5 Vérifier que les écouteurs du glisser d'outline (`.line`, `.bullet`) ne réagissent pas aux classes `.gtd-*` et que le glisser d'une carte ne déclenche ni navigation ni sélection de texte.

## 6. Page Aide

- [x] 6.1 Dans `server.js`, remplacer la section « Retrouver les tâches en cours » par une section « Classer les tâches par rubrique GTD » décrivant les trois rubriques, le glisser-déposer, le menu de rubrique, les lignes mères et terminées exclues, et l'ouverture d'une tâche par son titre.
- [x] 6.2 Dans `rust/src/html.rs`, écrire la même section dans `render_guide_page`, avec le même contenu et les mêmes liens.

## 7. Tests

- [x] 7.1 Mettre à jour les fixtures de `test/e2e/home.spec.js` pour couvrir `todo`, `in_progress`, `waiting`, `someday`, `done`, une ligne mère non listée, une feuille profonde sous un ancêtre replié et un domaine archivé.
- [x] 7.2 Réécrire les tests de liste : présence des trois rubriques, cartes attendues par rubrique, ordre par domaine puis outline, badge « En cours », absence des mères/`done`/archivés, compteurs et distinction des titres identiques par domaine et chaîne de parents.
- [x] 7.3 Adapter les tests de navigation : le titre de chaque carte conserve le lien profond exact, le clic ouvre la tâche dans son contexte sans changer son statut, et l'activation au clavier fonctionne.
- [x] 7.4 Ajouter les tests de glisser à la souris : déplacement `todo` → `waiting` → `someday` → `todo`, persistance après rechargement, dépôt sur la rubrique d'origine sans requête, dépôt hors rubrique et glisser annulé sans changement, indicateur de colonne survolée.
- [x] 7.5 Ajouter le test tactile par CDP (comme dans `reindent.spec.js`) : glisser depuis `.gtd-grip` vers une autre colonne et vérifier le statut persisté ; vérifier aussi le classement par le menu de rubrique au clavier, la restitution du focus et l'annonce `aria-live`.
- [x] 7.6 Mettre à jour `test/passkey-flow.js` : un domaine dont la seule tâche est `todo` affiche désormais une carte dans « À faire » au lieu de l'état vide « Aucune tâche en cours ».
- [x] 7.7 Mettre à jour `test/e2e/administration.spec.js` : le premier titre `h2` de la page Aide devient « Classer les tâches par rubrique GTD », et les assertions de contenu de l'Aide décrivent le tableau GTD.
- [x] 7.8 Ajouter les tests Rust de routeur : `POST .../status` avec `vue=accueil` renvoie le fragment du tableau, un statut inconnu est refusé, et le statut `waiting`/`someday` est bien relu sur `GET /`.
- [x] 7.9 Vérifier les états vides : aucun domaine, domaines sans aucune tâche, domaines avec seulement des mères ou des `done`, et absence de débordement horizontal en 390 px.

## 8. Vérifications

- [x] 8.1 Lancer `node --check server.js` et `node --check public/app.js`.
- [x] 8.2 Lancer `cargo fmt --check` et `cargo test` dans `rust/`.
- [x] 8.3 Lancer `npm test` puis `npm run test:e2e`.
- [x] 8.4 Vérifier à l'écran l'accueil en 1280 px et en 390 px : trois rubriques, ordre, badge, glisser souris/tactile, menu clavier, focus et annonce.
- [x] 8.5 Lancer `openspec validate add-gtd-home-board --strict`.
