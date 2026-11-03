## Context

L'outline est rendu côté serveur. `renderOutline` (`server.js`) parcourt l'ordre d'affichage, saute les nœuds `hiddenNodeIds` et émet une ligne plate par nœud visible via `renderLine`. Une ligne porte déjà sa profondeur, son parent et son id d'ancre ; sa puce `.bullet` est le seul contrôle de tête (sélection au clic, pli/dépli au double-clic, glisser-déposer) et contient deux glyphes qui partagent le même emplacement : le point `.bullet-dot` et la poignée `.bullet-grip` affichée quand la ligne est la tête sélectionnée.

Sur un écran large avec survol, `.bullet` est `visibility: hidden` et n'apparaît qu'au survol ou quand la ligne est sélectionnée. Une ligne repliée ne rend pas ses descendants : rien dans le DOM ne signale qu'elle en a. Le drapeau `node.collapsed` est persisté, et `expandIds` permet déjà de déplier temporairement les ancêtres d'une cible `?reveal=` sans changer cet état persisté.

## Goals / Non-Goals

**Goals:**

- Rendre visible, sans survol, la puce d'une ligne repliée qui contient des sous-tâches.
- Distinguer cette puce par un anneau qui signale la composition en sous-tâches.
- Aligner l'indicateur sur ce qui est réellement affiché : une ligne que `?reveal` a dépliée ne doit pas paraître repliée.
- Ne décaler ni le titre de la ligne ni celui de ses voisines, et ne pas gêner le passage point → poignée de la ligne sélectionnée.
- Exposer l'état replié dans l'étiquette accessible de la puce.
- Ne plus dépendre de l'événement natif `dblclick` pour replier/déplier : le geste est reconnu à partir de deux clics sur la puce.

**Non-Goals:**

- Aucun changement du modèle de données, du drapeau `collapsed`, de la route de pli ou du rendu de l'outline (ordre, profondeur, parent).
- Aucun compteur du nombre de sous-tâches, aucune infobulle supplémentaire.
- Aucun changement du geste lui-même (le double-clic sur la puce) ni de la sélection au clic simple.
- Aucune animation ni transition.

## Decisions

### 1. L'état replié affiché est calculé par `renderOutline`

`renderOutline` connaît `expandIds` et calcule déjà la visibilité ; il calcule de la même façon `isCollapsed = hasKids && node.collapsed && !expandIds?.has(node.id)` et le passe à `renderLine`. `renderLine` n'a donc pas à relire `node.collapsed` seul, ce qui éviterait d'afficher un anneau sur une ligne que la révélation a dépliée.

*Alternatives écartées :*

- **Lire `node.collapsed` dans `renderLine`** : simple, mais faux sous `?reveal`, où la ligne est affichée dépliée tout en restant persistée repliée.
- **Calculer l'état côté client** : le client devrait déduire la présence de sous-lignes cachées de l'ordre d'affichage et du DOM, alors que le serveur a l'information exacte ; cela introduit un second modèle de vérité.

### 2. Une classe sur la ligne et un marqueur dédié dans la puce

La ligne reçoit la classe `collapsed` et la puce reçoit un élément `.bullet-subtasks` (anneau) rendu uniquement dans ce cas, en plus du point et de la poignée existants. Le marqueur est `aria-hidden="true"` : c'est un repère visuel, l'état étant porté par l'étiquette du bouton.

*Alternatives écartées :*

- **Changer le glyphe du point** (`◉`, `○`, etc.) : la lisibilité d'un glyphe de 0,7 rem est incertaine, et le glyphe devrait cohabiter avec la poignée de la ligne sélectionnée ; un anneau CSS reste net à toutes les tailles.
- **Remplacer le point par un compteur** : plus riche, mais le besoin est binaire (« composée de sous-tâches ») et un compteur déborderait de l'emplacement de la puce ou décalerait le titre.

### 3. L'anneau est superposé, jamais dans le flux

`.bullet` devient `position: relative` et `.bullet-subtasks` est positionné au centre (`position: absolute` + `translate(-50%, -50%)`), avec un diamètre légèrement supérieur à celui du point et une bordure `1px solid currentColor`. L'anneau ne participe donc pas à la largeur de la puce : ni le titre ni les lignes voisines ne bougent quand il apparaît ou disparaît. Sur la tête sélectionnée, la poignée de glisser remplace le point : l'anneau est alors masqué pour que la poignée reste lisible, puis revient avec le point quand la sélection est levée (la puce reste visible pendant tout ce temps).

