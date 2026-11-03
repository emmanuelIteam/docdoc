## 1. Filtre et chemin côté serveur

- [x] 1.1 Dans `homeTasks(space)`, ne retenir une ligne que si `node.status === 'in_progress'` **et** qu'elle n'a aucun enfant (`!(node.children && node.children.length)`), puis joindre à chaque entrée la chaîne `ancestors` de ses parents, du projet de niveau 1 au parent immédiat, obtenue en remontant les pointeurs `parent` de l'index `indexOutline` puis en inversant la liste ; retourner `{ domain, node, ancestors }`. La fonction ne lit que l'espace en mémoire et n'écrit rien.
- [x] 1.2 Dans `homeTaskEntry(domain, node, ancestors)`, rendre le titre sur la première ligne, puis une seconde ligne `<span class="home-task-context">` : le badge `<span class="home-task-domain">` avec le nom du domaine, puis pour chaque parent un groupe `<span class="home-task-hop">` contenant le séparateur `<span class="home-task-sep" aria-hidden="true">›</span>` et `<span class="home-task-parent">` avec `titleLabel(parent.title)`. Échapper le nom, les titres et l'URL ; l'entrée reste un unique `<a class="home-task">` vers `/domaine/<slug>?reveal=<id>#node-<id>`.
- [x] 1.3 Dans `renderHomePage(space)`, transmettre `ancestors` à `homeTaskEntry` ; conserver la route, la liste et les deux états vides, en remplaçant le paragraphe « Aucune ligne n'est marquée « En cours » » par un message sur la tâche sans sous-tâche (titre `h2` « Aucune tâche en cours » inchangé) et la marche à suivre pour en marquer une.
- [x] 1.4 Mettre à jour la section « Retrouver les tâches en cours » de `renderGuidePage` : seules les tâches sans sous-tâche sont listées, la seconde ligne rappelle le domaine et la hiérarchie des tâches mères, et le clic ouvre la tâche dans son domaine.

## 2. Styles et cache

- [x] 2.1 Dans `public/style.css`, empiler `.home-task` à toutes les largeurs (`flex-direction: column`, écart réduit), ajouter `.home-task-context` en `display: flex` avec `flex-wrap: wrap` et petite taille de police, garder `.home-task-domain` insécable, laisser `.home-task-parent` revenir à la ligne (`overflow-wrap: anywhere`, pas de `text-overflow` ni d'ellipse), et retirer la règle de bascule 640 px devenue inutile.
- [x] 2.2 Incrémenter `CACHE_VERSION` dans `public/sw.js` (seule `style.css` change parmi les fichiers précachés).

## 3. Tests

- [x] 3.1 Dans `test/e2e/home.spec.js`, ajouter sous `a2` une seconde feuille `a2-2` intitulée « Projet partagé » et « En cours », et l'insérer dans `displayOrder` : elle couvre le même titre dans deux branches d'un même domaine, à côté de `a3` (même domaine, sans parent) et de `b1` (autre domaine).
- [x] 3.2 Adapter le test 1.1 : la liste ne contient plus que les feuilles (`a1-1-1`, `a2-1`, `a2-2`, `a3`, `b1`) dans l'ordre domaine puis outline ; vérifier l'absence des entrées mères `a1` et `a1-1` par `homeTask('domaine-a', 'a1')` et `homeTask('domaine-a', 'a1-1')` (pas par texte, ces titres apparaissent dans les chaînes) ; vérifier la seconde ligne de `a1-1-1` (domaine A, `Projet A1`, `Tâche A1.1`), celle de `a2-1` (domaine A, `Projet A2 replié`), et l'absence de parent sur `a3` et `b1`.
- [x] 3.3 Ajouter une vérification « seules des tâches mères sont en cours » avec le compte B : créer un domaine, ajouter une sous-ligne via `POST /domaine/<slug>/api/nodes` (`parentId`), marquer la ligne mère « En cours » avec `scope=head`, puis ouvrir `/` et attendre l'état vide « Aucune tâche en cours » sans aucune `.home-task`.
- [x] 3.4 Ajouter un contrôle à 390 px : la seconde ligne revient à la ligne et la page ne produit aucun défilement horizontal (`document.documentElement.scrollWidth <= window.innerWidth`), sans troncature du chemin.
- [x] 3.5 Conserver la couverture existante (lien profond et révélation, activation clavier, entrée Accueil, deux états vides) et vérifier que `test/passkey-flow.js` passe sans modification : le titre `h2` de l'état vide reste « Aucune tâche en cours ».

## 4. Vérifications

- [x] 4.1 Lancer `node --check server.js` et `node --check public/app.js`.
- [x] 4.2 Lancer `npm test` et `npm run test:e2e`.
- [x] 4.3 Vérifier à l'écran la page d'accueil en 1280 px et en 390 px : seules les feuilles sont listées, la seconde ligne porte le domaine puis la hiérarchie des tâches mères, et un chemin long revient à la ligne.
- [x] 4.4 Lancer `openspec validate list-leaf-tasks-with-parent-hierarchy --strict`.
