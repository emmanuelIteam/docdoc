## Why

Le repli du panneau sur un écran étroit existe, et il est désormais animé — mais il se joue encore sur la page que l'on quitte : on voit le panneau se refermer, puis la page suivante remplacer la précédente. L'ordre est inversé par rapport au geste attendu : c'est la page demandée qui doit apparaître d'abord, et le panneau qui doit se ranger ensuite, une fois la nouvelle page lisible.

## What Changes

- **La navigation part immédiatement** : le lien est suivi sans délai, la page demandée est chargée et s'affiche d'abord, panneau encore ouvert.
- **Le repli se joue sur la page d'arrivée** : une fois le fondu d'apparition terminé, le panneau se referme par un mouvement court de largeur, de remplissage et d'opacité (≈ 240 ms, courbe douce), puis l'état replié est persisté.
- **L'intention de repli traverse le chargement** : elle est déposée dans `sessionStorage` au clic et consommée par la page suivante, ce qui évite de replier le panneau avant la navigation sans pour autant modifier l'URL.
- **La nouvelle page apparaît en fondu** : chaque page de travail — accueil, domaine, administration, aide — s'affiche par une transition d'opacité courte (≈ 200 ms) au chargement, ce qui adoucit le remplacement du document.
- **Le mouvement réduit est respecté** : si `prefers-reduced-motion: reduce` est actif, le panneau est replié dès l'affichage de la page, sans animation ni fondu, et la navigation n'est jamais retardée.
- **Périmètre inchangé** : le seuil d'écran étroit (≤ 640 px), les entrées concernées, les clics modifiés, l'écran large, les routes et les données ne changent pas.

## Capabilities

### New Capabilities

- (aucune)

### Modified Capabilities

- `domain-navigation` : l'exigence « Replier le panneau après l'ouverture d'une page depuis le panneau » est précisée — la page demandée s'affiche d'abord avec le panneau ouvert, le repli est un mouvement animé qui se joue ensuite, l'état est persisté, et le mouvement réduit supprime l'animation — et une exigence « Afficher chaque page en fondu au chargement » est ajoutée.

## Impact

- **`public/app.js`** : au clic sur une entrée du panneau, l'intention de repli est déposée dans `sessionStorage` et la navigation part immédiatement ; la page d'arrivée consume l'intention et programme le repli après le fondu. Les gardes d'écran étroit, de clic modifié et de persistance restent identiques ; la page des passkeys, sans panneau, persiste l'état au clic.
- **`public/style.css`** : transition du panneau élargie (largeur, remplissage, bordure, opacité) avec la courbe et la durée partagées, animation de fondu du contenu au chargement, et neutralisation des deux sous `prefers-reduced-motion: reduce` ; la transition n'est activée qu'une fois l'état persisté peint.
- **`test/e2e/sidebar.spec.js`** : cas vérifiant l'ordre page puis repli (avec mesure des instants de chargement et de repli) et cas de mouvement réduit.
- **`public/sw.js`** : incrément de `CACHE_VERSION`, `style.css` et `app.js` étant précachés.
- **Aucune migration de données** : l'état du panneau vit toujours dans `localStorage`, et l'intention ponctuelle dans `sessionStorage`.
