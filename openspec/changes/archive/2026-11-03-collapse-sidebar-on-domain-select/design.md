## Context

Le panneau latéral est rendu côté serveur (`renderSidebar`) comme un `<aside class="sidebar">` dans une grille `auto 1fr` : il n'est pas un tiroir superposé, et sa largeur de 240 px est retirée à la colonne de contenu quand il est ouvert. Le client (`public/app.js`) ne gère aujourd'hui qu'un seul état : la classe `sidebar-collapsed` sur `<body>`, basculée par le bouton ☰, et persistée dans `localStorage` sous la clé `sidebarCollapsed` ; `applySidebarState()` la rétablit au chargement. Chaque navigation (y compris d'un domaine à l'autre depuis le panneau) est un chargement complet de document : aucun état client ne survit au changement de page, sauf ce qui est persisté.

## Goals / Non-Goals

**Goals :**

- Replier le panneau quand un domaine est choisi depuis celui-ci sur un smartphone, pour que l'outline du domaine choisi occupe la largeur disponible.
- Retrouver le panneau replié sur la page du domaine choisi, ainsi qu'après un rechargement ou un retour arrière.
- Laisser le bouton ☰ rouvrir le panneau normalement.
- Ne rien changer sur un écran large ni pour les autres entrées du panneau (Administration, Aide).

**Non-Goals :**

- Transformer le panneau en tiroir superposé avec fond assombri : la grille et le flux restent inchangés.
- Replier le panneau sur un écran large, ou après un clic modifié (nouvel onglet, nouvelle fenêtre).
- Mémoriser une préférence distincte « mobile » / « bureau » : l'état replié est celui du panneau, un seul booléen, comme pour le bouton ☰.
- Aucun changement du rendu serveur, des routes, du modèle de données ni des autres entrées de navigation.

## Decisions

### 1. Le seuil du smartphone est celui de l'application : `(max-width: 640px)`

Le comportement s'active sur la même requête média que les règles d'espacement et d'indentation des lignes (640 px). « Smartphone » est ainsi défini par la largeur disponible, pas par une détection d'agent : c'est reproductible en test (`setViewportSize`), cela couvre aussi un petit appareil en portrait ou une fenêtre de bureau étroite, et aucun `userAgent` n'est à maintenir.

*Alternatives écartées :*

- **`(hover: none) and (pointer: coarse)`** : décrit l'appareil plutôt que la place disponible ; un téléphone en paysage (844 px) garderait un panneau dont la fermeture n'apporte rien, et un ordinateur portable tactile changerait de comportement sans changer de largeur.
- **Détection d'agent (`/iPhone|Android/`)** : fragile, impossible à simuler en test sans mentir sur l'identité du navigateur.

### 2. Le repli passe par le même état que le bouton ☰

`setSidebarCollapsed(collapsed)` écrit la classe `body.sidebar-collapsed` **et** la clé `localStorage` ; le bouton ☰ et la sélection d'un domaine l'appellent tous les deux. Il n'existe donc qu'un seul état, une seule clé et un seul rendu : la page suivante appelle `applySidebarState()` et se peint déjà repliée, sans clignotement d'un panneau ouvert.

*Alternatives écartées :*

- **Replier sans persister** : la page du domaine serait rechargée avec le panneau ouvert, puisque l'état ne survit pas à la navigation.
- **Un second état « replié pour cette navigation »** : deux sources de vérité, et le bouton ☰ devrait savoir laquelle écraser.
- **Transmettre l'état dans l'URL** (`?sidebar=collapsed`) : alourdit chaque lien, crée des URL différentes pour la même page et ne survit pas au retour arrière.

### 3. Le clic est observé sans être annulé

Un écouteur délégué sur `document` reconnaît un lien `.sidebar-link` contenu dans `.sidebar-nav` (donc un domaine, pas Administration ni Aide), vérifie que la fenêtre est étroite, écrit l'état, puis laisse la navigation par défaut se faire. Rien n'est fait de spécifique au domaine ciblé : le lien actif, comme un lien vers un autre domaine, referme le panneau.

*Alternatives écartées :*

- **Écouter chaque lien à la génération du rendu** : le `<nav>` est remplacé hors bande par htmx lors du rattachement d'une étiquette (`hx-swap-oob`), et les liens recréés perdraient leur écouteur ; la délégation survit à ce remplacement.
- **`preventDefault()` puis `window.location`** : reproduit à la main ce que le navigateur fait déjà et casse le clic milieu, les modificateurs et le menu contextuel du lien.

### 4. Les clics modifiés et les autres entrées du panneau sont laissés de côté

L'écouteur ignore un clic qui n'est pas le bouton principal ou qui porte `Ctrl`, `Cmd`, `Shift` ou `Alt` : un nouvel onglet ouvert depuis le panneau ne doit pas refermer le panneau de la page courante. Les entrées du pied (Administration, Aide) ne sont pas des domaines et gardent leur comportement actuel.

*Alternatives écartées :*

- **Replier sur toutes les entrées du panneau** : élargirait le besoin sans qu'il soit demandé ; les pages Administration et Aide ne sont pas la cible de la sélection de domaine.
- **Replier seulement si le panneau est déjà ouvert** : c'est équivalent en pratique (un panneau replié n'a pas de lien cliquable) tout en ajoutant une condition inutile.

## Risks / Trade-offs

- **Une seule préférence pour tous les écrans** → un utilisateur qui replie le panneau sur son téléphone le retrouvera replié sur son ordinateur s'il partage le même profil de navigateur. C'est déjà le comportement du bouton ☰ ; le bouton reste le moyen de le rouvrir.
- **Le repli se produit aussi dans une fenêtre de bureau étroite** → c'est le comportement voulu par le seuil ; au-delà de 640 px, rien ne change.
- **Sans JavaScript** → aucun repli automatique, mais le bouton ☰ fonctionne comme avant (le comportement de repli est purement client).
- **Le panneau se referme pendant le délai de navigation** → l'outline s'élargit brièvement avant le chargement ; c'est le retour visuel attendu, et la transition existante (150 ms) le rend lisible plutôt que brutal.
- **Le clic sur le domaine déjà actif** → recharge la page et referme le panneau, ce qui reste cohérent avec la sélection.

## Migration Plan

Aucune migration de données. Le déploiement est un simple remplacement d'actifs, avec un incrément de `CACHE_VERSION` puisque `app.js` est précaché. Retour arrière : retirer l'écouteur délégué et laisser `setSidebarCollapsed` au bouton ☰ ; les `localStorage` existants gardent leur valeur et restent lus par `applySidebarState()`.

## Open Questions

Aucune question bloquante.
