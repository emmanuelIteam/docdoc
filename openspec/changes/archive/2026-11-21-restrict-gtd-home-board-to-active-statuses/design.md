## Context

L'application est un outliner rendu côté serveur, avec htmx pour les fragments, une implémentation Node de référence (`server.js`, utilisée par les tests Playwright) et une implémentation Rust de production (`rust/src/`). Les deux partagent les assets `public/` et le format de données.

Le tableau GTD de la page d'accueil (`GET /`, `render_home_board`/`renderHomeBoard`) comporte aujourd'hui trois colonnes : « À faire », qui regroupe `todo` et `in_progress`, puis « En attente » (`waiting`) et « Un jour peut-être » (`someday`). La première colonne est donc la seule à mapper deux statuts, et les cartes `in_progress` y portent un badge « En cours » pour se distinguer des cartes `todo`. Le dépôt et le menu de cette colonne écrivent `todo` ; `app.js` et les deux serveurs contiennent pour cela un cas particulier de correspondance entre la rubrique `todo` et le statut.

La demande resserre le périmètre : l'accueil ne doit montrer que le travail engagé — `in_progress`, `waiting`, `someday` —, et la première colonne doit s'appeler « En cours ». Les statuts de ligne restent les cinq valeurs persistées ; seule la sélection du tableau change.

## Goals / Non-Goals

**Goals :**

- Ne lister sur la page d'accueil que les lignes feuilles `in_progress`, `waiting` et `someday` de domaines actifs, à toute profondeur, y compris sous un ancêtre replié.
- Renommer la première rubrique « En cours » et lui faire porter uniquement le statut `in_progress`.
- Faire écrire `in_progress` par le glisser-déposer et par le menu de rubrique de la première colonne, sans cas particulier côté client.
- Retirer le badge « En cours », devenu redondant avec le libellé de la colonne.
- Garder la parité Node/Rust, les mêmes noms, le même balisage, les mêmes classes et les mêmes assets.
- Mettre à jour la page Aide et les tests sans migration de données.

**Non-Goals :**

- Aucune suppression ni renommage du statut `todo` : il reste valide dans l'outline, dans la cascade sur les sous-lignes et dans le stockage.
- Aucune promotion automatique des tâches `todo` vers `in_progress` à la création ou à l'affichage.
- Aucune quatrième colonne, aucun filtre, aucune recherche, aucun regroupement par domaine.
- Aucun changement de la route de statut, de la grammaire du lien profond, de l'ordre des cartes, des états vides, du glisser tactile ou de l'annonce `aria-live`.
- Aucun changement du format de stockage ni du vocabulaire des statuts.

## Decisions

### 1. L'identifiant de la première rubrique devient `in_progress`

La rubrique n'est plus un groupe de statuts : `GTD_RUBRIQUES` devient une liste de couples `(id, label)` où l'identifiant est aussi le statut écrit — `in_progress` → « En cours », `waiting` → « En attente », `someday` → « Un jour peut-être ». Le `data-gtd` d'une colonne, le `data-rubrique` d'une carte, la valeur postée par le glisser et par le menu et la clé de `GTD_LABELS` sont donc la même chaîne. Le cas particulier `targetRubrique === 'todo' ? 'todo'` de `gtdMoveCard` et l'équivalent dans `homeTaskCard` disparaissent.

Cela supprime aussi la propriété `statuses` de `GTD_RUBRIQUES` côté Node : elle n'était déjà plus lue, et la correspondance un-à-un la rend inutile. Les deux implémentations partagent alors exactement la même forme de table.

*Alternatives écartées :*

- **Garder l'identifiant `todo` avec le libellé « En cours »** : le balisage, les valeurs postées et les tests continueraient de parler de `todo` pour une colonne qui n'affiche que des tâches commencées ; le prochain lecteur devrait retenir une exception.
- **Garder un groupe `todo` + `in_progress` sous le libellé « En cours »** : contredit la demande, qui veut exclure les tâches non commencées, et garderait le badge pour distinguer deux états dans une colonne censée n'en avoir qu'un.

### 2. `todo` est exclu du tableau, pas du modèle

`home_rubrique`/`homeRubrique` renvoie la rubrique seulement pour `in_progress`, `waiting` et `someday` ; toute autre valeur — `todo`, `done`, un statut inconnu — renvoie l'absence de rubrique. Le statut `todo` reste dans `VALID_STATUSES`, dans le menu de ligne, dans la cascade et dans les fichiers existants. Aucune migration n'est nécessaire : les tâches `todo` existantes restent intactes et réapparaissent sur l'accueil si l'utilisateur les passe à « En cours ».

*Alternatives écartées :*

- **Supprimer `todo` du modèle** : casserait les fichiers existants, le menu de ligne, la cascade et les tests, pour un besoin qui ne concerne que la sélection de l'accueil.
- **Promouvoir automatiquement `todo` en `in_progress` à la création** : changerait la sémantique de l'outline et créerait une mutation implicite ; une tâche non commencée doit rester non commencée.
- **Filtrer `todo` côté client seulement** : le serveur enverrait des cartes que le client masquerait, avec des compteurs faux et un rendu sans JavaScript incohérent.

