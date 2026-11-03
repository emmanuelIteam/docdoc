## 1. Page « Aide » et navigation

- [x] 1.1 Ajouter `renderGuidePage(space)` dans `server.js`, à côté de `renderAdminPage` : appeler `renderShell(space, contenu, null, { title: 'Aide', help: true })` et construire le contenu en `<div class="guide">` avec une introduction et neuf sections `<h2>` (sélection et menu, repli, déplacement, renommage, ajout d'une sous-tâche, liens de tâche, indentation, étiquettes, administration), chacune avec le texte et les listes décrits dans la tâche 4.1.
- [x] 1.2 Ajouter la route `GET /aide` juste après `GET /administration`, avec le même type de réponse HTML et un message d'erreur dédié (« Aide indisponible ») si le rendu échoue. La route est montée après `auth.guard` et `withSpace` : ne pas ajouter de contrôle d'accès.
- [x] 1.3 Dans `renderSidebar`, calculer `helpActive = Boolean(opts.help)` et ajouter, dans `.sidebar-extra`, un lien `Aide` (`class="sidebar-link sidebar-help"`, `href="/aide"`, `active` + `aria-current="page"` quand `helpActive`) **immédiatement après** le lien Administration.
- [x] 1.4 Dans `renderShell`, supprimer le bloc `<footer class="shell-footer">` et son `<p class="hint">` ; vérifier qu'aucune autre page ne dépend de ce pied de page.

## 2. Retrait du pied de page

- [x] 2.1 Dans `public/style.css`, supprimer le bloc `.shell-footer` et les règles `body.has-labels-bar .shell-footer` (y compris dans la requête de média 640 px) ; retirer `grid-template-rows: 1fr auto` de `.shell`, en conservant `min-height: 100vh`.
- [x] 2.2 Conserver la règle `.hint` (utilisée par `public/offline.html`) et la règle `body.has-labels-bar main { padding-bottom: 4rem; }`.
- [x] 2.3 Vérifier qu'aucun rendu ni aucune règle `shell-footer` ne subsiste dans `server.js` et `public/style.css` (les tests ne gardent que des assertions d'absence du pied de page).
- [x] 2.4 Sur une page de domaine avec la barre d'étiquettes visible, vérifier que la dernière ligne de l'outline n'est plus recouverte et que la barre reste à sa place.

## 3. Styles et cache

- [x] 3.1 Ajouter les styles de la page : `.guide` (largeur de lecture bornée, par exemple `max-width: 46rem`), introduction, espacement des sections, titres `h2`, listes, et ajustement sur écran étroit. Le contenu doit revenir à la ligne sans débordement.
- [x] 3.2 Remplacer `.sidebar-admin { font-weight: 600; }` par `.sidebar-admin, .sidebar-help { font-weight: 600; }` pour donner à l'entrée Aide le même poids qu'Administration.
- [x] 3.3 Vérifier que `CACHE_VERSION` est incrémenté dans `public/sw.js` (fichier précaché modifié) : l'arbre porte déjà `v3`, dernière version à déployer.
- [x] 3.4 Vérifier que le contenu de la page ne contient aucun `#outline`, aucun `#labels-bar` ni aucun formulaire de mutation ; les scripts de la coquille (`htmx`, `app.js`, `pwa.js`) restent chargés comme sur la page Administration, qui vit déjà sans outline.

## 4. Contenu et spécification

- [x] 4.1 Vérifier que le texte de `/aide` couvre chaque geste listé par `user-guide` : bouton et menu au survol, bouton visible sans survol, sélection ligne + sous-lignes, second clic sur la tête, fermeture au départ du pointeur, double-clic de repli, glisser depuis le bouton, poignée et glisser au doigt, renommage par clic hors lien ou action du menu, ajout d'une sous-tâche par l'action +, collage d'un lien de tâche et ouverture de la cible, `Tab`/`MAJ+Tab` pendant l'édition ou sur une ligne sélectionnée, collage d'une étiquette de thème, et lien vers `/administration`.
- [x] 4.2 Relire le contenu pour n'y ajouter aucune fonctionnalité absente de l'application et n'en retirer aucun geste existant ; conserver le français et les libellés de l'interface (`MAJ+Tab`, « Renommer »).
- [x] 4.3 Vérifier que le delta `project-outliner` ne retire que l'exigence « Document line interactions in a page footer » et que `space-administration` n'a pas de delta.
- [x] 4.4 Lancer `openspec validate move-user-manual-to-help-page --strict` et corriger toute erreur de format.

