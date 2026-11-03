## 1. Structure et rendu serveur

- [x] 1.1 Dans `renderShell`, poser `id="topbar"` sur `.topbar` et y rendre un `<nav class="ancestry" id="ancestry" aria-label="Hiérarchie des tâches mères">` vide lorsque `opts.ancestry` est vrai ; laisser les autres pages inchangées.
- [x] 1.2 Activer `ancestry: true` dans les options de `renderPage` (page d'un domaine uniquement), sans toucher à la page vide, à l'administration, à l'aide ni aux pages d'accès.

## 2. Comportement client

- [x] 2.1 Dans `public/app.js`, ajouter une initialisation « barre collante » qui ne s'active que si `#topbar` et `#ancestry` existent.
- [x] 2.2 Calculer la première ligne visible : bas de l'en-tête, puis dichotomie sur les `.line` de `#outline` dont le bas dépasse cette limite.
- [x] 2.3 Construire la chaîne d'ancêtres en remontant `data-parent`, du plus lointain au plus proche, et lire chaque libellé dans `.title` (`textContent`).
- [x] 2.4 Ne réécrire le `<nav>` que lorsque la suite d'ids et de libellés change ; chaque maillon est un lien `#node-<id>` avec un chevron et une profondeur d'indentation propre.
- [x] 2.5 Recalculer au défilement (`requestAnimationFrame`), au redimensionnement, au basculement du panneau latéral et après `htmx:afterSwap` / `htmx:afterSettle` ; publier la hauteur de l'en-tête dans `--topbar-height` et poser la classe `is-stuck` quand il est collé.
- [x] 2.6 Mesurer une fois la hauteur de la chaîne la plus profonde possible (sonde hors flux) et publier `--chain-reserve` ; publier la hauteur courante de la chaîne dans `--chain-height` pour que la réserve de bas de page garde la hauteur du document constante.

## 3. Style

- [x] 3.1 Rendre `.topbar` `position: sticky` en haut, opaque, au-dessus des lignes mais sous le menu contextuel et la barre d'étiquettes ; faire passer la chaîne sur sa propre ligne et dans le flux de l'en-tête.
- [x] 3.2 Empiler `#ancestry` verticalement (une ligne par niveau, indentation croissante, chevron, troncature avec ellipse) et lui donner un plafond de hauteur avec défilement interne pour les branches très profondes.
- [x] 3.3 Ajouter `scroll-margin-top` aux `.line` en fonction de `--topbar-height` (repli sans JavaScript).
- [x] 3.4 Réserver au bas de la page la hauteur de la chaîne la plus profonde moins la hauteur courante (`--chain-reserve` / `--chain-height`) et désactiver l'ancrage de défilement dans `main`, pour que la hauteur variable de l'en-tête ne fasse ni sauter ni osciller la fin de page.
- [x] 3.5 Sur un écran étroit (≤ 640 px), réduire la police et le pas d'indentation de la chaîne, sans dépasser la largeur de la fenêtre.

## 4. Aide et PWA

- [x] 4.1 Ajouter dans `renderGuidePage` une section décrivant la barre collante, la chaîne sur plusieurs lignes et la navigation par la chaîne.
- [x] 4.2 Incrémenter `CACHE_VERSION` dans `public/sw.js`.

## 5. Tests et vérifications

- [x] 5.1 Ajouter une fixture profonde et une section 12 à `test/e2e/reindent.spec.js`.
- [x] 5.2 Couvrir la barre collée en haut avec le nom du domaine visible après défilement, à 1280 px.
- [x] 5.3 Couvrir la chaîne empilée (une ligne par niveau, indentation croissante, dans le flux de l'en-tête), son suivi du défilement, son absence sur un projet racine et sa mise à jour après un re-rendu htmx.
- [x] 5.4 Couvrir la navigation par un maillon (la ligne ciblée s'arrête sous la barre) et l'affichage de la chaîne à 390 px.
- [x] 5.5 Couvrir la stabilité en fin de page : la position de défilement ne bouge plus et la chaîne décrit toujours la première ligne visible.
- [x] 5.6 Reporter l'exigence dans `openspec/specs/project-outliner/spec.md`.
- [x] 5.7 Lancer `node --check server.js`, `node --check public/app.js` et `npm run test:e2e`, puis vérifier le rendu par capture d'écran.
