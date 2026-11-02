## 1. Styles

- [x] 1.1 Ajouter `.line { min-height: 2.75rem; }` dans la requête de média `@media (max-width: 640px)` existante de `public/style.css`, avec un commentaire expliquant la cible tactile.
- [x] 1.2 Vérifier qu'aucune autre règle ne fixe la hauteur de `.line` (padding, `height`, `line-height` du titre) et que la hauteur compacte reste le défaut hors media query.
- [x] 1.3 Vérifier que le menu contextuel, le champ d'édition `.title-input` et la puce restent centrés dans la ligne de 44 px sans décalage du caret.

## 2. Tests

- [x] 2.1 Ajouter un helper `lineHeights` (lecture de `getBoundingClientRect().height` par `data-id`) et un fixture dédié à un titre long dans `test/e2e/reindent.spec.js`, sans modifier les fixtures existantes.
- [x] 2.2 Asserter la hauteur compacte (~21,3 px, tolérance d'un demi-pixel) à 1280 × 720 et la hauteur d'au moins 44 px à 390 × 844.
- [x] 2.3 Asserter que le seuil de 640 px est inclusif : 640 px → 44 px, 641 px → hauteur compacte.
- [x] 2.4 Asserter la bascule live (marqueur `window.__noReload` conservé, hauteurs mises à jour dans les deux sens) et l'invariance de `data-depth`, `data-parent` et de l'ordre affiché.
- [x] 2.5 Asserter qu'un titre long à 390 px fait grandir la ligne au-delà de 44 px, s'affiche sur plusieurs lignes et n'est ni tronqué ni débordant.
- [x] 2.6 Élargir l'en-tête du fichier e2e à l'espacement vertical (section 8) et vérifier que les tests existants ne sont pas modifiés.

## 3. Vérification

- [x] 3.1 Lancer `npx playwright test` : 45/45, dont les nouveaux tests 8.1 à 8.5.
- [x] 3.2 Lancer `npm test` : 39/39.
- [x] 3.3 Lancer `openspec validate increase-line-spacing-on-narrow-screens --strict` : valide.
- [ ] 3.4 Recette manuelle sur un téléphone : à 390 px de large, les lignes font au moins 44 px et sont faciles à viser ; un titre long revient à la ligne sans être coupé ; en paysage (844 × 390), la hauteur reste compacte ; la bascule autour de 640 px se fait sans rechargement.

## Note de vérification

L'arbre de travail héberge en parallèle deux changes d'une autre session (`add-pwa-support` et `add-touch-drag-handle`) : `server.js`, `public/app.js`, `public/style.css` (puce tactile, poignée de glisser) et un nouveau `test/e2e/pwa.spec.js`. La seule modification de ce change est la règle `.line { min-height: 2.75rem; }` dans la media query existante (7 lignes de diff, dont le commentaire) ; l'un des tests de la section 9 s'appuie même dessus pour sa cible de 44 px.

Les deux suites ont été rejouées sur l'arbre partagé :

- `npx playwright test` avec `E2E_PORT=3599` → **45/45**, dont 8.1 (1280 px : ~21,3 px), 8.2 (390 px : 44 px), 8.3 (640 px : 44 px ; 641 px : compact), 8.4 (bascule live et invariants) et 8.5 (titre long sur plusieurs lignes, aucun débordement).
- Un premier essai sur le port 3499 a échoué en `EADDRINUSE` (exécution concurrente sur le même port), d'où le rejeu sur 3599.
- `npm test` → **39/39** (le total inclut les vérifications des changes voisins présents dans l'arbre).
- `openspec validate --strict` → valide.

La recette 3.4 reste à faire sur un téléphone physique : les équivalents automatisés couvrent 390 / 640 / 641 px, et le paysage 844 px reste compact par construction (au-dessus du seuil), mais le ressenti au doigt ne se teste pas en headless.
