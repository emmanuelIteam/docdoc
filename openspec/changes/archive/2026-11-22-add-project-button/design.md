## Context

La page d'un domaine est rendue côté serveur par `renderPage` : l'outline (`#outline`, un `<ul>` de lignes plates) suivi de la barre d'étiquettes, dans la coque `renderShell`. La coque porte l'en-tête `#topbar` — rendu collant sur une page de domaine (`topbar-sticky`) — qui contient le bouton du panneau, le nom du domaine, puis la barre de hiérarchie remplie par le client.

Deux gestes créent déjà une ligne : Entrée pendant l'édition insère un frère *après* l'ancre (`POST /domaine/:slug/api/nodes/:id/next`), et l'action « + » du menu contextuel insère un enfant *sous* la ligne (`POST /domaine/:slug/api/nodes` avec `parentId`). `create_node` sans `parentId` ajoute un projet *à la fin* (`projects.push`, `display_order.push`). Aucun geste n'insère un projet *en tête*, et aucun contrôle de la page ne crée de projet.

La création est pilotée par le client, et non par htmx, pour les gestes qui doivent ouvrir le champ d'édition : la route renvoie l'id du nouveau nœud dans `X-New-Node-Id`, le client remplace `#outline` (`swapOutlineHtml`) puis ouvre `startRename(title, 0, 0, true, true)`.

Le projet est maintenu en deux implémentations : `server.js` (référence de développement, couverte par Playwright) et `rust/` (runtime publié par l'image). Toute modification de rendu ou de route est portée à l'identique dans les deux.

## Goals / Non-Goals

**Goals:**

- Un clic sur « + » crée un projet et l'insère en tête de l'outline et en tête de l'ordre d'affichage persisté.
- La nouvelle ligne s'ouvre en édition avec `Nouveau projet` entièrement sélectionné et se trouve à l'écran, même si la page était défilée.
- Le contrôle est toujours atteignable : il vit dans l'en-tête collant, hors du fragment remplacé par htmx.
- Aucune migration, aucune nouvelle route, aucune dépendance, aucun changement de format de données.

**Non-Goals:**

- Changer le comportement d'Entrée, de l'action « + » du menu contextuel ou du glisser-déposer.
- Ajouter un contrôle équivalent sur l'Accueil, l'Administration ou l'Aide.
- Créer plusieurs projets en une action, annuler une création, ou saisir le titre directement dans l'en-tête.
- Changer le titre par défaut (`Nouveau projet`), la forme d'un nœud ou celle de `displayOrder`.
- Rendre l'action utilisable sans JavaScript.

## Decisions

### 1. Le contrôle vit dans l'en-tête de la page, à droite du nom du domaine

`renderShell` reçoit un drapeau `add_project` (Rust) / `opts.addProject` (Node), activé par le seul `renderPage`. Le bouton est rendu après le `<h1>` et avant la barre de hiérarchie, poussé à droite par `margin-left: auto` et protégé du rétrécissement par `flex: 0 0 auto` ; le `<h1>` garde son `min-width: 0` et son ellipse, donc un nom long se tronque au lieu de repousser le bouton.

L'en-tête d'une page de domaine est collant : le contrôle reste donc visible et activable pendant le défilement d'un domaine long, sans coûter une ligne de hauteur supplémentaire.

*Alternatives écartées :*

- **Une ligne dédiée en tête de l'outline** (un `<li>` ou une rangée avant le `<ul>`) : elle consommerait une ligne de hauteur sur chaque page, doublerait le rôle de l'en-tête collant, et se lirait comme une fausse ligne de l'outline (sélection, menu contextuel, ordre d'affichage).
- **La barre d'étiquettes** : elle est fixe en bas à droite et s'efface derrière le panneau sur écran étroit ; elle disparaît du regard pendant la lecture, précisément quand on ajoute un projet.
- **La page Administration**, à côté de la création de domaine : c'est le lieu de gestion des domaines, pas celui du travail dans un domaine ; le besoin exprimé est sur la page du domaine.

### 2. `position: head` sur la route de création existante

`POST /domaine/:slug/api/nodes` est étendue, pas doublée :

