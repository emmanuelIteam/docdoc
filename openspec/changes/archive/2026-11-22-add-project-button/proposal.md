## Why

Une page de domaine n'offre aujourd'hui aucun contrôle pour ajouter un projet. Les deux gestes de création existants passent par une ligne déjà présente : Entrée insère un frère *après* la ligne en cours d'édition, et l'action « + » du menu contextuel insère un enfant *sous* la ligne sélectionnée. Pour obtenir un projet supplémentaire, l'utilisateur doit donc partir d'une ligne existante — et le nouveau projet se retrouve après elle, jamais en tête. Ajouter un projet en première position demande de créer la ligne ailleurs puis de la faire glisser jusqu'en haut.

La page du domaine est pourtant l'endroit où l'utilisateur ouvre son travail : c'est là que le geste manque. Le premier projet d'un domaine étant créé automatiquement, la liste n'est jamais vide, mais rien n'y ajoute un projet par le haut.

## What Changes

- **Bouton « + » sur la page d'un domaine** : un contrôle discret dans l'en-tête de la page, à droite du nom du domaine, avec « Ajouter un projet » comme nom accessible. Il n'apparaît que sur les pages de domaine — ni sur l'Accueil, ni sur l'Administration, ni sur l'Aide.
- **Un projet inséré en tête** : un clic crée une ligne de niveau 1 titrée `Nouveau projet` et l'insère avant toutes les autres lignes — donc avant les sous-lignes de l'ancien premier projet — et en tête de l'ordre d'affichage persisté.
- **Édition immédiate** : la nouvelle ligne s'ouvre en édition avec tout le titre par défaut sélectionné, comme le fait déjà l'action « + » du menu contextuel ; la première frappe remplace `Nouveau projet`. Si la page était défilée, la ligne est ramenée sous l'en-tête collant avant l'ouverture du clavier.
- **Contrôle toujours atteignable** : il vit dans l'en-tête collant, reste à l'écran pendant le défilement d'un domaine long, et reste en place quand l'outline est remplacé par un re-rendu. Il est désactivé pendant la requête, pour qu'un double clic ne crée pas deux projets.
- **Aide** : la page Aide documente le bouton, la position en tête et l'ouverture du titre pour le nommer.
- **Aucune rupture de données** : le titre par défaut, la forme des nœuds et l'ordre d'affichage existant sont conservés ; un projet créé en tête n'est qu'une ligne de plus.

## Capabilities

### New Capabilities

- (aucune)

### Modified Capabilities

- `node-management` : la création d'un projet devient possible depuis la page du domaine, avec insertion en tête de l'outline et de l'ordre d'affichage, édition immédiate du titre et position conservée après rechargement.
- `project-outliner` : l'en-tête de la page d'un domaine porte le contrôle d'ajout de projet, avec son emplacement, son nom accessible, sa visibilité sur écran étroit et son indépendance vis-à-vis du re-rendu de l'outline.
- `user-guide` : la page Aide documente l'ajout d'un projet depuis la page du domaine.

## Impact

- **`rust/src/model.rs`** : nouvelle fonction `create_project_at_head` qui normalise `display_order` (`ensure_display_order`) puis insère le nœud en `projects[0]` et son id en `display_order[0]`. `create_node` et `create_node_after` sont inchangés pour ne pas déplacer les créations existantes.
- **`rust/src/app.rs`** : `create_node_route` lit un paramètre `position` (JSON ou formulaire) et appelle la nouvelle fonction quand `parentId` est absent ; le fragment rendu et l'en-tête `X-New-Node-Id` restent identiques. Test d'intégration dans `mod http_tests`.
- **`rust/src/html.rs`** : `ShellOptions.add_project`, rendu du bouton par `render_shell` (après le `<h1>`, avant la barre de hiérarchie), activation dans `render_page`, section « Ajouter un projet » dans `render_guide_page`.
- **`server.js`** : `createProjectAtHead`, branche `position` de `POST /domaine/:slug/api/nodes`, option `opts.addProject` de `renderShell`, activation dans `renderPage`, section correspondante de `renderGuidePage`. L'implémentation Node reste la référence de développement et porte le même comportement.
- **`public/app.js`** : `addChildLine` généralisé en `createLine({ parentId, position })`, gestionnaire délégué sur `#add-project` (bouton désactivé pendant la requête, `reveal` actif conservé), enregistrement de titre en vol sérialisé avant la création.
- **`public/style.css`** : styles `.topbar-add` (alignement à droite, cible tactile, état désactivé, focus visible).
- **`public/sw.js`** : incrément de `CACHE_VERSION` (`app.js` et `style.css` sont précachés).
- **Tests** : un cas Rust dans `mod http_tests` (insertion en tête, `X-New-Node-Id`, présence du contrôle sur la page du domaine et absence sur l'accueil, persistance) et une section `test/e2e/reindent.spec.js` (création en tête avec titre sélectionné, double clic, écran étroit, bouton absent des autres pages) ; la liste des sections attendues de la page Aide dans `test/e2e/administration.spec.js` (6.0) gagne la nouvelle section.
- **Aucune nouvelle dépendance, aucune nouvelle route, aucune migration de données** : la route de création existante gagne un paramètre facultatif, les domaines déjà enregistrés restent valides.
