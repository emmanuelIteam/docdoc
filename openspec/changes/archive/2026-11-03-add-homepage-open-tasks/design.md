## Context

La racine est aujourd'hui une redirection : `GET /` lit `space.domainList[0]` et répond `302` vers `/domaine/<slug>` du domaine de plus petit `order` (exigence « Redirect the homepage to the default domain » de `domain-navigation`). Sans domaine, elle rend une page vide avec un lien vers Administration.

Le modèle est déjà en mémoire, par compte : `withSpace` résout `space.domains` (domaines complets) et `space.domainList` (résumé ordonné par `order` puis nom), et toutes les pages sont rendues côté serveur. Un domaine porte `projects`, une forêt de nœuds `{ id, title, status, collapsed, children }`, et `displayOrder`, la suite plate des ids dans l'ordre vertical de l'outline, réparée par `ensureDisplayOrder`/`indexOutline`. Le statut est `todo`, `in_progress` ou `done` ; il est indépendant du repli : une ligne « En cours » sous un ancêtre replié existe et est persistée, elle n'est simplement pas rendue sur la page du domaine.

Le mécanisme de lien profond existe déjà et sert au copier-lien et aux liens de tâche inline : `/domaine/<slug>?reveal=<id>#node-<id>`. Côté serveur, `expandIdsFor` déplie les ancêtres de la cible sans modifier leur état persisté ; côté navigateur, le fragment fait défiler jusqu'à `#node-<id>`, `scroll-margin-top` arrête la ligne sous l'en-tête collant et `.line:target` la surligne. Rien de tout cela n'est à réinventer pour ouvrir une tâche depuis l'accueil.

## Goals / Non-Goals

**Goals :**

- Servir une page d'accueil à `/`, sans redirection, qui liste toutes les lignes « En cours » de tous les domaines du compte, à toute profondeur.
- Rappeler le nom du domaine sur chaque entrée, visible sans survol.
- Ordonner les entrées comme le panneau latéral puis comme l'outline de chaque domaine.
- Ouvrir la tâche cliquée dans son domaine, avec ses ancêtres dépliés, la ligne défilée et surlignée, sans changer son statut.
- Rendre la page atteignable depuis n'importe quelle page et couvrir les états vides.
- Ne rien changer au stockage, aux routes d'API ni au modèle de nœud, et n'ajouter aucun JavaScript.

**Non-Goals :**

- Aucun regroupement par domaine en sections avec en-têtes, aucun filtre, aucune recherche, aucune pagination.
- Aucun affichage de la chaîne des tâches mères sur l'accueil : le contexte est donné par la page du domaine (barre collante) une fois la tâche ouverte.
- Aucun changement de la grammaire du lien profond, du rendu de l'outline ou de la signification des statuts.
- Aucune déduplication : une tâche dont les ancêtres sont aussi en cours reste listée pour elle-même.
- Aucune modification du comportement d'un domaine vide : `GET /` ne matérialise pas de projet par défaut.

## Decisions

### 1. La racine `/` devient la page d'accueil, sans nouvelle route

`app.get('/')` rend `renderHomePage(req.space)` au lieu de rediriger. Il n'y a ni `/accueil`, ni redirection conditionnelle : la racine est la page d'accueil, y compris quand aucun domaine ou aucune tâche n'existe (elle montre alors un état vide). Le routeur d'accès continue de servir `/` aux visiteurs non authentifiés ; seule la branche authentifiée change.

*Alternatives écartées :*

- **Une route `/accueil` avec redirection depuis `/`** : deux URL pour une même page, et la redirection garde le défaut actuel (impossible de s'arrêter sur la vue d'ensemble).
- **Rediriger `/` vers l'accueil seulement s'il y a des tâches en cours** : le sens de `/` dépendrait des données, avec des favoris qui changent de destination.
- **Une page `/taches` séparée laissant `/` rediriger** : la demande est une page d'accueil ; deux points d'entrée à maintenir.

### 2. La liste est calculée depuis l'espace en mémoire à chaque requête

`renderHomePage` parcourt `space.domainList` (déjà ordonné), retrouve chaque domaine via `space.domains.get(id)`, répare l'ordre d'affichage avec `ensureDisplayOrder(domain.projects, domain.displayOrder)`, indexe l'arbre avec `indexOutline`, puis retient dans l'ordre les entrées dont `node.status === 'in_progress'`. Chaque entrée conserve `{ domain, node, depth, parent }` pour le rendu.

La fonction est purement lectrice : elle n'appelle ni `ensureDefaultProject` ni `persistDomain`, donc un `GET /` ne modifie jamais les données. C'est la différence avec `GET /domaine/:slug`, qui matérialise le projet par défaut d'un domaine vide.

