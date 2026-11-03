## Context

L'édition d'un titre vit dans `startRename` (`public/app.js`) : au clic, le `<span class="title">` est remplacé par un `<input class="title-input">`, le champ reçoit le focus immédiatement, la largeur est calée en `ch` sur la longueur du texte, et le curseur est posé à la frame suivante. La validation (`Entrée`, `Tab`, `MAJ+Tab`, perte de focus) passe par `finish` : le champ redevient un `span` et le titre modifié est envoyé en `PUT` ; une perte de focus avec un titre changé déclenche en plus un re-rendu complet de l'outline (`reloadOutline`), tandis qu'`Entrée` et `Tab` remplacent l'outline par la réponse structurelle (nouvelle ligne, nouvelle profondeur).

Quatre propriétés de l'existant produisent l'à-coup sur smartphone :

- **Le champ est mono-ligne alors que le titre revient à la ligne.** Un titre de deux ou trois lignes redevient une ligne de ~40 px à l'ouverture, puis reprend sa hauteur à la fermeture : tout ce qui est en dessous se déplace deux fois. Le curseur peut en plus se retrouver dans la partie du source qui n'est plus affichée horizontalement.
- **La sortie d'édition re-rend toute l'outline**, exactement quand le clavier se ferme. Le swap htmx remplace des éléments, réinitialise la sélection et peut détruire un champ qui vient de s'ouvrir sur une autre ligne si le `PUT` d'une édition précédente se termine après ce clic.
- **Le focus est pris sans `preventScroll`.** C'est le navigateur qui choisit où amener le champ : il « pan » le visual viewport (Chrome 108+ et iOS ne redimensionnent plus le layout viewport à l'apparition du clavier — voir [Chrome for Developers](https://developer.chrome.com/blog/viewport-resize-behavior)) ou fait défiler la page, sans que l'application le sache. Aucun écouteur de `visualViewport` n'existe aujourd'hui.
- **Le bandeau d'ancêtres se remesure sur tout changement de `innerHeight`** (`initStickyAncestry`) et anime sa hauteur en 160 ms. Sur les moteurs qui redimensionnent le layout viewport (Firefox Android, ancien Chrome, WebView), la barre pousse l'outline pendant que le clavier bouge : un mouvement de plus.

Contraintes : aucune dépendance nouvelle ; htmx continue de rendre les fragments ; le champ édite le source Markdown (les liens inline affichés ne sont pas le texte stocké) ; les tests Playwright tournent dans le Chrome installé et **ne peuvent pas ouvrir de clavier virtuel** ; iOS et Android diffèrent sur le viewport ; `app.js` et `style.css` sont précachés par le service worker.

## Goals / Non-Goals

**Goals :**

- La ligne éditée reste à sa place et identifiable du début à la fin de la saisie.
- Un titre qui revient à la ligne garde sa forme et sa hauteur pendant l'édition ; les lignes suivantes ne bougent ni à l'ouverture ni à la fermeture.
- La validation d'un titre ne re-rend plus l'outline ; le clic sur une autre ligne ne peut plus être annulé par l'enregistrement de la précédente.
- Le clavier ne provoque qu'un seul déplacement, et seulement si la ligne n'est pas déjà visible au-dessus de lui.
- Le bandeau d'ancêtres ne se redimensionne pas pendant la saisie.
- `prefers-reduced-motion: reduce` supprime la transition d'état et le défilement animé.
- Aucune régression sur écran large, au clavier, ni sur les raccourcis `Entrée` / `Tab` / `MAJ+Tab`.

**Non-Goals :**

- **Garder le clavier ouvert entre deux lignes avec `Entrée`** : cela demanderait une création de ligne optimiste côté client (le serveur attribue l'id) et une réconciliation du texte saisi pendant l'aller-retour. Le geste reste hors périmètre ; un champ déjà ouvert n'est en revanche plus détruit par une validation antérieure.
- **Changer le meta viewport** (`interactive-widget`) : il redimensionnerait tout le document au moment même où l'on cherche à ne plus bouger, et iOS l'ignore. L'encoche du clavier est gérée par `visualViewport`.
- Aucune modification des routes, du modèle de données, de la grammaire des liens, ni du rendu serveur.
- Aucun nouveau geste, aucun changement du point d'entrée en édition (clic sur le titre hors lien, espace libre, action « Renommer »).
- Aucune refonte de l'accessibilité clavier ni du menu contextuel.

## Decisions

### 1. Un champ multi-ligne auto-dimensionné, à la hauteur de la ligne

`startRename` mesure d'abord `line.offsetHeight` — la hauteur de la ligne, qui inclut déjà la hauteur tactile minimale de 2,475 rem sur écran étroit — puis remplace le `span` par un `<textarea class="title-input" rows="1" wrap="soft">`. Le champ reçoit `line.style.minHeight = hauteurMesurée + 'px'` ; sa hauteur est recalée sur `scrollHeight` à chaque `input` ; `overflow: hidden`, `resize: none`, `padding: 0`, `border: none`, et l'état d'édition porte le soulignement (un `box-shadow` inséré, qui n'ajoute pas de boîte). La largeur n'est plus calculée en `ch` : le champ est un élément flex qui prend la largeur restante de la ligne (`flex: 1 1 auto; min-width: 0`), donc le texte revient à la ligne comme le titre. `line.style.minHeight` est retiré dans `finish`.

Le source pouvant être plus long que le libellé affiché (liens inline), le champ peut grandir : l'exigence est de **ne jamais réduire** une ligne de plusieurs lignes à une seule, pas de garantir une hauteur au pixel près. Les titres sans lien — le cas courant — ont exactement la même hauteur.

*Alternatives écartées :*

- **Garder l'`input` et réserver la hauteur de la ligne** : la liste ne bouge plus, mais le texte redevient mono-ligne et le curseur peut sortir de la zone visible ; l'utilisateur perd quand même la forme de sa ligne.
- **`contenteditable` sur le `span`** : géométrie parfaite, mais le `span` affiche les libellés alors que le source contient `[libellé](url)` ; il faudrait reconstruire le Markdown et remapper le curseur à chaque frappe.
- **`field-sizing: content` seul** : le support n'est pas uniforme ; le calcul JS est déterministe et testable.

### 2. La validation d'un titre ne re-rend plus l'outline

`finish` peint le titre en place (`paintTitle` met déjà le texte et `data-title` à jour), retire l'état d'édition, puis envoie le `PUT` **sans l'attendre** (`keepalive: true`, erreur seulement journalisée). Plus de `reloadOutline` après un renommage : c'est le swap htmx qui produisait le saut de sortie et pouvait détruire le champ suivant. Un événement `outline:title-changed` est émis pour que le bandeau d'ancêtres rafraîchisse ses libellés (le `renderChain` compare les libellés à chaque mise à jour).

Un compteur `editGeneration` est incrémenté à chaque `startRename` et capturé par `finish`. Les chemins structurels (`next`, `reindent`) gardent leur re-rendu, mais si la réponse arrive alors qu'un champ **plus récent** est ouvert, elle est ignorée et un rafraîchissement complet est reporté à la fermeture de ce champ : son fragment décrirait l'état d'avant l'édition en cours. La ligne créée n'est jamais perdue, et le champ en cours n'est jamais remplacé. `reloadOutline` (chemin de secours) est également différé si un champ est ouvert.

*Alternatives écartées :*

- **Garder le `PUT` puis le `reloadOutline`** : c'est précisément le mouvement de sortie à supprimer, et le swap reste une course avec le clic suivant.
- **Attendre le `PUT` avant de peindre** : la ligne resterait en édition pendant l'aller-retour, puis changerait d'état en deux temps ; la peinture locale est déjà fiable (le serveur ne fait que `trim`).

### 3. Focus sans défilement, puis un seul déplacement après stabilisation

À la création du champ : `focus({ preventScroll: true })` (repli sur `focus()` si l'option n'est pas supportée), puis `line.scrollIntoView({ block: 'nearest' })` à la frame suivante — un no-op si la ligne est déjà visible, qui protège seulement du bandeau collant (la ligne porte déjà `scroll-margin-top`). Ensuite, on attend que le viewport se stabilise : `visualViewport.resize` débouncé à 120 ms, avec un plafond de 350 ms si l'événement n'arrive pas. Alors seulement, un unique `line.scrollIntoView({ block: 'nearest', behavior: 'smooth' })` (ou `auto` si le mouvement est réduit).

L'encoche du clavier est publiée sur `:root` : `--keyboard-inset = max(0, innerHeight - (visualViewport.offsetTop + visualViewport.height))`, uniquement à `scale === 1`, et `scroll-padding-bottom: calc(var(--keyboard-inset) + .75rem)`. Le `scrollIntoView` « nearest » respecte ce rembourrage : la ligne déjà au-dessus du clavier ne bouge pas ; celle qui serait dessous est amenée juste au-dessus, en un seul mouvement. Aucun calcul de position à la main, donc rien à revalider quand `offsetTop` ou le zoom changent.

À la fermeture : on ne restaure pas la position antérieure (l'utilisateur a fini d'éditer) ; l'encoche retombe à 0 quand le clavier disparaît, sans provoquer de défilement.

*Alternatives écartées :*

- **Laisser le navigateur faire** : c'est l'état actuel, et son point d'arrivée n'est pas contrôlé.
- **`block: 'center'`** : déplace toujours la ligne, même quand elle était parfaitement visible.
- **Un délai fixe après le focus** : fragile (le clavier n'a pas la même durée selon l'appareil) ; le débounce sur `visualViewport` s'adapte, le plafond couvre les moteurs qui ne l'émettent pas.
- **`interactive-widget=resizes-content`** : voir Non-Goals.

### 4. Un état d'édition visible, porté par la ligne

`.line.editing` ajoute un fond teinté (`#eff6ff`) et une barre d'accent de 2 px en `box-shadow: inset`, donc sans décaler le titre ni les voisins. La transition est de 120 ms sur `background-color` et `box-shadow` ; le champ porte un soulignement de 2 px. L'état est posé à la création, retiré dans `finish` quel que soit le chemin (perte de focus, `Entrée`, `Tab`, `Échap`, erreur), et neutralisé sous `prefers-reduced-motion: reduce`.

Aujourd'hui, le seul indice est un trait pointillé de 1 px : après un déplacement de la page, rien ne dit plus quelle ligne est en cours.

*Alternatives écartées :*

- **Un contour autour de la ligne** : visuellement plus lourd et confondu avec le focus clavier.
- **Réutiliser la classe `selected`** : la sélection a un autre sens (portée des statuts) et le menu contextuel s'y accroche.

### 5. Geler la hauteur du bandeau d'ancêtres pendant l'édition

`update()` lit la présence d'un `.title-input` ; tant qu'un champ est ouvert, un changement de `innerHeight` ne déclenche plus `sizeBar`/`refreshReserve` (la barre garde sa hauteur et sa réserve). `renderChain` continue de tourner, donc le défilement reste suivi. À la fermeture, `schedule()` remesure la barre et republie `--topbar-height`. `reloadOutline` n'étant plus appelé après un renommage, le `htmx:afterSwap` ne relance plus la mesure au mauvais moment.

*Alternatives écartées :*

- **Figer aussi le contenu de la barre** : le fil d'Ariane deviendrait faux dès que l'utilisateur fait défiler la page pendant l'édition ; seule la hauteur doit être stable.
- **Supprimer l'animation de la barre** : elle est utile au défilement et n'est pas la cause du saut.

### 6. Le mouvement réduit et les tests traités des deux côtés

CSS : une requête `prefers-reduced-motion: reduce` annule la transition de `.line.editing`. JS : `matchMedia('(prefers-reduced-motion: reduce)').matches` choisit `behavior: 'auto'` pour le défilement de révélation. Les deux moitiés sont nécessaires : sans la garde JS, la révélation serait animée alors que l'utilisateur a demandé l'inverse.

Les tests sont ajoutés à `test/e2e/reindent.spec.js` (section tactile existante, 390 × 844) : pas de requête `outline-fragment` après une validation, champ suivant conservé pendant un `PUT` retardé, hauteur et positions stables sur un titre long, classe `.editing` présente puis retirée, hauteur du bandeau stable pendant une édition. Le clavier virtuel n'étant pas simulable, la géométrie du clavier reste une recette manuelle (iPhone + Android) consignée dans les tâches.

## Risks / Trade-offs

- **Le `<textarea>` se comporte différemment d'un `<input>` sur iOS** (majuscule automatique, touche Entrée, poignée de redimensionnement) → `resize: none`, `Entrée` reste neutralisée et transformée en « nouvelle ligne », et la recette manuelle couvre la saisie, le collage et le curseur. Le champ garde la classe `title-input`, donc les tests et les chemins `Tab`/`Entrée` restent valables.
- **Un titre contenant un lien inline peut grandir à l'édition** (le source est plus long que le libellé) → assumé : c'est une croissance, jamais un rétrécissement ; le cas est rare et le texte reste entièrement visible.
- **Une réponse `Entrée`/`Tab` ignorée retarde l'apparition de la nouvelle ligne** si l'utilisateur a ouvert un autre champ entre-temps → la ligne est affichée à la fermeture du champ par un rafraîchissement complet, jamais perdue ; le cas demande deux gestes pendant l'aller-retour.
- **Un `PUT` en arrière-plan qui échoue** laisse le titre peint localement et l'ancien titre côté serveur → l'erreur est journalisée et un rechargement suivant rétablit l'état serveur ; pas de reprise automatique dans ce changement.
- **`visualViewport` absent ou bridé** (vieux moteurs, WebView) → l'encoche reste à 0 et le plafond de 350 ms déclenche la révélation ; le comportement est alors proche de l'actuel, sans régression.
- **`scroll-padding-bottom` non nul pendant que le clavier est ouvert** → il ne s'applique qu'aux défilements programmés et aux ancres ; aucune ancre n'est activée pendant la saisie.
- **Rotation ou redimensionnement pendant l'édition** → la barre garde sa hauteur jusqu'à la fermeture, puis se remesure ; la ligne peut alors être repositionnée par le navigateur, cas rare et hors du geste courant.
- **Tests Playwright** → ils couvrent les invariants applicatifs, pas le clavier ; le risque résiduel est une géométrie différente sur un appareil réel, d'où la recette manuelle.
- **Cache du service worker** → `app.js` et `style.css` sont précachés : `CACHE_VERSION` doit être incrémenté, sinon un client déjà équipé rejoue l'ancien comportement.

## Migration Plan

Aucune migration de données. Déployer `app.js`, `style.css` avec un incrément de `CACHE_VERSION` dans `public/sw.js`. Retour arrière : rétablir les deux fichiers et la version précédente ; aucun état persisté n'est modifié, le renommage reste un `PUT` de titre.

## Open Questions

- **Faut-il viser le tiers supérieur de la zone visible plutôt que « juste au-dessus du clavier » ?** Le choix « juste au-dessus » minimise le déplacement et respecte la règle « un seul mouvement » ; à confirmer sur iPhone et Android en recette, avec un titre long en bas de page.
- **`Entrée` qui garde le clavier ouvert** : hors périmètre (création optimiste). À réévaluer après ce changement, une fois la sortie d'édition stabilisée.
