## 1. Liste plate du panneau

- [x] 1.1 Réécrire `renderSidebarNav` pour parcourir directement `space.domainList` et rendre une entrée `domainLink` par domaine, sans en-tête de thème, sans section « Sans thème » et sans pastille ; conserver l'état vide « Aucun domaine ».
- [x] 1.2 Calculer dans `renderSidebar` le chemin de la page courante (`/`, `/administration`, `/aide` ou `/domaine/<slug>`) et le transmettre à `renderSidebarNav` pour les formulaires de classement ; conserver les classes, `aria-current` et l'ordre des blocs Accueil / Domaines / pied.

## 2. Classement depuis le panneau

- [x] 2.1 Ajouter près de `redirectAfter` un helper qui n'accepte qu'un chemin local (chaîne commençant par `/`, refusant `//`, la barre oblique inverse et les caractères de contrôle) et renvoie `null` sinon.
- [x] 2.2 Adapter `POST /api/domains/:id/move` : valider `req.body.returnTo` avec ce helper, l'utiliser comme chemin par défaut de `redirectAfter`, et conserver `/administration` comme repli ; ne rien changer à `moveDomain`, aux directions ni aux bornes.
- [x] 2.3 Rendre chaque entrée dans une ligne `.sidebar-domain` contenant le lien `.sidebar-link` et deux formulaires `POST /api/domains/:id/move` (`dir=up`/`down`, `returnTo` courant) avec boutons `title`/`aria-label` nommant le domaine, désactivés au premier et au dernier rang.
- [x] 2.4 Vérifier que les contrôles sont des `<button>` dans des `<form>` : le repli du panneau sur écran étroit écoute les ancres, donc un déplacement ne doit pas replier le panneau, et l'état rouvert doit persister après le rechargement.

## 3. Styles et cache

- [x] 3.1 Ajouter dans `public/style.css` les styles de `.sidebar-domain` (ligne flex, lien tronqué) et de `.sidebar-order` : largeur réservée, contrôles révélés au survol et à `:focus-within`, visibles en permanence sous `@media (hover: none)`, boutons d'au moins 24 px et état désactivé lisible.
- [x] 3.2 Supprimer les règles devenues mortes `.theme-group`, `.theme-group-header`, `.theme-group-name`, `.theme-group-domains` et `.sidebar-muted` après vérification qu'elles ne servent qu'au panneau ; conserver `.theme-dot` pour la matrice et les étiquettes.
- [x] 3.3 Incrémenter `CACHE_VERSION` dans `public/sw.js` (seule `style.css` change parmi les fichiers précachés).

## 4. Étiquettes

- [x] 4.1 Dans `POST /domaine/:slug/api/labels`, retirer le panneau renvoyé en *out-of-band* et ne renvoyer que `renderLabelsBar` ; mettre à jour le commentaire. Conserver `rebuildDomainList`, nécessaire aux pastilles et à la matrice d'Administration.
- [x] 4.2 Vérifier que l'attachement et le détachement depuis la barre restent sans rechargement, que les chips et le sélecteur suivent, et que le panneau ne bouge plus.

## 5. Page Aide

- [x] 5.1 Ajouter une section « Classer les domaines » dans `renderGuidePage`, entre « Rattacher un thème » et « Gérer les thèmes et les domaines » : contrôles ↑/↓ du panneau, ordre partagé avec Administration et l'accueil, thèmes restant des étiquettes, sans second lien vers `/administration`.
- [x] 5.2 Vérifier que la section est du HTML statique, lisible sans JavaScript et sur écran étroit.

## 6. Tests

- [x] 6.1 Mettre à jour `test/e2e/administration.spec.js` 6.0 : la liste des titres `.guide-section h2` inclut « Classer les domaines » au bon rang, et le lien vers `/administration` reste unique.
- [x] 6.2 Réécrire 6.1 : supprimer les assertions `.theme-group` / `.theme-group-name` / pastille du panneau ; vérifier la liste plate `Alpha` puis `Beta`, l'inversion après la flèche d'Administration, la présence d'un seul lien par domaine après attachement d'un thème, et l'ordre conservé après archivage/restauration.
- [x] 6.3 Réécrire 6.2 : le panneau n'a ni champ visible, ni formulaire de thème, ni bouton Renommer/Supprimer/Archiver, mais il expose bien deux contrôles de déplacement par domaine.
- [x] 6.4 Réécrire 6.7 : la barre d'étiquettes met à jour ses chips sans rechargement et le panneau garde exactement la même liste plate, sans groupe « Sans thème ».
- [x] 6.5 Ajouter dans `test/e2e/sidebar.spec.js` un scénario de classement avec les deux domaines de fixture : ↓ sur le premier puis ↑ sur le second, bornes désactivées, même URL après le POST, ordre reflété dans la table d'Administration et dans le panneau, puis restauration de l'ordre initial pour ne pas perturber les scénarios suivants.
- [x] 6.6 Ajouter le cas écran étroit (390 px) : activer un contrôle de déplacement recharge la page avec le panneau toujours ouvert.

## 7. Vérifications

- [x] 7.1 Lancer `node --check server.js`.
- [x] 7.2 Lancer `npm test`.
- [x] 7.3 Lancer `npm run test:e2e`.
- [x] 7.4 Vérifier à l'écran en 1280 px et en 390 px : liste plate, révélation des contrôles au survol et au doigt, déplacement d'un cran, état actif conservé, panneau non replié sur smartphone, page Aide.
- [x] 7.5 Lancer `openspec validate flatten-sidebar-domain-list --strict`.

## 8. Portage Rust (runtime servi par le conteneur)

- [x] 8.1 Dans `rust/src/html.rs`, remplacer `render_sidebar_nav` par la liste plate et les lignes `.sidebar-domain` avec formulaires ↑/↓ ; calculer le chemin courant dans `render_sidebar` et ajouter la section « Classer les domaines » à l'Aide.
- [x] 8.2 Dans `rust/src/app.rs`, ajouter `local_path`, l'utiliser dans `move_domain_route` et retirer le panneau *out-of-band* de la route des étiquettes.
- [x] 8.3 Ajouter le test Rust `sidebar_is_flat_and_reorder_returns_to_the_page` et lancer `cargo test --locked` (38 tests).
- [x] 8.4 Reconstruire l'image et recréer le conteneur `docdoc`, puis vérifier qu'il est sain, que le CSS servi contient `.sidebar-domain` et que le binaire déployé ne contient plus `theme-group`.
