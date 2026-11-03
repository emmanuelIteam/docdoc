## 1. Feuille de style (`public/style.css`)

- [x] 1.1 Ajouter `.line.editing` : fond `#eff6ff`, barre d'accent de 2 px en `box-shadow: inset` ; la transition de 120 ms sur `background-color` et `box-shadow` (avec `--panel-ease`) vit sur `.line` pour que la teinte apparaisse **et** s'efface en douceur ; l'état reste distinct du survol (`#f4f4f5`) et de la sélection (`#eef2ff`).
- [x] 1.2 Transformer `.title-input` en champ multi-ligne : `display: block`, largeur fluide (`flex: 1 1 auto; min-width: 0`), `padding: 0`, `border: none`, `resize: none`, `overflow: hidden`, `line-height: 1.25` conservé, soulignement de 2 px en `box-shadow: inset 0 -2px 0` (aucun ajout de boîte) ; retirer la largeur en `ch` et le `min-width: 2ch` devenus inutiles.
- [x] 1.3 Poser `scroll-padding-bottom: calc(var(--keyboard-inset, 0px) + .75rem)` sur `:root` ; la variable est publiée par `app.js` (tâche 3.1).
- [x] 1.4 Sous `@media (prefers-reduced-motion: reduce)`, neutraliser la transition de `.line` ; vérifier que la règle existante (bandeau, panneau, fondu) n'est pas modifiée.

## 2. Édition du titre (`public/app.js`)

- [x] 2.1 Dans `startRename`, mesurer `line.offsetHeight` avant remplacement (la ligne, pas le span : la hauteur tactile minimale est déjà comprise), créer un `<textarea class="title-input" rows="1" wrap="soft">` avec la valeur source, poser `line.style.minHeight` à la hauteur mesurée et la classe `.line.editing` ; auto-dimensionner sur `scrollHeight` à chaque `input` (et à la création) ; supprimer le dimensionnement `sizeInput` en `ch`.
- [x] 2.2 Donner le focus avec `{ preventScroll: true }`, appeler `line.scrollIntoView({ block: 'nearest' })` à la frame suivante, puis poser le curseur (`setSelectionRange`) à l'offset calculé ; conserver le comportement `selectAll` (ligne créée par `Entrée` ou « + »).
- [x] 2.3 Dans `finish`, peindre le titre en place (`paintTitle`), retirer `.line.editing` et `line.style.minHeight` dans **tous** les chemins (perte de focus, `Entrée`, `Tab`, `MAJ+Tab`, `Échap`, erreur), envoyer le `PUT` sans l'attendre (`keepalive: true`, erreur journalisée) et ne plus appeler `reloadOutline` quand seul le titre a changé.
- [x] 2.4 Émettre `outline:title-changed` après la peinture locale pour que le bandeau d'ancêtres rafraîchisse ses libellés, et `outline:editing-ended` à chaque fermeture pour qu'il se remesure.
- [x] 2.5 Introduire `editGeneration` (incrémenté à chaque `startRename`, capturé par `finish`) : si une réponse de `next` / `reindent` revient alors qu'un champ plus récent est ouvert, l'ignorer et programmer un rafraîchissement complet, appliqué à la fermeture de ce champ, sans voler le focus.
- [x] 2.6 Faire en sorte que `reloadOutline` (chemin de secours) soit différé tant qu'un `.title-input` est ouvert, puis appliqué à la fermeture.

## 3. Clavier et viewport (`public/app.js`)

- [x] 3.1 Ajouter un suivi `visualViewport` (`resize` + `scroll`) qui publie `--keyboard-inset = max(0, innerHeight - (offsetTop + height))` sur `:root`, uniquement à `scale === 1`, et la remet à 0 quand le clavier disparaît.
- [x] 3.2 Ajouter la révélation différée : attendre la stabilisation du viewport (débounce 120 ms sur `visualViewport.resize`, plafond 350 ms) puis un unique `line.scrollIntoView({ block: 'nearest', behavior: 'smooth' })` ; `behavior: 'auto'` si `prefers-reduced-motion: reduce` ; ignorer une révélation devenue périmée (génération).
- [x] 3.3 À la fermeture du champ, ne pas restaurer la position de défilement antérieure ; vérifier que la retombée de `--keyboard-inset` à 0 ne provoque aucun défilement.