*Alternatives écartées :*

- **Élargir la puce quand elle est cerclée** : décale le titre de la ligne et celui des voisines, ce que l'exigence « le bouton ne doit pas décaler le texte » interdit.
- **Un `box-shadow` sur le point** : la boîte d'un glyphe inline suit la hauteur de ligne et non le glyphe, l'anneau serait ovale.
- **Garder l'anneau autour de la poignée** : à la taille de la puce, la poignée à six points devient illisible dans le cercle ; le masquer est plus net et la sélection est un état transitoire.

### 4. Révélation permanente par CSS

`.line.collapsed .bullet { visibility: visible; }` placé après la règle de masquage. Le pli et le dépliage restent rendus par le serveur : le double-clic renvoie l'outline re-rendue, avec ou sans la classe, et l'indicateur suit. Le client ne conserve aucun état de pli.

*Alternatives écartées :*

- **Afficher la puce en JavaScript au chargement** : inutile, un rendu serveur suffit et fonctionne sans JS pour l'affichage.
- **Rendre la puce toujours visible sur toutes les lignes** : changerait l'esthétique de l'outline et la règle de survol existante, hors du besoin.

### 5. Détecter le double-clic à partir de deux clics

Le repli était déclenché par l'événement natif `dblclick` sur la puce. Or le premier clic change le contenu de la puce (le point devient la poignée, l'anneau disparaît) : les deux clics peuvent donc viser des glyphes différents, et certains environnements n'émettent alors pas de `dblclick` ; un double-tap tactile ne l'émet pas non plus de façon fiable. Le gestionnaire de clic existant compte donc les clics sur la puce : deux clics sur la même ligne, à moins de 500 ms d'intervalle et à moins de 8 px l'un de l'autre, déclenchent le POST de pli et ne font pas avancer la sélection. Un clic ailleurs remet le compteur à zéro. L'écoute de `dblclick` est retirée pour ne pas plier deux fois.

*Alternatives écartées :*

- **Garder `dblclick` et ajouter un second détecteur** : le POST partirait deux fois (pli puis dépli), ou il faudrait un verrou temporel fragile.
- **Changer le geste pour un clic simple** : la sélection de la ligne et de son sous-arbre occupe déjà le clic simple.

### 6. Étiquette accessible de la puce

Pour une ligne repliée avec sous-tâches, `aria-label` devient par exemple « Sélectionner la ligne — repliée, contient des sous-tâches masquées » ; les autres lignes gardent « Sélectionner la ligne ». Le `title` (infobulle de l'action) reste inchangé pour ne pas modifier l'aide existante.

## Risks / Trade-offs

- **Une puce visible en permanence sur les lignes repliées** → c'est le but (repérage sans survol) ; l'outline reste sobre car seules les lignes repliées avec sous-tâches changent.
- **Un anneau peu visible sur un petit point** → bordure `1px` dans la couleur d'accent (`currentColor`), diamètre légèrement supérieur au point ; sur écran étroit la puce est déjà plus grande et l'anneau suit la couleur adoucie de la puce.
- **L'anneau disparaît sur la tête sélectionnée** → la poignée occupe le même emplacement et doit rester lisible ; l'anneau revient avec le point dès que la sélection est levée.
- **La révélation `?reveal` est temporaire** → l'indicateur suit l'affichage réel, donc une ligne persistée repliée mais dépliée par la révélation n'affiche pas d'anneau ; rouvrir la page sans `reveal` réaffiche l'anneau avec l'état persisté.
- **Deux clics rapides sur la puce pourraient être deux clics de sélection** → c'était déjà le cas avec `dblclick` : deux clics assez rapprochés forment le geste de pli, et non deux étapes de sélection. Le seuil de 500 ms et l'écart de 8 px gardent le geste fidèle à un vrai double-clic.
- **Un double-clic très lent (au-delà de 500 ms) ne plie pas** → il reste deux clics de sélection ; le seuil est celui d'un double-clic système courant.

## Migration Plan

Aucune migration : seuls le rendu, la feuille de style et le détecteur de geste changent. Déploiement normal ; `CACHE_VERSION` est incrémenté car `app.js` et `style.css` sont précachés. Retour arrière : retirer la classe, le marqueur et les règles CSS associées, et restaurer l'écoute de `dblclick` ; les domaines existants restent valides puisque `collapsed` n'est pas modifié.

## Open Questions

Aucune question bloquante.
