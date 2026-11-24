## Why

Le panneau latéral nomme « Accueil » une page qui n'est pas un point de départ neutre mais le tableau de pilotage GTD : le libellé dit d'où l'on vient plutôt que ce qu'on y fait, et rien dans l'interface ne rappelle la méthode. Depuis n'importe quelle page, y revenir demande en plus d'ouvrir le panneau — un geste de trop précisément là où ce retour est le plus fréquent.

## What Changes

- **Entrée du panneau renommée** : « Accueil » devient « GTD » dans la rubrique de tête du panneau. L'ancre (`a.sidebar-link.sidebar-home`), son `href="/"`, sa position avant « Domaines » et son état actif restent inchangés.
- **Titre de la page** : le `<h1>` de `/` passe de « Tableau de bord » à « GTD », et le titre du document avec lui.
- **Sous-titre** : « Getting Things Done » est affiché sous le titre, sur la page GTD uniquement, y compris lorsque le compte n'a encore aucun domaine.
- **Raccourci dans l'en-tête** : un lien « GTD » vers `/` est ajouté immédiatement à droite du bouton ☰, sur chaque page servie par la coque sauf la page GTD — page de domaine, Administration, Aide. Il n'est pas rendu sur la page GTD, où le titre voisin dit déjà « GTD » et où un lien vers la page courante ne servirait à rien ; il reste visible quand le panneau est replié, ne dépend pas de son ouverture et s'active au clavier comme un lien ordinaire.
- **Aide** : les renvois à « la page d'accueil » deviennent « la page GTD » et la section « Ordonner les tâches de l'accueil » devient « Ordonner les tâches GTD ».
- **Aucune rupture** : aucune route, aucun format de donnée, aucune dépendance et aucune migration ne changent. Le raccourci réutilise l'URL `/` existante.

## Capabilities

### New Capabilities

- (aucune)

### Modified Capabilities

- `home-dashboard` : l'entrée de tête du panneau s'appelle « GTD » ; la page porte le titre « GTD » et le sous-titre « Getting Things Done » ; un raccourci GTD est présent dans l'en-tête des pages de la coque autres que la page GTD.
- `domain-navigation` : l'exigence de repli du panneau sur un écran étroit nomme l'entrée « GTD » au lieu de « Accueil ».
- `user-guide` : la page « Aide » nomme la page GTD et non plus la page d'accueil.

## Impact

- **`server.js`** : `renderSidebar` écrit le libellé « GTD » ; `renderShell` rend le raccourci `a.topbar-shortcut` juste après `#sidebar-toggle` sur toutes les pages sauf la page GTD, et regroupe le titre et son sous-titre dans `.topbar-title` ; `renderHomePage` passe `title: 'GTD'` et `subtitle: 'Getting Things Done'` ; `renderGuidePage` remplace les renvois à « la page d'accueil » et renomme la section d'ordonnancement.
- **`rust/src/html.rs`** : mêmes changements dans `render_sidebar`, `render_shell` (nouvelle option `subtitle` de `ShellOptions`, raccourci omis quand `home` est vrai, bloc de titre), `render_home_page` et `render_guide_page`. Les deux implémentations restent alignées.
- **`public/style.css`** : styles `.topbar-title`, `.topbar-subtitle`, `.topbar-shortcut` (taille compacte à côté de ☰, anneau de focus) et, au besoin, une règle dans le bloc `@media (max-width: 640px)`.
- **`public/sw.js`** : incrément de `CACHE_VERSION` (`style.css` est précaché ; `app.js` n'est pas modifié).
- **Tests** : `test/e2e/home.spec.js` (titre, sous-titre, entrée « GTD », raccourci présent sur les pages autres que la GTD et absent de `/`, navigation, écran étroit), `test/e2e/administration.spec.js` (liste des titres de sections de l'Aide), `test/passkey-flow.js` (titre de la page racine) et les cas Rust de `html.rs` et de `mod http_tests` qui cherchent « Tableau de bord » et le raccourci.
- **Aucune migration de données** : seuls des libellés, une structure d'en-tête et des styles changent ; les domaines, l'ordre et les préférences déjà enregistrés restent valides.
