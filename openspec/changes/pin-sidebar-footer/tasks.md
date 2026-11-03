## 1. Style du panneau

- [x] 1.1 Dans `public/style.css`, donner à `.sidebar` la hauteur d'une fenêtre (`height: 100vh` puis `height: 100dvh`), l'épingler avec `position: sticky; top: 0` et `align-self: start`, et commenter pourquoi (panneau d'une hauteur d'écran, pied toujours visible, liste seule à défiler).
- [x] 1.2 Rendre la liste seule compressible et défilante : `min-height: 0` sur `.sidebar-nav` (elle garde `flex: 1` et `overflow-y: auto`) ; figer `.sidebar-top`, `.sidebar-header` et `.sidebar-footer` avec `flex: 0 0 auto` pour que le pied ne se comprime jamais.
- [x] 1.3 Incrémenter `CACHE_VERSION` dans `public/sw.js` (`style.css` est précaché).

## 2. Tests

- [x] 2.1 Ajouter le cas 1.6 de `test/e2e/sidebar.spec.js` : sur 1280 × 720 avec les deux domaines de fixture, la liste ne défile pas (`scrollHeight` égal à `clientHeight`) et le pied repose au bas de l'écran, sous la liste.
- [x] 2.2 Ajouter le cas 1.7 : créer assez de domaines par `POST /api/domains` pour déborder l'écran, vérifier que seule la liste défile, que le pied reste au bas de l'écran, qu'il y reste après le défilement d'une page plus haute que la fenêtre (`/administration`), et qu'il en va de même sur une fenêtre de téléphone (390 × 844).
- [x] 2.3 Laisser inchangés les cas 1.1 à 1.5 (repli après sélection, persistance, réouverture, écran large).

## 3. Spécifications

- [x] 3.1 Delta `domain-navigation` : nouvelle exigence « Garder le bloc bas du panneau visible au bas de l'écran » et ses scénarios (liste courte, liste longue, page plus haute que l'écran, écran étroit, panneau replié).

## 4. Vérifications

- [x] 4.1 Lancer `node --check test/e2e/sidebar.spec.js`.
- [ ] 4.2 Lancer `npm run test:e2e` (au minimum `test/e2e/sidebar.spec.js`) puis `npm test`.
  - Non exécuté dans la session de rédaction : le sandbox interdit le fork des workers Playwright (`spawn EPERM`). Les cas 1.6 et 1.7 restent à exécuter sur un poste non confiné.
- [ ] 4.3 Vérifier à l'écran le panneau en 1280 px et en 390 px, avec une liste courte puis une liste longue, défilement de la page compris.
  - Non exécuté : Chrome ne démarre pas dans le sandbox de la session (ni `chromium.launch`, ni `--remote-debugging-port`).
- [x] 4.4 Lancer `openspec validate pin-sidebar-footer --strict`.
