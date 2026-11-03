## 1. Style

- [x] 1.1 Dans la requête média `(max-width: 640px)` de `public/style.css`, ajouter `body:not(.sidebar-collapsed) .labels-bar { display: none; }` avec un commentaire expliquant que la barre s'efface derrière le panneau affiché pour ne pas recouvrir sa boîte de session.

## 2. Tests

- [x] 2.1 Dans `test/e2e/sidebar.spec.js`, atteindre de nouveau le lien passkeys depuis une page de domaine (le contournement par l'accueil n'est plus nécessaire).
- [x] 2.2 Ajouter un cas à 390 px : panneau déployé → barre d'étiquettes masquée ; ☰ replie le panneau → barre affichée ; ☰ le rouvre → barre masquée de nouveau ; à 1280 px avec le panneau déployé → barre affichée.

## 3. Spec et PWA

- [ ] 3.1 Reporter l'exigence dans `openspec/specs/theme-management/spec.md` à l'archivage du changement.
- [x] 3.2 Incrémenter `CACHE_VERSION` dans `public/sw.js`.

## 4. Vérifications

- [x] 4.1 Lancer `node --check test/e2e/sidebar.spec.js`.
- [x] 4.2 Lancer la suite `test/e2e/sidebar.spec.js`, puis `npm run test:e2e` et `npm test`.
- [x] 4.3 Lancer `openspec validate hide-labels-bar-while-sidebar-open --strict`.
