## Context

Chaque page est rendue côté serveur (`renderShell`) et chaque entrée du panneau est une ancre ordinaire : la sélectionner provoque un chargement complet du document. Le client ne connaît qu'un état, la classe `sidebar-collapsed` sur `<body>`, persistée dans `localStorage`.

La première version de ce changement repliait le panneau **avant** de quitter la page, en retardant la navigation. À l'usage, l'ordre est perçu à l'envers : on voit le panneau se refermer, puis la page suivante remplacer la précédente. Le geste attendu est l'inverse — la page demandée apparaît, puis le panneau se range — ce qui impose de déplacer le repli sur la page d'arrivée.

Le reste de l'interface (outline, étiquettes) est mis à jour en place par htmx, sans rechargement : ces mises à jour ne doivent pas être concernées par le fondu.

## Goals / Non-Goals

**Goals :**

- Suivre le lien immédiatement : aucune latence de navigation ajoutée.
- Afficher la page demandée d'abord, panneau encore ouvert, avec son contenu en fondu.
- Replier ensuite le panneau par un mouvement continu et bref, puis persister l'état.
- Supprimer les deux animations quand `prefers-reduced-motion: reduce` est actif, sans retarder la navigation.
- Garder strictement le même état persisté, les mêmes entrées concernées et le même comportement sur un écran large.

**Non-Goals :**

- Aucune transition entre documents via la View Transitions API : le support inter-navigateurs est encore inégal et le fondu CSS couvre le besoin sans dépendance.
- Aucun paramètre d'URL ni attribut de lien modifié : l'intention de repli voyage dans `sessionStorage`.
- Aucun repli automatique sur un écran large : la décision prise avec `collapse-sidebar-on-page-navigation` reste valable.
- Aucun réglage utilisateur supplémentaire : `prefers-reduced-motion` est le seul interrupteur.

## Decisions

### 1. L'intention de repli traverse le chargement dans `sessionStorage`

Au clic sur une entrée du panneau (écran étroit, panneau ouvert, clic non modifié), le gestionnaire dépose `Date.now()` sous la clé `sidebarCollapseOnLoad` et laisse le navigateur suivre le lien : pas de `preventDefault`, donc la page demandée part immédiatement. La page d'arrivée, dans `applySidebarState()`, consomme la clé, la retire, et programme le repli. L'horodatage borne la validité à 15 s : une navigation annulée ne laisse pas une intention périmée replier le panneau d'une page ouverte bien plus tard.

La page des passkeys est un cas particulier : elle n'a pas de panneau (coquille d'authentification). Pour cette destination, l'état est persisté au clic, immédiatement, au lieu de laisser une intention en attente pour la prochaine page à panneau.

*Alternatives écartées :*

- **Retarder la navigation puis replier (version précédente)** : c'est précisément l'ordre que l'utilisateur rejette — le repli se voit sur la page que l'on quitte.
- **Persister `sidebarCollapsed` avant de partir, puis animer à l'arrivée** : impossible de distinguer « état déjà replié » de « repli demandé par cette navigation » ; la page arriverait repliée, sans mouvement à montrer.
- **Paramètre d'URL (`?repli=1`)** : alourdit chaque lien et crée des URL différentes pour la même page.
- **`document.referrer` ou un drapeau en mémoire** : le document est remplacé, la mémoire du document disparaît ; le référent ne dit pas si le panneau était ouvert.

### 2. Le repli se joue à l'arrivée, une fois le fondu terminé

La page d'arrivée appelle `setTimeout(..., 300)` : le fondu du contenu dure 200 ms (`page-fade-in`), les 100 ms restantes séparent nettement les deux mouvements. Le délai est une constante JS unique, commentée comme dépendante de la durée du fondu dans `style.css`.

Le repli lui-même est une transition de `width`, `padding`, `border-right-width` et `opacity` (240 ms, courbe `--panel-ease`), partagée avec le fondu par les variables `:root`. La transition n'est activée qu'après la pose de l'état persisté (`sidebar-ready` sur `<body>`, ajouté à la frame suivante) : une page rechargée avec le panneau déjà replié ne rejoue pas le repli.

*Alternatives écartées :*

- **Animer `grid-template-columns`** : une piste `auto` ne s'anime pas vers une longueur fixe de façon fiable ; animer la largeur de l'élément donne déjà le bon mouvement.
- **`transform: translateX(-100%)`** : sortirait le panneau du flux de la grille et laisserait sa largeur réservée, ou demanderait de changer la structure.
- **Écouter `animationend` du fondu** : plus « juste » en théorie, mais l'événement peut manquer (animation annulée, onglet en arrière-plan) et il faudrait un minuteur de secours de toute façon ; le délai fixe est déterministe et testable.

### 3. Fondu du contenu par une animation CSS au chargement

`@keyframes` d'opacité `0 → 1` appliquée à `.content` (barre de titre comprise) avec `animation: ... both`. Elle ne s'exécute qu'au chargement du document : les swaps htmx remplacent des enfants de `main` et ne rejouent donc pas l'animation. Le fondu est purement visuel : la mise en page est complète dès la première peinture, et le contenu est utilisable pendant l'animation. Le panneau n'est pas inclus : il reste ouvert pendant le fondu, puis se replie, ce qui est exactement l'ordre demandé.

*Alternatives écartées :*

- **Classe posée en JavaScript au `DOMContentLoaded`** : le contenu serait peint opaque puis rendu transparent, produisant le clignotement que l'on veut éviter.
- **Animer `main` seulement** : la barre de titre resterait peinte d'un bloc au-dessus d'un contenu en fondu.

### 4. `prefers-reduced-motion` traité des deux côtés

En CSS, une requête `@media (prefers-reduced-motion: reduce)` annule la transition du panneau et l'animation du fondu. En JavaScript, `matchMedia('(prefers-reduced-motion: reduce)')` fait appliquer l'état replié dès le chargement de la page d'arrivée, sans attendre ni animer : la page arrive panneau replié. La navigation, elle, n'est jamais retardée.

## Risks / Trade-offs

- **La page s'affiche dans la largeur étroite pendant ≈ 300 ms avant que le panneau ne se replie** → c'est l'ordre demandé (page d'abord), et l'attente est bornée ; si ce délai paraît trop long ou trop court, il tient dans une constante JS.
- **L'état n'est persisté qu'à la fin du repli** → quitter la page dans les 300 ms qui suivent laisse le panneau ouvert sur la suivante, ce qui correspond à un repli non terminé.
- **Une navigation annulée laisse une intention en attente** → l'horodatage la rend inopérante au bout de 15 s ; une intention fraîche reste bloquée si la navigation échoue juste après, cas rare.
- **Stockage indisponible (mode privé, cadre embarqué)** → le code retombe sur l'ancien comportement (repli immédiat au clic) au lieu de ne rien replier.
- **Cache du service worker** → `style.css` et `app.js` sont précachés : `CACHE_VERSION` doit être incrémenté, sinon un client déjà équipé peut rejouer l'ancien comportement.

## Migration Plan

Aucune migration de données. Déployer `style.css` et `app.js` avec un incrément de `CACHE_VERSION` dans `public/sw.js`. Retour arrière : rétablir l'ancien écouteur et l'ancienne transition ; les valeurs `localStorage` existantes restent lues par `applySidebarState()`.

## Open Questions

Aucune question bloquante.
