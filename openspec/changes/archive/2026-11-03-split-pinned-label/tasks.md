## 1. Anatomie des lignes épinglées

- [x] 1.1 Dans `public/app.js`, construire chaque ligne épinglée comme un `<a class="ancestry-item">` contenant une ligne `.ancestry-row` avec l'emplacement de puce `.ancestry-bullet` et le libellé `.ancestry-label`, en reprenant la profondeur de la ligne source dans `--depth`.
- [x] 1.2 Dans `public/style.css`, aligner `.ancestry-row` sur la ligne de l'outline : `margin-left` de `profondeur × 1.6rem` (`.8rem` sous 640 px), `padding` horizontal `.4rem`, `gap` `.35rem`, puce `.7rem` (1.5rem sous 640 px), `font-size` 1rem, `line-height` 1.25 ; supprimer le chevron `::before` et l'ancien pas d'indentation `--crumb-depth`.

## 2. Partage du libellé à cheval

- [x] 2.1 Dans `chainOf`, mesurer la fraction masquée du titre de la première ligne visible (`(bas de la barre − haut du titre) / hauteur`) et n'ajouter la ligne comme dernier maillon que si elle est une tâche mère et que cette fraction est strictement positive.
- [x] 2.2 Dans `renderChain`, appliquer `--pin-fraction` et la classe `is-partial` à la dernière ligne épinglée ; dans le style, translater `.ancestry-row` de `(1 − fraction) × 1.25rem` et laisser l'emplacement couper le fragment au bas de la barre ; masquer la puce du fragment.
- [x] 2.3 Réutiliser les lignes épinglées par identifiant (`crumbById`) au lieu de vider `#ancestry`, et ne mettre à jour que le libellé, la profondeur, la fraction et la classe quand la chaîne change.

## 3. Glissement de la barre

- [x] 3.1 Animer la hauteur de `#ancestry` (`.16s ease`) entre l'ancienne et la nouvelle hauteur lors d'un ajout/retrait de ligne, et faire suivre `padding-bottom` de `main` avec la même transition pour garder la hauteur du document constante.
- [x] 3.2 Retirer le `padding-bottom` de l'en-tête sticky pour que le bas de la barre coïncide avec le séparateur ; rendre le séparateur comme pseudo-élément `::after` en bas de `#ancestry`, masqué quand la barre est vide.
- [x] 3.3 Publier `--topbar-height` depuis la hauteur finale cible de la barre (`barTarget`) et non depuis la valeur en cours d'animation, pour que les ancres cliquées pendant la transition s'arrêtent sous la barre finale.
- [x] 3.4 Ajouter `@media (prefers-reduced-motion: reduce)` pour supprimer les transitions de la barre et du `padding-bottom`.

## 4. Tests

- [x] 4.1 Adapter 12.2 à la nouvelle anatomie (mesure de l'abscisse réelle, typographie de `.ancestry-row`) et y ajouter l'alignement du libellé épinglé sur le titre de la ligne de même profondeur.
- [x] 4.2 Adapter 12.7 (fraction masquée du titre au lieu du haut de la ligne) et 12.4 (attendre la fin de la transition avant de mesurer l'ancre).
- [x] 4.3 Ajouter 12.8 : ligne entièrement visible (pas de maillon), ligne à cheval (fragment mesuré, complémentarité au séparateur, lien, pas de doublon), ligne entièrement cachée (fraction 1).
- [x] 4.4 Ajouter 12.9 : durées de transition présentes, événements `transitionrun`/`transitionend` sur la hauteur de la barre, hauteur et haut du fragment stables pendant que la fraction change.

## 5. Vérifications et spec

- [x] 5.1 Lancer `node --check public/app.js` et `node --check test/e2e/reindent.spec.js`.
- [x] 5.2 Lancer la section 12 des tests e2e, toute la suite `npm run test:e2e` (89 tests) et `npm test` (39 vérifications).
- [x] 5.3 Reporter l'exigence modifiée dans `openspec/specs/project-outliner/spec.md` à l'archivage.
- [x] 5.4 Vérifier `CACHE_VERSION` dans `public/sw.js` (`v12`, qui couvre `app.js` et `style.css`).
