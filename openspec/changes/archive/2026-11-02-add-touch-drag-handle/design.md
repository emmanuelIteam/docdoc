## Context

L'outline est rendu côté serveur comme une suite plate de `<li class="line">` (voir `openspec/specs/project-outliner`), chaque ligne portant `data-id`, `data-parent`, `data-depth` et `--depth`. `server.js` (fonction `renderLine`) produit l'unique contrôle de tête :

```html
<button class="bullet" type="button" title="Sélectionner" draggable="true">●</button>
```

Ce bouton cumule trois rôles dans `public/app.js` : un clic sélectionne la ligne et son sous-arbre (cycle tête/sous-arbre), un double-clic replie/déplie, et c'est la poignée du glisser-déposer HTML5 (`dragstart`, `dragover`, `drop`, `dragend`). `public/style.css` le garde `visibility: hidden` et ne le révèle que par `.line:hover .bullet` ou `.line.selected .bullet`, dans un emplacement réservé de `.7rem` (11,2 px) qui ne décale jamais le titre.

Sur un téléphone, ce montage ne tient pas :

- il n'y a pas de survol, donc le bouton de sélection d'une ligne non sélectionnée n'est pas visible ; pire, un élément `visibility: hidden` n'est pas une cible de hit-test, donc le doigt qui vise son emplacement touche la ligne elle-même et le gestionnaire de clic ouvre l'éditeur de titre (`public/app.js`, branche « free space » de la ligne) ;
- le glisser-déposer HTML5 ne reçoit aucun événement au doigt : le navigateur ne déclenche pas `dragstart` pour un contact tactile. Le change `add-drag-and-drop-move` l'avait acté (« No touch/pen drag support beyond the standard pointer ») en laissant la poignée de glisser comme suivi ;
- même une fois la ligne sélectionnée, le point `●` ne dit rien du déplacement : il indique « sélectionnée », pas « saisissable ».

Le change voisin `increase-line-spacing-on-narrow-screens` porte les lignes à 44 px de haut à 640 px et en dessous, ce qui donne la bande verticale nécessaire à un geste au doigt ; il laisse explicitement hors périmètre la révélation de la puce au toucher et l'adaptation du glisser-déposer. C'est l'objet de ce change.

## Goals / Non-Goals

**Goals:**

