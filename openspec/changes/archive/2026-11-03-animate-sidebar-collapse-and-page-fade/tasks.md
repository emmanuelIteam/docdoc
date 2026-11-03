## 1. Mouvement du panneau et fondu de la page (CSS)

- [x] 1.1 Dans `public/style.css`, déclarer la durée et la courbe partagées (`--panel-motion`, `--panel-ease`) et élargir la transition de `.sidebar` à `width`, `padding`, `border-right-width` et `opacity`.
- [x] 1.2 Remplacer `border-right: none` du panneau replié par une bordure de largeur nulle, et poser `opacity: 0` pour que le contenu du panneau s'efface au lieu d'être rogné.
- [x] 1.3 Ajouter l'animation de fondu (`@keyframes`, opacité 0 → 1, ≈ 200 ms) sur `.content`, avec `both` pour que la première peinture parte transparente sans décaler la mise en page.
- [x] 1.4 Neutraliser la transition du panneau et le fondu sous `@media (prefers-reduced-motion: reduce)`.
- [x] 1.5 N'activer la transition du panneau (`sidebar-ready`) qu'après la pose de l'état persisté, pour qu'une page qui arrive déjà repliée ne rejoue pas le repli.

## 2. Ordre page puis repli (JS)

- [x] 2.1 Au clic sur une entrée du panneau sur un écran étroit, déposer l'intention de repli (`sidebarCollapseOnLoad`, horodatée) dans `sessionStorage` et laisser la navigation partir immédiatement, sans `preventDefault` ni délai.
- [x] 2.2 À l'arrivée, dans `applySidebarState()`, consommer l'intention et programmer `setSidebarCollapsed(true)` après le fondu (`SIDEBAR_COLLAPSE_DELAY_MS = 300`), la constante étant commentée comme dépendante de la durée du fondu CSS.
- [x] 2.3 Borner la validité de l'intention (15 s) pour qu'une navigation annulée ne replie pas le panneau d'une page ouverte plus tard.
- [x] 2.4 Cas des passkeys, page sans panneau : persister l'état au clic au lieu de laisser une intention en attente.
- [x] 2.5 Laisser inchangés la garde `(max-width: 640px)`, les clics modifiés, l'écran large et la persistance ; si `sessionStorage` est indisponible, retomber sur le repli immédiat au clic.
- [x] 2.6 Avec `prefers-reduced-motion: reduce`, appliquer l'état replié dès le chargement de la page d'arrivée, sans attendre ni animer.

## 3. Tests

- [x] 3.1 Dans `test/e2e/sidebar.spec.js`, vérifier que la page demandée est chargée d'abord avec le panneau ouvert (relevé au `DOMContentLoaded`) et son contenu en fondu, que le repli ne commence qu'après le fondu (mesure des instants), que la largeur est intermédiaire pendant le mouvement, puis que l'état replié est persisté.
- [x] 3.2 Vérifier avec `reducedMotion: 'reduce'` que la page arrive panneau replié, sans animation ni fondu, et que la navigation n'est pas retardée.
- [x] 3.3 Laisser inchangés les cas 1.1 à 1.8 (domaine, persistance, écran large, bloc bas, barre d'étiquettes) et le cas des passkeys.

## 4. Spec et PWA

- [x] 4.1 Reporter les exigences dans `openspec/specs/domain-navigation/spec.md` à l'archivage du changement (delta : repli après l'affichage de la page, exigence de fondu ajoutée).
- [x] 4.2 Incrémenter `CACHE_VERSION` dans `public/sw.js` (`style.css` et `app.js` étant précachés).

## 5. Vérifications

- [x] 5.1 Lancer `node --check public/app.js` et `node --check test/e2e/sidebar.spec.js`.
- [x] 5.2 Lancer la suite `test/e2e/sidebar.spec.js`, puis `npm run test:e2e` et `npm test`.
- [x] 5.3 Lancer `openspec validate animate-sidebar-collapse-and-page-fade --strict`.
