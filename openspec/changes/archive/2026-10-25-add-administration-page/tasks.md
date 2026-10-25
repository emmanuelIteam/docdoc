## 1. Stockage et helpers serveur

- [x] 1.1 Ajouter `listArchiveKeys(userId)` à `storage.js`, calqué sur `listDomainKeys` et confiné à `users/{userId}/archive/` ; l'exporter.
- [x] 1.2 Factoriser la mutation d'étiquette dans un helper `setDomainLabel(space, domain, themeId, action)` utilisé par `POST /domaine/:slug/api/labels` et par la matrice.
- [x] 1.3 Ajouter un helper `redirectAfter(req, res, defaultPath)` qui redirige vers `/administration` quand `req.body.returnTo === '/administration'` et applique sinon le comportement actuel de la route (aucune autre valeur acceptée).
- [x] 1.4 Ajouter `moveTheme(space, id, direction)` (échange dans le tableau `themes`, persistance) et `moveDomain(space, id, direction)` (échange des `order` avec renumérotation `0..n-1` si égalité, persistance des domaines concernés).
- [x] 1.5 Ajouter `ensureDefaultProject(space, domain)` : si `projects` est vide, créer une ligne racine via `createNode(domain, null)` et persister. Le helper sert à la création du domaine, aux GET d'outline et après la suppression de la dernière ligne.

## 2. Rendu de la page d'administration

- [x] 2.1 Ajouter `renderAdminPage(space)` et le drapeau `opts.admin` de `renderShell` (titre « Administration », `data-domain-slug` vide, rubrique active).
- [x] 2.2 Rendre la section Thèmes : formulaire de création (nom + couleur), une ligne par thème (pastille, nom, couleur, ↑, ↓, suppression confirmée).
- [x] 2.3 Rendre la matrice thème × domaine : lignes = thèmes, colonnes = domaines, une cellule = un formulaire `attach`/`detach`, état vide explicite, conteneur défilable horizontalement.
- [x] 2.4 Rendre la section Domaines : formulaire de création, une ligne par domaine (ordre, nom suivi d'un bouton d'édition `✎` en `<details>` qui révèle le champ et l'avertissement « URL régénérée », URL, thèmes portés, ↑, ↓, archivage confirmé). Aucun champ de renommage n'est visible tant que le bouton n'est pas activé.
- [x] 2.5 Rendre la section Archives dans un `<details>` replié : une ligne par domaine archivé (nom, bouton Restaurer, bouton Purger avec confirmation nominative), état vide explicite.
- [x] 2.6 Prévoir les états vides des trois sections et de la matrice, et vérifier que la page se rend avec un espace entièrement vide.

## 3. Routes

- [x] 3.1 Ajouter `GET /administration` après `auth.guard` + `withSpace`, rendant la page depuis `req.space` uniquement.
- [x] 3.2 Ajouter `POST /api/themes/:id/move` (`dir=up|down`) → `moveTheme`, puis redirection vers l'administration.
- [x] 3.3 Ajouter `POST /api/domains/:id/move` (`dir=up|down`) → `moveDomain`, puis redirection vers l'administration.
- [x] 3.4 Ajouter `POST /api/themes/:id/labels` (`domainId`, `action=attach|detach`) → `setDomainLabel`, 404 si thème ou domaine inconnu, puis redirection vers l'administration.
- [x] 3.5 Ajouter `POST /api/archives/:id/restore` : lire l'objet d'archive du compte, régénérer le slug, fixer `order = nextOrder`, écrire le domaine, supprimer l'objet d'archive, puis redirection vers l'administration.
- [x] 3.6 Ajouter `POST /api/archives/:id/purge` : supprimer l'objet d'archive du compte, 404 « Archive introuvable » si absent, puis redirection vers l'administration.
- [x] 3.7 Brancher `redirectAfter` sur `POST /api/themes`, `POST /api/themes/:id/rename`, `POST /api/themes/:id/delete`, `POST /api/domains`, `POST /api/domains/:id/rename`, `POST /api/domains/:id/archive`.
- [x] 3.8 Faire répondre `POST /domaine/:slug/api/labels` avec le fragment de barre d'étiquettes quand `HX-Request` est présent, accompagné du panneau latéral en `hx-swap-oob="outerHTML"` ; conserver la redirection actuelle pour une requête non htmx.

## 4. Panneau latéral, page domaine et accueil

- [x] 4.1 Simplifier `renderSidebar` : retirer les formulaires de création, les champs de renommage et les boutons de suppression des thèmes ; garder les en-têtes de groupe en lecture seule (pastille + nom).
- [x] 4.2 Ajouter la rubrique « Administration » dans `.sidebar-footer`, au-dessus de la boîte de session, active uniquement sur la page d'administration.
- [x] 4.3 Supprimer `renderDomainActions` et la barre d'outils de la page domaine : plus de bouton « + Nouveau projet », plus de zone d'étiquettes en haut ; rendre à la place la barre `#labels-bar` fixée en bas à droite. Le titre de la page reste en lecture seule.
- [x] 4.4 Renvoyer l'état vide de l'accueil vers la page d'administration (lien) et mettre à jour le texte d'aide du pied de page qui mentionne la création dans le panneau.
- [x] 4.5 Extraire `renderSidebarNav(space, activeSlug)` de `renderSidebar` et le réutiliser pour le swap OOB de la barre d'étiquettes.
- [x] 4.6 Brancher `ensureDefaultProject` sur `POST /api/domains`, `GET /domaine/:slug`, `GET /domaine/:slug/outline-fragment` et `DELETE /domaine/:slug/api/nodes/:id`.
- [x] 4.7 Passer le toggle « + » de `app.js` en délégation d'événements (l'élément est remplacé à chaque swap) et brancher les formulaires de puce et d'attachement en htmx (`hx-target="#labels-bar"`, `hx-swap="outerHTML"`).

