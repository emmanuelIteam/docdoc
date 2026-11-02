## 1. Markup de la ligne et documentation

- [x] 1.1 Dans `renderLine` (`server.js`), remplacer le contenu du bouton de sélection par les deux glyphes `<span class="bullet-dot" aria-hidden="true">●</span>` et `<span class="bullet-grip" aria-hidden="true">⠿</span>`, ajouter `aria-label="Sélectionner la ligne"` et faire porter au `title` les deux usages (« Sélectionner — glisser pour déplacer »). Conserver `type="button"` et `draggable="true"`.
- [x] 1.2 Vérifier que le markup reste valide pour htmx (`hx-*` du menu inchangés), que `data-id`, `data-parent`, `data-depth` et `style="--depth"` de la ligne sont intacts, et que le bouton reste le premier enfant de la ligne.
- [x] 1.3 Mettre à jour le paragraphe `.hint` du pied de page (`server.js`) pour mentionner la puce visible sans survol, la poignée affichée sur la ligne sélectionnée et le glisser de cette poignée au doigt.

## 2. Styles

- [x] 2.1 Dans `public/style.css`, passer `.bullet` en `display: flex; align-items: center; justify-content: center` et ajouter `touch-action: none` (sans effet sur une souris, indispensable au glisser tactile).
- [x] 2.2 Ajouter `.bullet-grip { display: none; }`, puis la bascule `.line.selected-head .bullet-dot { display: none; }` et `.line.selected-head .bullet-grip { display: inline; }` ; vérifier que les deux glyphes occupent la même boîte et que rien ne décale le titre.
- [x] 2.3 Ajouter la requête `@media (max-width: 640px), (hover: none)` qui rend `.bullet` visible sans survol avec `width: 1.5rem`, `min-height: 1.5rem` et `font-size: .9rem` ; vérifier que la règle de base `visibility: hidden` et `.line:hover .bullet` restent effectives hors de la requête.
- [x] 2.4 Colorer le point au repos en gris neutre et la poignée sélectionnée en `--accent-dark` (le point garde la couleur d'accent sur un écran large avec pointeur), sans toucher au fond `.line.selected`.
- [x] 2.5 Ajouter la variante flottante du fantôme `.drag-ghost.floating` (position fixe, `z-index` supérieur au menu, `pointer-events: none`, `max-width: 80vw`) sans modifier `.drag-ghost` utilisé par `setDragImage`.
- [x] 2.6 Masquer le menu pendant le glisser (`.line.dragging .menu { display: none; }`) et vérifier que `.line.dragging`, `.drop-before`, `.drop-after`, `.drop-inside`, `.drop-invalid` et `#outline.drop-root` restent inchangés.
- [x] 2.7 Contrôler la non-régression desktop : à 1280 px la puce ne se révèle qu'au survol, la ligne garde sa hauteur compacte et le titre sa position.

## 3. Glisser tactile

- [x] 3.1 Extraire `positionAtPoint(clientY, line)` du corps de `positionAt(e, line)` et faire de `positionAt` un simple appel ; vérifier que `dragover` et `drop` HTML5 se comportent à l'identique.
- [x] 3.2 Extraire `moveLine(sourceId, target, position)` du gestionnaire `drop` (fetch `POST .../move`, `reloadOutline`, gestion d'erreur) et le réutiliser dans le chemin HTML5.
- [x] 3.3 Ajouter l'état de glisser tactile et `pointerdown` sur `.bullet` : filtrer `pointerType === 'mouse'`, mémoriser `pointerId` et le point de départ, appeler `setPointerCapture`, neutraliser `draggable` pendant le geste (rétabli à la fin), sans `preventDefault`.
- [x] 3.4 Ajouter `pointermove` : ne rien faire sous 8 px, puis démarrer le glisser (classe `.dragging`, fantôme flottant construit avec `buildDragGhost` et positionné au-dessus du doigt) et mettre à jour la cible via `document.elementFromPoint` + `resolveDropTarget` + `isInvalidDrop` + `positionAtPoint`.
- [x] 3.5 Ajouter `pointerup` : si un glisser est en cours, déplacer sur une cible valide (ou annuler), puis avaler le clic suivant pour ne pas changer la sélection ; si aucun glisser n'a démarré, laisser le clic sélectionner.
- [x] 3.6 Ajouter `pointercancel` et le nettoyage commun (fantôme supprimé, `.dragging` et indicateurs effacés, `draggable` rétabli, boucle de défilement arrêtée) sans envoyer de requête.
- [x] 3.7 Ajouter le défilement automatique par `requestAnimationFrame` (bande de 72 px en haut et en bas, 4 à 14 px par frame), recalculer la cible à chaque frame et arrêter la boucle au relâchement ou à l'annulation.
- [x] 3.8 Vérifier qu'aucun des chemins tactiles ne se déclenche pour la souris et que le glisser HTML5 n'est pas perturbé (pas de double requête, pas de clic parasite).

## 4. Tests

- [x] 4.1 Ajouter dans `test/e2e/reindent.spec.js` un fixture `touchPage` (même `storageState`, contexte `hasTouch: true`, `isMobile: true`, `viewport: 390 × 844`) et un helper de geste tactile par CDP (`Input.dispatchTouchEvent` : `touchStart`, `touchMove`, `touchEnd`, avec annulation), sans modifier les fixtures ni les tests existants.
- [x] 4.2 Asserter que la puce est visible sans survol à 390 px, que sa boîte fait au moins 24 × 24 px, et que l'abscisse du titre est identique avant et après sélection.
- [x] 4.3 Asserter la bascule des glyphes : `.bullet-grip` visible et `.bullet-dot` masqué sur la tête sélectionnée, point conservé sur les sous-lignes, retour au point après désélection.
- [x] 4.4 Asserter qu'un tap sur la puce sélectionne la ligne et n'ouvre pas le champ de titre, et qu'aucune requête `/move` n'est envoyée.
- [x] 4.5 Asserter qu'un glisser de la poignée au-delà de 8 px envoie `POST .../move` avec la cible et la position attendues, puis que l'ordre affiché et `data-depth` reflètent le déplacement (cible « au-dessus », « en dessous » et « à l'intérieur »).
- [x] 4.6 Asserter qu'un dépôt sur la ligne glissée ou un descendant ne produit aucune requête, et qu'une annulation tactile (`pointercancel` ou relâchement hors ligne) ne produit aucune requête et efface les indicateurs.
- [x] 4.7 Asserter le défilement automatique avec un fixture long : doigt maintenu près du bord bas, `window.scrollY` augmente pendant le glisser.
- [x] 4.8 Vérifier que les sections 6 à 8 existantes passent sans modification et que la section 9 ne dépend pas de l'ordre d'exécution des tests.

## 5. Vérification

- [x] 5.1 Lancer `npx playwright test` : tests existants et nouvelle section 9 au vert.
- [x] 5.2 Lancer `npm test`.
- [x] 5.3 Lancer `openspec validate add-touch-drag-handle --strict`.
- [ ] 5.4 Recette sur un téléphone réel (Chrome Android et Safari iOS) : le point est visible sans survol, un tap sélectionne, la poignée `⠿` apparaît, le glisser déplace la ligne et son sous-arbre, le doigt près du bord fait défiler, un glisser annulé ne change rien, et le défilement hors puce reste fluide.
- [ ] 5.5 Recette bureau : révélation au survol inchangée, glisser HTML5 fonctionnel, double-clic de repli fonctionnel, poignée visible sur la tête sélectionnée et pied de page à jour.
- [ ] 5.6 Contrôler le rendu du glyphe `⠿` sur les deux plateformes et, s'il tombe sur une police de secours incohérente, appliquer le repli documenté (design, décision 3).
