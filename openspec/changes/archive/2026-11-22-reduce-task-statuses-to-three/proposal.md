## Why

Le menu contextuel d'une ligne propose aujourd'hui cinq actions de statut — « À faire », « En cours », « En attente », « Un jour peut-être » et « Terminé » —, auxquelles s'ajoutent les actions structurelles. Sur la page d'un domaine de projet, où l'on planifie, cet éventail mélange deux niveaux : les trois états de planification (En projet, En cours, Terminé) et les sous-états GTD (« À faire », « En attente ») qui relèvent du pilotage quotidien depuis l'accueil. Le menu est trop chargé et ne dit plus où se décide quoi.

## What Changes

- **Trois états sur la page du domaine** : le menu d'une ligne n'offre plus que « En projet » (`todo`), « En cours » (`in_progress`) et « Terminé » (`done`). Les actions « En attente » et « Un jour peut-être » quittent le menu.
- **Sous-états d'« En cours » gérés depuis l'accueil** : « En cours » se décline en « À faire » (`in_progress`) et « En attente » (`waiting`). La page d'accueil ne présente plus que ces deux rubriques, regroupées sous l'intitulé « En cours » ; la rubrique « Un jour peut-être » disparaît.
- **« En projet » signifie non commencé** : `todo` devient l'état « En projet », rendu normal et non listé sur l'accueil. Une tâche `waiting` reste un sous-état d'« En cours » : sur la page du domaine, le bouton « En cours » est actif pour elle et la ramène à « À faire » lorsqu'on le choisit.
- **Retrait de `someday`** : le statut « Un jour peut-être » est retiré du vocabulaire des mutations. Les tâches existantes qui portent ce statut sont lues et restaurées comme « En projet » (`todo`), sans perte de données.
- **Aide** : la page Aide explique les trois états de projet, les deux sous-états d'« En cours » et la nouvelle répartition de l'accueil.
- **BREAKING** : `someday` n'est plus accepté par les mutations de statut et devient une valeur héritée normalisée en `todo` ; la troisième rubrique de l'accueil disparaît.

## Capabilities

### New Capabilities

- (aucune)

### Modified Capabilities

- `node-status-tracking` : le vocabulaire passe de cinq à trois états de projet plus le sous-état `waiting` ; le menu n'offre que trois actions ; le rendu distingue « En attente » sans « Un jour peut-être » ; `someday` est normalisé en `todo` à la lecture.
- `home-dashboard` : le tableau passe de trois à deux rubriques — « À faire » et « En attente » — regroupées sous « En cours » ; le classement, le glisser-déposer et le menu de rubrique ne connaissent plus « Un jour peut-être ».
- `user-guide` : la page Aide documente les trois états de projet et les deux sous-états d'« En cours » au lieu des trois rubriques actuelles.

## Impact

- **`server.js`** : `VALID_STATUSES` réduit à `todo`, `in_progress`, `waiting`, `done` ; `STATUS_LABELS`/`STATUS_ICONS` et `statusClass` ; menu de ligne à trois actions avec « En cours » actif pour `waiting` ; `GTD_RUBRIQUES`/`homeRubrique`/`homeBoard` à deux rubriques ; normalisation de `someday` → `todo` dans `normalizeDomain` et à la validation d'une sauvegarde ; texte de la page Aide.
- **`rust/src/model.rs`** : `VALID_STATUSES`, `status_icon`, `status_label`, normalisation du statut dans `node_from_value`, validation de `set_status`.
- **`rust/src/html.rs`** : menu de ligne, classe de statut du titre, tableau d'accueil à deux rubriques, contenu de la page Aide.
- **`rust/src/app.rs`** : validation du statut de la route `POST /domaine/:slug/api/nodes/:id/status`, textes et tests de routeur ; `rust/src/space.rs` pour la lecture d'un domaine existant.
- **`public/app.js`** : `GTD_LABELS` et le classement des cartes limités aux deux rubriques.
- **`public/style.css`** : retrait des styles `status-someday`, conservation du style `status-waiting`, en-têtes des deux rubriques.
- **`public/sw.js`** : incrément de `CACHE_VERSION` (`style.css` et `app.js` changent).
- **Tests** : `test/e2e/home.spec.js` réécrit autour de deux rubriques et de la migration `someday` → « En projet » ; `test/e2e/backup.spec.js` et `rust/test/manual/passkey-flow.js` adaptés si nécessaire ; tests unitaires Rust (`model`, `html`, routeur) mis à jour.
- **Aucune dépendance nouvelle ; le format de stockage reste le même** (les statuts sont des chaînes déjà persistées).
