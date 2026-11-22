## 1. Modèle de statuts et normalisation (Node)

- [x] 1.1 Dans `server.js`, réduire `VALID_STATUSES` à `todo`, `in_progress`, `waiting`, `done` et supprimer `someday` ; vérifier que `setStatus` rejette toute valeur hors de cette liste.
- [x] 1.2 Dans `server.js`, remplacer la table unique `STATUS_ICONS`/`STATUS_LABELS` par une table `MENU_STATUSES` à trois entrées — `todo`/« En projet »/`○`, `in_progress`/« En cours »/`◐`, `done`/« Terminé »/`●` — et garder `GTD_RUBRIQUES` pour les deux libellés de l'accueil — `in_progress`/« À faire », `waiting`/« En attente ».
- [x] 1.3 Dans `server.js`, adapter `statusClass` : `status-in-progress` pour `in_progress`, `status-waiting` pour `waiting`, `status-done` pour `done`, chaîne vide pour `todo` ; retirer la branche `someday`.
- [x] 1.4 Dans `server.js`, ajouter `normalizeStatus(status)` qui renvoie le statut s'il est dans `VALID_STATUSES`, sinon `todo`, et l'appliquer récursivement aux nœuds chargés dans `normalizeDomain` (projets et enfants).
- [x] 1.5 Dans `server.js`, adapter `validateBackupNodes` : accepter `someday` comme valeur héritée et la normaliser en `todo`, conserver le rejet des autres valeurs inconnues.
- [x] 1.6 Dans `server.js`, mettre à jour les commentaires de `VALID_STATUSES`, `homeRubrique` et `homeBoard` pour décrire les quatre statuts et les deux sous-états.

## 2. Menu et rendu de l'outline (Node)

- [x] 2.1 Dans `server.js` `renderLine`, n'émettre que les trois `statusBtn` de `MENU_STATUSES` ; supprimer les boutons `waiting` et `someday`.
- [x] 2.2 Dans `server.js` `renderLine`, marquer le bouton `in_progress` actif lorsque `node.status` vaut `in_progress` **ou** `waiting`, et utiliser le libellé de `MENU_STATUSES` comme `title` accessible.
- [x] 2.3 Vérifier que le menu d'une ligne passe de onze à neuf boutons (trois statuts et six actions structurelles) et que le rendu du titre reste normal pour `todo`, gras pour `in_progress`, italique pour `done` et souligné pointillé pour `waiting`.

## 3. Accueil à deux rubriques (Node)

- [x] 3.1 Dans `server.js`, réduire `GTD_RUBRIQUES` aux deux couples `in_progress`/« À faire » et `waiting`/« En attente » ; faire renvoyer par `homeRubrique` une rubrique uniquement pour ces deux statuts et `null` pour `todo`, `done`, `someday` et les lignes mères.
- [x] 3.2 Dans `server.js`, faire remplir par `homeBoard` deux listes ordonnées (`in_progress`, `waiting`) au lieu de trois, sans changer l'ordre domaines puis outline.
- [x] 3.3 Dans `server.js` `renderHomeBoard`, rendre les deux colonnes sous un intitulé de groupe « En cours » visible, conserver les compteurs, les états vides « Aucune tâche » et l'`aria-label` du tableau mis à jour.
- [x] 3.4 Dans `server.js` `homeTaskCard`, laisser `moveChoice` proposer les deux rubriques de `GTD_RUBRIQUES` ; vérifier que le dépôt et le menu postent `in_progress` ou `waiting` et que la rubrique courante reste désactivée.

## 4. Page Aide (Node)

- [x] 4.1 Dans `server.js` `renderGuidePage`, réécrire la section GTD : nommer « À faire » et « En attente » comme sous-états d'« En cours », expliquer qu'ils se gèrent depuis l'accueil, que les tâches « En projet » ne sont pas listées et que « Un jour peut-être » est désormais lu comme « En projet ».
- [x] 4.2 Dans `server.js` `renderGuidePage`, documenter les trois états du menu d'une ligne — « En projet », « En cours », « Terminé » — et l'absence des sous-états dans ce menu.

## 5. Parité Rust

