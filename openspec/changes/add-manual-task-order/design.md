## Context

La page d'accueil GTD est rendue côté serveur : `homeBoard` (Node) / `home_tasks` (Rust) parcourt les domaines dans l'ordre du panneau latéral, puis l'ordre d'affichage de chaque outline, et remplit deux listes — `in_progress` (« À faire ») et `waiting` (« En attente »). `renderHomeBoard` rend ces listes en deux colonnes, chaque carte portant déjà la poignée de glissement, le lien profond du titre et le menu de rubrique. Le glisser-déposer entre rubriques passe par la route de statut (`POST /domaine/:slug/api/nodes/:id/status` avec `vue=accueil`) et remplace `#home-board` par le fragment rendu.

Le tableau est aujourd'hui entièrement dérivé de la structure : la spec `home-dashboard` interdit même explicitement un ordre manuel propre à une rubrique. L'utilisateur veut au contraire décider de l'ordre de traitement de ses tâches depuis l'accueil, sans déplacer les lignes de ses domaines.

Contraintes :

- Le projet est maintenu en deux implémentations : `server.js` (référence de développement, couverte par Playwright) et `rust/` (runtime publié par l'image). Toute route, tout rendu et tout stockage doivent être portés à l'identique.
- Les données vivent dans un bucket compatible S3, par compte, sous `users/{userId}/` ; un document par famille (`themes.json`, `domains/{id}.json`, `archive/{id}.json`).
- La sauvegarde JSON exporte et restaure l'espace du compte ; les sauvegardes existantes doivent rester restaurables.
- Le rendu reste serveur : l'ordre ne peut pas être une simple préférence locale au navigateur.

## Goals / Non-Goals

**Goals:**

- Ordre manuel propre à chaque rubrique et au compte, avec l'ordre domaines + outline comme ordre initial quand aucun ordre n'est enregistré.
- Réordonnancement par glisser-déposer dans une rubrique, à la souris, au doigt et au stylet, avec repère d'insertion.
- Réordonnancement au clavier par deux flèches `↑` / `↓` par carte, désactivées aux extrémités, avec conservation du focus.
- Dépôt dans l'autre rubrique à la position visée ; le menu de rubrique place la carte en fin de liste.
- Persistance du document d'ordre, incluse dans l'export et remplacée par la restauration.
- Parité Node / Rust et aucune migration de données.

**Non-Goals:**

- Changer l'ordre des lignes dans un domaine ou l'ordre des domaines dans le panneau.
- Ajouter un tri automatique (par date, priorité, domaine) ou un mode « tri manuel » à activer.
- Réordonner les tâches depuis la page d'un domaine ou depuis Administration.
- Glisser une carte entre deux onglets, annuler un réordonnancement, ou proposer un historique.
- Changer le format des domaines, des nœuds ou de `displayOrder`.
- Rendre le glisser-déposer utilisable sans JavaScript : les flèches et le menu sont les chemins accessibles, et l'ordre s'affiche sans JavaScript puisque le serveur le rend.

## Decisions

### 1. Un document par compte, deux listes d'identifiants

L'ordre est stocké dans `users/{userId}/home-order.json` :

```json
{
  "in_progress": ["id-tache-1", "id-tache-2"],
  "waiting": ["id-tache-3"]
}
```

`storage.homeOrderKey(userId)` construit la clé, `Space.homeOrder` porte les deux listes en mémoire, `persistHomeOrder` les écrit via la file `writeQueue` existante. Côté Rust, `HomeOrder` (deux `Vec<String>`, `Default`) est chargé par `Space::load` et écrit par `persist_home_order`.

*Alternatives écartées :*

- **Un rang par nœud dans le document du domaine** (`homeRank`) : un nœud n'appartient qu'à une rubrique à la fois, mais son rang devrait être réinitialisé à chaque changement de statut ; comparer des rangs globaux entre domaines ferait perdre le regroupement par domaine dès le premier déplacement, et chaque réordonnancement réécrirait plusieurs documents de domaine.
- **Un ordre par domaine** : le tableau mélange les domaines ; un ordre par domaine ne peut pas entrelacer deux domaines ni exprimer « cette tâche du domaine B avant celle du domaine A ».
- **`localStorage`** : l'ordre ne suivrait pas le compte d'un appareil à l'autre et ne serait pas dans la sauvegarde ; le rendu resterait serveur et afficherait l'ordre naturel avant que le client ne le corrige, avec un saut visible.
- **Dans `themes.json`** : mélange deux préoccupations dans un document dont le nom et le format ne l'annoncent pas.
- **Une clé par rubrique** (`home-order/in_progress.json`) : deux écritures pour un déplacement entre rubriques, et deux lectures au chargement, sans bénéfice.

### 2. Fusion déterministe : ordre enregistré puis reste naturel

À chaque rendu d'une rubrique :

1. construire la liste naturelle des cartes listées (domaines puis outline) ;
2. parcourir la liste enregistrée de la rubrique et retenir les identifiants qui figurent encore dans la liste naturelle, sans doublon ;
3. ajouter à la suite les cartes non retenues, dans l'ordre naturel.

La fusion est idempotente et ne dépend d'aucune date. Une liste enregistrée vide (ou absente, ou un identifiant supprimé, terminé, archivé, ou passé `todo`) redonne exactement l'ordre actuel : la migration est implicite et l'affichage d'un compte existant ne change pas tant que l'utilisateur n'a rien déplacé. Une carte nouvellement listée n'est pas dans la liste enregistrée : elle rejoint la fin de la rubrique. L'identifiant resté dans une liste pour une tâche qui n'est plus listée est ignoré au rendu et disparaît à la première écriture de cette rubrique.

*Alternatives écartées :*

- **Insérer une carte inconnue à sa place naturelle** : l'ordre manuel ne serait plus stable — une nouvelle carte s'intercalerait au milieu d'une séquence que l'utilisateur a choisie. La fin de rubrique est la seule position qui ne déplace aucune carte existante.
- **Réécrire l'ordre à chaque rendu** : un GET ne doit rien persister (règle déjà posée pour l'accueil) et deux onglets se battraient pour la même écriture.

