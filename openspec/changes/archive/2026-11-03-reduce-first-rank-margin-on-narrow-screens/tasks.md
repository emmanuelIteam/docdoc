## 1. Styles

- [x] 1.1 Dans `public/style.css`, définir `--outline-first-rank-shift` sur `:root` (0 rem par défaut) avec un commentaire expliquant qu'elle est définie à la racine pour que les lignes épinglées, hors de `.outline`, la suivent.
- [x] 1.2 Dans la requête `@media (max-width: 640px)` de l'outline, passer `--outline-first-rank-shift` à 1 rem et ajouter la règle de marge négative pour `.line[data-depth='0']` et `.ancestry-row[data-depth='0']`, avec le commentaire du compromis (gouttière de 1,5 rem → 0,5 rem, 16 px rendus au titre).
- [x] 1.3 Ajouter la marge négative + padding équivalent sur `.ancestry` (avec `flex-basis` augmenté d'autant) et `.ancestry-item`, pour que la ligne épinglée d'un projet arrive sur le bord de son item sans être rognée et que la barre garde la largeur de la page.
- [x] 1.4 Ajouter le padding équivalent sur `.drag-ghost`, pour que le clone d'un projet ne soit pas rogné par le fantôme tactile.
- [x] 1.5 Remplacer l'anneau de dépôt racine `#outline.drop-root { box-shadow: … }` par un pseudo-élément `#outline.drop-root::before` décalé à gauche de `--outline-first-rank-shift` (et `position: relative` sur l'outline pendant le glisser), avec son commentaire.
- [x] 1.6 Vérifier qu'aucune autre règle ne fixe la marge gauche des lignes de premier rang (média 640 px, `.ancestry-row`, `app.js`).

## 2. Ligne épinglée

- [x] 2.1 Dans `public/app.js`, `crumbFor` : poser aussi `data-depth` sur `.ancestry-row` (à côté de `--depth`), avec un commentaire renvoyant à la règle CSS de la marge de premier rang.

## 3. Cache PWA

- [x] 3.1 Incrémenter `CACHE_VERSION` dans `public/sw.js` (`v13` → `v15`, `v14` étant pris par le change voisin `pin-sidebar-footer`), `style.css` et `app.js` étant précachés.

## 4. Tests

- [x] 4.1 `test/e2e/reindent.spec.js`, section 7 : mettre à jour les marges attendues à 390 px et à 640 px (`a: -16`, `b: 12.8`, `c: 25.6`) et le retour à 0 px à 641 px ; mettre à jour l'en-tête de section et du fichier.
- [x] 4.2 Ajouter le cas « la ligne épinglée d'un projet suit la marge réduite » à 390 px (bords gauches du libellé épinglé et du titre de la ligne à 1 px près, marges calculées à −16 px, puce restant dans son item, barre sans défilement horizontal).
- [x] 4.3 Ajouter le cas « l'anneau de dépôt racine suit le bord gauche des projets » à 390 px.
- [x] 4.4 Vérifier que les autres cas de la section 7 (écran large, invariants, bascule sans rechargement) et de la section 12 (alignement à 1280 px, absence de débordement horizontal à 390 px) restent verts.

## 5. Vérifications

- [x] 5.1 `npx playwright test test/e2e/reindent.spec.js` : 51/51, section 7 → 6/6 après les dernières assertions.
- [x] 5.2 `npx playwright test test/e2e/pwa.spec.js` : 7/7.
- [x] 5.3 `npm test` : 41/41.
- [x] 5.4 `openspec validate reduce-first-rank-margin-on-narrow-screens --strict` : valide.
- [x] 5.5 Recette visuelle à 390 px, panneau replié : titre d'un projet de 60 px → 44 px, largeur 299,6 px → 315,6 px (+16 px, +5,3 %), marge calculée −16 px, bord gauche à 8 px, aucun débordement horizontal, anneau de dépôt au bord des projets, ligne épinglée alignée (44 px = 44 px) et non rognée, barre sans défilement horizontal.

## 6. Archive

- [x] 6.1 Reporter les deltas dans `openspec/specs/project-outliner/spec.md` et `openspec/specs/outline-display-order/spec.md`.
- [x] 6.2 Déplacer le change dans `openspec/changes/archive/2026-11-03-reduce-first-rank-margin-on-narrow-screens/`.

## Note de vérification

L'arbre de travail héberge en parallèle d'autres changes (`pin-sidebar-footer`, `show-version-on-help-page`, `collapse-sidebar-on-page-navigation`) : `public/style.css`, `public/app.js`, `public/sw.js` et `test/e2e/reindent.spec.js` sont également modifiés par ces changes. La vérification a été faite sur l'état partagé :

- `npx playwright test test/e2e/reindent.spec.js` → **51/51**, section 7 rejouée après les dernières assertions → **6/6** ;
- `npx playwright test` (suite complète, état partagé) → **95/95** ;
- `npx playwright test test/e2e/pwa.spec.js` → **7/7** ;
- `npm test` → **41/41** ;
- `openspec validate reduce-first-rank-margin-on-narrow-screens --strict` → valide, puis `openspec validate --all --strict` → 28/28.

`CACHE_VERSION` a été porté de `v13` à `v15` par ce change, puis à `v16` par un change voisin : l'exigence « incrémenter `CACHE_VERSION` » reste satisfaite, la valeur finale étant simplement plus récente.
