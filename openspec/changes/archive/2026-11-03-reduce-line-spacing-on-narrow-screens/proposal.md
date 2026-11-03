## Why

Depuis le change `increase-line-spacing-on-narrow-screens`, chaque ligne de l'outline mesure au moins 2,75 rem (44 px) sur un écran de 640 px ou moins. Cette bande de 44 px, choisie pour la cible tactile WCAG 2.5.5, laisse à l'usage trop d'air autour des titres : sur un téléphone, l'outline paraît aéré et affiche moins de tâches par écran qu'attendu. Une réduction de 10 % garde une ligne largement tapable au doigt tout en resserrant la liste.

## What Changes

- **Hauteur minimale mobile réduite de 10 %** : 2,75 rem → **2,475 rem** (39,6 px à la taille de police racine de 16 px) lorsque la fenêtre fait 640 px de large ou moins. Le seuil reste **640 px, inclusif** ; à 641 px, la présentation compacte de bureau (~21 px) est inchangée.
- **Réduction purement visuelle et en CSS** : `min-height` seulement. Un titre qui revient sur plusieurs lignes grandit toujours au-delà de 39,6 px, sans troncature ni ellipse. Profondeur (`data-depth`), parent (`data-parent`), ordre d'affichage et hiérarchie sont inchangés ; la bascule suit le redimensionnement et la rotation sans rechargement.
- **Compromis tactile assumé** : la cible de 44 px (WCAG 2.5.5, niveau AAA) est abandonnée à la demande du propriétaire du produit. La cible de 24 × 24 px de la puce (WCAG 2.2 AA, 2.5.8) est conservée, et la ligne entière reste tapable sur 39,6 px de haut.
- **Hors périmètre** : l'indentation mobile (0,8 rem), la taille de la puce, le menu contextuel, la barre d'étiquettes et l'espacement du bureau ne changent pas.
- **Cache PWA** : `CACHE_VERSION` est incrémenté, `style.css` étant un fichier précaché.

## Capabilities

### New Capabilities

Aucune.

### Modified Capabilities

- `project-outliner` : l'exigence **Render lines with compact vertical spacing** passe de « au moins 2,75 rem (44 px) » à « au moins 2,475 rem (39,6 px) » sous 640 px, avec les mêmes scénarios (écran large, écran étroit, seuil inclusif, titre sur plusieurs lignes, invariants, redimensionnement). Aucune autre exigence n'est modifiée.

## Impact

- **`public/style.css`** : valeur de `min-height` de `.line` dans la requête `@media (max-width: 640px)` existante (2,75 rem → 2,475 rem) et commentaire associé ; commentaire de la règle `.bullet` mis à jour. C'est le seul fichier applicatif touché avec `public/sw.js`.
- **`public/sw.js`** : `CACHE_VERSION` incrémenté pour que les navigateurs déjà équipés prennent la nouvelle feuille de style.
- **`test/e2e/reindent.spec.js`** : section 8 (hauteur tactile) mise à jour de 44 px à 39,6 px ; aucune autre section modifiée.
- **Aucun impact** sur `server.js`, `public/app.js`, `storage.js`, les données, les routes ou l'authentification.
- **Vérification** : `npx playwright test`, `npm test`, puis `openspec validate reduce-line-spacing-on-narrow-screens --strict`.
- **Retour arrière** : remettre `min-height: 2.75rem` et les bornes de test à 44 px ; aucune donnée n'est concernée.