## 5. Tests

- [x] 5.1 Dans `test/e2e/administration.spec.js`, ajouter une section « Aide » **avant** le test 6.1 (l'espace du compte A est encore vide) : `.sidebar-extra a` contient exactement `Administration` puis `Aide` dans cet ordre, le clic sur Aide mène à `/aide`, le titre est « Aide », l'entrée Aide est active et porte `aria-current="page"`, l'entrée Administration ne l'est pas, la page ne contient aucun `footer.shell-footer`, et le contenu mentionne les sujets documentés (sélection, repli, déplacement, renommage, ajout d'une sous-tâche, liens de tâche, `Tab`/`MAJ+Tab`, étiquettes, lien `/administration`).
- [x] 5.2 Dans le même fichier, compléter le test 6.2 (ou 6.1) pour vérifier qu'une page de domaine et la page Administration n'ont plus de `footer.shell-footer`, et que l'entrée Aide n'est pas active quand Administration l'est.
- [x] 5.3 Dans `test/e2e/task-links.spec.js`, remplacer les deux assertions sur `footer.shell-footer .hint` (lignes 439-440) par une visite de `/aide` et la vérification que la documentation des liens de tâche y figure (collage du lien copié, ouverture de la ligne cible).
- [x] 5.4 Vérifier que le test 5.1 fonctionne aussi isolément (`npx playwright test administration.spec.js -g "6.0"` ou équivalent), sans dépendre des domaines créés par 6.1.

## 6. Vérification automatisée

- [x] 6.1 Lancer `npx playwright test` (les quatre fichiers e2e) et vérifier que la suite est verte, nouveaux tests compris.
- [x] 6.2 Lancer `npm test` (suite passkey/stockage) et vérifier qu'elle reste verte.
- [x] 6.3 Lancer `openspec validate move-user-manual-to-help-page --strict` : valide.
- [x] 6.4 Après archivage du change, remplacer le `Purpose` « TBD » créé automatiquement dans `openspec/specs/user-guide/spec.md` par la description de la capacité (page « Aide » : route, entrée du panneau, absence de documentation en pied de page, contenu et présentation).

## 7. Recette manuelle

- [ ] 7.1 Depuis une page de domaine, une page Administration et l'état vide : l'entrée Aide est sous Administration, le clic ouvre `/aide`, la page affiche le manuel en sections, et aucun texte d'aide n'apparaît en bas des pages.
- [ ] 7.2 Sur un écran étroit (390 px), la page se lit sans débordement, le texte revient à la ligne et le panneau se replie/déplie comme avant.
- [ ] 7.3 Avec un espace sans domaine, `/aide` reste accessible et la page d'accueil vide n'affiche plus le pied de page.

## Note de vérification

- `npx playwright test` (E2E_PORT=3699) : **69/69**, dont le nouveau test 6.0 (page Aide avant tout domaine : ordre Administration → Aide, entrée active et `aria-current`, contenu en 9 sections, absence de `footer.shell-footer`, aucun débordement horizontal à 390 px) et les assertions ajoutées à 6.2 (page domaine et page Administration sans pied de page, entrée Aide inactive). Après l'ajout du contrôle à 390 px, `administration.spec.js` a été rejoué : **7/7**.
- `npm test` : **39/39** ; l'assertion « raccourcis Tab / MAJ+Tab documentés » cible désormais `/aide` et vérifie que la page domaine ne rend plus `shell-footer`.
- `openspec validate move-user-manual-to-help-page --strict` : valide.
- `public/sw.js` était déjà en `CACHE_VERSION = 'v3'` dans l'arbre (incrément d'un change voisin) ; cette version dessert le `style.css` modifié au prochain déploiement, aucune nouvelle incrémentation n'est donc nécessaire.
- Change archivé le 2026-11-03 sous `openspec/changes/archive/2026-11-03-move-user-manual-to-help-page` ; le `Purpose` de `openspec/specs/user-guide/spec.md` a été renseigné (tâche 6.4). Restent à faire : la recette visuelle 7.1 à 7.3 (vrai navigateur / téléphone).
- Après archivage, les specs e2e touchées (`administration.spec.js` et `task-links.spec.js`, 24 tests) et `npm test` (39 vérifications) ont été rejouées avec succès.