## 5. Styles

- [x] 5.1 Ajouter les styles de la page : `.admin-section`, `.admin-table`, `.admin-empty`, `.matrix`, `.admin-move`, la rubrique active du panneau et le rendu du `<details>` des archives.
- [x] 5.2 Ajouter les styles de la barre `#labels-bar` : `position: fixed` en bas à droite, chips alignées, sélecteur ouvert vers le haut, espace réservé sous l'outline et au-dessus du pied de page, adaptation aux écrans étroits.
- [x] 5.3 Ajouter le style du bouton d'édition du domaine : `<summary>` sans marqueur natif, curseur et zone cliquable, mise en page du formulaire révélé dans la cellule nom.

## 6. Vérification

- [x] 6.1 Ajouter `test/e2e/administration.spec.js` : créer un thème et un domaine depuis la page, changer la couleur d'un thème, réordonner thème et domaine, attacher/détacher via la matrice, archiver, restaurer (vérifier l'URL et la fin de liste), purger.
- [x] 6.2 Vérifier l'absence de contrôles de gestion dans le panneau, l'absence de renommage/archivage sur la page domaine, et l'absence de barre d'outils en haut du contenu.
- [x] 6.3 Vérifier le confinement : deux comptes, les archives de l'un n'apparaissent jamais chez l'autre ; une archive inconnue renvoie « Archive introuvable ».
- [x] 6.4 Relancer `npm test` et `npx playwright test` ; les specs existantes (`reindent.spec.js`) doivent rester vertes.
- [x] 6.5 Lancer `openspec validate add-administration-page --strict` avant de clore le changement.
- [x] 6.6 Ajouter un test : un domaine créé contient une ligne « Nouveau projet » ; supprimer cette dernière ligne en recrée une ; un domaine restauré dont l'outline est vide en reçoit une à sa première visite.
- [x] 6.7 Ajouter un test : attacher puis détacher une étiquette depuis la barre ne recharge pas la page (marqueur conservé), la barre se met à jour et le panneau latéral regroupe le domaine immédiatement.
- [x] 6.8 Ajouter un test : le renommage d'un domaine se fait par le bouton `✎` de l'administration (formulaire invisible avant activation), reste interdit sur la page domaine, et l'avertissement d'URL apparaît à l'ouverture.
