## Why

Sur un écran étroit, chaque ligne de l'outline paie la gouttière de 1,5 rem du contenu (24 px) avant de commencer : à 390 px, le titre d'un projet commence à 60 px du bord de la fenêtre et ne dispose que de 299,6 px de large. Pour les lignes de premier rang — les projets, qui portent les titres les plus longs et sont les plus lues — cette gouttière ne traduit aucune hiérarchie : la profondeur 0 est la racine. Les tâches, elles, la paient en plus de leur indentation. Récupérer 1 rem de cette gouttière sur les seules lignes de premier rang rend 16 px de largeur à chaque titre de projet (299,6 px → 315,6 px, soit +5,3 % à 390 px) sans toucher à la hiérarchie ni à l'indentation des tâches.

## What Changes

- **Marge gauche des lignes de premier rang réduite sur écran étroit** : lorsque la fenêtre fait 640 px de large ou moins, une ligne de profondeur 0 (un projet) est décalée de **1 rem vers la gauche** par rapport à sa position de bureau. Son retrait gauche passe de 1,5 rem (la gouttière du contenu) à **0,5 rem** ; son fond de survol et de sélection reste à 8 px du bord de la fenêtre. Le seuil est **inclusif** (640 px → réduit, 641 px → marge de bureau).
- **Les autres lignes ne bougent pas** : une ligne de profondeur 1 garde son décalage de 0,8 rem, une ligne de profondeur 2 son 25,6 px, etc. Le pas d'indentation de 0,8 rem par niveau est inchangé ; le seul effet sur la hiérarchie est que l'écart visuel entre un projet et ses tâches passe de 0,8 rem à 1,8 rem, ce qui renforce la distinction projet / tâche.
- **Réduction purement visuelle et en CSS** : aucun changement de `data-depth`, `data-parent`, de l'ordre d'affichage ni des routes. La bascule suit le redimensionnement et la rotation sans rechargement.
- **La ligne épinglée suit** : dans la barre de hiérarchie, la ligne épinglée qui représente un projet prend la même marge réduite, afin de rester exactement alignée avec la ligne qu'elle représente.
- **La barre ne rogne rien** : la barre et chacune de ses lignes rendent la même 1 rem à gauche et la reprennent en padding. Sans cela, la ligne épinglée d'un projet — décalée de 1 rem dans une barre qui masque ce qui dépasse — perdrait le début de sa puce ; avec, elle arrive exactement sur le bord de sa ligne, les autres lignes épinglées ne bougent pas et la barre conserve la largeur de la page (aucun défilement horizontal).
- **Le fantôme de glisser suit** : le clone d'une ligne de premier rang, décalé de 1 rem dans le fantôme tactile, reçoit un padding équivalent pour ne pas être rogné par son `overflow: hidden`.
- **L'indicateur de dépôt racine suit** : l'anneau affiché autour de l'outline pendant un glisser vers la racine est dessiné à partir du bord gauche des lignes de premier rang, et non plus du bord de la boîte de l'outline, qu'il traverserait désormais.
- **Hors périmètre** : le pas d'indentation mobile (0,8 rem), la marge gauche des lignes de profondeur ≥ 1, la gouttière de droite (1,5 rem), la hauteur des lignes, la puce, le menu contextuel, la gouttière du reste de la page (titre du domaine, barre d'étiquettes) et le panneau latéral. Aucun changement du modèle persisté ni migration de données.
- **Cache PWA** : `CACHE_VERSION` est incrémenté, `style.css` et `app.js` étant des fichiers précachés.

## Capabilities

### New Capabilities

Aucune.

### Modified Capabilities

- `project-outliner` : nouvelle exigence **Réduire la marge gauche des lignes de premier rang sur écran étroit** (décalage de 1 rem des lignes de profondeur 0 sous 640 px, seuil inclusif, invariants de profondeur et d'ordre, bascule sans rechargement, ligne épinglée alignée). L'exigence **Réduire le pas d'indentation sur écran étroit** est précisée : le pas de 0,8 rem s'applique à partir des lignes de profondeur 1, et la marge des lignes de premier rang relève de la nouvelle exigence. L'exigence de la barre épinglée n'est pas modifiée (elle exige déjà l'alignement exact, que la nouvelle marge respecte).
- `outline-display-order` : l'exigence de rendu plat est précisée — sur un écran étroit, les lignes de premier rang peuvent être désindentées de 1 rem ; les autres lignes restent indentées de *n* niveaux depuis le bord de l'outline.

## Impact

- **`public/style.css`** : variable `--outline-first-rank-shift` (0 rem par défaut, 1 rem sous `@media (max-width: 640px)`), marge négative des lignes et des lignes épinglées de profondeur 0, barre de hiérarchie et lignes épinglées élargies et complétées en padding pour ne rien rogner, padding du fantôme de glisser, et anneau de dépôt racine dessiné par un pseudo-élément décalé.
- **`public/app.js`** : la ligne épinglée expose sa profondeur dans `data-depth` (une ligne), afin que la même règle CSS s'applique à elle.
- **`public/sw.js`** : `CACHE_VERSION` incrémenté (`v13` → `v15` par ce change ; l'arbre porte `v16`, un change voisin l'ayant relevé ensuite).
- **`test/e2e/reindent.spec.js`** : section 7 mise à jour (marges attendues à 390 px et 640 px, seuil à 641 px), nouveau cas sur l'alignement de la ligne épinglée d'un projet à 390 px et nouveau cas sur l'anneau de dépôt racine.
- **Aucun impact** sur `server.js`, `storage.js`, les données, les routes, l'authentification, l'indentation, le réindent, l'ordre persisté ou le glisser-déposer.
- **Vérification** : `npx playwright test test/e2e/reindent.spec.js`, `npm test`, puis `openspec validate reduce-first-rank-margin-on-narrow-screens --strict`.
- **Retour arrière** : remettre `--outline-first-rank-shift` à 0 rem et l'anneau de dépôt sur la boîte de l'outline ; aucune donnée n'est concernée.
