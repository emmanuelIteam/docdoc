## Why

Sur un smartphone, la barre d'étiquettes est fixée en bas à droite et peut être large de presque tout l'écran. Quand le panneau latéral est affiché, elle recouvre le bas du panneau : le lien « Gérer mes passkeys » et le bouton « Déconnexion » deviennent incliquables — le test e2e le constate, la barre intercepte le clic. La navigation dans le panneau est justement le moment où l'on veut atteindre ces commandes.

## What Changes

- **La barre s'efface tant que le panneau est affiché sur un écran étroit** (≤ 640 px) : elle ne recouvre plus le panneau ni sa boîte de session, et le lien passkeys comme la déconnexion restent cliquables.
- **Elle revient dès que le panneau est replié**, avec le même contenu et le même comportement (rattacher ou détacher une étiquette).
- **Écran large inchangé** : au-dessus de 640 px, la barre reste affichée même quand le panneau est ouvert.
- **Aucun JavaScript, aucune donnée** : la règle s'appuie sur la classe `sidebar-collapsed` déjà portée par `<body>` ; seul `style.css` change.

## Capabilities

### New Capabilities

- (aucune)

### Modified Capabilities

- `theme-management` : l'exigence de la barre d'étiquettes gagne la règle d'effacement derrière le panneau latéral sur un écran étroit, sans changer ce que la barre affiche ni comment elle agit quand elle est visible.

## Impact

- **`public/style.css`** : dans la requête média à 640 px, masquer `.labels-bar` tant que `<body>` ne porte pas `sidebar-collapsed`.
- **`public/sw.js`** : incrément de `CACHE_VERSION`, `style.css` étant précaché.
- **`test/e2e/sidebar.spec.js`** : le lien passkeys est de nouveau atteint depuis une page de domaine, et un cas vérifie que la barre s'efface puis revient au repli du panneau (et reste affichée à 1280 px).
- **Aucune migration** : rien n'est persisté de nouveau.
