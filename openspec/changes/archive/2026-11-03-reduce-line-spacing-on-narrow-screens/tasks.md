## 1. Styles

- [x] 1.1 Dans `public/style.css`, remplacer `min-height: 2.75rem` par `min-height: 2.475rem` dans la requête `@media (max-width: 640px)` de `.line`, et réécrire le commentaire : 39,6 px à 16 px de police racine, soit −10 % par rapport à 2,75 rem, cible 44 px AAA abandonnée à la demande, cible 24 px AA de la puce conservée, `min-height` pour ne pas tronquer un titre long.
- [x] 1.2 Mettre à jour le commentaire de la règle `.bullet` qui attribue encore « 44 px » à la hauteur de ligne.
- [x] 1.3 Vérifier qu'aucune autre règle ne fixe la hauteur des lignes en mobile (`padding`, `line-height`, `.outline`).

## 2. Tests

- [x] 2.1 Dans `test/e2e/reindent.spec.js` (section 8), remplacer les bornes 44 / 44,5 px par un minimum à 39,5 px et une valeur exacte de 39,6 px sur une ligne dont le titre tient sur une ligne (une ligne dont le titre revient à la ligne dépasse légitimement le minimum) ; mettre à jour les noms et commentaires (8.2, 8.3, 8.4, 8.5, en-tête du fichier et constantes).
- [x] 2.2 Garder la section 9 (glisser tactile) inchangée : vérifier que `LONG_FIXTURE` (30 lignes × ~40,9 px) dépasse toujours la hauteur du viewport 390 × 844 — test 9.7 vert.
- [x] 2.3 Vérifier que les tests 8.1 et 8.4 (bureau compact, bascule sans rechargement) restent valables, avec la vérification exacte sur la ligne `a` pour 8.4.

## 3. Cache PWA

- [x] 3.1 Incrémenter `CACHE_VERSION` dans `public/sw.js` (`v8` → `v9`), `style.css` étant un fichier précaché.

## 4. Vérifications

- [x] 4.1 `npx playwright test test/e2e/reindent.spec.js` : 48/48, section 8 comprise (39,6 px mesurés à 390 px).
- [x] 4.2 `npm test` : 39/39.
- [x] 4.3 `openspec validate reduce-line-spacing-on-narrow-screens --strict` : valide.
- [x] 4.4 Recette visuelle à 390 px : captures avant/après panneau replié, 19 tâches visibles contre 17, aucun titre tronqué, puce centrée et toujours visible.

## Note de vérification

L'arbre de travail héberge en parallèle d'autres changes (page d'accueil, pipeline de release, corrections de la barre collée) : `public/style.css`, `test/e2e/reindent.spec.js` et `public/sw.js` sont également modifiés par ces changes. La vérification a été faite sur l'état partagé :

- `npx playwright test test/e2e/reindent.spec.js` → **48/48**, puis section 8 seule rejouée après les modifications concurrentes → **5/5** ;
- `npx playwright test test/e2e/pwa.spec.js` → **7/7** ;
- `npm test` → **39/39** ;
- `openspec validate reduce-line-spacing-on-narrow-screens --strict` → valide ; spec `project-outliner` synchronisée puis validée.

`CACHE_VERSION` a été porté de `v8` à `v9` par ce change, puis à `v11` par un change voisin qui modifie lui aussi des fichiers précachés : l'exigence « incrémenter `CACHE_VERSION` » reste satisfaite, la valeur finale étant simplement plus récente.
