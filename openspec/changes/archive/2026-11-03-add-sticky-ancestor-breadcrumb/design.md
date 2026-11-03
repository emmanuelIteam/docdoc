## Context

La page d'un domaine est un document qui défile avec la fenêtre : le panneau latéral et l'en-tête (`.topbar`, qui porte le `<h1>` du domaine) sont dans le flux et sortent de l'écran dès les premières centaines de pixels. L'outline est rendu côté serveur comme une suite plate de `<li class="line" id="node-<id>" data-parent="<id>" data-depth="<n>">` ; le DOM contient le titre affiché de chaque ligne visible, et un ancêtre replié n'a pas ses descendants dans le DOM. Le client (`public/app.js`) ne connaît donc la hiérarchie que par `data-parent`, qu'il remonte déjà pour d'autres usages (sous-arbre de sélection, glisser-déposer).

## Goals / Non-Goals

**Goals :**

- Maintenir le nom du domaine visible en haut de la fenêtre pendant le défilement.
- Afficher, sous le nom du domaine, la chaîne des tâches mères de la première ligne visible, une ligne par niveau.
- Faire suivre cette chaîne au défilement et aux re-rendus htmx.
- Laisser la chaîne vide quand la première ligne visible est un projet de niveau 1.
- Rendre chaque maillon cliquable vers la tâche correspondante, sans que la barre masque la ligne ciblée.
- Garder la première ligne de l'outline sous la barre et un défilement stable, y compris en fin de page.

**Non-Goals :**

- Aucun changement de l'ordre d'affichage, de la profondeur, du parent, du modèle de nœud ou des routes.
- Aucun sommaire latéral ni liste de tous les projets : seuls les ancêtres de la ligne lue sont montrés.
- Pas de nouvelle requête réseau : la chaîne est lue dans le DOM déjà rendu.
- Aucun repli de la barre ni comportement au clic sur le nom du domaine.

## Decisions

### 1. La barre est l'en-tête existant, rendu collant, et la chaîne est empilée dessous

`renderShell` pose `id="topbar"` sur l'élément `.topbar` existant et y ajoute, uniquement pour la page d'un domaine (`opts.ancestry`), un `<nav id="ancestry" aria-label="Hiérarchie des tâches mères">` vide. Le `<h1>` reste le nom du domaine ; le `<nav>` se place sur la ligne suivante (`flex: 0 0 100%`) et empile ses maillons verticalement, chacun indenté d'un cran de plus que le précédent.

*Alternatives écartées :*

- **Une seconde barre au-dessus de l'en-tête** : deux surfaces collantes, un décalage à calculer et un doublon visuel du nom du domaine.
- **Mettre le nom du domaine dans le `<nav>` et supprimer le `<h1>`** : la page perdrait son titre de niveau 1 et la barre changerait de hauteur entre les pages.
- **Rendre la barre collante côté client** : `position: sticky` suffit, fonctionne sans JavaScript et ne dépend pas du défilement pour la position.

### 2. La chaîne appartient au flux de l'en-tête, elle ne flotte pas au-dessus de l'outline

Le `<nav>` n'est pas positionné en absolu : il fait partie de la hauteur de l'en-tête collant. Quand il grandit, l'outline est poussé vers le bas, il n'est pas recouvert. C'est ce qui garantit que la chaîne décrit exactement la ligne que l'on voit sous la barre, et non une ligne cachée derrière un panneau flottant.

*Alternatives écartées :*

- **Un panneau absolu sous l'en-tête** : il recouvre les premières lignes ; le premier élément visible sous le panneau peut être un enfant dont le parent est caché, et la chaîne ne correspond plus à ce que l'on lit.
- **Un panneau fixe avec un espace réservé constant** : stable, mais laisse en permanence des lignes vides ou tronque la chaîne alors que la profondeur varie.

### 3. Le client calcule la chaîne de la première ligne visible

À chaque défilement (throttlé par `requestAnimationFrame`), le client mesure le bas de l'en-tête et cherche la première `.line` dont le bas dépasse cette limite : c'est la ligne en cours de lecture. Il remonte ses `data-parent` pour construire la chaîne, du plus lointain au plus proche, et lit chaque titre dans `.title` (`textContent`, donc le libellé affiché même si le titre contient un lien de tâche).

La recherche est une dichotomie sur les lignes, dont les positions verticales sont croissantes dans l'ordre d'affichage : le coût reste logarithmique même avec une multitude de tâches.

*Alternatives écartées :*

- **Un observateur d'intersection par ligne** : autant d'observateurs que de lignes, et un ordre de rappel non garanti pour désigner « la première ».
- **Faire calculer la chaîne par le serveur** : le serveur ignore la position de défilement ; il faudrait une requête à chaque mouvement.
- **Un écouteur `scroll` par ligne** : même problème de volume, pour un résultat moins direct.

### 4. La hauteur variable de l'en-tête est neutralisée en fin de page

Une chaîne qui grandit avec la profondeur rend la hauteur de l'en-tête variable. Deux effets indésirables sont traités :