### 3. Une route unique de positionnement

`POST /api/home/order` reçoit `domain` (slug), `node` (id), `rubrique` (`in_progress` ou `waiting`) et `index` (entier facultatif). Elle :

1. valide la rubrique et un éventuel `index` non entier (400), résout le domaine par slug (404) et le nœud (404) ;
2. vérifie que le nœud est une feuille active listée — `homeRubrique` non nul — sinon 400 ;
3. si le statut courant diffère de la rubrique, applique `setStatus(..., 'head')` et persiste le domaine ;
4. calcule la liste affichée de la rubrique après mutation, retire le nœud, borne `index` entre 0 et la longueur, puis insère ; sans `index`, insère à la fin ;
5. écrit la liste complète de la rubrique dans `home-order.json` et renvoie `renderHomeBoard(space)` en HTML.

La route porte à la fois le statut et la position parce qu'un dépôt entre rubriques change les deux : deux requêtes (statut puis position) rendraient un fragment intermédiaire, doubleraient la latence et exposeraient un état où la carte est dans la rubrique sans sa position. Le rendu renvoyé est le même fragment `#home-board` que la route de statut, donc htmx et la restauration du focus restent inchangés.

La route de statut garde sa branche `vue=accueil` pour les appels existants et les tests, mais la page d'accueil ne l'utilise plus : tous les gestes du tableau — flèches, glisser, menu — passent par `/api/home/order`, ce qui garantit une seule sémantique de position.

*Alternatives écartées :*

- **Étendre la route de statut avec `index`** : la route de statut est aussi celle de la page d'un domaine ; y ajouter un paramètre d'ordre propre à l'accueil brouille son contrat. La nouvelle route reste une route d'accueil, au même niveau que `/api/backup`.
- **Envoyer la liste complète depuis le client** : le serveur devrait valider une permutation entière, et deux clients pourraient écraser l'ordre avec des listes incomplètes ; un index borné côté serveur est plus simple et plus sûr.
- **Deux routes (`/reorder` puis `/status`)** : un dépôt entre rubriques produirait deux rendus et deux écritures.

### 4. L'index est compté en cartes, pas en pixels

