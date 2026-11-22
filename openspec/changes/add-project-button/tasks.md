## 1. Modèle et ordre d'affichage

- [x] 1.1 Dans `rust/src/model.rs`, ajouter `create_project_at_head(domain: &mut Domain) -> Node` : normaliser l'ordre avec `ensure_display_order(&domain.projects, &domain.display_order)`, insérer le nœud en `projects[0]`, insérer son id en `display_order[0]`, réassigner l'ordre normalisé, et documenter pourquoi la normalisation précède l'insertion.
- [x] 1.2 Dans `server.js`, ajouter l'équivalent `createProjectAtHead(domain)` avec `ensureDisplayOrder(domain.projects, domain.displayOrder)` puis `projects.unshift` et `displayOrder.unshift`.
- [x] 1.3 Vérifier les cas limites : outline vide (tête et fin confondues), `displayOrder` vide ou partiel, premier projet déjà pourvu de sous-lignes (le nouvel id doit précéder tout le bloc, et non s'insérer entre le projet et ses sous-lignes).

## 2. Route de création

- [x] 2.1 Dans `rust/src/app.rs`, lire `position` depuis `boundary_params` dans `create_node_route` et appeler `create_project_at_head` quand `parentId` est absent et `position == "head"` ; conserver `create_node(domain, None)` sinon.
- [x] 2.2 Dans `server.js`, ajouter la même branche à `POST /domaine/:slug/api/nodes`.
- [x] 2.3 Vérifier que les trois cas (`parentId` fourni, `position=head`, ni l'un ni l'autre) renvoient le fragment d'outline, l'en-tête `X-New-Node-Id` et la persistance du domaine.

## 3. Rendu et styles

- [x] 3.1 Dans `rust/src/html.rs`, ajouter `add_project: bool` à `ShellOptions`, rendre le bouton dans `render_shell` entre le `<h1>` et la barre de hiérarchie, et l'activer dans `render_page` uniquement.
- [x] 3.2 Dans `server.js`, ajouter `opts.addProject` à `renderShell` et `addProject: true` à l'appel de `renderPage`.
- [x] 3.3 Donner au bouton la forme `type="button"`, `id="add-project"`, `class="btn-mini topbar-add"`, un libellé visible `+` et `title`/`aria-label` « Ajouter un projet ».
- [x] 3.4 Dans `public/style.css`, styler `.topbar-add` : `margin-left: auto`, `flex: 0 0 auto`, cible d'au moins 24 × 24 px, survol cohérent avec `.btn-mini`, état `[disabled]` visible, anneau de focus conservé ; ajouter au besoin une règle dans le bloc `@media (max-width: 640px)`.
- [x] 3.5 Incrémenter `CACHE_VERSION` dans `public/sw.js` (`app.js` et `style.css` sont précachés). Le changement de statuts voisin avait déjà porté la valeur à `v24` : la présente modification passe à `v25`.

## 4. Client

- [x] 4.1 Dans `public/app.js`, généraliser `addChildLine(parentId)` en `createLine({ parentId, position })` et faire passer les deux appelants par cette fonction.
- [x] 4.2 Ajouter un gestionnaire délégué sur `#add-project` : désactiver le bouton dès l'envoi (`disabled` et `aria-busy="true"`), envoyer `{ position: 'head' }` avec le paramètre `reveal` actif, réactiver dans `finally`.
- [x] 4.3 Après le swap, retrouver la ligne par `X-New-Node-Id` et appeler `startRename(..., forceEnd: true, selectAll: true)` sur son titre.
- [x] 4.4 Exposer l'enregistrement de titre en vol (`pendingTitleSave`, réglée puis effacée) et l'attendre dans `createLine` avant le POST ; en cas d'échec de l'enregistrement, ne pas créer et repasser par `reloadOutline()`.
- [x] 4.5 Vérifier que le bouton n'est rendu que sur les pages de domaine, qu'il survit à un swap de `#outline` (changement de statut, repli) et qu'aucun chemin de re-rendu ne le duplique.

## 5. Aide

- [x] 5.1 Dans `render_guide_page` (`rust/src/html.rs`), ajouter une section « Ajouter un projet » : le bouton « + » de l'en-tête, l'insertion en tête de la liste, et l'ouverture du titre avec `Nouveau projet` sélectionné.
- [x] 5.2 Reprendre la même section dans `renderGuidePage` (`server.js`).

## 6. Spécifications

- [x] 6.1 Mettre à jour `openspec/specs/node-management/spec.md` (exigence « Create a node » : contrôle de la page du domaine, insertion en tête de l'outline et de l'ordre d'affichage, édition immédiate, position conservée, activation unique).
- [x] 6.2 Mettre à jour `openspec/specs/project-outliner/spec.md` (nouvelle exigence : contrôle d'ajout de projet dans l'en-tête de la page d'un domaine).
- [x] 6.3 Mettre à jour `openspec/specs/user-guide/spec.md` (nouvelle exigence : la page Aide documente l'ajout d'un projet depuis la page du domaine).

## 7. Tests

- [x] 7.1 Dans `mod http_tests` (`rust/src/app.rs`), ajouter un cas : créer un domaine, poster `{"position":"head"}` sur `/domaine/{slug}/api/nodes`, vérifier `X-New-Node-Id`, que la nouvelle ligne précède la ligne par défaut dans le fragment, et qu'elle est toujours première après un `GET` de la page. Le cas vérifie aussi la présence du contrôle sur la page du domaine et son absence sur l'accueil.
- [x] 7.2 Dans `test/e2e/reindent.spec.js`, ajouter une section « Ajouter un projet depuis l'en-tête » : le bouton est visible avec son nom accessible, un clic crée une ligne `Nouveau projet` en première position avec tout le titre sélectionné, la frappe remplace le titre et l'ordre persiste après rechargement.
- [x] 7.3 Ajouter les cas « un double clic ne crée qu'un seul projet », « sur écran étroit le bouton reste atteignable dans l'en-tête collant après défilement » et « le bouton est absent de l'Accueil, de l'Administration et de l'Aide » ; mettre à jour la liste des sections attendues de la page Aide dans `test/e2e/administration.spec.js` (6.0).
- [x] 7.4 Lancer `cargo fmt --check` et `cargo test` avec la toolchain locale du dépôt (`RUSTUP_HOME=.rustup`, `CARGO_HOME=.cargo`, `--offline`), puis la suite Playwright. Chrome n'étant pas installé sur cette machine, la suite a été exécutée avec Edge via une configuration locale non versionnée (`playwright.edge.config.js`, supprimée après la vérification) ; `node --check` passe sur `server.js` et `public/app.js`.
