## Context

La barre d'étiquettes est rendue avec chaque page de domaine (`renderLabelsBar`) comme un `.labels-bar` `position: fixed`, collé en bas à droite (`right: .5rem`, `bottom: .5rem` sous 640 px) et large au plus de `min(30rem, 100vw - 2rem)`, soit ~358 px sur un écran de 390 px. Le panneau latéral occupe les 240 premiers pixels de la même fenêtre et sa boîte de session (lien vers la gestion des passkeys, formulaire de déconnexion) est en bas du panneau. Les deux surfaces se superposent donc en bas à droite sur un téléphone, et la barre, peinte au-dessus (z-index 30), capte le clic destiné aux commandes du panneau.

L'état du panneau est déjà porté par `<body>` : la classe `sidebar-collapsed` y est posée par le client, persistée dans `localStorage` et rétablie au chargement. Aucun autre signal n'est nécessaire pour savoir si le panneau est affiché.

## Goals / Non-Goals

**Goals :**

- Rendre le bas du panneau utilisable sur un écran étroit : la barre ne doit plus recouvrir le lien passkeys ni la déconnexion.
- Rendre la barre dès que le panneau est replié, sans changer son contenu ni son comportement.

**Non-Goals :**

- Aucun déplacement, redimensionnement ou découpage de la barre : sa position et son contenu restent ceux qui sont spécifiés.
- Aucun changement de l'écran large.
- Aucun JavaScript ni état supplémentaire : la classe `sidebar-collapsed` suffit.
- Aucun changement du panneau ni de ses entrées.

## Decisions

### 1. Masquer la barre tant que le panneau est affiché, sous 640 px

La règle s'ajoute à la requête média existante : `body:not(.sidebar-collapsed) .labels-bar { display: none; }`. Elle ne s'applique qu'aux écrans étroits, et seulement quand le panneau occupe la place ; dès que ☰ le replie, la barre réapparaît. Elle ne dépend ni du défilement ni de la hauteur du document, contrairement à une réservation de place dans le pied du panneau.

*Alternatives écartées :*

- **Peindre le panneau au-dessus de la barre (`z-index`)** : le bas de la barre passerait derrière le panneau, à moitié visible et à moitié cliquable, sans que l'on comprenne laquelle des deux surfaces répond.
- **Contenir la barre dans la colonne de contenu** : il ne reste que 150 px à côté d'un panneau de 240 px ; les étiquettes et le sélecteur n'y tiennent pas.
- **Réserver la hauteur de la barre dans le pied du panneau** : le pied du panneau est en bas du document, dont la hauteur varie avec l'outline ; pour une page longue, il n'est pas au bas de la fenêtre et la réservation ne protège rien. Elle décalerait en revanche les commandes sur une page courte.
- **Masquer la barre en JavaScript au clic sur ☰** : deux sources de vérité pour un état déjà présent dans le DOM, et un décalage possible pendant la transition.

### 2. Le seuil reste celui de l'application : 640 px

C'est le seuil de la mise en page étroite (barre, indentation, cible tactile) et du repli du panneau. Au-delà, la barre ne recouvre pas les commandes du panneau (la fenêtre est assez large) et reste affichée.

### 3. La disparition est purement visuelle

`display: none` retire la barre de l'ordre de tabulation pendant que le panneau est ouvert : ses commandes ne sont pas atteignables au clavier non plus, ce qui est cohérent — elles sont de toute façon recouvertes et invisibles. La barre ne porte aucun état : rien n'est perdu en la masquant, et son contenu est rendu par le serveur à chaque navigation.

## Risks / Trade-offs

- **Les étiquettes ne sont pas modifiables tant que le panneau est ouvert** → c'est transitoire : replier le panneau (un clic sur ☰) rend la barre. Le panneau est une surface de navigation ouverte volontairement, la barre un contrôle de la page.
- **Le pied de page réserve toujours la hauteur de la barre** (`body.has-labels-bar main`) → un peu de blanc en bas de page quand elle est masquée ; c'est sous la ligne de flottaison et cela évite tout décalage à l'ouverture du panneau.
- **Un écran étroit sans panneau (déjà replié)** → la barre reste affichée : la règle ne s'applique qu'au panneau ouvert.
- **Une future barre rendue sur les pages sans panneau** → la règle ne la concerne pas (sélecteur `.labels-bar` et classe `sidebar-collapsed` sur `<body>`).

## Migration Plan

Aucune migration. Déploiement d'actifs avec un incrément de `CACHE_VERSION` puisque `style.css` est précaché. Retour arrière : retirer la règle de la requête média ; le reste est inchangé.

## Open Questions

Aucune question bloquante.