| `parentId` | `position` | Effet |
| --- | --- | --- |
| fourni | quelconque | enfant ajouté en fin de bloc du parent (inchangé, `position` ignoré) |
| absent | `head` | projet inséré en tête |
| absent | absent ou `tail` | projet ajouté en fin de liste (inchangé) |

L'en-tête `X-New-Node-Id` et le fragment d'outline renvoyé restent identiques dans les trois cas, donc les chemins client existants ne changent pas. `ensure_default_project` continue d'appeler la création sans position et reste correct : sur un outline vide, la tête et la fin sont la même place.

*Alternatives écartées :*

- **Une route dédiée `POST /api/projects`** : elle dupliquerait la résolution du domaine, la persistance, le calcul de `reveal` et le rendu du fragment pour une seule différence d'index d'insertion.
- **Faire de toute création racine une insertion en tête** : changerait le sens d'un appel existant sans que l'appelant le demande, et rendrait impossible une future création en fin de liste.
- **Créer puis déplacer** (création en fin, puis `POST …/move` vers la tête) : deux allers-retours, deux écritures persistées et un rendu intermédiaire pour un résultat identique.

### 3. Insertion en tête de l'ordre d'affichage, après normalisation

La nouvelle fonction `create_project_at_head` commence par recalculer l'ordre affichable — `ensure_display_order(&domain.projects, &domain.display_order)` en Rust, `ensureDisplayOrder(domain.projects, domain.displayOrder)` en Node — puis insère le nœud en `projects[0]` et son id en `display_order[0]`, et réassigne l'ordre normalisé.

La normalisation d'abord n'est pas cosmétique : un domaine dont l'ordre persisté est vide ou partiel (données antérieures, restauration) verrait sinon son nouvel id placé devant une liste que `ensure_display_order` complète ensuite par ordre d'arbre, et la ligne ne serait pas première. Le projet créé n'a pas encore de sous-ligne : son bloc d'affichage tient en un id, donc l'insertion en tête de liste ne peut pas séparer un projet de ses descendants.

### 4. Création pilotée par le client, `addChildLine` généralisé

`addChildLine(parentId)` devient `createLine({ parentId, position })` : même POST, même lecture de `X-New-Node-Id`, même `swapOutlineHtml`, même ouverture du titre, même `reloadOutline()` en cas d'échec. Un seul chemin reste donc à maintenir pour les deux créations qui ouvrent un champ.

Le bouton `#add-project` est un `<button type="button">` et un gestionnaire délégué sur le document l'intercepte, comme le fait déjà `.menu-item.add-child`. Il passe `disabled` (et `aria-busy="true"`) dès l'envoi et le retire dans un `finally` : un double clic pendant la requête ne peut pas créer deux projets. Le paramètre `reveal` de l'URL est conservé, comme pour toute création.

*Alternatives écartées :*

- **htmx sur le bouton** : le client ne lirait pas `X-New-Node-Id` au bon moment et il faudrait corréler la réponse à l'action ; c'est l'alternative déjà écartée pour l'action « + » du menu contextuel.
- **Retrouver la nouvelle ligne par son titre** : plusieurs lignes peuvent déjà s'appeler `Nouveau projet`.

### 5. Ouvrir le titre et amener la ligne à l'écran

Après le swap, `startRename(titleEl, 0, 0, true, true)` est appelé sur la ligne retrouvée par son id : `selectAll` sélectionne toute la valeur à la frame suivante, donc la première frappe remplace `Nouveau projet`. `startRename` déclenche déjà `scheduleReveal`, qui attend la stabilisation du viewport (clavier mobile) puis appelle `scrollIntoView({ block: 'nearest' })` ; `.line` déclare `scroll-margin-top: calc(var(--topbar-height, 4rem) + .5rem)`, donc la ligne s'arrête sous l'en-tête collant au lieu d'être masquée par lui. `prefers-reduced-motion` est déjà respecté par ce chemin.

Aucun défilement spécifique n'est ajouté : le comportement demandé est exactement celui d'un ajout de sous-tâche, à la différence que la cible est en haut de la page.

