## Why

La page d'accueil ne montre aujourd'hui qu'une seule liste : les tâches feuilles marquées « En cours ». Elle ne permet donc pas de distinguer ce qui est actionnable de ce qui est bloqué en attente d'un tiers ou simplement mis de côté. La méthode GTD repose précisément sur cette séparation ; sans elle, les tâches « à faire » et les tâches « un jour peut-être » se mélangent dans l'outline et la page d'accueil perd sa valeur de tableau de pilotage.

## What Changes

- **Trois rubriques GTD sur la page d'accueil** : « À faire », « En attente » et « Un jour peut-être », rendues comme trois colonnes (empilées sur un écran étroit) toujours visibles dès qu'un domaine existe.
- **Une seule classification par tâche** : la rubrique d'une tâche est son statut. Deux statuts sont ajoutés au vocabulaire existant : `waiting` (« En attente ») et `someday` (« Un jour peut-être »). Les statuts `todo`, `in_progress` et `done` restent inchangés.
- **« À faire » regroupe `todo` et `in_progress`** : une tâche commencée reste actionnable et ne disparaît pas de l'accueil ; elle porte un badge « En cours ». La colonne « À faire » ne change pas le statut d'une tâche en cours lorsqu'on y dépose une carte déjà présente.
- **Périmètre de la liste** : seules les lignes feuilles (sans enfant) des domaines actifs, à toute profondeur, tous domaines confondus. Les lignes mères restent des regroupements et ne sont pas listées ; les tâches `done` et les domaines archivés sont exclus.
- **Rattachement par glisser-déposer** : une carte se glisse d'une rubrique à une autre à la souris, au doigt ou au stylet ; le dépôt écrit le statut de la tâche et rafraîchit le tableau. Un dépôt sur la rubrique d'origine, hors d'une rubrique ou annulé ne change rien.
- **Alternative clavier** : chaque carte offre un menu « Changer de rubrique » avec les trois rubriques, pour classer une tâche sans glisser.
- **Ordre stable** : dans chaque rubrique, les cartes suivent l'ordre des domaines du panneau latéral puis l'ordre d'affichage de l'outline ; un déplacement change la rubrique, pas la position dans la rubrique.
- **Statuts visibles dans l'outline** : le menu d'une ligne propose aussi « En attente » et « Un jour peut-être », et le titre porte un style propre à chaque statut. La cascade sur les sous-lignes reste inchangée.
- **Page d'accueil** : le titre devient « Tableau de bord », l'état vide « Aucune tâche en cours » est remplacé par trois colonnes vides, et l'entrée « Accueil » du panneau reste inchangée.
- **Aide** : la page Aide explique les trois rubriques, le glisser-déposer et le menu de repli.
- **Aucune migration de données** : les statuts sont des chaînes déjà persistées ; les tâches existantes en `todo`, `in_progress` ou `done` restent lisibles et les deux nouveaux statuts n'apparaissent que lorsqu'une tâche est classée.
- **BREAKING** pour l'affichage : l'accueil ne liste plus uniquement les tâches « En cours » ; toutes les tâches feuilles non terminées apparaissent, les tâches `todo` dans « À faire ».

## Capabilities

### New Capabilities

- (aucune)

### Modified Capabilities

- `home-dashboard` : la liste unique des tâches en cours devient un tableau à trois rubriques GTD, avec glisser-déposer, alternative clavier, ordre par rubrique et nouveaux états vides.
- `node-status-tracking` : le vocabulaire des statuts passe de trois à cinq valeurs ; « En attente » et « Un jour peut-être » sont mutuellement exclusifs avec les autres statuts et ont un rendu propre dans l'outline.
- `user-guide` : la page Aide documente les rubriques GTD et le classement depuis l'accueil.

## Impact

- **`server.js`** : `VALID_STATUSES` et les tables d'icônes/libellés gagnent `waiting` et `someday` ; `homeTasks`/`renderHomePage` sont remplacés par un regroupement en trois rubriques et un rendu de cartes ; la route `POST /domaine/:slug/api/nodes/:id/status` renvoie le fragment du tableau quand la requête vient de l'accueil (`vue=accueil`) ; texte de la page Aide.
- **`rust/src/model.rs`** : `VALID_STATUSES`, `status_icon`, `status_label` et validation de `set_status` pour les cinq statuts.
- **`rust/src/html.rs`** : rendu des cinq statuts dans le menu et le titre d'une ligne ; `render_home_board` (fragment) et `render_home_page` (coquille) ; page Aide.
- **`rust/src/app.rs`** : la route de statut renvoie le fragment du tableau pour `vue=accueil` ; tests de routeur.
- **`public/app.js`** : glisser-déposer HTML5 et tactile des cartes, indicateurs de dépôt, restauration du focus et annonce vocale après rafraîchissement.
- **`public/style.css`** : styles des colonnes, cartes, poignée, menus, états vides, badges « En cours », statuts `waiting`/`someday`, et retour à la ligne du menu de ligne si nécessaire.
- **`public/sw.js`** : incrément de `CACHE_VERSION` (`style.css` et `app.js` changent).
- **Tests** : `test/e2e/home.spec.js` réécrit autour des trois rubriques et du glisser-déposer (souris et tactile) ; `test/passkey-flow.js` n'attend plus l'état vide pour un domaine dont la seule tâche est `todo` ; `test/e2e/administration.spec.js` attend le nouveau titre de la section d'aide ; tests unitaires Rust (`model`, `html`, routeur) ajoutés ou adaptés.
- **Aucune dépendance nouvelle, aucun changement du format de stockage.**