Côté client, la position d'insertion est le nombre de cartes de la rubrique cible — la carte glissée exclue — dont le milieu est au-dessus du pointeur. Un repère `gtd-drop-before` / `gtd-drop-after` est posé sur la carte voisine, ou la colonne est mise en évidence quand elle est vide. Cette règle donne directement l'index final attendu par le serveur :

- déposer au-dessus de la première carte → 0 ;
- déposer sous la dernière carte → longueur de la liste ;
- déposer sur sa position courante → même index, aucune requête.

La carte glissée est exclue du comptage : sans cela, un déplacement vers le bas serait décalé d'un cran. Le dépôt est calculé de la même façon pour la souris (HTML5 drag), le toucher et le stylet (Pointer Events depuis la poignée), en réutilisant `elementFromPoint` pour le tactile.

*Alternatives écartées :*

- **Insérer selon l'événement `dragover` de la carte survolée uniquement** : une colonne vide ou un dépôt sous la dernière carte n'aurait pas de cible, et le glisser tactile ne produirait pas de `dragover`.
- **Envoyer l'identifiant de la carte voisine** (`beforeId` / `afterId`) : il faudrait gérer les extrémités (`null` en tête et en fin) et le serveur devrait retrouver l'index ; un entier est plus direct et se borne côté serveur.

### 5. Les flèches sont rendues par le serveur, désactivées aux bornes

`homeTaskCard` reçoit la position et le total de la carte dans sa rubrique. Elle rend un groupe `.gtd-order` avec deux `<button type="button">` portant `hx-post="/api/home/order"`, `hx-vals` (`domain`, `node`, `rubrique`, `index` = position ∓ 1), `hx-target="#home-board"` et `hx-swap="outerHTML"`. La flèche haut est `disabled` en position 0, la flèche bas en dernière position ; une flèche désactivée ne peut donc pas envoyer de requête. Le nom accessible est « Monter « titre » » / « Descendre « titre » », et le glyphe est décoratif.

Le rendu serveur de l'index évite un calcul client et garantit que la requête est valide au moment où la carte est affichée ; le serveur borne de toute façon l'index, donc une carte modifiée entre-temps ne peut pas produire un déplacement hors bornes.

*Alternatives écartées :*

- **Un gestionnaire JS qui calcule l'index au clic** : il faudrait retrouver la position dans le DOM, alors que le serveur la connaît déjà au rendu ; le seul cas où le DOM a changé est un autre onglet, que le serveur borne.
- **Une seule flèche qui ouvre un menu de position** : moins direct et plus difficile à répéter au clavier.
- **Réutiliser le menu de rubrique** : il ne propose que les rubriques, pas les positions.

### 6. Le focus et l'annonce passent par l'état d'attente existant

`gtdPendingMove` gagne le type d'action (`drag`, `menu`, `arrow`), la direction et la rubrique d'origine. `htmx:beforeRequest` le remplit pour les flèches comme pour le menu ; `htmx:afterSwap` le consomme :

- `arrow` : focus sur la même flèche si elle existe et n'est pas désactivée, sinon sur l'autre flèche, sinon sur le lien du titre ; annonce « « titre » montée/descendue en position N sur M. » ;
- `menu` : focus sur le lien du titre ; annonce du déplacement vers la rubrique ;
- `drag` : focus sur le lien du titre ; annonce du déplacement ou de la nouvelle position selon que la rubrique change.

Les messages restent dans `#gtd-announcer`, région `aria-live` polie hors du fragment remplacé, déjà en place. La garde `gtdBusy` reste unique : une seule requête de tableau à la fois, et un second geste est ignoré jusqu'au swap.

### 7. La sauvegarde porte `homeOrder`, sans changer la version

L'export ajoute `homeOrder` à l'objet racine, toujours présent, avec les deux tableaux. La validation l'accepte absent (sauvegarde antérieure) et le refuse s'il n'est pas un objet ou si un tableau contient autre chose qu'une chaîne ; les identifiants inconnus sont conservés et simplement ignorés au rendu. La restauration écrit `home-order.json` avec l'ordre validé, ou deux tableaux vides quand le champ est absent, afin qu'une restauration remplace bien tout l'espace. `BACKUP_VERSION` reste `1` : le champ est additif, une ancienne sauvegarde reste lisible, et un ancien lecteur qui ignore le champ ne corrompt rien.

