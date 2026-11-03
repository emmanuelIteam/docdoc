## 1. Comportement client

- [x] 1.1 Dans `public/app.js`, factoriser la bascule de l'état replié dans `setSidebarCollapsed(collapsed)`, qui pose la classe `sidebar-collapsed` sur `<body>` et écrit la clé `sidebarCollapsed` dans `localStorage` ; faire passer le bouton `#sidebar-toggle` par cette fonction sans changer son comportement.
- [x] 1.2 Ajouter un écouteur `click` délégué sur `document` qui reconnaît un lien `.sidebar-link` de `.sidebar-nav` (un domaine, à l'exclusion des entrées Administration et Aide), ignore les clics modifiés (`Ctrl`, `Cmd`, `Shift`, `Alt`) et un bouton autre que le principal, puis replie le panneau quand `window.matchMedia('(max-width: 640px)').matches` ; ne pas annuler la navigation.
- [x] 1.3 Laisser `applySidebarState()` inchangé pour que la page du domaine choisi soit rendue panneau replié dès le chargement.

## 2. Tests

- [x] 2.1 Créer `test/e2e/sidebar.spec.js` sur le modèle de `test/e2e/administration.spec.js` (serveur enfant, port libre, état de session enregistré) avec deux domaines de fixture (`e2e` et `e2e2`) importés à l'enrôlement.
- [x] 2.2 Couvrir la sélection à 390 × 844 : le panneau est ouvert, le clic sur le domaine `e2e2` charge sa page, le panneau est replié et `localStorage.sidebarCollapsed` vaut `'1'`.
- [x] 2.3 Couvrir la persistance : après rechargement, le panneau reste replié ; le bouton ☰ le rouvre et efface la clé.
- [x] 2.4 Couvrir l'écran large à 1280 px : la sélection d'un domaine laisse le panneau ouvert et la clé absente.
- [x] 2.5 Couvrir les entrées du pied sur écran étroit : Administration et Aide ne replient pas le panneau.

## 3. Spec et PWA

- [x] 3.1 Reporter l'exigence dans `openspec/specs/domain-navigation/spec.md` à l'archivage du changement.
- [x] 3.2 Incrémenter `CACHE_VERSION` dans `public/sw.js`.

## 4. Vérifications

- [x] 4.1 Lancer `node --check public/app.js` et `node --check test/e2e/sidebar.spec.js`.
- [x] 4.2 Lancer `npm run test:e2e` et vérifier que la nouvelle suite passe avec les suites existantes.