## 4. Bandeau d'ancêtres (`public/app.js`)

- [x] 4.1 Dans `update()`, tant qu'un `.title-input` est présent, ignorer un changement de `innerHeight` pour `sizeBar` et `refreshReserve` (la hauteur et la réserve restent celles de l'ouverture) ; continuer d'appeler `renderChain` pour suivre le défilement.
- [x] 4.2 Écouter `outline:title-changed` pour rafraîchir les libellés, et relancer `schedule()` à la fermeture du champ pour remesurer la barre et republier `--topbar-height`.

## 5. Tests (`test/e2e/reindent.spec.js`)

- [x] 5.1 Ajouter la fixture `MOBILE_EDIT_FIXTURE` (un titre long qui revient sur plusieurs lignes à 390 px, suivi d'une autre ligne) et le helper `longEditGeometry` (hauteur de la ligne longue, `top` de la ligne suivante).
- [x] 5.2 Cas 13.1 — après une validation de titre, aucune requête `outline-fragment` n'est émise et `#outline` conserve son identité (marqueur posé sur l'élément avant l'édition).
- [x] 5.3 Cas 13.2 — ouvrir A, saisir, retarder le `PUT` via `page.route`, taper B : le champ de B reste focalisé et conserve sa valeur après 800 ms.
- [x] 5.4 Cas 13.3 — sur le titre long, la hauteur de la ligne et le `top` de la ligne suivante ne changent pas à l'ouverture ni à la fermeture (±1 px).
- [x] 5.5 Cas 13.4 — `.line.editing` est présent pendant l'édition et absent après une sortie par `Échap` puis par perte de focus.
- [x] 5.6 Cas 13.5 — un `MutationObserver` sur le style du bandeau vérifie qu'il n'est pas remesuré pendant l'édition lorsqu'on redimensionne la fenêtre, puis qu'il l'est à la fermeture.
- [x] 5.7 Cas 13.6 — avec `reducedMotion: 'reduce'`, la transition de `.line` vaut 0 s et l'appel de révélation reçu porte `behavior: 'auto'` (espionner `scrollIntoView` par `addInitScript`).
- [x] 5.8 Cas 13.7 — avec une réponse `/next` retardée, presser `Entrée` puis ouvrir une autre ligne : ce champ reste ouvert et focalisé ; après sa fermeture, la ligne créée apparaît (le rafraîchissement reporté est appliqué).
- [x] 5.9 Laisser inchangés les cas existants (sections 4 à 12) et vérifier qu'ils passent sans modification : `Tab`/`MAJ+Tab` pendant l'édition, sélection conservée, espacement tactile, glisser au doigt, bandeau d'ancêtres, liens de tâche.

## 6. PWA, vérifications et recette

- [x] 6.1 Incrémenter `CACHE_VERSION` dans `public/sw.js` (`v18` → `v19`), `app.js` et `style.css` étant précachés.
- [x] 6.2 Lancer `node --check public/app.js` et `node --check test/e2e/reindent.spec.js`.
- [x] 6.3 Lancer `npx playwright test test/e2e/reindent.spec.js`, puis `npm run test:e2e` et `npm test` : 58 tests de la suite reindent, 106 tests e2e et 41 vérifications passkey passent.
- [x] 6.4 Lancer `openspec validate stabiliser-edition-mobile --strict` : le changement est valide.
- [ ] 6.5 Recette manuelle sur iPhone (Safari) et Android (Chrome) : titre long en bas de page, ouverture puis fermeture du champ, clic sur une autre ligne sans changer de titre, `Entrée`, `Tab`, mouvement réduit, application installée (PWA). Consigner la position finale de la ligne et le nombre de déplacements observés.
- [ ] 6.6 Vérifier que la page « Aide » reste exacte (aucun geste nouveau, aucun raccourci modifié) et reporter les deltas dans `openspec/specs/node-management/spec.md` et `openspec/specs/project-outliner/spec.md` à l'archivage du changement.
