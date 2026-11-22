## 1. Ordre manuel côté Node : modèle et persistance

- [x] 1.1 Dans `storage.js`, ajouter `homeOrderKey(userId)` qui renvoie `users/{userId}/home-order.json`, et l'exporter avec les autres constructeurs de clés.
- [x] 1.2 Dans `server.js`, ajouter `homeOrder` à `makeSpace` sous la forme `{ in_progress: [], waiting: [] }`, et le charger dans `loadSpace` après les thèmes et les domaines.
- [x] 1.3 Dans `server.js`, ajouter `normalizeHomeOrder(raw)` : ne retenir que les deux rubriques de `GTD_RUBRIQUES`, ne garder que des chaînes non vides, dédoublonner en conservant la première occurrence, et renvoyer deux listes vides pour un document absent ou mal formé.
- [x] 1.4 Dans `server.js`, ajouter `persistHomeOrder(space)` qui écrit `{ in_progress, waiting }` via `space.writeQueue`, sur le modèle de `persistThemes`, et journalise un échec sans interrompre la requête.
- [x] 1.5 Dans `server.js`, ajouter `orderHomeEntries(space, rubrique, entries)` : parcourir `space.homeOrder[rubrique]`, retenir les entrées encore présentes, puis ajouter les autres entrées dans leur ordre naturel, sans doublon.
- [x] 1.6 Dans `server.js` `homeBoard`, appliquer `orderHomeEntries` à chaque rubrique après le parcours domaines + outline, et vérifier qu'un espace sans `home-order.json` rend exactement l'ordre actuel.

## 2. Route de positionnement (Node)

- [x] 2.1 Dans `server.js`, ajouter `POST /api/home/order` : valider `rubrique` et un éventuel `index` entier (400), résoudre le domaine par slug (404), le nœud (404), refuser une ligne non listée par `homeRubrique` (400).
- [x] 2.2 Dans la même route, si le statut courant diffère de la rubrique cible, appliquer `setStatus(domain.projects, node, rubrique, 'head')` et persister le domaine avec `persistDomain`.
- [x] 2.3 Dans la même route, construire la liste affichée de la rubrique après mutation, retirer le nœud, borner `index` (entier facultatif) entre 0 et la longueur, insérer à cette position ou en fin quand `index` est absent, écrire la liste complète dans `space.homeOrder[rubrique]` et appeler `persistHomeOrder`.
- [x] 2.4 Dans la même route, renvoyer `renderHomeBoard(req.space)` en HTML avec le statut 200 ; sur une erreur, répondre en texte clair sans modifier ni statut ni ordre.
- [x] 2.5 Vérifier que la route existante `POST /domaine/:slug/api/nodes/:id/status` conserve sa branche `vue=accueil` pour les appels existants, même si la page d'accueil ne l'utilise plus.

## 3. Rendu des cartes et des flèches (Node)

- [x] 3.1 Dans `server.js` `homeTaskCard`, recevoir la position et le total de la carte, et rendre un groupe `.gtd-order` avec deux boutons `.gtd-order-btn` (`data-dir="up"` / `"down"`), un `aria-label` nommant la tâche et la direction, et `hx-post="/api/home/order"`, `hx-vals` (`domain`, `node`, `rubrique`, `index`), `hx-target="#home-board"`, `hx-swap="outerHTML"`.
- [x] 3.2 Dans `homeTaskCard`, désactiver la flèche haut quand la position vaut 0 et la flèche bas quand la position est la dernière ; ne pas rendre de flèche active sur une carte seule.
- [x] 3.3 Dans `homeTaskCard` `moveChoice`, faire poster les choix de rubrique vers `/api/home/order` avec `domain`, `node` et `rubrique`, sans `index`, et conserver le bouton courant désactivé (`aria-current="true"`).
- [x] 3.4 Dans `renderHomeBoard`, passer la position et le total de chaque carte à `homeTaskCard`.
- [x] 3.5 Dans `server.js`, mettre à jour le commentaire de `homeBoard` et de `homeRubrique` pour décrire l'ordre manuel, l'ordre naturel initial et la route de positionnement.