- Faire apparaître une poignée de glisser sur la ligne sélectionnée, à la place du point, sans décalage du titre.
- Rendre le bouton de sélection réellement atteignable au doigt (visible sans survol, cible d'au moins 24 × 24 px) à 640 px et en dessous ou sur un appareil sans survol.
- Permettre de déplacer une ligne et son sous-arbre au doigt en saisissant cette poignée, avec les mêmes cibles, indicateurs, refus et endpoint que le glisser HTML5.
- Garder le bureau strictement identique : révélation au survol, glisser-déposer HTML5, double-clic de repli.
- Prouver le comportement dans un vrai navigateur tactile (Playwright, contexte `hasTouch`) et le documenter dans le pied de page.

**Non-Goals:**

- Replier/déplier au double-tap sur téléphone (le `dblclick` n'est pas fiable au doigt) : le double-clic reste une interaction de pointeur.
- Agrandir les items du menu contextuel (28,8 px), les liens du panneau latéral ou les lignes d'administration.
- Replier automatiquement le panneau latéral, changer le pas d'indentation, la hauteur des lignes ou la police : c'est le change voisin.
- Glisser au clavier, au lecteur d'écran, ou retour haptique.
- Changer le modèle persisté, les routes, la portée de sélection, l'ordre affiché ou l'endpoint `POST /domaine/:slug/api/nodes/:id/move`.
- Préférence utilisateur « compact / confortable ».

## Decisions

### 1. Deux glyphes dans le même bouton, bascule en CSS

`renderLine` produit un bouton unique avec deux `span` décoratifs et un nom accessible stable :

```html
<button class="bullet" type="button" title="Sélectionner — glisser pour déplacer"
        aria-label="Sélectionner la ligne" draggable="true">
  <span class="bullet-dot" aria-hidden="true">●</span>
  <span class="bullet-grip" aria-hidden="true">⠿</span>
</button>
```

```css
.bullet-grip { display: none; }
.line.selected-head .bullet-dot { display: none; }
.line.selected-head .bullet-grip { display: inline; }
```

La bascule suit l'état de sélection, qui vit déjà dans les classes `.selected` / `.selected-head` posées par le client et restaurées après chaque re-rendu htmx : aucune synchronisation JavaScript à maintenir. Les deux glyphes partagent le même emplacement (même boîte, même largeur), donc le titre ne bouge pas.

*Alternatives écartées :*
- **Remplacer le texte du bouton en JS** : la sélection est écrite à plusieurs endroits (`click`, `restoreHeadSelection`, `mouseout`, raccourci Tab) et l'outline est re-rendu par htmx ; il faudrait rejouer la bascule à chaque fois. Un état visuel dérivé du DOM par CSS est plus sûr.
- **Un second bouton « poignée » à côté du point** : deux contrôles de 11 px collés, deux cibles concurrentes, et le titre se décale à l'apparition — contraire à l'exigence « sans décaler le titre ».
- **`::before` en `content`** : imposerait de masquer le nœud texte et de gérer le nom accessible à la main.

Le `title` annonce les deux usages ; `aria-label` remplace le glyphe `●` comme nom accessible (aujourd'hui un lecteur d'écran annonce « cercle noir »). La poignée est décorative : le glisser reste une interaction de pointeur, pas une action clavier.

### 2. Toujours visible sans survol, avec une cible de 24 × 24 px

```css
.bullet {
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none; /* le geste démarre sur la poignée, pas sur le défilement */
}

@media (max-width: 640px), (hover: none) {
  .bullet {
    visibility: visible;
    width: 1.5rem;      /* 24 px */
    min-height: 1.5rem; /* 24 px */
    font-size: .9rem;
  }
}
```

La condition est un OU : le seuil de 640 px est la convention du projet (indentation, espacement) et rend le comportement testable au viewport ; `(hover: none)` couvre ce que la largeur ne dit pas — une tablette de 1024 px sans souris, où la puce serait sinon invisible et insélectionnable. Un ordinateur portable tactile expose `hover: hover` dès qu'une souris est présente : il garde la révélation au survol.

24 × 24 px est le minimum de la WCAG 2.2 AA (2.5.8) ; viser 44 px de large coûterait 44 px de largeur de titre sur un écran de 390 px déjà indenté. La hauteur, elle, est déjà de 44 px par le change voisin (et `min-height: 1.5rem` garantit 24 px même sans lui).

*Alternatives écartées :*
- **Garder la puce invisible et rendre le tap sur la ligne sélectionnant** : cela changerait l'édition (le tap sur l'espace libre ouvre aujourd'hui le champ de titre) et reposerait sur une cible invisible.
- **`@media (pointer: coarse)`** : ne distingue pas un pointeur grossier d'une absence de survol ; `hover: none` décrit exactement le problème.
- **Élargir à 44 px** : trop cher en largeur de titre à 390 px ; à revoir si les tests terrain montrent des ratés.

Sans survol (écran étroit ou appareil tactile), le point au repos passe en gris neutre (`#a1a1aa`) et la poignée sélectionnée en `--accent-dark` : la bascule de couleur renforce le message « cette ligne est maintenant saisissable », sans ajouter de bruit sur les lignes inactives.

### 3. Le glyphe de poignée : `⠿`

L'application n'utilise que des glyphes Unicode pour ses icônes (`○ ◐ ● 🔗 → ← + 🗑`) : pas de sprite, pas de dépendance d'icônes. `⠿` (U+283F, motif braille à six points) est la représentation conventionnelle d'une poignée de glisser et reste lisible à 14,4 px dans l'emplacement de 24 px.

*Alternatives écartées :* `≡` (se lit comme un menu), `⋮⋮` (espacement dépendant de la police), une icône SVG (nouveau motif d'asset pour un seul glyphe).

*Risque assumé :* la couverture de la police. À vérifier sur Chrome Android et Safari iOS ; si le glyphe tombe sur une police de secours incohérente, basculer sur `⋮⋮` ou dessiner six points en `radial-gradient`. C'est un point de recette, pas un choix définitif.

### 4. Glisser tactile aux Pointer Events, pas de polyfill HTML5

Le HTML5 drag and drop n'émet rien pour un contact tactile ; les Pointer Events, eux, couvrent souris, doigt et stylet avec capture du pointeur, et sont disponibles sur toutes les cibles (iOS 13+). Aucune dépendance n'est ajoutée.

Le geste :

1. `pointerdown` sur `.bullet` avec `pointerType !== 'mouse'` : mémoriser `pointerId`, `(x, y)`, `setPointerCapture`, et neutraliser `draggable` le temps du geste (pour qu'iPadOS ne lance pas un drag natif concurrent). Aucun `preventDefault` : le clic de sélection doit continuer de fonctionner.
2. `pointermove` : tant que le déplacement est inférieur à 8 px, rien ne change (c'est un tap). Au-delà, le glisser démarre : `.dragging` sur la ligne, fantôme, indicateurs.
3. `pointerup` : si un glisser est en cours, résoudre la cible sous le doigt, appeler le déplacement si elle est valide, puis avaler le clic suivant (sinon le relâchement sélectionnerait aussi la ligne). Si aucun glisser n'a démarré, ne rien faire : le clic sélectionne comme aujourd'hui.
4. `pointercancel` : tout annuler, sans requête.

`touch-action: none` sur `.bullet` est la condition pour que le navigateur ne revendique pas le geste pour le défilement (il émettrait sinon `pointercancel` en plein glisser) ; la propriété est sans effet sur une souris. Le seuil de 8 px est la tolérance de tap usuelle : en dessous, on sélectionne ; au-dessus, on déplace.

*Alternatives écartées :*
- **Polyfill `drag-drop-touch`** : dépendance tierce d'environ 10 Ko pour un comportement générique qui entrerait en conflit avec les gestionnaires HTML5 existants ; le geste métier (indicateurs, refus, endpoint) est déjà écrit ici.
- **Appui long (300 ms) avant le glisser** : ajoute une latence et un minuteur à gérer, sans bénéfice puisque `touch-action: none` réserve déjà la zone au glisser. À reconsidérer si le blocage du défilement sur la puce gêne (question ouverte).
- **Événements tactiles (`touchstart`/`touchmove`)** : pas de capture, coordonnées à gérer à la main, et il faudrait dupliquer le chemin souris.

### 5. Un seul chemin de dépôt, partagé avec HTML5

Les helpers existants sont réutilisés tels quels : `resolveDropTarget(el)`, `isInvalidDrop(target)`, `clearDropIndicators()`, `buildDragGhost(line)`, `subtreeRows(line)`. Deux extractions suffisent :

- `positionAtPoint(clientY, line)` remplace le corps de `positionAt(e, line)` (qui devient un appel), pour que le chemin tactile passe une coordonnée et non un événement ;
- `moveLine(sourceId, target, position)` regroupe le `fetch(..., '/move')` et le `reloadOutline()` aujourd'hui dans le gestionnaire `drop`.

Le chemin tactile résout la cible avec `document.elementFromPoint(x, y)` — le fantôme est en `pointer-events: none`, et la ligne glissée reste atteignable, ce qui permet à `isInvalidDrop` de la refuser comme aujourd'hui. Les indicateurs (`drop-before`, `drop-after`, `drop-inside`, `drop-invalid`, `drop-root`) et le contrat `{ targetId, position }` sont inchangés.

### 6. Fantôme flottant et menu masqué

`buildDragGhost` clone la ligne et ses sous-lignes ; le chemin tactile ajoute la classe `floating` et positionne le clone en `position: fixed`, à 12 px au-dessus du doigt, pour ne pas être caché par la main. Sa hauteur est mesurée après insertion pour le placer, et son `z-index` passe au-dessus du menu (20). Un `max-width: 80vw` évite qu'il couvre l'écran.

Pendant le glisser, `.line.dragging .menu { display: none; }` : le menu est ancré au-dessus de la ligne (donc sous le doigt qui remonte) et `elementFromPoint` le résoudrait vers la ligne glissée elle-même, c'est-à-dire une cible invalide. Le masquer rend la zone de dépôt lisible ; il réapparaît si le glisser est annulé (la sélection est intacte).

*Alternative écartée :* ne pas afficher de fantôme et se contenter de `.dragging` (opacité 0,55). Le doigt masque la ligne ; sans fantôme, on ne sait plus ce qu'on tient.

### 7. Défilement automatique pendant le glisser

Une boucle `requestAnimationFrame` tourne pendant le glisser : quand le doigt entre dans une bande de 72 px en haut ou en bas de la fenêtre, la page défile de 4 à 14 px par frame selon la proximité du bord (soit jusqu'à ~840 px/s), et la cible est recalculée à chaque frame sous la même position de doigt. Sans cela, sur un téléphone qui affiche une dizaine de lignes, la plupart des déplacements seraient impossibles.

*Alternatives écartées :* aucun défilement (le déplacement serait limité à l'écran visible) ; `scroll-behavior: smooth` (non déterministe, ne suit pas le doigt).

### 8. Bureau inchangé

`dragstart`, `dragover`, `drop` et `dragend` restent le chemin de la souris. Le chemin tactile sort immédiatement pour `pointerType === 'mouse'` : aucun risque de double déclenchement. La poignée s'affiche aussi sur la tête sélectionnée au bureau — c'est la même règle CSS, elle ne dépend pas de la largeur — ce qui rend le déplacement plus lisible partout sans changer le geste.

### 9. Vérification : contexte tactile Playwright et CDP

`test/e2e/reindent.spec.js` porte déjà le harnais complet (serveur en process, compte, authentificateur virtuel, `storageState`). Un second spec dupliquerait l'enrôlement ; une section 9 dans le même fichier réutilise le harnais et ajoute un fixture `touchPage` qui crée un contexte `{ hasTouch: true, isMobile: true, viewport: 390 × 844 }` à partir du même `storageState`. Playwright n'a pas d'API de glisser tactile : le geste est joué par CDP (`Input.dispatchTouchEvent` en `touchStart` / `touchMove` / `touchEnd`), déjà utilisé pour le WebAuthn virtuel.

La section couvre : puce visible sans survol et ≥ 24 × 24 px, titre à la même abscisse avant/après sélection, poignée sur la tête et point sur les sous-lignes, tap qui sélectionne sans requête, glisser qui envoie `{ targetId, position }` et réordonne, dépôt invalide et `pointercancel` sans requête, et défilement automatique (un fixture long, doigt maintenu en bas, `scrollY` qui augmente). Le contexte Playwright n'émule pas de façon garantie la capacité de survol : c'est l'arm `max-width` de la media query que les tests exercent, et l'arm `hover: none` reste une vérification sur appareil réel.

## Risks / Trade-offs

- **[Le doigt masque la cible]** — la ligne visée fait 44 px de haut et un pouce en couvre une bonne partie. *Mitigation* : le fantôme est placé au-dessus du doigt et les indicateurs sont des traits de 2 px en bord de ligne ; à confirmer en recette sur un vrai téléphone.
- **[Bloquer le défilement qui démarre sur la puce]** — `touch-action: none` neutralise le scroll sur 24 px de large. *Mitigation* : le reste de la ligne (titre, espace libre) défile normalement ; la puce est le seul endroit où le geste doit être réservé. Si l'usage montre des gestes de défilement ratés, un appui long devient la soupape (question ouverte).
- **[Déplacement accidentel en voulant faire défiler]** — un geste commencé sur la puce et dépassant 8 px déplace la ligne au lieu de défiler. *Mitigation* : seuil de 8 px, cible étroite, et l'annulation reste possible en relâchant hors d'une ligne. Aucune donnée n'est touchée avant le relâchement.
- **[Glyphe `⠿` inégal selon les plateformes]** — police de secours, rendu différent sur iOS. *Mitigation* : point de recette explicite, repli documenté sur `⋮⋮` ou six points en `radial-gradient`.
- **[Le point permanent alourdit l'écran étroit]** — une colonne de points sur toutes les lignes. *Mitigation* : l'emplacement était déjà réservé (aucun décalage), le point au repos est gris neutre, et la couleur d'accent est réservée à la poignée sélectionnée.
- **[`hover: none` diverge du seuil de largeur]** — un écran large sans pointeur suit la révélation permanente, un écran étroit avec souris aussi. *Mitigation* : deux arms explicites dans la spec (écran étroit, appareil sans survol), et un seuil de 640 px documenté et testé au viewport.
- **[La puce élargie décale les titres de 12,8 px sur mobile]** — coût direct en largeur de texte. *Mitigation* : accepté et documenté ; l'indentation est déjà réduite de moitié sur ce seuil, et 24 px reste le minimum tactile.
- **[Safari iOS : drag natif concurrent]** — `draggable="true"` pourrait lancer un glisser natif au doigt malgré les Pointer Events. *Mitigation* : `draggable` est désactivé pendant le geste tactile et rétabli au relâchement ; à vérifier sur un iPhone réel.
- **[Tests tactiles fragiles]** — les gestes CDP dépendent du timing. *Mitigation* : helpers dédiés, seuils de déplacement explicites, et recette manuelle en complément.
- **[Le change voisin n'est pas encore appliqué]** — sans lui les lignes font ~21 px ; `min-height: 1.5rem` sur la puce les porterait à 24 px sur mobile. *Mitigation* : comportement acceptable et temporaire ; les deux changes sont indépendants et se composent.

## Migration Plan

1. Déployer `server.js` (markup et pied de page), puis `public/style.css` et `public/app.js` (fichiers statiques, aucune donnée ni configuration).
2. Aucune migration : domaines, ordre affiché, statuts, thèmes et comptes sont inchangés ; l'endpoint de déplacement est réutilisé tel quel.
3. Recette sur un téléphone : sélectionner une ligne, vérifier que la poignée apparaît, la faire glisser vers une autre ligne et vers le bord bas de l'écran, annuler un glisser, vérifier que le tap sélectionne toujours et que le défilement hors puce fonctionne.
4. Recette bureau : révélation au survol, glisser HTML5, double-clic de repli, et poignée sur la tête sélectionnée.
5. Rollback : redéployer les trois fichiers précédents. Aucune donnée transformée, aucun effet de bord.

## Open Questions

- **Appui long plutôt que glisser immédiat ?** Le glisser immédiat est plus direct mais réserve le défilement sur la puce ; un appui de ~250 ms réduirait les déplacements accidentels et signalerait la « prise ». À trancher après usage réel.
- **Le point doit-il rester visible en permanence sur mobile, ou seulement après un premier contact ?** Le choix actuel privilégie la découvrabilité ; il pourra être allégé si la colonne de points se révèle bruyante.
- **Faut-il aussi replier/déplier au double-tap sur téléphone ?** Le `dblclick` n'est pas fiable au doigt ; ce serait un geste distinct (ou un bouton dédié) à spécifier.
- **Faut-il un retour haptique** (`navigator.vibrate`) à la prise et au dépôt ? Non supporté sur iOS et hors demande pour l'instant.
- **Faut-il étendre la prise à toute la ligne sélectionnée** (appui long n'importe où) plutôt qu'aux 24 px de la poignée ?