- [x] 5.1 Dans `rust/src/model.rs`, réduire `VALID_STATUSES` à `todo`, `in_progress`, `waiting`, `done` ; séparer les libellés de menu (`En projet`, `En cours`, `Terminé`) des libellés de rubrique de l'accueil (`À faire`, `En attente`) et retirer `someday` de `status_icon`/`status_label`.
- [x] 5.2 Dans `rust/src/model.rs`, ajouter `normalize_status(status) -> String` (statut valide conservé, sinon `todo`) et l'appliquer dans `node_from_value` ; vérifier que `normalize_domain` normalise donc les domaines chargés et les sauvegardes restaurées.
- [x] 5.3 Dans `rust/src/model.rs`, vérifier que `set_status` rejette `someday` et accepte `waiting`, puis adapter ses tests unitaires.
- [x] 5.4 Dans `rust/src/html.rs`, n'émettre que les trois `status_button` du menu et marquer `in_progress` actif pour `in_progress` et `waiting` ; retirer `status-someday` de `line_status_class`.
- [x] 5.5 Dans `rust/src/html.rs`, réduire `GTD_RUBRIQUES` à deux entrées, faire renvoyer par `home_rubrique` uniquement `in_progress` et `waiting`, et faire remplir par `home_tasks` deux buckets.
- [x] 5.6 Dans `rust/src/html.rs` `render_home_board`, rendre l'intitulé de groupe « En cours » au-dessus des deux colonnes et conserver compteurs, états vides et libellés de `home_task_card`.
- [x] 5.7 Dans `rust/src/html.rs`, réécrire le texte de la page Aide comme en 4.1 et 4.2.
- [x] 5.8 Dans `rust/src/app.rs`, vérifier que la route `POST /domaine/:slug/api/nodes/:id/status` accepte `waiting` et refuse `someday`, et que le mode `vue=accueil` renvoie le fragment à deux rubriques ; adapter les tests de routeur.
- [x] 5.9 Vérifier que `rust/src/space.rs` et la restauration de sauvegarde passent bien par `normalize_domain`, donc par la normalisation `someday` → `todo`.

## 6. Assets et cache

- [x] 6.1 Dans `public/app.js`, réduire `GTD_LABELS` à `{ in_progress: 'À faire', waiting: 'En attente' }` et mettre à jour le commentaire « between the three GTD rubriques ».
- [x] 6.2 Dans `public/style.css`, passer `.gtd-board` à deux colonnes, ajouter le style de l'intitulé de groupe « En cours », supprimer `.title.status-someday` et conserver `.title.status-waiting`.
- [x] 6.3 Dans `public/sw.js`, incrémenter `CACHE_VERSION` (par exemple `v23` → `v24`) pour publier `app.js` et `style.css`.

## 7. Tests

- [x] 7.1 Dans `test/e2e/home.spec.js`, réécrire les fixtures autour de deux rubriques : conserver des feuilles `todo` (non listées), des feuilles `in_progress` et `waiting`, une ligne héritée `someday` lue comme `todo`, une ligne mère, une feuille profonde sous un ancêtre replié et un domaine archivé ; mettre à jour les sélecteurs `data-gtd`.
- [x] 7.2 Dans `test/e2e/home.spec.js`, adapter les tests de glisser à la souris et au doigt, le menu de rubrique et les compteurs au passage `À faire` ↔ `En attente` ; vérifier l'absence de requête sur un dépôt dans la rubrique d'origine, hors rubrique ou annulé.
- [x] 7.3 Dans `test/e2e/home.spec.js` ou `test/e2e/backup.spec.js`, ajouter un test d'une tâche héritée `someday` : elle n'apparaît dans aucune rubrique et s'affiche en « En projet » sur la page du domaine.
- [x] 7.4 Dans `test/e2e/backup.spec.js`, ajouter un test de restauration d'une sauvegarde contenant `someday` : la tâche est restaurée en `todo` sans perte de ses autres champs.
- [x] 7.5 Dans les tests unitaires de `rust/src/model.rs`, couvrir `normalize_status`, `set_status` (`waiting` accepté, `someday` refusé) et les libellés de menu et de rubrique.
- [x] 7.6 Dans les tests unitaires de `rust/src/html.rs`, couvrir le menu à trois statuts, l'absence de `someday`, `in_progress` actif pour `waiting`, les deux colonnes de l'accueil et l'intitulé « En cours ».
- [x] 7.7 Dans les tests unitaires de `rust/src/app.rs`, couvrir une mutation `waiting` depuis l'accueil, le refus de `someday` et le rendu des deux rubriques.
- [x] 7.8 Vérifier `test/passkey-flow.js` et `rust/test/manual/passkey-flow.js` : un domaine dont la seule tâche est `todo` doit toujours afficher les deux rubriques vides.

## 8. Recette et validation

- [x] 8.1 Lancer `node --test` (ou la suite Node du projet), les tests Playwright ciblés et `cargo test` ; corriger toute régression.
- [x] 8.2 Vérifier à l'écran, en 1280 px et en 390 px, le menu d'une ligne (neuf boutons, trois statuts), l'état actif d'« En cours » sur une ligne en attente, les deux colonnes sous « En cours » et le glisser-déposer entre elles.
- [x] 8.3 Vérifier que la page Aide ne mentionne plus « Un jour peut-être » comme rubrique et documente les trois états et les deux sous-états.
- [x] 8.4 Lancer `openspec validate "reduce-task-statuses-to-three"` et vérifier que `openspec status --change "reduce-task-statuses-to-three" --json` donne `tasks` en `done`.
