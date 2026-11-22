## Why

La page d'accueil range aujourd'hui les cartes selon l'ordre des domaines du panneau latéral puis, dans un domaine, selon l'ordre de l'outline. Cet ordre est entièrement imposé : impossible de remonter la tâche du jour au-dessus des autres, ni de rapprocher deux tâches de domaines différents sans déplacer les lignes dans leur domaine. Le tableau est pourtant l'écran de pilotage quotidien : l'utilisateur veut y décider de l'ordre dans lequel il traite ses tâches, au lieu de le déduire de la structure de ses projets.

## What Changes

- **Ordre manuel par rubrique** : chaque rubrique — « À faire » et « En attente » — conserve sa propre séquence de cartes, pour le compte connecté. Tant qu'aucun ordre n'a été enregistré pour une rubrique, l'ordre actuel (domaines puis outline) reste l'ordre initial ; dès qu'une carte y est déplacée, l'ordre manuel prime.
- **Glisser-déposer dans une rubrique** : une carte se dépose avant ou après une autre carte de la même rubrique, avec un repère d'insertion visible. L'ordre est enregistré et le tableau rafraîchi, avec le même rendu serveur que les mutations existantes. Le geste fonctionne à la souris, au doigt et au stylet (poignée).
- **Flèches haut et bas** : chaque carte gagne deux contrôles accessibles, `↑` et `↓`, qui la déplacent d'un cran dans sa rubrique. Ils sont désactivés en première et en dernière position, s'activent au clavier, et le focus reste sur la flèche utilisée (ou sur l'autre si elle devient désactivée) pour répéter le geste.
- **Dépôt positionné entre rubriques** : déposer une carte dans l'autre rubrique conserve le point de dépôt — avant ou après une carte — au lieu de la placer systématiquement en fin de liste. Le menu « Changer de rubrique » place la carte en fin de rubrique cible.
- **Ordre durable et sauvegardé** : la séquence est stockée par compte et par rubrique dans un document dédié, conservée entre deux visites et incluse dans la sauvegarde JSON. Une carte nouvellement listée dans une rubrique rejoint la fin de cette rubrique.
- **Aide** : la page Aide documente le réordonnancement par glisser-déposer et par les flèches, et le fait que l'ordre est mémorisé.
- **Aucune rupture de données** : sans ordre enregistré, l'affichage reste identique à aujourd'hui ; le format des domaines et des tâches est inchangé et les sauvegardes existantes restent restaurables.

## Capabilities

### New Capabilities

- (aucune)

### Modified Capabilities

- `home-dashboard` : l'ordre des cartes devient manuel et propre à chaque rubrique, avec l'ordre des domaines puis de l'outline comme ordre initial ; le glisser-déposer réordonne à l'intérieur d'une rubrique ; deux flèches par carte réordonnent au clavier ; le dépôt entre rubriques conserve la position ; le focus et l'annonce couvrent le réordonnancement.
- `data-backup` : l'export contient l'ordre manuel des tâches de l'accueil ; la restauration le remplace ; une sauvegarde sans ce champ reste valide et laisse l'ordre vide.
- `user-guide` : la page Aide documente les flèches et le glisser-déposer de réordonnancement, les extrémités désactivées et la persistance de l'ordre.

## Impact

- **`server.js`** : `homeOrder` dans l'espace du compte (chargement, écriture sérialisée), fusion de l'ordre manuel dans `homeBoard`, rendu des flèches dans `homeTaskCard`, nouvelle route `POST /api/home/order` (statut et position en une requête, fragment `#home-board` en réponse), export/restauration/validation de la sauvegarde, texte de la page Aide, commentaires de l'ordre.
- **`storage.js`** : nouvelle clé `homeOrderKey(userId)` (`users/{userId}/home-order.json`), document `{ in_progress: [...], waiting: [...] }`.
- **`rust/src/space.rs`** : champ `home_order`, chargement depuis la nouvelle clé et écriture (`persist_home_order`).
- **`rust/src/storage.rs`** : constructeur de la clé `home_order_key`.
- **`rust/src/html.rs`** : fusion de l'ordre dans `home_tasks`, flèches et positions dans `home_task_card`, texte de la page Aide.
- **`rust/src/app.rs`** : route `POST /api/home/order`, validation, lecture/écriture de l'ordre, inclusion dans `backup_document`, validation et restauration de `homeOrder`, tests de routeur.
- **`public/app.js`** : résolution de la position de dépôt (avant/après une carte, colonne vide), repère d'insertion, envoi de la position, flèches et restauration du focus, messages d'annonce, suppression des flèches du fantôme de glissement.
- **`public/style.css`** : styles `.gtd-order` et `.gtd-order-btn` (cible tactile, états désactivé et focus), repères `.gtd-drop-before` / `.gtd-drop-after`.
- **`public/sw.js`** : incrément de `CACHE_VERSION` (`app.js` et `style.css` changent).
- **Documentation** : `docs/exploitation.md` (arborescence du compte et contenu de la sauvegarde) et `rust/README.md` si l'arborescence y est décrite.
- **Tests** : nouvelle suite Playwright `test/e2e/home-order.spec.js` (serveur et compte dédiés) ; `test/e2e/home.spec.js` (dépôt dans la rubrique d'origine, focus, annonces), `test/e2e/backup.spec.js` (ordre exporté et restauré), `test/e2e/administration.spec.js` (liste des sections de la page Aide), tests unitaires et de routeur Rust.
- **Aucune dépendance nouvelle, aucun changement du format des domaines ou des nœuds** ; un espace sans ordre enregistré affiche exactement l'ordre actuel.
