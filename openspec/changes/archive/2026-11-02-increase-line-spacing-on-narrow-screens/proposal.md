## Why

Sur un téléphone, une ligne de l'outline est haute d'environ 21 px (police de 16 px, `line-height` 1.25, `padding` vertical de 0,04 rem). C'est deux fois moins que les 44 px communément retenus pour une cible tactile : deux lignes voisines se partagent une bande de contact de 21 px, donc un doigt qui vise une ligne touche souvent sa voisine, et la puce de sélection — large de 11,2 px seulement — est difficile à atteindre. L'utilisateur demande d'espacer un peu les lignes sur smartphone, sans changer la densité de l'outline sur ordinateur.

## What Changes

- **Espacement vertical élargi sur écran étroit** : à 640 px de large et en dessous, chaque ligne de l'outline a une **hauteur minimale de 2,75 rem (44 px à la taille de police par défaut de 16 px)**, son contenu restant centré verticalement. Au-dessus de 640 px, la présentation compacte actuelle est conservée (environ 21 px).
- **`min-height`, pas `height`** : une ligne dont le titre revient sur plusieurs lignes grandit au-delà de 44 px et n'est jamais tronquée. Aucun `nowrap`, aucune ellipse.
- **Agrandissement purement visuel et CSS** : la profondeur de chaque ligne (`data-depth`), son parent (`data-parent`), l'ordre d'affichage, les titres et la hiérarchie sont inchangés. La bascule suit le redimensionnement et la rotation sans rechargement ni requête.
- **Hors périmètre** : élargir la cible de la puce (11,2 px de large), révéler la puce au toucher, agrandir les items du menu contextuel (28,8 px), replier automatiquement le panneau latéral, le pas d'indentation (déjà réduit de moitié sur écran étroit), et toute modification de la densité sur ordinateur. Ce sont des leviers voisins, à traiter dans des changes séparés si le besoin se confirme.
- **Aucun changement** du modèle persisté, des routes, du stockage, de l'authentification, ni aucune migration de données.

## Capabilities

### New Capabilities

Aucune : l'espacement vertical des lignes est déjà une exigence de `project-outliner` ; cette évolution en modifie la portée selon la largeur de la fenêtre.

### Modified Capabilities

- `project-outliner` : l'exigence **Render lines with compact vertical spacing** devient **« espacement compact sur écran large, hauteur tactile minimale sur écran étroit »** (au moins 2,75 rem à 640 px et en dessous), avec les scénarios écran large, écran étroit, seuil inclusif, redimensionnement sans rechargement et titre sur plusieurs lignes. Les autres exigences (rendu plat, sélection, menu, glisser-déposer, liens profonds, pas d'indentation) restent inchangées.
- `outline-display-order` : **non modifiée**. Elle décrit la position verticale issue de l'ordre d'affichage, que l'espacement ne change pas.

## Impact

- **`public/style.css`** : règle `min-height` sur `.line` ajoutée dans la requête de média `@media (max-width: 640px)` existante (celle du pas d'indentation). C'est le seul fichier applicatif touché.
- **Aucun impact** sur `server.js`, `public/app.js`, `storage.js`, les routes, l'authentification, S3, le glisser-déposer, le réindent ou l'ordre persisté.
- **Tests** : nouvelle section 8 dans `test/e2e/reindent.spec.js`, qui réutilise son harnais (serveur + enrôlement par passkey) : hauteurs calculées à 1280 / 640 / 641 / 390 px, bascule live au redimensionnement, invariants (`data-depth`, `data-parent`, ordre), et titre long qui dépasse 44 px sans troncature. Les tests existants ne sont pas modifiés.
- **Vérification** : `npx playwright test`, `npm test`, puis `openspec validate increase-line-spacing-on-narrow-screens --strict`.
- **Coût accepté** : à 390 × 844, l'écran affiche environ 13 lignes au lieu d'environ 28 ; c'est le prix d'une cible tactile utilisable, et le défilement de la page n'est pas modifié.