## 4. Sauvegarde et restauration (Node)

- [x] 4.1 Dans `server.js` `exportBackup`, ajouter `homeOrder: { in_progress, waiting }` à l'objet racine, toujours présent, à partir de `space.homeOrder`.
- [x] 4.2 Dans `server.js` `validateBackup`, accepter `homeOrder` absent et le traiter comme deux listes vides ; refuser un `homeOrder` qui n'est pas un objet ou dont une des deux listes contient autre chose qu'une chaîne.
- [x] 4.3 Dans `validateBackup`, renvoyer le `homeOrder` normalisé (dédoublonné, deux listes) dans `value`.
- [x] 4.4 Dans `restoreBackup`, écrire `home-order.json` avec l'ordre validé, et avec deux listes vides quand la sauvegarde n'a pas `homeOrder`, afin que la restauration remplace aussi l'ordre.
- [x] 4.5 Vérifier que `BACKUP_VERSION` reste `1` et qu'aucune sauvegarde existante n'est refusée.

## 5. Client : glisser-déposer positionné et flèches

- [x] 5.1 Dans `public/app.js`, remplacer la cible de dépôt « colonne » par un calcul d'index : compter les cartes de la colonne cible, carte glissée exclue, dont le milieu est au-dessus du pointeur ; gérer la colonne vide et le dépôt sous la dernière carte.
- [x] 5.2 Dans `public/app.js`, poser les classes `gtd-drop-before` / `gtd-drop-after` sur la carte voisine (ou `gtd-drop-target` sur la colonne vide) et les retirer dans `gtdClearDropTarget`, donc au `dragend`, au `drop`, au `pointercancel` et quand le pointeur quitte la zone.
- [x] 5.3 Dans `public/app.js` `gtdMoveCard`, remplacer le retour anticipé « même rubrique » par une comparaison d'index : envoyer la requête vers `/api/home/order` avec `domain`, `node`, `rubrique` et `index`, et ne rien envoyer quand l'index calculé est identique à la position courante dans la même rubrique.
- [x] 5.4 Dans `public/app.js`, appliquer le même calcul d'index au glissement tactile (`gtdUpdateTouchTarget`, `pointerup`) en résolvant la carte sous le doigt avec `elementFromPoint`, stocker la colonne et l'index dans `gtdTouchDrag`, et conserver le dépôt hors colonne sans effet.
- [x] 5.5 Dans `public/app.js` `gtdBuildGhost`, retirer `.gtd-order` du clone pour que le fantôme ne montre pas de flèches.
- [x] 5.6 Dans `public/app.js`, étendre `gtdPendingMove` avec le type d'action (`drag`, `menu`, `arrow`), la direction et la rubrique d'origine ; remplir cet état dans `htmx:beforeRequest` pour les flèches comme pour le menu.
- [x] 5.7 Dans `public/app.js` `gtdFinishMove`, restaurer le focus sur la même flèche si elle existe et n'est pas désactivée, sinon sur l'autre flèche si elle n'est pas désactivée, sinon sur le lien du titre ; annoncer « montée » ou « descendue » avec la position N sur M.
- [x] 5.8 Dans `public/app.js`, conserver l'annonce et le focus actuels pour un glisser ou un choix de rubrique, et annoncer la nouvelle position quand la rubrique ne change pas.
- [x] 5.9 Vérifier que `gtdBusy` empêche toujours un second geste pendant une requête, y compris pour les flèches, et que `gtdFailMove` recharge le tableau en cas d'échec.

## 6. Styles et cache