*Alternatives écartées :*

- **Un index des tâches en cours maintenu à chaque changement de statut** : il faudrait l'invalider sur les changements de statut, les déplacements, les suppressions, l'archivage et le rechargement d'espace ; un oubli donnerait une page fausse. Le parcours complet est linéaire en nombre de nœuds et se fait en mémoire, sans I/O.
- **Relire les domaines depuis le stockage à chaque affichage** : un aller-retour S3 par domaine pour des données déjà chargées.
- **Trier par date de mise en cours** : le modèle ne stocke aucune date de statut ; l'ordre du panneau et de l'outline est stable et prévisible.

### 3. Chaque entrée est un seul lien vers le lien profond existant

Une entrée rend `<a class="home-task" href="/domaine/<slug>?reveal=<id>#node-<id>">`. La cible est exactement celle du copier-lien (`public/app.js`) et des liens de tâche inline (`task-links`). L'atterrissage est déjà couvert par les exigences existantes : `expandIdsFor` déplie les ancêtres sans persister leur état, le navigateur défile jusqu'au fragment, `scroll-margin-top` tient la ligne sous la barre collante et `.line:target` la surligne.

Le lien est une ancre native : clic, clic milieu, ouverture dans un nouvel onglet, clavier et menu contextuel du navigateur fonctionnent sans code client. Aucun écouteur n'est ajouté, donc l'activation ne peut ni ouvrir le renommage ni changer un statut.

*Alternatives écartées :*

- **Une navigation JavaScript (`location.href`, `htmx.ajax`)** : réimplémente ce que l'ancre fait, et casse l'ouverture dans un nouvel onglet.
- **Un paramètre dédié (`?task=<id>`)** : deuxième grammaire de lien profond à maintenir, alors que `reveal` + fragment est déjà la grammaire de référence.
- **Un bouton avec `onclick`** : inaccessible au clavier sans travail supplémentaire, et sans aperçu d'URL.

### 4. Liste plate ordonnée, nom du domaine sur chaque entrée

L'ordre est : domaines dans l'ordre du panneau latéral, puis, dans un domaine, l'ordre d'affichage de l'outline. C'est la séquence que l'utilisateur voit déjà dans le panneau puis sur la page du domaine, et elle est stable entre deux chargements sans date à stocker.

Le nom du domaine est un badge toujours visible sur l'entrée (à droite du titre sur un écran large, sous le titre sur un écran étroit). Il n'y a pas d'en-tête de section par domaine : le nom est rappelé sur chaque tâche, comme demandé, et une tâche reste identifiable même si la liste est longue. Le badge est neutre (pas de pastille de thème) : un domaine peut porter plusieurs étiquettes de thème, une seule couleur suggérerait un choix arbitraire.

*Alternatives écartées :*

- **Des sections par domaine avec un en-tête** : le nom du domaine disparaît des entrées, et une même tâche lue en dehors de son en-tête perd son contexte ; l'ordre par domaine est de toute façon conservé dans la liste plate.
- **Une pastille de thème sur le badge** : ambigu pour un domaine multi-thèmes, et sans rapport avec la tâche.
- **Un tableau à deux colonnes** : rigide sur écran étroit et moins lisible qu'une ligne cliquable.

### 5. Le titre est réduit à son texte visible pour rester dans un seul lien

Un titre peut contenir la syntaxe `[libellé](/domaine/<slug>?reveal=<id>#node-<id>)` (`renderTitleHtml`). Sur l'accueil, imbriquer ces ancres dans l'ancre de l'entrée produirait un HTML invalide et un clic ambigu. Un helper `titleLabel(title)` applique donc la même expression (`TASK_LINK_SOURCE`) en remplaçant chaque lien par son libellé, puis le résultat est échappé au rendu. Le texte qui entoure le lien est conservé, la syntaxe invalide reste littérale, et l'entrée garde un seul arrêt de tabulation.

*Alternatives écartées :*

- **Réutiliser `renderTitleHtml`** : ancres imbriquées, donc HTML invalide et navigation impossible à cibler de façon fiable.
- **N'ancre que le titre à l'intérieur de la ligne** : la ligne ne serait plus entièrement cliquable, et la zone de clic dépendrait de la longueur du titre.
- **Afficher la syntaxe brute** : illisible pour l'utilisateur.

### 6. L'accès à l'accueil passe par une entrée du pied du panneau

`renderSidebar` reçoit `opts.home` et ajoute, avant Administration, un `<a class="sidebar-link sidebar-home" href="/">Accueil</a>`, avec `active` et `aria-current="page"` sur la page d'accueil. Aucun domaine n'est actif sur cette page (`activeSlug` vaut `null`), donc le panneau n'affiche qu'un seul état actif, celui de l'accueil. Le pied du panneau est déjà l'endroit des liens de page (Administration, Aide) : l'entrée y est cohérente et visible depuis toutes les pages.

