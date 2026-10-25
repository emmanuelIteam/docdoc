## Why

Sur un écran étroit, le pas d'indentation de 1,6 rem par niveau consomme une part disproportionnée de la largeur utile. À 390 px de large (panneau latéral replié), le titre d'une ligne de profondeur 3 ne dispose que d'environ 236 px et celui d'une profondeur 5 d'environ 184 px : des tâches qui tiennent sur une ligne en profondeur 0 passent à la ligne dès qu'elles sont un peu imbriquées. Réduire le pas de moitié sur les écrans étroits rend ces lignes plus lisibles sans changer la hiérarchie ni la profondeur.

## What Changes

- **Pas d'indentation divisé par deux sur écran étroit** : 1,6 rem par niveau lorsque la fenêtre fait plus de 640 px, 0,8 rem — la moitié exacte — à 640 px et en dessous. Le seuil est **inclusif** (640 px → moitié, 641 px → pas plein).
- **Réduction purement visuelle** : la profondeur portée par chaque ligne (`data-depth`), son parent, l'ordre d'affichage et la hiérarchie sont inchangés. Aucune route, aucun stockage, aucun re-rendu : la bascule suit le redimensionnement et la rotation sans rechargement.
- **Le succès est « plus de place », pas « une seule ligne »** : aucun `nowrap`, aucune ellipse. Un titre long peut toujours revenir à la ligne ; l'exigence ne garantit pas qu'une tâche tienne sur une ligne.
- **Hors périmètre** : le panneau latéral (240 px, automatisation de son repli), le padding du contenu, la liste thématique du panneau et l'usage tactile (puce révélée au survol, glisser-déposer HTML5). Ce sont des leviers voisins, à traiter dans des changes séparés si le besoin se confirme.
- **Aucun changement** du modèle persisté, du format des domaines, des thèmes, de l'authentification, ni aucune migration de données.

## Capabilities

### New Capabilities

Aucune : l'indentation est déjà une exigence de `project-outliner` ; cette évolution en ajoute une portant sur la taille du pas.

### Modified Capabilities

- `project-outliner` : nouvelle exigence **Réduire le pas d'indentation sur écran étroit** (1,6 rem au-dessus de 640 px, 0,8 rem à 640 px et en dessous), avec les scénarios écran large, écran étroit, seuil, profondeur inchangée et bascule sans rechargement. Les exigences de rendu plat, d'ordre d'affichage et d'indentation par profondeur restent inchangées.
- `outline-display-order` : **non modifiée**. Elle décrit le lien profondeur ↔ position et ne fixe aucun pas ; « Indentation follows the depth » reste vraie quel que soit le pas.

## Impact

- **`public/style.css`** : variable `--outline-indent` (1,6 rem par défaut), `margin-left` de `.line` calculé à partir d'elle, et override à 0,8 rem sous `@media (max-width: 640px)`. C'est le seul fichier applicatif touché.
- **Aucun impact** sur `server.js`, `public/app.js`, `storage.js`, les routes, l'authentification, S3, le glisser-déposer, le réindent ou l'ordre persisté.
- **Tests** : nouveaux cas responsive dans `test/e2e/reindent.spec.js`, qui réutilise son harnais (serveur + enrôlement par passkey) plutôt que d'en dupliquer les ~200 lignes : profondeurs 0 à 2, viewports 390 / 640 / 641 / 1280, bascule live au redimensionnement, `data-depth`, `data-parent` et ordre inchangés. Les tests existants du fichier ne sont pas modifiés.
- **Vérification** : `npx playwright test`, `npm test`, puis `openspec validate halve-indent-on-narrow-screens --strict`.
- **Risque connu et accepté** : à 320 px de large, une ligne de profondeur 5 dispose d'environ 178 px (~24 caractères) ; le retour à la ligne reste fréquent. C'est cohérent avec le critère retenu (« plus de place »), pas avec une garantie « une seule ligne ». Le panneau latéral ouvert (240 px) reste le premier consommateur d'espace sur un téléphone.
