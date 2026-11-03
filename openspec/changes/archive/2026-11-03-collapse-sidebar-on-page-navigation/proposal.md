## Why

Sur un smartphone, le panneau latéral ne se replie aujourd'hui que lorsqu'on y choisit un domaine. Les autres entrées qui ouvrent une page — Accueil, Administration, Aide, Gestion des passkeys — laissent le panneau ouvert après le chargement : la page demandée s'affiche dans la bande étroite qui reste, et il faut la refermer à la main (☰) alors que la navigation était précisément le geste qui devait y donner accès.

## What Changes

- **Toute entrée du panneau qui ouvre une page referme le panneau sur un écran étroit** (≤ 640 px) : Accueil, un domaine, Administration, Aide et l'accès à la gestion des passkeys. Le repli se produit avant la navigation, donc la page demandée arrive déjà en pleine largeur.
- **Même état, même bouton** : le repli emprunte l'état persisté déjà utilisé par ☰ et par la sélection d'un domaine ; il survit au rechargement et le bouton rouvre le panneau.
- **Les commandes qui n'ouvrent pas de page sont inchangées** : « Installer l'application » (bouton) et « Déconnexion » (formulaire) ne replient pas le panneau ; seul le clic sur un lien de page le fait.
- **Écran large inchangé** : au-dessus de 640 px, le panneau reste affiché pour naviguer entre domaines et pages.
- **Clic modifié inchangé** : un clic avec `Ctrl`, `Cmd`, `Shift` ou `Alt` (nouvel onglet, nouvelle fenêtre) laisse l'état du panneau de la page courante intact.
- **Aucun changement de rendu, de route ni de données** : seul l'écouteur client est élargi.

## Capabilities

### New Capabilities

- (aucune)

### Modified Capabilities

- `domain-navigation` : l'exigence « Replier le panneau après la sélection d'un domaine sur un écran étroit » est remplacée par une exigence qui couvre toute entrée du panneau ouvrant une page (Accueil, domaine, Administration, Aide, gestion des passkeys), les autres comportements du panneau restant inchangés.

## Impact

- **`public/app.js`** : l'écouteur délégué du panneau vise désormais tout lien de page contenu dans le panneau (`#sidebar a[href]`) au lieu des seuls liens de domaine ; la garde d'écran étroit, la persistance et l'exclusion des clics modifiés restent identiques.
- **`test/e2e/sidebar.spec.js`** : le cas 1.4 (qui vérifiait l'absence de repli sur Accueil, Administration et Aide) est inversé et étendu à la gestion des passkeys ; un cas d'écran large vérifie que ces entrées ne replient pas le panneau.
- **`public/sw.js`** : incrément de `CACHE_VERSION`, `app.js` étant précaché.
- **Aucune migration de données** : l'état vit dans `localStorage`, comme le repli manuel.
