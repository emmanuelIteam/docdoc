## 1. Rendu serveur

- [x] 1.1 Dans `renderOutline`, calculer pour chaque ligne visible l'état replié réellement affiché (`node.children.length > 0 && node.collapsed && !expandIds?.has(node.id)`) et le passer à `renderLine`.
- [x] 1.2 Dans `renderLine`, ajouter la classe `collapsed` à la ligne et rendre le marqueur `.bullet-subtasks` dans la puce uniquement quand la ligne est repliée.
- [x] 1.3 Adapter l'étiquette accessible (`aria-label`) de la puce d'une ligne repliée pour annoncer le repli et les sous-tâches masquées ; laisser les autres étiquettes inchangées.

## 2. Style

- [x] 2.1 Rendre `.bullet` positionné en relatif et dessiner `.bullet-subtasks` en anneau absolument centré (bordure `1px solid currentColor`, rayon 50 %) pour ne pas entrer dans le flux.
- [x] 2.2 Rendre la puce d'une `.line.collapsed` visible sans survol (`.line.collapsed .bullet { visibility: visible; }`), après la règle de masquage existante, y compris sur un écran large.
- [x] 2.3 Vérifier que l'anneau reste lisible aux deux tailles de puce (écran large et écran étroit/ tactile) et qu'il cohabite avec la poignée `.bullet-grip` de la tête sélectionnée.

## 3. Tests e2e

- [x] 3.1 Ajouter une section 11 à `test/e2e/reindent.spec.js` : sur une ligne repliée, la puce et l'anneau sont visibles sans survol à 1280 px, et l'anneau est absent sur une ligne dépliée avec sous-lignes comme sur une ligne sans sous-ligne.
- [x] 3.2 Couvrir le repliage et le dépliage par double-clic sur la puce : l'anneau apparaît puis disparaît, et les sous-lignes suivent.
- [x] 3.3 Couvrir `?reveal=<id>` : l'ancêtre persisté replié mais affiché déplié n'affiche pas d'anneau.
- [x] 3.4 Vérifier que l'anneau ne décale ni le titre de la ligne ni celui d'une voisine, que la poignée de la tête sélectionnée remplace l'anneau et que celui-ci revient à la levée de la sélection, et que `aria-label` annonce le repli.

## 4. Spécifications et vérifications

- [x] 4.1 Reporter l'exigence « Indicate that a collapsed line has sub-tasks » dans `openspec/specs/project-outliner/spec.md` avec ses scénarios.
- [x] 4.2 Incrémenter `CACHE_VERSION` dans `public/sw.js` (`style.css` et `app.js` sont précachés).
- [x] 4.3 Lancer `node --check server.js` et `npm run test:e2e` ; vérifier que les cas 9.8 et 10.2 existants restent verts.

## 5. Correctif : repli indépendant de l'événement natif `dblclick`

- [x] 5.1 Dans `public/app.js`, reconnaître le double-clic sur la puce à partir de deux clics rapprochés (même ligne, ≤ 500 ms, ≤ 8 px) et envoyer le POST de pli depuis le gestionnaire de clic ; retirer l'écoute de `dblclick`.
- [x] 5.2 Ne pas faire avancer la sélection sur le second clic du geste, et réinitialiser le compteur sur un clic ailleurs.
- [x] 5.3 Ajouter les cas 11.7 (deux clics indépendants rapprochés replient) et 11.8 (deux clics espacés ne replient pas) à `test/e2e/reindent.spec.js`.
- [x] 5.4 Relancer `npm run test:e2e` en entier et vérifier que la sélection, le glisser-déposer et les tests tactiles restent verts.