- [x] 6.1 Dans `public/style.css`, ajouter `.gtd-order` (position absolue dans la gouttière droite de la carte, sous le menu) et `.gtd-order-btn` (cible d'au moins 24 × 24 px, états survol, focus visible, désactivé).
- [x] 6.2 Dans `public/style.css`, ajouter les repères `.gtd-card.gtd-drop-before` et `.gtd-card.gtd-drop-after` (trait visible dans l'espace entre deux cartes), sans déplacer la mise en page.
- [x] 6.3 Dans `public/style.css`, vérifier en 390 px que les flèches ne chevauchent ni le titre ni la chaîne de parents et qu'aucun défilement horizontal n'apparaît.
- [x] 6.4 Dans `public/sw.js`, incrémenter `CACHE_VERSION` (`v25` → `v26`) pour publier `app.js` et `style.css`.

## 7. Page Aide (Node)

- [x] 7.1 Dans `server.js` `renderGuidePage`, ajouter une section titrée « Ordonner les tâches de l'accueil » qui décrit le glisser-déposer dans une rubrique, les flèches `↑`/`↓` et leur désactivation aux extrémités, le dépôt positionné entre rubriques, le menu qui place en fin de liste et la persistance de l'ordre.
- [x] 7.2 Vérifier que la section reste lisible sans JavaScript et qu'elle n'ajoute pas de second lien vers `/administration` dans la section GTD existante.

## 8. Parité Rust

- [x] 8.1 Dans `rust/src/storage.rs`, ajouter `home_order_key(user_id)` et l'utiliser dans les lectures/écritures de l'ordre.
- [x] 8.2 Dans `rust/src/space.rs`, ajouter `HomeOrder` (`in_progress`, `waiting`, `Default`), le champ `home_order` de `Space`, son chargement dans `Space::load` et `persist_home_order`.
- [x] 8.3 Dans `rust/src/space.rs`, normaliser l'ordre lu (chaînes non vides, dédoublonnage, rubriques connues) et exposer une fusion sur des identifiants — ordre enregistré puis identifiants naturels restants — utilisée par `home_tasks`.
- [x] 8.4 Dans `rust/src/html.rs` `home_tasks`, appliquer l'ordre manuel à chaque bucket ; ajouter la position et le total à `home_task_card` ; rendre `.gtd-order` et les deux flèches avec `disabled` aux bornes et les mêmes `hx-vals`.
- [x] 8.5 Dans `rust/src/html.rs`, faire pointer les choix de rubrique du menu vers `/api/home/order` sans `index` et mettre à jour le texte de la page Aide comme en 7.1.
- [x] 8.6 Dans `rust/src/app.rs`, ajouter la route `POST /api/home/order` dans le routeur protégé et l'implémenter avec la même validation, le même changement de statut conditionnel, le même bornage et le même fragment de réponse qu'en Node.
- [x] 8.7 Dans `rust/src/app.rs`, ajouter `home_order` à `ValidatedBackup`, à `validate_backup` (absent accepté, mal formé refusé), à `backup_document` et à `restore_backup` (écriture de la clé, listes vides si absent).

## 9. Documentation

- [x] 9.1 Dans `docs/exploitation.md`, ajouter `home-order.json` à l'arborescence d'un compte, et compléter la description de l'export/restauration avec `homeOrder` et la compatibilité des sauvegardes sans ce champ.
- [x] 9.2 Dans `rust/README.md`, mettre à jour la description de l'arborescence des données si elle liste les documents du compte.

## 10. Tests Node

- [x] 10.1 Créer `test/e2e/home-order.spec.js` avec son propre serveur et son compte, et un jeu de tâches réparties sur deux domaines : vérifier l'ordre initial (domaines puis outline) dans les deux rubriques.
- [x] 10.2 Ajouter les tests des flèches : descente d'un cran, remontée d'un cran, flèche haut désactivée sur la première carte, flèche bas désactivée sur la dernière, focus restant sur la flèche, annonce de la nouvelle position.
- [x] 10.3 Ajouter les tests du glisser-déposer dans une rubrique : déposer au-dessus et en dessous avec `dragTo` et `targetPosition` pour viser la moitié haute ou basse d'une carte, vérifier le nouvel ordre, le statut inchangé et la persistance après rechargement.
- [x] 10.4 Ajouter les tests du dépôt entre rubriques à une position : la carte prend le statut cible et s'insère entre les deux cartes visées ; le menu de rubrique place la carte en fin de liste.
- [x] 10.5 Ajouter les tests de l'ordre propre à chaque rubrique, de la carte nouvellement listée ajoutée en fin, et de l'absence de requête quand une carte est déposée sur sa position courante.
- [x] 10.6 Ajouter un test tactile qui réordonne une carte dans sa rubrique depuis la poignée (même mécanique `Input.dispatchTouchEvent` que `home.spec.js`).
- [x] 10.7 Ajouter un test en 390 px : flèches visibles et activables, aucun débordement horizontal, aucun chevauchement avec le titre.
- [x] 10.8 Ajouter des tests directs de la route `/api/home/order` : rubrique inconnue (400), tâche non listée (400), tâche d'un autre compte (404), index hors bornes ramené aux extrémités, et vérification qu'un refus ne modifie ni statut ni ordre.
- [x] 10.9 Adapter `test/e2e/home.spec.js` 1.8 : un dépôt à la position courante n'envoie aucune requête, un dépôt à une autre position de la même rubrique ne change que l'ordre ; surveiller `/api/home/order` en plus de `/status`.
- [x] 10.10 Adapter `test/e2e/home.spec.js` 1.9 pour le menu passé à `/api/home/order` (focus sur le titre, annonce, carte en fin de rubrique) et vérifier que 1.10 (glisser tactile) reste vert.
- [x] 10.11 Dans `test/e2e/backup.spec.js`, ajouter : l'export contient `homeOrder` ; la restauration d'un document avec ordre le rétablit ; la restauration d'un document sans `homeOrder` vide l'ordre ; un `homeOrder` mal formé est refusé sans modification.
- [x] 10.12 Dans `test/e2e/administration.spec.js` 6.0, ajouter « Ordonner les tâches de l'accueil » à la liste attendue des titres de sections de la page Aide et vérifier le texte de la nouvelle section.

## 11. Tests Rust

- [x] 11.1 Dans `rust/src/space.rs` (ou `html.rs`), tester la fusion : ordre enregistré prioritaire, identifiants inconnus ignorés, cartes non enregistrées ajoutées en fin dans l'ordre naturel.
- [x] 11.2 Dans `rust/src/html.rs`, tester le rendu des flèches (deux boutons nommant la tâche, désactivation aux bornes, `hx-vals` avec le bon index) et les choix de rubrique pointant vers `/api/home/order`.
- [x] 11.3 Dans `rust/src/app.rs` `mod http_tests`, tester `/api/home/order` : réordonnancement dans la rubrique, dépôt entre rubriques avec position et statut, refus d'une rubrique inconnue et d'une tâche non listée, bornage d'un index hors limites, et ordre relu après une nouvelle requête à `/`.
- [x] 11.4 Dans `rust/src/app.rs` `mod http_tests`, tester l'export/restauration de `homeOrder` (aller-retour, document sans champ, document mal formé) et l'absence de régression sur les sauvegardes version 1.

## 12. Recette et validation

- [x] 12.1 Lancer `npm run test:e2e` (ou les specs ciblées `home-order`, `home`, `backup`) et corriger toute régression.
- [x] 12.2 Lancer `cargo test` dans `rust/` et corriger les tests unitaires et de routeur.
- [x] 12.3 Vérifier à l'écran, en 1280 px et en 390 px : l'ordre initial, une flèche haut/bas, un glisser dans la rubrique avec repère, un dépôt entre rubriques, le menu, le rechargement et le focus clavier.
- [x] 12.4 Vérifier qu'un compte sans `home-order.json` affiche l'ordre actuel, et que la page Aide documente le réordonnancement.
- [x] 12.5 Lancer `openspec validate "add-manual-task-order"` et vérifier que `openspec status --change "add-manual-task-order" --json` donne `tasks` en `done`.