1. **Le point de référence ne dépend pas de la hauteur.** L'en-tête et l'outline se déplacent de la même quantité quand la chaîne grandit : la première ligne visible reste la même, et la chaîne ne peut pas s'auto-alimenter. `main { overflow-anchor: none; }` empêche le navigateur de compenser cette croissance par un défilement, ce qui changerait la ligne de référence.
2. **La hauteur totale du document reste constante.** Le client mesure une fois la hauteur de la chaîne la plus profonde possible (`refreshReserve`, avec une sonde hors flux) et publie `--chain-reserve` ; le pied de page réserve cette hauteur moins la hauteur courante de la chaîne (`--chain-height`). En fin de page, la croissance de l'en-tête ne modifie donc plus la hauteur totale : le défilement n'est pas rappelé entre deux états et la chaîne ne peut pas osciller.

*Alternatives écartées :*

- **Laisser faire l'ancrage de défilement** : en grandissant, l'en-tête pousse le contenu ; le navigateur compense, la première ligne change, la chaîne grandit encore — une boucle mesurée en fin de page.
- **Figer la chaîne en fin de page** : le symptôme disparaît, mais la chaîne peut rester en décalage d'un niveau par rapport à la ligne visible.
- **Plafonner la hauteur de la chaîne** : stable, mais le besoin est justement de voir toute la hiérarchie, quel que soit le nombre de niveaux.

### 5. La chaîne est reconstruite seulement quand elle change

Le client compare la suite d'ids et de libellés à la précédente et ne réécrit le `<nav>` qu'en cas de différence : les liens ne sont pas recréés à chaque pixel de défilement, et un clic sur un maillon n'est pas perdu par un remplacement intempestif. Les libellés font partie de la signature pour qu'un renommage d'ancêtre mette le maillon à jour.

*Alternatives écartées :*

- **Réécrire le `<nav>` à chaque frame** : réalloue des nœuds et casse le survol/le focus des liens pendant le défilement.
- **Signer seulement les ids** : un renommage ne change pas la chaîne et laisserait un libellé périmé.

### 6. Chaque maillon pointe vers l'ancre de la tâche, les lignes réservent la hauteur de la barre

Chaque maillon est un `<a href="#node-<id>">`. Les lignes reçoivent `scroll-margin-top: calc(var(--topbar-height) + .5rem)`, la hauteur réelle de l'en-tête étant publiée par le client dans `--topbar-height` ; une ancre (clic sur un maillon, lien profond `#node-<id>`) s'arrête donc sous la barre au lieu d'être recouverte. La barre reste sous le menu contextuel (`z-index` de la barre inférieur à celui du menu) pour qu'un menu ouvert près du haut reste cliquable.

*Alternatives écartées :*

- **Des maillons non cliquables** : la barre indiquerait la hiérarchie sans permettre d'y remonter, alors que le besoin est de se repérer et de revenir.
- **Un défilement JavaScript au clic** : l'ancre native fait déjà le travail, reste partageable et fonctionne sans script supplémentaire.

### 7. Mise à jour après un swap htmx

L'outline est régulièrement remplacée (`hx-swap="outerHTML"`) : le client écoute `htmx:afterSwap` et `htmx:afterSettle` pour recalculer la chaîne sans attendre un mouvement de défilement. Le cache des lignes et la réserve de hauteur sont invalidés dès que l'élément `#outline` change d'identité.

*Alternatives écartées :*

- **Un `MutationObserver` sur tout le document** : coûteux pour un besoin déjà signalé par les événements htmx.

## Risks / Trade-offs

- **La barre grandit avec la profondeur** → c'est le comportement demandé ; une branche profonde consomme plusieurs lignes d'écran, et la chaîne est plafonnée en hauteur (`max-height: 40vh`) avec un défilement interne au-delà.
- **L'outline se décale quand la chaîne apparaît ou change de niveau** → c'est le prix de la non-superposition ; le décalage est d'une ligne par niveau et ne se produit qu'aux changements de branche.
- **Une chaîne longue sur un écran étroit** → chaque maillon est tronqué avec une ellipse et la barre ne dépasse jamais la largeur de la fenêtre.
- **Le premier rendu est vide avant le calcul client** → la chaîne est calculée au chargement, pas au premier défilement ; sans JavaScript, la barre montre le nom du domaine, ce qui reste le comportement de repli.
- **Une ligne repliée cache ses descendants** → un ancêtre d'une ligne visible est toujours dans le DOM (sinon la ligne ne le serait pas) : la remontée de `data-parent` ne rencontre pas de trou.
- **Le menu contextuel d'une ligne tout en haut** → il est peint au-dessus de la barre (z-index supérieur), donc reste utilisable.
- **La marge basse réserve la chaîne la plus profonde** → quelques dizaines de pixels de blanc en fin de page ; c'est le prix d'un défilement sans oscillation.

## Migration Plan

Aucune migration : seuls le rendu, le style et le comportement client changent. Déploiement normal, avec un incrément de `CACHE_VERSION` puisque `style.css` et `app.js` sont précachés. Retour arrière : retirer le `<nav>`, l'initialisation client et les règles CSS ; aucune donnée n'est concernée.

## Open Questions

Aucune question bloquante.
