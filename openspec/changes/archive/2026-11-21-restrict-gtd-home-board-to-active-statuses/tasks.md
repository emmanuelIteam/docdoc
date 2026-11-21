## 1. Tableau d'accueil côté Node

- [x] 1.1 Dans `server.js`, remplacer `GTD_RUBRIQUES` par trois couples `{ id, label }` — `in_progress`/« En cours », `waiting`/« En attente », `someday`/« Un jour peut-être » —, supprimer la propriété `statuses` devenue inutile et mettre à jour le commentaire.
- [x] 1.2 Dans `server.js`, faire renvoyer par `homeRubrique` une rubrique uniquement pour `in_progress`, `waiting` et `someday` (renvoyer `node.status`), et `null` pour `todo`, `done` et les lignes mères ; mettre à jour le commentaire.
- [x] 1.3 Dans `server.js`, dans `homeTaskCard`, supprimer le badge `gtd-badge` et faire écrire `target.id` tel quel dans les `hx-vals` du menu (plus de cas particulier `todo`).
- [x] 1.4 Dans `server.js`, réécrire dans `renderGuidePage` la section « Classer les tâches par rubrique GTD » : nommer « En cours » au lieu de « À faire », expliquer que les tâches à faire ne sont pas listées et qu'il faut les passer à « En cours » depuis leur domaine.

## 2. Tableau d'accueil côté Rust

- [x] 2.1 Dans `rust/src/html.rs`, passer `GTD_RUBRIQUES` à `("in_progress", "En cours")`, `("waiting", "En attente")`, `("someday", "Un jour peut-être")` ; faire renvoyer par `home_rubrique` uniquement ces trois statuts et associer la rubrique `in_progress` au premier bucket.
- [x] 2.2 Dans `rust/src/html.rs`, dans `home_task_card`, supprimer le badge et écrire l'identifiant de la rubrique comme `status` dans les `hx-vals` du menu.
- [x] 2.3 Dans `rust/src/html.rs`, écrire dans `render_guide_page` le même texte que la page Aide Node.
- [x] 2.4 Dans `rust/src/html.rs`, adapter les tests unitaires de `render_home_board` : `data-gtd="in_progress"`, absence des cartes `todo`, absence de `gtd-badge`, présence et ordre des cartes `in_progress`/`waiting`/`someday`, compteurs recalculés.
- [x] 2.5 Dans `rust/src/app.rs`, adapter les tests de routeur : `vue=accueil` renvoie le fragment avec `data-gtd="in_progress"` et une carte `waiting`, un statut inconnu est toujours refusé, et le statut `in_progress` est relu sur `GET /`.

## 3. Assets

- [x] 3.1 Dans `public/app.js`, remplacer `GTD_LABELS` par `{ in_progress: 'En cours', waiting: 'En attente', someday: 'Un jour peut-être' }` et faire envoyer par `gtdMoveCard` `status: targetRubrique`, sans cas particulier.
- [x] 3.2 Dans `public/style.css`, supprimer la règle `.gtd-badge`.
- [x] 3.3 Dans `public/sw.js`, incrémenter `CACHE_VERSION`.

## 4. Tests navigateur

- [x] 4.1 Dans `test/e2e/home.spec.js`, adapter les fixtures : conserver des feuilles `todo` (par exemple `a7` et `b2`) pour vérifier leur absence, et ajouter ou convertir des feuilles `in_progress` (par exemple `a1-2`) pour couvrir l'ordre et les compteurs de « En cours » ; garder les feuilles `waiting`/`someday`, la mère repliée et le domaine archivé.
- [x] 4.2 Dans `test/e2e/home.spec.js`, adapter les assertions de liste : en-tête « En cours » et `data-gtd="in_progress"`, compteurs et ordre recalculés, absence des cartes `todo`, `done`, mères et domaines archivés, absence de `.gtd-badge`.
- [x] 4.3 Dans `test/e2e/home.spec.js`, adapter les tests de glisser à la souris et au doigt : utiliser des cartes actives, vérifier « En cours » ↔ « En attente »/« Un jour peut-être », le statut persisté `in_progress`, le dépôt sur la rubrique d'origine sans requête, le dépôt hors rubrique et le glisser annulé sans changement.
- [x] 4.4 Dans `test/e2e/home.spec.js`, adapter les tests du menu clavier : libellés des trois rubriques, rubrique courante désactivée, focus restauré et annonce après un déplacement vers « En cours ».
- [x] 4.5 Dans `test/passkey-flow.js`, mettre à jour l'attente de la page d'accueil : un domaine dont la seule ligne est `todo` affiche les trois colonnes vides et aucune carte « Réserver le camping » sur `/`, tandis que la page du domaine continue de l'afficher.
- [x] 4.6 Dans `test/e2e/administration.spec.js`, compléter les assertions de la page Aide : elle nomme « En cours » dans la section GTD et indique que les tâches à faire ne sont pas listées.

## 5. Vérifications

- [x] 5.1 Lancer `node --check server.js` et `node --check public/app.js`.
- [x] 5.2 Lancer `cargo fmt --check` et `cargo test` dans `rust/`.
- [x] 5.3 Lancer `npm test` puis `npm run test:e2e`.
- [x] 5.4 Vérifier à l'écran l'accueil en 1280 px et en 390 px : trois rubriques, première colonne « En cours » sans badge, absence des tâches à faire, glisser et menu.
- [x] 5.5 Lancer `openspec validate restrict-gtd-home-board-to-active-statuses --strict`.
