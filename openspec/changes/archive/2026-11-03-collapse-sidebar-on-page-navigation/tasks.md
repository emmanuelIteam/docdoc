## 1. Comportement client

- [x] 1.1 Dans `public/app.js`, remplacer le sélecteur de l'écouteur délégué `.sidebar-nav a.sidebar-link` par `#sidebar a[href]`, et mettre à jour le commentaire : toute entrée du panneau qui ouvre une page referme le panneau sur un écran étroit.
- [x] 1.2 Laisser inchangés la garde `(max-width: 640px)`, la persistance via `setSidebarCollapsed(true)` et l'exclusion des clics modifiés (`Ctrl`, `Cmd`, `Shift`, `Alt`), d'un bouton autre que le principal et d'un événement déjà annulé.

## 2. Tests

- [x] 2.1 Inverser et étendre le cas 1.4 de `test/e2e/sidebar.spec.js` : à 390 px, Accueil, Administration, Aide et la gestion des passkeys referment le panneau, et la page chargée arrive repliée ; rouvrir le panneau avec ☰ entre deux entrées.
- [x] 2.2 Ajouter un cas d'écran large à 1280 px : Accueil et Administration laissent le panneau ouvert et n'écrivent pas la clé.
- [x] 2.3 Laisser inchangés les cas 1.1 à 1.3 (domaine, persistance et réouverture par ☰, écran large pour un domaine).

## 3. Spec et PWA

- [x] 3.1 Reporter la nouvelle exigence dans `openspec/specs/domain-navigation/spec.md` à l'archivage du changement (delta : retrait de l'exigence limitée aux domaines, ajout de l'exigence élargie).
- [x] 3.2 Incrémenter `CACHE_VERSION` dans `public/sw.js`.

## 4. Vérifications

- [x] 4.1 Lancer `node --check public/app.js` et `node --check test/e2e/sidebar.spec.js`.
- [x] 4.2 Lancer la suite `test/e2e/sidebar.spec.js`, puis `npm run test:e2e` et `npm test`.
- [x] 4.3 Lancer `openspec validate collapse-sidebar-on-page-navigation --strict`.
