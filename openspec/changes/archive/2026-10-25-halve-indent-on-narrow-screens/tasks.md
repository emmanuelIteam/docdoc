## 1. Styles

- [x] 1.1 Déclarer `--outline-indent: 1.6rem` sur `.outline` dans `public/style.css`, avec un commentaire expliquant la réduction sur écran étroit.
- [x] 1.2 Remplacer le pas codé en dur de `.line` par `margin-left: calc(var(--depth, 0) * var(--outline-indent, 1.6rem))`.
- [x] 1.3 Ajouter `@media (max-width: 640px) { .outline { --outline-indent: .8rem; } }` juste après la règle `.outline`.
- [x] 1.4 Vérifier qu'aucune autre règle ne dépend d'un pas d'indentation codé en dur (puce, gaps, menu, padding) et que le pas plein reste le défaut hors media query.

## 2. Tests

- [x] 2.1 Ajouter une fixture dédiée aux profondeurs 0, 1 et 2 (`a` → `b` → `c`) dans `test/e2e/reindent.spec.js`, sans modifier les fixtures existantes.
- [x] 2.2 Asserter les marges calculées à 1280×720 (0 / 25,6 / 51,2 px) et à 390×844 (0 / 12,8 / 25,6 px).
- [x] 2.3 Asserter les bornes du seuil sur la profondeur 2 : 640 px → 25,6 px, 641 px → 51,2 px.
- [x] 2.4 Asserter la bascule live (marqueur `window` conservé, marges mises à jour dans les deux sens) et l'invariance de `data-depth`, `data-parent` et de l'ordre affiché.
- [x] 2.5 Élargir l'en-tête du fichier e2e à l'indentation (clavier et largeur de fenêtre) et vérifier que les tests existants ne sont pas modifiés.

## 3. Vérification

- [x] 3.1 Lancer `npx playwright test` : 17/17 en isolation (13 tests existants + 7.1 à 7.4).
- [x] 3.2 Lancer `npm test` : 38/38 en isolation.
- [x] 3.3 Lancer `openspec validate halve-indent-on-narrow-screens --strict` : valide.
- [x] 3.4 Recette manuelle : à 390 px panneau replié, le titre d'une ligne de profondeur 3 gagne ~38 px ; bascule autour de 640 px ; paysage 844×390 → pas plein.

## Note de vérification

L'arbre de travail héberge en parallèle l'implémentation du change `add-administration-page` (modifications de `server.js`, `public/app.js`, `storage.js`, `public/style.css` et nouveau `test/e2e/administration.spec.js`). La suite complète lancée sur l'arbre partagé est donc rouge pour des raisons étrangères à ce change : `npm test` attend encore une redirection vers `/domaine/...` là où l'administration redirige vers `/administration`, et le test 6.8 de `reindent.spec.js` attend le champ de renommage de thème que ce change retire du panneau.

Pour isoler ce change, les deux suites ont été rejouées dans un worktree sur `HEAD` + uniquement `public/style.css` et `test/e2e/reindent.spec.js` de ce change :

- `node test/passkey-flow.js` → **38/38** ;
- `npx playwright test` → **17/17**, dont les quatre nouveaux tests 7.1 à 7.4.

La recette manuelle 3.4 a été faite sur un vrai téléphone : à 390 px panneau replié, le titre d'une ligne de profondeur 3 gagne environ 38 px ; la bascule se fait autour de 640 px ; en paysage 844×390, le pas reste plein.
