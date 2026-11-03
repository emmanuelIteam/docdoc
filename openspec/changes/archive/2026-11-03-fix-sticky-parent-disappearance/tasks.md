## 1. Comportement client

- [x] 1.1 Dans `public/app.js`, construire dans `refreshIndex()` un `Set` des identifiants de tâches mères affichées (les `data-parent` non vides des `.line`), invalidé avec l'index quand `#outline` change.
- [x] 1.2 Dans `chainOf(first, barBottom)`, ajouter la première ligne visible à la suite de ses ancêtres lorsqu'elle est une tâche mère et que son `rect.top` est passé sous le bas de la barre (tolérance de 0,5 px pour la première ligne d'une page) ; ne rien changer pour une feuille.
- [x] 1.3 Laisser la recherche de la première ligne visible, la réserve de hauteur (`refreshReserve`) et le rendu de `#ancestry` inchangés.

## 2. Tests

- [x] 2.1 Ajouter dans `test/e2e/reindent.spec.js` le helper `scrollLineTopAtBar(page, id, gap)` qui place le haut d'une ligne à `gap` px sous le bas de la barre (positif : visible, négatif : masqué), en se basant sur la hauteur de l'en-tête et non sur sa position courante.
- [x] 2.2 Ajouter le cas 12.8 : ligne entièrement visible (pas de maillon dupliqué), ligne à cheval sur la barre (la tâche mère est le dernier maillon, son titre est partiellement masqué), ligne entièrement cachée (le maillon reste, c'est la sous-tâche qui est lue).
- [x] 2.3 Mettre à jour le calcul attendu du cas 12.7 pour appliquer la même règle (maillon de la tâche mère à cheval sur la barre) en fin de page.

## 3. Spec et PWA

- [x] 3.1 Reporter l'exigence modifiée dans `openspec/specs/project-outliner/spec.md` à l'archivage du changement.
- [x] 3.2 Incrémenter `CACHE_VERSION` dans `public/sw.js` (v11 après v10).

## 4. Vérifications

- [x] 4.1 Lancer `node --check public/app.js` et `node --check test/e2e/reindent.spec.js`.
- [x] 4.2 Lancer la section 12 des tests e2e, puis toute la suite `npm run test:e2e`, et vérifier que le cas 12.8 échoue bien sans le correctif.