*Alternatives écartées :*

- **Passer la version à 2** : les sauvegardes version 1 deviendraient à traiter séparément, alors que l'ajout est rétrocompatible ; la spec exige qu'une version inconnue soit refusée, et une montée de version casserait la restauration des fichiers existants.
- **Ne pas sauvegarder l'ordre** : une restauration perdrait silencieusement une personnalisation que l'utilisateur a prise la peine de faire.

### 8. Le fantôme de glissement et les indicateurs suivent les nouveaux contrôles

Le clone produit par `gtdBuildGhost` retire déjà `.gtd-move` ; il retire aussi `.gtd-order` pour que le fantôme ne montre pas de flèches actives. Les classes de repère sont retirées par `gtdClearDropTarget`, comme les classes de colonne, au `dragend`, au `drop` et au `pointercancel`.

### 9. Parité Rust

`rust/src/space.rs` porte `HomeOrder`, le chargement et l'écriture ; `rust/src/storage.rs` la clé ; `rust/src/html.rs` la fusion, les positions et les flèches ; `rust/src/app.rs` la route, la validation de sauvegarde et l'export. Les noms de champs et le comportement de fusion sont identiques à Node, et les tests unitaires Rust couvrent l'ordre et les bornes.

## Risks / Trade-offs

- **Index périmé (deux onglets, autre appareil)** → le serveur borne l'index et refuse une tâche qui n'est plus listée ; le client recharge le tableau en cas d'erreur, comme pour les mutations existantes.
- **Écriture concurrente de l'ordre** → une seule requête de tableau à la fois par client (`gtdBusy`), et la file `writeQueue` sérialise les écritures ; le dernier écrivain gagne, ce qui est acceptable pour un compte personnel.
- **Une carte qui revient dans une rubrique** → si son identifiant figure encore dans la liste enregistrée (aucun réordonnancement de cette rubrique entre-temps), elle retrouve son ancienne position ; sinon elle est ajoutée en fin. Le comportement est déterministe mais peut surprendre : la spec le décrit comme « position enregistrée » et non comme une promesse de retour.
- **Identifiants orphelins** (tâche supprimée, domaine archivé) → ignorés au rendu et purgés à la prochaine écriture de la rubrique ; le document ne grossit pas indéfiniment.
- **Retour arrière vers une version sans `homeOrder`** → l'ancien code ignore `home-order.json` et réaffiche l'ordre naturel ; aucune donnée de domaine n'est touchée. L'ordre manuel n'est pas perdu sur disque et revient avec la version suivante.
- **Ancien service worker** → `CACHE_VERSION` est incrémenté, règle déjà en place pour tout actif précaché (`app.js`, `style.css`).
- **Glisser-déposer inaccessible par nature** → les flèches et le menu couvrent le clavier, et l'annonce `aria-live` décrit le résultat ; le glisser reste un raccourci pour la souris et le doigt.
- **2 implémentations** → la fusion, la route et les bornes doivent rester identiques ; les tests Playwright couvrent Node et les tests unitaires / de routeur couvrent Rust.
- **Sauvegarde d'une version antérieure** → le champ absent vide l'ordre à la restauration, ce qui est le comportement voulu d'un remplacement intégral ; aucun refus.

## Migration Plan

Aucune migration de données. `home-order.json` est créé à la première écriture ; son absence, une liste partielle ou des identifiants inconnus donnent l'ordre naturel actuel. Les domaines, les nœuds et `displayOrder` ne changent pas. Déploiement normal avec incrément de `CACHE_VERSION` ; les deux implémentations doivent être livrées ensemble. Retour arrière : supprimer la route et le rendez-vous des flèches ; le fichier `home-order.json` reste inerte et peut être supprimé sans conséquence sur les domaines.

## Open Questions

Aucune question bloquante. Le sort d'une carte qui revient dans une rubrique est tranché par la règle de fusion (position enregistrée si elle existe encore, sinon fin de rubrique) et n'a pas besoin d'un réglage supplémentaire.
