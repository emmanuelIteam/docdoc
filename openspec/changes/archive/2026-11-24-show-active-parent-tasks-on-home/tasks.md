## 1. Règle de listage — implémentation Node

- [x] 1.1 Dans `server.js`, ajouter un helper local `hasActiveDescendant(node)` qui renvoie vrai dès qu'un enfant, à toute profondeur, porte le statut `in_progress` ou `waiting`.
- [x] 1.2 Dans `server.js` `homeRubrique(node)`, retirer le test « la ligne a des enfants » et renvoyer la rubrique d'une ligne active seulement lorsque `hasActiveDescendant(node)` est faux ; mettre à jour le commentaire pour décrire la règle « ligne active sans descendant actif » et non plus « feuille ».
- [x] 1.3 Vérifier que la route `POST /api/home/order` de `server.js` réutilise `homeRubrique` sans changement : une mère active sans descendant actif doit être acceptée, une mère dont un descendant est actif doit répondre 400.

## 2. Règle de listage — implémentation Rust

- [x] 2.1 Dans `rust/src/html.rs`, ajouter `fn has_active_descendant(node: &Node) -> bool` parcourant récursivement `children` et testant `in_progress` / `waiting`.
- [x] 2.2 Dans `rust/src/html.rs` `home_rubrique`, retirer le test `!node.children.is_empty()` et renvoyer la rubrique d'une ligne active seulement si `has_active_descendant(node)` est faux ; mettre à jour le commentaire au-dessus de `GTD_RUBRIQUES` et de la fonction.
- [x] 2.3 Vérifier que `home_order_route` dans `rust/src/app.rs` n'a pas besoin d'être modifiée : elle appelle déjà `home_rubrique`, qui accepte désormais une mère listée et refuse une mère dont un descendant est actif.

## 3. Page Aide

- [x] 3.1 Dans `server.js` `renderGuidePage`, remplacer le paragraphe qui dit que seules les tâches feuilles sont listées et que les lignes mères ne le sont pas : expliquer qu'une ligne active sans descendant actif est listée, qu'une mère active sans sous-tâche active apparaît comme une autre tâche, et qu'une mère dont une sous-tâche est active est représentée par cette sous-tâche.
- [x] 3.2 Dans `rust/src/html.rs` `render_guide_page`, appliquer exactement le même texte qu'en 3.1.

## 4. Tests unitaires

- [x] 4.1 Dans `rust/src/html.rs`, renommer `home_board_groups_leaves_and_skips_parents_and_done` et adapter ses fixtures : conserver une mère `in_progress` dont l'enfant est `in_progress` (les deux ne doivent pas produire deux cartes), ajouter une mère `in_progress` dont les enfants sont `todo` et `done` (sa carte doit apparaître), et une mère `waiting` dont l'enfant est `waiting` (seule l'enfant est listée).
- [x] 4.2 Dans le même test, vérifier le rendu d'une carte mère : `id="gtd-node-<mere>"` présent, titre lien profond, seconde ligne limitée au domaine et aux ancêtres de la mère, aucun doublon de son propre titre dans le contexte.
- [x] 4.3 Dans `rust/src/app.rs`, ajouter un test de la route `/api/home/order` : créer une mère et un enfant, marquer la mère `in_progress` avec l'enfant `todo` et vérifier que le positionnement de la mère est accepté ; passer l'enfant `in_progress` et vérifier que le positionnement de la mère répond 400 alors que celui de l'enfant est accepté.
- [x] 4.4 Vérifier que les autres tests unitaires de `html.rs` et `app.rs` (ordre manuel, compteurs, routes de statut) restent verts sans modification.

## 5. Tests de bout en bout

- [x] 5.1 Dans `test/e2e/home.spec.js`, retourner le test 1.7 : le domaine du compte B garde une mère `in_progress`, un enfant `todo` et un enfant `done` ; la carte de la mère est désormais présente avec son `href` profond et sa seconde ligne réduite au domaine, tandis que les deux enfants restent absents.
- [x] 5.2 Dans `test/e2e/home.spec.js`, ajouter un cas « une branche, une carte » : quand un enfant de cette mère passe `in_progress`, la carte de la mère disparaît, celle de l'enfant apparaît avec la mère dans sa chaîne, puis le retour de l'enfant à `todo` fait réapparaître la carte de la mère.
- [x] 5.3 Dans le même fichier, vérifier que le test 1.1 et ses compteurs (3 / 4) restent inchangés : les mères actives des fixtures ont toutes un descendant actif.
- [x] 5.4 Vérifier que `test/e2e/home-order.spec.js` reste vert sans modification : ses fixtures ne contiennent que des feuilles.
- [x] 5.5 Dans `test/e2e/administration.spec.js`, ajouter au contrôle de la page Aide une assertion sur la nouvelle règle — par exemple la présence de « une seule carte » ou de « tâche mère … sous-tâche active » selon le texte retenu en 3.1 — et vérifier que les autres assertions de la section GTD restent valides.

## 6. Validation

- [x] 6.1 Lancer `cargo test` depuis `rust/` et `node --check server.js` ; corriger toute régression.
- [x] 6.2 Lancer `npx playwright test test/e2e/home.spec.js test/e2e/home-order.spec.js` et vérifier les cas 1.1, 1.7, le nouveau cas de branche, le glisser et le menu de rubrique.
- [x] 6.3 Lancer `openspec validate "show-active-parent-tasks-on-home"` puis `openspec status --change "show-active-parent-tasks-on-home" --json` ; les quatre artefacts doivent être `done`.
- [x] 6.4 Vérifier à l'écran, en 1280 px et en 390 px, qu'une mère active sans sous-tâche active apparaît comme une carte, qu'elle se glisse et se réordonne normalement, et que sa carte disparaît dès qu'une sous-tâche devient active.
