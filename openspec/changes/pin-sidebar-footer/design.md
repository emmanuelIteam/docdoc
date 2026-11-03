## Context

Le panneau latéral est rendu côté serveur (`renderSidebar`) comme un `<aside class="sidebar" id="sidebar">`, premier élément d'une grille `.shell { grid-template-columns: auto 1fr; min-height: 100vh }`. Il est en `display: flex; flex-direction: column` et contient, dans l'ordre : la rubrique Accueil (`.sidebar-top`), le titre « Domaines » (`.sidebar-header`), la liste des domaines (`#sidebar-nav`, `flex: 1; overflow-y: auto`) et le bloc bas (`.sidebar-footer` : Administration, Aide, installation, session).

Aucune de ces règles ne borne la hauteur du panneau. Un élément de grille s'étire par défaut sur la hauteur de la ligne, elle-même dimensionnée par la colonne de contenu : le panneau est donc au moins aussi haut que la page. Quand la liste des domaines devient longue, c'est le panneau qui grandit, la page avec lui, et le `overflow-y: auto` de la liste ne s'active jamais — il n'y a rien à faire défiler dans un conteneur dont la hauteur suit le contenu. Conséquence : le bloc bas se retrouve à la fin d'un panneau de plusieurs écrans, et il faut faire défiler toute la page pour l'atteindre, y compris sur une page dont le contenu est court (la page ne défile alors que pour aller chercher le pied du panneau).

## Goals / Non-Goals

**Goals :**

- Le panneau occupe exactement une hauteur d'écran et reste visible en haut de la fenêtre quand la page défile.
- Le bloc bas est toujours affiché au bas de l'écran : au bas de la fenêtre quand la liste est courte, sous la liste qui défile quand elle est longue.
- La liste des domaines est la seule partie qui défile, à l'intérieur du panneau.
- Le cas courant (liste courte) garde son rendu : le bloc bas était déjà au bas de l'écran, il y reste.
- Repli, persistance et largeur nulle du panneau replié inchangés.

**Non-Goals :**

- Aucun changement du balisage rendu par `renderSidebar`, des routes, du modèle de données ni du JavaScript client.
- Aucun changement du groupement par thème, de la surbrillance de la page active, de la lecture seule du panneau ni du repli sur écran étroit.
- Aucun défilement automatique de la liste jusqu'au domaine actif : la liste s'ouvre en haut, comme avant, et l'utilisateur la fait défiler (voir « Open Questions »).
- Aucun bandeau de défilement personnalisé, aucun changement de largeur du panneau.

## Decisions

### 1. Une hauteur d'écran épinglée en haut, plutôt qu'un panneau fixe

`.sidebar` reçoit `height: 100vh`, puis `height: 100dvh` (repli pour les navigateurs sans `dvh`), `position: sticky`, `top: 0` et `align-self: start`.

`sticky` garde le panneau dans le flux de la grille : il continue de définir la colonne `auto` de `.shell`, le contenu reste à sa droite sans marge calculée à la main, et la transition de largeur du repli (150 ms) reste celle de la colonne. `align-self: start` est indispensable : sans lui, l'élément de grille s'étire sur toute la hauteur de la ligne, `height` ne s'applique plus comme hauteur libre et `sticky` n'a aucune course — le pied repartirait sous la ligne de flottaison.

*Alternatives écartées :*

