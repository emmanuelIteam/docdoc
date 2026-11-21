## Why

La page d'accueil GTD liste aujourd'hui toutes les lignes feuilles non terminées, y compris celles qui n'ont pas encore été commencées (`todo`). La colonne « À faire » mélange donc des tâches que l'utilisateur n'a pas engagées et des tâches réellement en cours, et son libellé ne décrit plus ce qu'elle contient. L'accueil doit devenir un tableau de pilotage du travail engagé : seules les tâches en cours, en attente ou « un jour peut-être » y figurent, et la première colonne s'appelle « En cours ».

## What Changes

- **Périmètre réduit aux états actifs** : seules les lignes feuilles de domaine actif dont le statut est `in_progress`, `waiting` ou `someday` sont listées sur la page d'accueil. Les lignes `todo` n'y apparaissent plus ; les lignes mères, les `done` et les domaines archivés restent exclus comme aujourd'hui.
- **« À faire » devient « En cours »** : la première rubrique porte le libellé « En cours » et ne regroupe plus que le statut `in_progress`. L'identifiant interne de la rubrique passe de `todo` à `in_progress`, ce qui supprime la table de correspondance spéciale entre la rubrique et le statut.
- **Badge « En cours » retiré** : la carte d'une tâche `in_progress` n'affiche plus de badge « En cours », puisque la rubrique elle-même porte ce libellé et que toutes ses cartes sont dans cet état.
- **Dépôt dans la première rubrique** : glisser une carte vers « En cours » ou choisir cette rubrique dans le menu écrit le statut `in_progress` sur la tâche, et non plus `todo`. Les deux autres rubriques continuent d'écrire `waiting` et `someday`.
- **Statuts de ligne inchangés** : `todo` reste une valeur valide du menu de l'outline, de la cascade sur les sous-lignes et du format de stockage ; seul l'accueil l'exclut. Une tâche `todo` doit être passée à « En cours » depuis son domaine pour apparaître sur l'accueil.
- **BREAKING** pour l'affichage : une tâche `todo` n'apparaît plus sur la page d'accueil. Comme `todo` est le statut par défaut d'une ligne créée, une nouvelle ligne n'apparaît sur l'accueil qu'après avoir été passée à « En cours ».
- **Aide** : la section GTD de la page Aide nomme les trois rubriques « En cours », « En attente » et « Un jour peut-être » et explique que les tâches non commencées ne sont pas listées.
- **Aucune migration de données** : les statuts sont des chaînes déjà persistées ; les tâches `todo` existantes restent lisibles dans leur outline et disparaissent simplement de l'accueil.

## Capabilities

### New Capabilities

- (aucune)

### Modified Capabilities

- `home-dashboard` : la rubrique « À faire » devient « En cours » et ne regroupe plus que `in_progress` ; les tâches `todo` ne sont plus listées ; l'exigence de badge « En cours » est retirée ; le dépôt et le menu de la première rubrique écrivent `in_progress`.
- `user-guide` : la page Aide documente les trois rubriques renommées, l'exclusion des tâches `todo` et le passage à « En cours » nécessaire pour qu'une tâche apparaisse sur l'accueil.

## Impact

- **`server.js`** : `GTD_RUBRIQUES` (identifiant, libellé et statuts de la première rubrique), `homeRubrique` (exclusion de `todo`), `homeTaskCard` (suppression du badge et écriture directe du statut de la rubrique dans le menu), texte de la section GTD de la page Aide.
- **`rust/src/html.rs`** : `GTD_RUBRIQUES`, `home_rubrique`, `home_task_card` (badge et choix de rubrique), `render_home_board` et texte de `render_guide_page` ; tests unitaires du tableau mis à jour.
- **`rust/src/app.rs`** : tests du routeur de statut (`vue=accueil`) adaptés au nouveau contenu et aux nouveaux statuts listés.
- **`public/app.js`** : `GTD_LABELS` et l'envoi du statut cible dans `gtdMoveCard` (plus de cas particulier `todo`).
- **`public/style.css`** : suppression de la règle `.gtd-badge`, devenue inutile.
- **`public/sw.js`** : incrément de `CACHE_VERSION` (`app.js` et `style.css` changent).
- **Tests** : `test/e2e/home.spec.js` (fixtures, contenus et compteurs des rubriques, absence des `todo`, glisser et menu), `test/passkey-flow.js` (un domaine dont la seule ligne est `todo` ne montre plus de carte), `test/e2e/administration.spec.js` (contenu de la page Aide), tests unitaires et de routeur Rust.
- **Aucune dépendance nouvelle, aucun changement du format de stockage.**
