## 1. Rendu serveur de la page d'accueil

- [x] 1.1 Ajouter `homeTasks(space)` dans `server.js` : parcourir `space.domainList` dans l'ordre, résoudre chaque domaine par `space.domains`, réparer l'ordre d'affichage avec `ensureDisplayOrder` et indexer l'arbre avec `indexOutline`, puis retenir dans l'ordre les nœuds dont `status === 'in_progress'` ; retourner des entrées `{ domain, node }`. La fonction ne lit que l'espace en mémoire et n'écrit rien.
- [x] 1.2 Ajouter `renderHomePage(space)` : rendue avec `renderShell(space, contenu, null, { title: 'Tâches en cours', home: true })` ; une liste `<ul class="home-tasks">` avec une `<li>` par entrée ; état vide « Aucun domaine » (avec lien vers Administration) quand `space.domainList` est vide, état vide « Aucune tâche en cours » sinon.
- [x] 1.3 Rendre chaque entrée comme un unique `<a class="home-task" href="/domaine/<slug>?reveal=<id>#node-<id>">` contenant le titre puis `<span class="home-task-domain">` avec le nom du domaine ; échapper le titre, le nom et l'URL.
- [x] 1.4 Ajouter `titleLabel(title)` à côté de `renderTitleHtml`, avec la même `TASK_LINK_SOURCE` et un remplacement par `'$1'`, pour afficher le texte visible d'un titre contenant des liens de tâche ; l'utiliser pour le titre d'une entrée sans toucher à `renderTitleHtml`.
- [x] 1.5 Remplacer le corps de `app.get('/')` par `res.type('html').send(renderHomePage(req.space))` : plus de redirection, et aucun appel à `ensureDefaultProject` ni à `persistDomain` (un `GET` ne doit rien créer).

## 2. Panneau latéral et aide

- [x] 2.1 Ajouter une option `home` à `renderShell` et `renderSidebar`, et rendre avant Administration l'entrée `<a class="sidebar-link sidebar-home" href="/">Accueil</a>`, avec la classe `active` et `aria-current="page"` sur la page d'accueil uniquement.
- [x] 2.2 Ajouter dans `renderGuidePage` une section « Retrouver les tâches en cours » décrivant la page d'accueil, le rappel du nom du domaine et l'ouverture d'une tâche dans son contexte.

## 3. Style et cache

- [x] 3.1 Ajouter dans `public/style.css` les styles de la liste d'accueil : entrée pleine largeur cliquable, focus visible, titre sur plusieurs lignes non tronqué, badge de domaine lisible sans survol et passant sous le titre en 640 px ou moins, états vides.
- [x] 3.2 Incrémenter `CACHE_VERSION` dans `public/sw.js` (seule `style.css` change parmi les fichiers précachés).

## 4. Tests

- [x] 4.1 Mettre à jour `test/e2e/reindent.spec.js` : `enroll` attend une URL hors `/auth` (l'accueil) au lieu de `/domaine/`, et `domainPath` vaut `/domaine/e2e` avant la première navigation.
- [x] 4.2 Mettre à jour `test/passkey-flow.js` : après l'adoption, `GET /` répond 200 et affiche l'état vide « Aucune tâche en cours » au lieu d'une redirection 302, tandis que `/domaine/voyages` affiche toujours « Réserver le camping ».
- [x] 4.3 Mettre à jour `test/e2e/administration.spec.js` : le pied du panneau compte trois entrées (Accueil, Administration, Aide) et la liste attendue des titres `h2` de la page Aide inclut la nouvelle section.
- [x] 4.4 Ajouter `test/e2e/home.spec.js` sur le modèle de `sidebar.spec.js` (serveur enfant, deux comptes autorisés) : un compte avec deux domaines dont les tâches en cours sont à plusieurs profondeurs, une tâche en cours sous un ancêtre replié, une tâche « À faire », une tâche « Terminé » et un même titre dans les deux domaines ; un second compte avec un domaine mais aucune tâche en cours.
- [x] 4.5 Couvrir la liste : seules les lignes « En cours » apparaissent, une sous-tâche profonde et une tâche sous un ancêtre replié sont listées, l'ordre suit les domaines puis l'outline, chaque entrée affiche le nom de son domaine et deux titres identiques restent distinguables ; couvrir les deux états vides (aucun domaine via le compte sans domaine de l'administration, aucune tâche via le second compte).
- [x] 4.6 Couvrir la navigation : `href` exact `/domaine/<slug>?reveal=<id>#node-<id>`, clic vers la bonne URL, ancêtres dépliés, ligne cible visible et surlignée, statut inchangé, et activation au clavier par focus puis `Entrée`.
- [x] 4.7 Couvrir l'entrée « Accueil » : présente sur une page de domaine, active sur l'accueil, inactive sur une page de domaine, et menant à `/`.

## 5. Vérifications

- [x] 5.1 Lancer `node --check server.js` et `node --check public/app.js`.
- [x] 5.2 Lancer `npm test` et `npm run test:e2e`.
- [x] 5.3 Vérifier à l'écran la page d'accueil en 1280 px et en 390 px (liste, nom du domaine, clic, surlignage), puis `openspec validate add-homepage-open-tasks --strict`.