- **`position: fixed`** : sortirait le panneau du flux ; il faudrait réserver la largeur de la colonne par un `padding-left` sur `.shell`, synchronisé à la main avec le repli, et le panneau ne suivrait plus le zoom ni le défilement horizontal de la page.
- **`.shell { height: 100vh }` et `.content { overflow-y: auto }`** : donnerait un défilement interne à la colonne de contenu, ce qui déplace le référentiel de défilement de la page — donc des comportements existants (barre d'outils collante, ancres `scroll-margin-top`, `scrollIntoView` des liens de tâches, restauration du défilement) — pour un besoin qui ne concerne que le panneau.
- **Limiter la hauteur du panneau à `calc(100vh - …)`** : chaque nouvelle rangée du panneau (rubrique, titre, pied, session) devrait être recomptée dans le calcul ; une hauteur d'écran et un pied non compressible expriment la même chose sans nombre magique.

### 2. Seule la liste défile ; le pied ne se comprime jamais

`.sidebar-nav` garde `flex: 1` et reçoit `min-height: 0` : sans lui, la taille minimale automatique d'un élément flex vaut sa hauteur de contenu, et la liste refuserait de rétrécir — c'est exactement ce qui poussait le pied hors de l'écran. `.sidebar-footer` reçoit `flex: 0 0 auto` (comme `.sidebar-top` et `.sidebar-header`), pour que ce soit toujours la liste qui cède la place, jamais les entrées du bas.

Quand la liste tient, `flex: 1` la fait grandir jusqu'au pied, qui reste donc au bas de la fenêtre : le cas courant est inchangé. Quand elle déborde, sa hauteur est plafonnée par celle du panneau et `overflow-y: auto` prend le relais.

*Alternatives écartées :*

- **Faire défiler tout le panneau** (`overflow-y: auto` sur `.sidebar`, pied dans le flux) : le pied quitterait l'écran dès que la liste est longue, c'est-à-dire exactement le défaut à corriger.
- **Un pied `position: sticky; bottom: 0`** : le rendrait collant dans le panneau sans garantir qu'il soit visible quand le panneau entier est hors écran, et le ferait chevaucher la liste plutôt que de lui laisser la place.

### 3. `100dvh` avec repli `100vh`

Sur un téléphone, la barre d'URL rétractable change la hauteur visible. `100dvh` suit cette hauteur dynamique ; la déclaration `100vh` qui la précède sert de repli aux navigateurs qui ne connaissent pas `dvh`, avec au pire une bande de quelques dizaines de pixels sous le pied. La hauteur n'est pas `calc(100vh - …)` : le panneau n'a pas de marge extérieure, son `padding` de 1 rem est inclus dans la hauteur par le `box-sizing: border-box` global.

### 4. Les cas limites restent ceux du rendu existant

- Fenêtre très basse (téléphone en paysage, par exemple) : la liste peut tomber à zéro de hauteur et défiler pour un seul domaine ; c'est le compromis qui garde le pied visible.
- Panneau replié : la largeur passe à zéro et le `overflow: hidden` déjà en place masque liste et pied ; rien à ajouter.
- Barre d'étiquettes flottante (`.labels-bar`, `position: fixed` en bas à droite) : elle ne chevauche pas le panneau, qui est une colonne de la grille.

## Risks / Trade-offs

- **La liste défile désormais dans le panneau** : le domaine actif peut être hors de vue au chargement d'une page dont la liste est longue. Le défilement de la liste est direct (molette, doigt, barre de défilement) et le pied reste accessible. Un défilement automatique vers l'entrée active serait une amélioration séparée.
- **Le panneau ne défile plus avec la page** : sur une page longue, il reste en place au lieu de disparaître vers le haut ; c'est le comportement demandé et il rapproche le panneau d'une navigation persistante.
- **Hauteur dynamique sur mobile** : un navigateur sans `dvh` peut laisser une bande sous le pied quand la barre d'URL est masquée ; aucune entrée n'est alors inaccessible, seule la position exacte diffère.
- **Tests existants** : aucun n'affirme la position ni la hauteur du pied ; les cas ajoutés (1.6 et 1.7 de `sidebar.spec.js`) la mesurent, et les cas 1.1 à 1.5 restent valables (ils ne dépendent que de la largeur du panneau).

## Migration Plan

Aucune migration de données. Déploiement d'actifs avec un incrément de `CACHE_VERSION` (`style.css` est précaché). Retour arrière : retirer la hauteur, `position: sticky`, `top`, `align-self`, `min-height: 0` et les `flex: 0 0 auto` ; le panneau reprend sa hauteur naturelle.

## Open Questions

Aucune question bloquante. Amélioration possible, hors périmètre : faire défiler la liste jusqu'au domaine actif à l'ouverture d'une page.
