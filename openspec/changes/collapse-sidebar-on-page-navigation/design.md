## Context

Le panneau latéral est rendu côté serveur (`renderSidebar`) comme un `<aside class="sidebar" id="sidebar">` dans une grille `auto 1fr`. Toutes ses entrées de navigation sont des ancres : l'accès Accueil (désormais en tête du panneau, `#sidebar-top`), un lien par domaine dans `#sidebar-nav`, Administration et Aide dans `.sidebar-extra`, et l'accès à la gestion des passkeys dans la boîte de session. Deux commandes ne sont pas des liens de page : le bouton « Installer l'application » (`<button>`) et le formulaire « Déconnexion » (`<form method="post">`).

Le client ne connaît qu'un état : la classe `sidebar-collapsed` sur `<body>`, persistée dans `localStorage` sous `sidebarCollapsed`. Un écouteur délégué la pose avant la navigation quand un domaine est choisi dans le panneau et que la fenêtre est un écran étroit (`(max-width: 640px)`). Chaque navigation étant un chargement complet, la persistance est ce qui fait arriver la page suivante déjà repliée ; `applySidebarState()` la rétablit au chargement.

## Goals / Non-Goals

**Goals :**

- Replier le panneau sur un écran étroit quelle que soit l'entrée empruntée, du moment qu'elle ouvre une page : Accueil, domaine, Administration, Aide, gestion des passkeys.
- Conserver exactement le même état, la même persistance et le même bouton de réouverture que le repli existant.
- Laisser inchangés l'écran large, les clics modifiés et les commandes qui ne naviguent pas.

**Non-Goals :**

- Aucun repli sur un écran large.
- Aucun repli au clic sur « Installer l'application » ni sur « Déconnexion ».
- Aucun changement du rendu du panneau, des routes, du modèle de données ni des autres comportements du panneau (groupement par thème, surbrillance de la page active, lecture seule).
- Aucune nouvelle préférence « mobile » / « bureau » : un seul booléen, comme pour le bouton ☰.

## Decisions

### 1. Un seul sélecteur : tout lien de page contenu dans le panneau

L'écouteur délègue sur `#sidebar a[href]`. Aujourd'hui, toutes les ancres du panneau ouvrent une page (Accueil, domaines, Administration, Aide, passkeys) et aucune n'a d'autre rôle ; les commandes non navigantes sont un `<button>` et un `<form>`, donc exclues par construction. Une entrée ajoutée plus tard dans le panneau et rendue comme un lien suivra la règle sans qu'on y pense.

*Alternatives écartées :*

- **Énumérer les classes** (`.sidebar-home, .sidebar-admin, .sidebar-help, .sidebar-nav a.sidebar-link`, plus la boîte de session) : la liste se périme à chaque déplacement d'entrée — l'Accueil a déjà changé de place — et oublier une classe rend le comportement incohérent d'une entrée à l'autre.
- **Ajouter un attribut `data-nav` sur chaque lien** : modifierait le balisage rendu pour un besoin que la structure du panneau exprime déjà.
- **Écouter chaque lien à la génération du rendu** : le `<nav>` est remplacé hors bande par htmx lors d'un rattachement d'étiquette ; la délégation survit à ce remplacement.

### 2. Le seuil de l'écran étroit reste `(max-width: 640px)`

C'est le seuil déjà utilisé par le repli après sélection d'un domaine et par les règles d'espacement et d'indentation de l'outline. « Smartphone » reste défini par la largeur disponible, pas par une détection d'agent : reproductible en test et cohérent avec le reste de l'interface.

*Alternatives écartées :*

- **Tous les écrans** : le panneau est la navigation principale sur un ordinateur ; le refermer à chaque clic obligerait à rouvrir ☰ après chaque changement de domaine ou de page, pour un gain de place nul.
- **Détection d'agent** : fragile et impossible à simuler sans mentir sur l'identité du navigateur.

### 3. Le repli reste un état unique, posé avant la navigation

`setSidebarCollapsed(true)` écrit la classe et la clé `localStorage` dans le même gestionnaire, avant que le navigateur ne suive le lien. La page suivante appelle `applySidebarState()` et se peint déjà repliée : pas de clignotement, pas de second état à maintenir, et ☰ reste le seul moyen de rouvrir.

*Alternatives écartées :*

- **Replier seulement la page courante sans persister** : la navigation rechargerait le panneau ouvert, et la page demandée garderait la bande étroite.
- **Transmettre l'état dans l'URL** : alourdit chaque lien et crée des URL différentes pour la même page.

### 4. Les clics modifiés et les commandes non navigantes restent hors du dispositif

Le gestionnaire ignore un clic non principal ou portant `Ctrl`, `Cmd`, `Shift` ou `Alt`, ainsi qu'un événement déjà annulé : ouvrir une entrée dans un nouvel onglet ne doit pas refermer le panneau de la page courante. Le bouton d'installation et le formulaire de déconnexion ne sont pas des ancres : ils ne déclenchent rien.

*Alternatives écartées :*

- **Replier aussi sur « Déconnexion »** : la session se termine et la page suivante n'a pas de panneau ; l'état n'aurait aucun effet observable.
- **Replier sur « Installer l'application »** : une invite native ne change pas de page ; refermer le panneau ferait perdre le contexte sans raison.

## Risks / Trade-offs

- **Une entrée non navigationnelle deviendrait un lien de page** → elle replierait le panneau ; c'est le comportement attendu pour un lien qui navigue, et le panneau n'en contient aucun autre aujourd'hui.
- **Une seule préférence pour tous les écrans** → replier sur téléphone laisse le panneau replié si le même profil de navigateur est rouvert sur ordinateur ; c'est déjà le cas du bouton ☰.
- **Le panneau se referme pendant le délai de navigation** → l'effet est le retour visuel attendu, et la transition existante (150 ms) le rend lisible.
- **Les tests existants supposent l'ancien périmètre** → le cas 1.4 de `sidebar.spec.js` vérifie aujourd'hui que ces entrées ne referment pas le panneau ; il est inversé dans ce changement.

## Migration Plan

Aucune migration de données. Déploiement d'actifs avec un incrément de `CACHE_VERSION` puisque `app.js` est précaché. Retour arrière : rétablir le sélecteur `.sidebar-nav a.sidebar-link` ; les valeurs `localStorage` existantes restent lues par `applySidebarState()`.

## Open Questions

Aucune question bloquante.