### 3. Le badge « En cours » est retiré

Toutes les cartes de la colonne « En cours » sont `in_progress` : un badge qui répète le titre de la colonne sur chaque carte n'ajoute aucune information et alourdit chaque entrée. Le badge, son style `.gtd-badge` et les assertions correspondantes disparaissent. L'identification de l'état reste portée par la colonne et par le style du titre.

*Alternatives écartées :*

- **Conserver le badge** : redondant et visuellement bruyant dans une colonne mono-état.
- **Remplacer le badge par un autre indicateur** : aucun autre état n'est représenté dans cette colonne ; rien à signaler.

### 4. Aucun changement de route ni de protocole de déplacement

Le glisser-déposer, le menu de rubrique et la route `POST /domaine/<slug>/api/nodes/<id>/status` restent inchangés dans leur forme. Seule la valeur `status` envoyée pour la première colonne passe de `todo` à `in_progress`, et la réponse `vue=accueil` continue de renvoyer le fragment complet `#home-board`. Le serveur valide `in_progress` avec les autres statuts et applique la même cascade `scope=head`. Aucun nouveau paramètre, aucune nouvelle route, aucune évolution de l'API publique.

*Alternatives écartées :*

- **Une route dédiée à la première colonne** : dupliquerait résolution, validation et persistance pour la même mutation.
- **Un champ `rubrique` distinct du statut** : deux dimensions à maintenir, avec des états contradictoires possibles.

### 5. Rendu, ordre et états vides inchangés

Le tableau garde ses trois sections toujours rendues, ses compteurs, son message « Aucune tâche » par colonne vide, son ordre domaine puis outline, son état vide global sans domaine, son contenu `#home-board` remplacé en entier après un déplacement et son annonce `aria-live`. Seuls le libellé de la première colonne, son identifiant et le filtre changent. La coquille, le titre « Tableau de bord » et l'entrée « Accueil » restent identiques.

### 6. Parité Node/Rust et assets partagés

`server.js` et `rust/src/html.rs` appliquent la même table, le même filtre et le même balisage ; `public/app.js` et `public/style.css` fonctionnent sans adaptation autre que les libellés et la suppression du badge. La page Aide reçoit le même texte dans `renderGuidePage` (Node) et `render_guide_page` (Rust). `public/sw.js` incrémente `CACHE_VERSION` parce que `app.js` et `style.css` changent.

## Risks / Trade-offs

- **Les tâches `todo` disparaissent de l'accueil** → c'est l'effet demandé ; la page Aide explique qu'une tâche non commencée doit être passée à « En cours » depuis son domaine. Le risque est une impression de perte de tâches pour un utilisateur qui n'a jamais classé ses lignes ; le contenu reste intégralement dans l'outline.
- **Une nouvelle ligne, créée avec le statut par défaut `todo`, n'apparaît pas sur l'accueil** → comportement cohérent avec « seules les tâches actives sont listées », mais qui peut surprendre. La page Aide le documente ; une promotion automatique est volontairement exclue.
- **Déposer une carte dans « En cours » écrit `in_progress`** → une tâche que l'utilisateur n'a pas commencée mais qu'il replace dans la première colonne est marquée comme commencée. C'est le seul statut disponible dans cette colonne ; le libellé de la colonne le rend explicite.
- **Des tests et des captures reposent sur `data-gtd="todo"`, `.gtd-badge` et les compteurs** → la revue doit vérifier `test/e2e/home.spec.js`, `test/passkey-flow.js`, `test/e2e/administration.spec.js` et les tests Rust ; un oubli se traduit par un test rouge, pas par une régression silencieuse.
- **Deux implémentations à maintenir** → mêmes noms, mêmes classes, mêmes textes ; la revue vérifie la parité du balisage et du filtre.
- **Un ancien client ou un retour arrière ne connaît pas la nouvelle sémantique** → les statuts stockés restent les mêmes chaînes ; l'ancien tableau afficherait de nouveau les `todo` dans « À faire » et les cartes déplacées en `in_progress` resteraient visibles avec leur badge. Aucune donnée n'est perdue.

## Migration Plan

Aucune migration de données : seules la sélection des statuts et les libellés changent. Le déploiement publie `server.js`/`rust/` et les assets (`app.js`, `style.css`) avec un incrément de `CACHE_VERSION` dans `public/sw.js` ; les service workers installés prennent le nouveau cache à la prochaine visite.

Ordre de mise en œuvre : modèle et rendu serveur (Node puis Rust), suppression du badge et des styles, page Aide, tests. La fonctionnalité est visible dès que la page d'accueil est rechargée ; aucun script de bascule n'est nécessaire.

Retour arrière : restaurer la table des rubriques (première rubrique `todo` avec `statuses: ['todo', 'in_progress']`), le filtre, le badge et ses styles, le cas particulier de `app.js` et les textes de l'Aide. Les tâches passées à `in_progress` par le nouveau dépôt restent à ce statut et sont listées par l'ancien tableau dans « À faire » avec le badge : aucune perte de données.

## Open Questions

Aucune question bloquante. La promotion automatique des tâches non commencées, une colonne « À faire » distincte et un filtre par domaine sont volontairement hors périmètre.
