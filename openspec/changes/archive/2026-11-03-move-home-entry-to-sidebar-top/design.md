## Context

Le panneau latéral est une colonne `aside#sidebar` de 240 px, en `display: flex; flex-direction: column`, rendue par `renderSidebar` : un titre `.sidebar-header` (« Domaines »), une zone `nav#sidebar-nav` qui contient la liste des domaines, puis un `.sidebar-footer` en bas (entrées de service, bouton d'installation, session). Depuis `add-homepage-open-tasks`, l'entrée « Accueil » (`a.sidebar-link.sidebar-home`, `href="/"`, classe `active` + `aria-current` sur l'accueil) est rendue dans `nav.sidebar-extra`, dans ce pied, avant Administration et Aide.

Un comportement existant contraint le déplacement : le repli automatique sur un écran étroit écoute les clics sur `#sidebar-nav a.sidebar-link` (sélection d'un domaine) et rien d'autre. Une entrée hors de `#sidebar-nav` ne peut donc pas replier le panneau, ce qui est le comportement attendu pour Accueil, Administration et Aide.

L'état actif est déjà piloté par l'option `home` de `renderShell`/`renderSidebar`, et les tests ciblent `a.sidebar-home` : le déplacement peut conserver ces sélecteurs. Le panneau n'a pas de hauteur contrainte : il défile avec la page, comme le reste de la mise en page ; ce changement ne modifie pas ce point.

## Goals / Non-Goals

**Goals :**

- Afficher l'entrée « Accueil » dans une rubrique propre en tête du panneau, avant « Domaines » et la liste des domaines.
- La retirer du pied du panneau, sans doublon.
- Conserver l'état actif, le `href="/"`, l'absence de repli du panneau au clic sur écran étroit, et l'accessibilité de l'entrée.
- Ne toucher ni aux données, ni aux routes, ni au JavaScript, ni à la page d'accueil.

**Non-Goals :**

- Aucun changement du regroupement des domaines par thème, de la liste, du titre « Domaines » ou des entrées Administration et Aide.
- Aucun doublon « Accueil » (ni en tête et dans le pied, ni deux blocs).
- Aucune icône ou logo ajouté : les entrées du panneau sont textuelles.
- Aucun nouveau titre « Accueil » au-dessus du lien : le texte du lien est le libellé de la rubrique.
- Aucune modification des règles de repli du panneau : seule la sélection d'un domaine replie.
- Aucun changement de contenu ou de route de la page d'accueil, et aucune barre latérale collante : le panneau continue de défiler avec la page.

## Decisions

### 1. Un bloc `sidebar-top` avant le titre « Domaines », hors de la zone des domaines

`renderSidebar` rend un `<div class="sidebar-top" id="sidebar-top">` avant `<div class="sidebar-header">Domaines</div>`, contenant l'ancre Accueil. Le bloc est un frère de `#sidebar-nav`, pas un enfant : il est invisible pour l'écouteur de repli (`#sidebar-nav a.sidebar-link`), donc un clic sur Accueil laisse le panneau ouvert sur un smartphone, et il sépare visuellement la navigation vers l'accueil de la liste des domaines.

*Alternatives écartées :*

- **Placer l'entrée dans `#sidebar-nav`** : l'écouteur de repli la prendrait pour un domaine et refermerait le panneau sur un smartphone, et elle se mêlerait aux domaines.
- **La garder dans le pied** : c'est l'état actuel ; la demande est de la mettre en tête.
- **Un bloc positionné en absolu au-dessus de la liste** : sortirait du flux, demanderait une réserve de hauteur et compliquerait le panneau replié, sans bénéfice ici.

### 2. Déplacer l'entrée, ne pas la dupliquer

L'ancre est retirée de `nav.sidebar-extra` ; le pied ne garde qu'Administration et Aide. Deux liens identiques donneraient deux cibles actives possibles et un pied alourdi, alors que la demande est un point d'entrée unique et plus visible.

*Alternatives écartées :*

- **Garder les deux** : deux « Accueil », deux `aria-current` potentiels, et un test de pied qui ne veut plus rien dire.
- **Remplacer Administration et Aide par un menu** : hors périmètre.

### 3. Conserver la classe, le drapeau et l'état actif existants

L'ancre garde `class="sidebar-link sidebar-home"`, `href="/"`, et la classe `active` + `aria-current="page"` fournies par `opts.home`. Aucun nouvel état, aucun nouveau drapeau, aucun changement de `renderShell`. Le bloc est un simple `div` : l'`aside` est déjà une région, et ajouter un `<nav aria-label="Accueil">` ferait annoncer « Accueil » deux fois par les lecteurs d'écran.

*Alternatives écartées :*

- **Un `<nav>` avec `aria-label`** : redondant pour un lien unique déjà nommé.
- **Renommer la classe ou introduire `sidebar-primary`** : casserait les sélecteurs de tests sans bénéfice.

### 4. Une séparation visuelle nette, sans changement de comportement

`.sidebar-top` reçoit une marge basse et un filet de séparation avant « Domaines » ; `.sidebar-home` reprend la graisse des entrées de service (`font-weight: 600`) et les styles existants de `.sidebar-link` (survol, `active`, padding). La hauteur de la cible tactile reste celle du lien (padding `0.4rem` + interligne), au-delà des 24 px requis sur écran étroit, sans règle supplémentaire.

*Alternatives écartées :*

- **Un fond ou un cadre de carte** : le panneau a déjà des groupes de thèmes ; une carte de plus surchargerait.
- **Réduire le padding du bloc** : la cible tactile deviendrait trop courte sur un smartphone.

### 5. Les tests vérifient la position et l'absence de doublon

- `administration.spec.js` : le pied ne contient plus que deux entrées (Administration, Aide), et l'entrée Aide passe de l'index 2 à l'index 1.
- `home.spec.js` : l'entrée Accueil précède `.sidebar-header` et `#sidebar-nav` dans le panneau, le pied n'en contient aucune, et les états actif/inactif et la navigation sont inchangés.
- `sidebar.spec.js` : le clic sur Accueil depuis une page de domaine, sur un écran étroit, ne replie pas le panneau (aux côtés d'Administration et d'Aide).

*Alternatives écartées :*

- **Tester seulement le balisage** : le projet n'a pas de test unitaire de rendu ; les assertions de position et de comportement passent par le navigateur.
- **Un test de capture d'écran** : plus fragile que des assertions de structure, de position et d'état.

## Risks / Trade-offs

- **Le pied perd une entrée** → administration et aide restent à leur place ; l'accueil devient plus visible qu'avant, ce qui compense l'habitude.
- **La rubrique consomme ~2,5 rem en haut du panneau** → la liste des domaines commence plus bas ; le panneau reste utilisable et la page défile comme avant.
- **Panneau replié** → la rubrique disparaît avec le panneau, comme le reste ; le bouton ☰ la rouvre.
- **Tests existants comptant les entrées du pied** → `administration.spec.js` est mis à jour dans le même changement ; les autres tests ciblent les classes, pas la position.
- **Lecteurs d'écran** → l'entrée reste un lien unique avec `aria-current` sur l'accueil ; aucun landmark redondant n'est ajouté.
- **Écran étroit** → le clic sur Accueil ne referme pas le panneau (comportement existant des entrées hors `#sidebar-nav`), désormais couvert par un scénario et un test.

## Migration Plan

Aucune migration : le changement est du balisage et du style. Déploiement normal avec incrément de `CACHE_VERSION` (style). Retour arrière : remettre l'ancre dans `nav.sidebar-extra`, supprimer le bloc `sidebar-top` et ses règles CSS, restaurer les tests ; aucune donnée n'est concernée.

## Open Questions

Aucune question bloquante. Un libellé différent de « Accueil » ou une icône pourraient être envisagés plus tard, mais ne sont pas nécessaires à cette rubrique.