*Alternatives écartées :*

- **Faire du `<h1>` un lien vers `/`** : change le balisage de toutes les pages et un titre de page n'est pas un lien de navigation évident.
- **Aucune entrée** : la page d'accueil ne serait atteignable qu'en tapant l'URL ou en relançant l'application installée.

### 7. Deux états vides distincts, sans redirection

Sans aucun domaine, la page garde l'état vide actuel (« Aucun domaine », lien vers Administration) : la racine reste utilisable avant le premier domaine, comme aujourd'hui. Avec des domaines mais aucune tâche en cours, un état vide dédié explique qu'aucune tâche n'est en cours et rappelle comment en marquer une (menu de la ligne, action « En cours »). Les deux utilisent la classe `.empty-state` et sont rendus dans la même coquille (`renderShell`) que le reste, avec le titre « Tâches en cours ».

*Alternatives écartées :*

- **Rediriger vers le domaine par défaut quand la liste est vide** : la page d'accueil changerait de nature selon les données, et l'utilisateur ne pourrait pas constater qu'il n'a rien en cours.
- **Une liste vide sans message** : rien n'indiquerait si la page fonctionne ou si le compte est vide.

### 8. Aucun JavaScript, seulement du CSS

Tout est rendu côté serveur : pas de `hx-*`, pas d'appel à `app.js`, pas de mise à jour dynamique. La page se rafraîchit par navigation, comme l'administration. Seul `public/style.css` change (ligne cliquable, badge de domaine, états vides), ce qui impose un incrément de `CACHE_VERSION` dans `public/sw.js` ; `app.js` et `htmx.min.js` restent identiques. Le service worker ne met jamais les documents en cache, donc `/` n'a pas de politique de cache à définir.

*Alternatives écartées :*

- **Une liste mise à jour en htmx** : aucun besoin de mise à jour partielle, la page est consultée par navigation et se recharge déjà à chaque retour.
- **Un rendu client à partir de `/api/outline`** : multiplierait les requêtes par domaine et priverait la page de fonctionnement sans JavaScript.

## Risks / Trade-offs

- **Le sens de `/` change** → un favori ou une redirection d'après connexion n'ouvre plus le domaine par défaut. C'est le comportement demandé ; l'entrée « Accueil » et les domaines du panneau permettent de naviguer dans les deux sens.
- **Les statuts en cascade gonflent la liste** → marquer un projet « En cours » marque tout son sous-arbre, donc chaque descendant apparaît. C'est fidèle au modèle : chaque ligne est une tâche, et une sous-tâche en cours doit être visible même si son parent l'est aussi ; v1 n'affiche pas de regroupement pour autant.
- **Une liste longue sans filtre ni pagination** → la page croît avec l'activité. Acceptable à l'échelle d'un compte personnel ; un filtre par domaine ou par thème serait une évolution séparée.
- **Deux entrées de même titre** → le badge de domaine les distingue ; aucune autre désambiguïsation n'est ajoutée.
- **Une tâche supprimée entre l'affichage et le clic** → la page du domaine s'ouvre normalement, `?reveal` inconnu est ignoré (comportement existant) ; au pire la ligne n'est pas surlignée.
- **Un écran étroit** → le badge passe sous le titre et la ligne grandit ; aucun texte n'est tronqué.
- **Les tests existants supposent l'ancienne racine** → l'enrôlement de `test/e2e/reindent.spec.js` attend une URL `/domaine/` et en déduit `domainPath` : il doit attendre l'accueil puis viser `/domaine/<slug>`. L'assertion `302 → /domaine/voyages` de `test/passkey-flow.js` devient une assertion de contenu, et le pied du panneau passe de deux à trois entrées.
- **La page Aide liste ses sections** → `test/e2e/administration.spec.js` vérifie les titres `h2` dans l'ordre ; l'ajout d'une section impose de mettre à jour cette liste dans le même changement.

## Migration Plan

Aucune migration de données : rien n'est persisté de nouveau et le format des domaines ne change pas. Le déploiement se contente d'un incrément de `CACHE_VERSION` (style). Les tests sont mis à jour dans le même changement, puis `node --check server.js` et `npm run test:e2e` valident le rendu. Retour arrière : rétablir la redirection dans `GET /`, retirer `renderHomePage`, le helper de libellé, l'entrée « Accueil », la section d'aide et les styles ; les données restent intactes.

## Open Questions

Aucune question bloquante. Le regroupement par domaine, le filtrage et le compteur de tâches sont volontairement hors périmètre de cette première version.