### 6. Le contrôle est rendu par la coque, pas par l'outline

Le bouton est un frère de `#outline` dans le document. Ni les swaps htmx (`hx-target="#outline"`), ni `swapOutlineHtml` ne le remplacent ; il ne faut donc pas de `htmx.process` sur lui après un re-rendu, et aucun état client (sélection, menu, champ ouvert) ne le concerne. C'est aussi ce qui garantit qu'il ne peut pas apparaître deux fois.

### 7. L'enregistrement du titre en cours précède la création

Cliquer sur le bouton alors qu'un titre est en cours d'édition ferme d'abord le champ : le `blur` remplace le champ par son texte et lance le PUT d'enregistrement sans l'attendre. Si le POST de création partait avant que ce PUT n'arrive au serveur, l'outline rendue par la création porterait l'ancien titre et le re-rendu afficherait brièvement le texte d'avant la modification.

`app.js` expose donc la promesse d'enregistrement en vol (`pendingTitleSave`, effacée dès qu'elle se règle) et `createLine` l'attend avant d'envoyer la création, comme le font déjà les chemins Entrée et Tab. Un échec d'enregistrement annule la création et repasse par `reloadOutline()`, plutôt que de créer une ligne sur un outline dont le titre n'est pas sûr.

*Alternative écartée :* accepter le glissement, au motif que les deux requêtes partent le plus souvent dans l'ordre. Le symptôme visible — le titre saisi qui redevient l'ancien — est trop proche d'une perte de données pour être laissé au hasard de l'ordonnancement réseau.

### 8. Sans JavaScript, le bouton ne fait rien

Le bouton n'a pas de repli `<form>` : un formulaire posté vers `/domaine/:slug/api/nodes` renverrait un fragment d'outline, c'est-à-dire une page de HTML brut à la place du document. Un repli correct demanderait une variante de la route qui redirige vers la page du domaine — beaucoup plus que le « simple bouton » demandé, et sans rapport avec les autres gestes de création, tous pilotés par le client. Le bouton reste donc inerte sans JavaScript, comme l'action « + » du menu contextuel.

## Risks / Trade-offs

- **Double clic** → le bouton est désactivé dès l'envoi et réactivé dans `finally` ; une seule ligne est créée, et un test e2e le vérifie.
- **Le glyphe `+` est déjà celui de l'action « ajouter une sous-tâche »** → le contexte diffère : l'un est dans le menu d'une ligne et n'agit que sur elle, l'autre est dans l'en-tête de la page et n'a pas de ligne de référence. Le nom accessible « Ajouter un projet » et l'infobulle lèvent l'ambiguïté, et le libellé visible reste `+`, comme demandé.
- **Échec réseau** → rien n'est créé ; `reloadOutline()` restaure l'outline du serveur et la console journalise l'erreur, comme pour `/next`.
- **Titre par défaut persisté** → un utilisateur qui quitte sans nommer laisse un `Nouveau projet` en tête. C'est le comportement des autres créations (le titre est une vraie chaîne enregistrée), et la ligne se renomme ou se supprime comme n'importe quelle autre.
- **Toutes les lignes descendent d'un cran** → c'est l'effet demandé ; rien n'est déplacé dans l'arbre, seul l'ordre d'affichage gagne un id en tête.
- **Ancien service worker** → `CACHE_VERSION` est incrémenté, règle déjà en place pour tout actif précaché (`app.js`, `style.css`).
- **Deux implémentations** → la branche `position` et l'insertion en tête doivent rester identiques en Rust et en Node ; le test Rust et le test Playwright couvrent chacun une implémentation, comme pour les changements précédents.

## Migration Plan

Aucune migration. `displayOrder` gagne un id en tête à la première création ; les domaines existants restent valides, y compris ceux dont l'ordre est partiel, puisque la normalisation précède l'insertion. Déploiement normal avec incrément de `CACHE_VERSION`. Retour arrière : retirer le bouton, la branche `position` et le gestionnaire client ; les projets déjà créés en tête restent des lignes ordinaires, sans champ ni clé à nettoyer.

## Open Questions

Aucune question bloquante.
