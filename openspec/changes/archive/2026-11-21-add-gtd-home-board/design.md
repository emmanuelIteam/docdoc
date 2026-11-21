## Context

L'application est un outliner rendu côté serveur, avec htmx pour les fragments et une implémentation Node de référence (`server.js`, utilisée par les tests Playwright) doublée d'une implémentation Rust de production (`rust/src/`). Les deux partagent les mêmes assets `public/` et le même format de données.

Un domaine porte une forêt de nœuds `{ id, title, status, collapsed, children }` et un `displayOrder` plat. Le statut est aujourd'hui limité à `todo`, `in_progress` et `done`, et il est appliqué soit à la ligne seule (`scope=head`), soit à tout son sous-arbre (`scope=subtree`). La page d'accueil (`GET /`) est déjà servie à la racine : elle parcourt l'espace en mémoire, ne persiste rien sur un `GET`, et liste les lignes feuilles `in_progress` avec le nom de leur domaine, la chaîne de leurs parents et un lien profond `/domaine/<slug>?reveal=<id>#node-<id>`.

La racine n'a donc qu'une seule liste et aucun moyen de déplacer une tâche entre des listes. Le modèle de statut, lui, est déjà un champ persistant par nœud : il peut porter la classification GTD sans nouveau champ ni migration.

## Goals / Non-Goals

**Goals :**

- Servir un tableau GTD à trois rubriques sur `/`, toujours rendu côté serveur et lisible sans JavaScript.
- Classer chaque tâche dans exactement une rubrique, en réutilisant le statut persistant : `todo` ou `in_progress` → « À faire », `waiting` → « En attente », `someday` → « Un jour peut-être ».
- Permettre le rattachement par glisser-déposer à la souris, au doigt et au stylet, avec une alternative clavier équivalente.
- Conserver l'ordre des domaines du panneau puis l'ordre d'affichage de l'outline dans chaque rubrique.
- Conserver les liens profonds, le rappel du domaine et de la hiérarchie, et l'exclusion des domaines archivés.
- Rester à parité entre `server.js` et `rust/src/`, sans dépendance nouvelle ni changement du format de stockage.

**Non-Goals :**

- Aucun regroupement par domaine, filtre, recherche ou pagination.
- Aucun réordonnancement manuel des cartes à l'intérieur d'une rubrique : la position reste déterministe.
- Aucune quatrième colonne « Terminé » et aucune gestion des tâches terminées depuis l'accueil.
- Aucun glisser-déposer entre la page d'accueil et une page de domaine : le geste se limite au tableau.
- Aucun changement de la cascade de statut sur les sous-lignes, ni de la grammaire du lien profond, ni du rendu de l'outline au-delà du style des nouveaux statuts.
- Aucune nouvelle route d'API publique : la route de statut existante gagne seulement un mode de réponse pour l'accueil.

## Decisions

### 1. Le statut est la classification GTD, avec deux valeurs ajoutées

Le statut d'un nœud reste l'unique champ de classification. `waiting` et `someday` rejoignent `todo`, `in_progress` et `done` ; les valeurs sont des chaînes déjà persistées, donc aucune migration n'est nécessaire. `set_status` continue de valider contre la liste complète, et la cascade `scope=subtree` est inchangée.

La rubrique « À faire » est un groupe de statuts (`todo` et `in_progress`) et non un statut unique : une tâche commencée reste une action à faire, elle ne doit pas disparaître de l'accueil. Une carte `in_progress` porte un badge « En cours » dans cette colonne.

*Alternatives écartées :*

- **Un champ `gtd` séparé du statut** : deux dimensions à maintenir, avec des états contradictoires possibles (une tâche « En cours » et « Un jour peut-être »), et une migration de chaque nœud. Le statut est déjà exactement cette dimension.
- **Remplacer les statuts par trois rubriques** : casserait `in_progress` et `done`, déjà persistés et utilisés par le menu de ligne et les tests.
- **Une quatrième colonne « En cours »** : la demande porte sur trois rubriques GTD ; « En cours » est un état d'avancement dans « À faire », pas une rubrique de report.

### 2. Seules les lignes feuilles sont listées

Une carte représente une action. Une ligne qui possède des enfants est un regroupement (projet, tâche mère) : elle reste visible dans son outline et n'est pas listée sur l'accueil. Le filtre est le même que dans la version actuelle : `children` vide, à toute profondeur, y compris sous un ancêtre replié. Les `done` et les domaines archivés sont exclus.

*Alternatives écartées :*

- **Lister toutes les lignes, y compris les mères** : le tableau se remplit de regroupements non actionnables, et déposer une mère poserait la question de la cascade sur ses enfants.
- **Lister les mères à la place de leurs feuilles** : une tâche mère peut avoir des feuilles dans des rubriques différentes ; elle n'a pas de rubrique unique.

### 3. Trois colonnes toujours présentes dès qu'un domaine existe

`render_home_board` rend les trois sections, chacune avec son en-tête, son compteur et sa liste, même lorsqu'elle est vide. Une colonne vide affiche « Aucune tâche ». Sans aucun domaine, la page conserve l'état vide « Aucun domaine » avec le lien vers Administration : il n'y a alors rien à classer et aucun tableau à montrer.

Le tableau est enveloppé dans un unique `<div id="home-board">` pour que htmx puisse le remplacer en entier après un déplacement. La coquille (`renderShell`) garde le panneau, le titre de page « Tableau de bord » et l'entrée « Accueil » active.

*Alternatives écartées :*

- **Masquer les colonnes vides** : l'utilisateur ne verrait pas où déposer une tâche et les trois rubriques disparaîtraient selon les données.
- **Un état vide global quand tout est vide** : contrairement à la version actuelle, cela empêcherait de voir les rubriques et de comprendre qu'elles existent.

### 4. Réutiliser la route de statut avec un mode « accueil »

Le dépôt et le menu clavier envoient `POST /domaine/<slug>/api/nodes/<id>/status` avec `status=<rubrique>` (`todo` pour « À faire »), `scope=head`, `vue=accueil`. Après persistance, la route renvoie `render_home_board(space)` au lieu du fragment d'outline. Le slug et l'id sont portés par la carte (`data-*`), donc la route reste scopée au domaine et à la session comme aujourd'hui.

Ce choix évite une seconde route de mutation, une seconde validation et une seconde persistance. Le paramètre `vue` ne change que la réponse, jamais la sémantique du statut.

*Alternatives écartées :*

- **Une route dédiée `/accueil/api/...`** : dupliquerait la résolution du domaine, la validation et la persistance pour le même geste.
- **Une réponse JSON et une mise à jour optimiste côté client** : le tableau devrait être reconstruit en JavaScript, alors que le serveur sait déjà le rendre ; une erreur laisserait l'interface désynchronisée.
- **Un rechargement complet après chaque dépôt** : perdrait le focus et le contexte de défilement pour un simple changement de rubrique.

### 5. Glisser-déposer natif pour la souris, Pointer Events pour le tactile

Une carte est un `<li class="gtd-card" draggable="true">` avec un lien de titre profond, une poignée de déplacement et un menu de rubrique. Le glisser HTML5 est utilisé pour la souris et le stylet ; il démarre sur la carte (le lien et le menu restent interactifs), affiche un fantôme de la carte et surligne la colonne survolée. Sur tactile, HTML5 n'émet pas d'événements : la poignée `.gtd-grip` démarre un glisser piloté par Pointer Events, avec le même fantôme, le même indicateur de colonne et le même appel serveur. La poignée est visible en permanence, avec une cible d'au moins 24 px, pour que le geste reste découvrable au doigt comme à la souris.

La poignée tactile évite de confondre le geste avec le défilement vertical de la page. Le dépôt sur la rubrique d'origine est un no-op ; un dépôt hors colonne ou une annulation ne fait aucune requête. Une requête en cours bloque un second dépôt.

*Alternatives écartées :*

- **Glisser depuis toute la carte au doigt** : le moindre défilement démarrerait un déplacement et empêcherait de faire défiler le tableau.
- **Une bibliothèque de glisser-déposer** : dépendance nouvelle pour un geste que le projet implémente déjà dans l'outline avec les mêmes primitives.
- **Un glisser HTML5 seul** : ne fonctionne pas sur les navigateurs tactiles ciblés par la PWA.

### 6. Alternative clavier : un menu de rubrique par carte

Chaque carte porte un `<details class="gtd-move">` dont le résumé est un bouton « Changer de rubrique » et dont le contenu offre les trois rubriques. Chaque choix est un bouton `hx-post` vers la route de statut, avec `vue=accueil`, `scope=head` et `hx-target="#home-board"`. La rubrique courante est désactivée et marquée `aria-current`. Le menu est rendu par le serveur et ne dépend pas du glisser-déposer.

C'est l'équivalent clavier et lecteur d'écran du geste. Il évite d'ajouter des boutons toujours visibles sur chaque carte et reste utilisable sans JavaScript de glisser (htmx est déjà chargé par toutes les pages).

*Alternatives écartées :*

- **Un `<select>` par carte** : plus lourd visuellement et soumis à un comportement de formulaire différent du reste de l'application.
- **Aucune alternative, renvoi vers la page du domaine** : la page d'accueil serait inutilisable au clavier pour la fonction principale.
- **Trois boutons toujours visibles** : encombre chaque carte et brouille la hiérarchie titre/contexte.

### 7. Le tableau est remplacé en entier après un changement

Le fragment `#home-board` contient les trois colonnes, les compteurs et les états vides. Après un dépôt ou un choix de menu, htmx remplace ce fragment. Cela garantit que les compteurs, l'ordre et les états vides viennent toujours du serveur, sans duplication de la logique de regroupement côté client.

Le remplacement perd le focus : `app.js` mémorise l'id de la carte déplacée avant la requête, puis, sur `htmx:afterSwap`, remet le focus sur le lien de cette carte dans sa nouvelle colonne. Une région `aria-live` hors du fragment annonce « « Titre » déplacée vers <rubrique>. ». En cas d'erreur de réponse, le tableau est rechargé et un message d'échec est annoncé.

*Alternatives écartées :*

- **Déplacer la carte dans le DOM côté client** : il faudrait recalculer les compteurs, l'ordre et les états vides ; deux sources de vérité.
- **Remplacer seulement la colonne source et la colonne cible** : le serveur devrait rendre deux fragments et le client les cibler ; plus fragile qu'un seul conteneur.

### 8. Ordre déterministe dans chaque rubrique

Pour chaque rubrique, on parcourt `space.domainList` (déjà ordonné) puis `ensureDisplayOrder` et `indexOutline` du domaine, et on pousse les feuilles correspondantes. L'ordre est donc identique à celui du panneau puis de l'outline, stable entre deux chargements, et un déplacement ne crée aucun ordre manuel implicite.

*Alternatives écartées :*

- **Trier par date de déplacement** : aucune date de statut n'est stockée ; il faudrait un nouveau champ et une migration.
- **Un ordre par rubrique persisté** : hors périmètre de la demande et prématuré pour trois listes.

### 9. Parité Node/Rust et assets partagés

La fonctionnalité est implémentée deux fois : `server.js` (référence, tests Playwright) et `rust/src/{model,html,app}.rs` (production). Les noms de fonctions et le balisage restent alignés (`renderHomeBoard`/`render_home_board`, `homeBoard`/`home_buckets`) pour que `public/app.js` et `public/style.css` fonctionnent sans adaptation. Les tests Rust couvrent le modèle, le rendu et la route ; les tests Playwright couvrent le comportement navigateur sur le serveur Node.

*Alternatives écartées :*

- **N'implémenter que Rust** : la référence de développement et les tests Playwright divergeraient, et le prochain correctif devrait rattraper l'écart.
- **N'implémenter que Node** : la production ne recevrait pas la fonctionnalité.

### 10. Les nouveaux statuts sont visibles dans l'outline

`STATUS_ICONS`/`STATUS_LABELS` (Node) et `status_icon`/`status_label` (Rust) gagnent `waiting` (« En attente », `◷`) et `someday` (« Un jour peut-être », `✧`). Le menu de ligne propose les cinq statuts ; la classe du titre devient `status-waiting` ou `status-someday`. Le CSS leur donne une couleur propre et un soulignement non coloré distinct (pointillé pour « En attente », double pour « Un jour peut-être »), sans gras ni italique, afin que le statut reste lisible sans couleur et sans survol. Le menu de ligne peut passer à la ligne si les cinq statuts et les actions le font déborder sur un écran étroit.

*Alternatives écartées :*

- **Ne pas exposer les nouveaux statuts dans le menu de ligne** : une tâche classée « En attente » ne pourrait être déclassée que depuis l'accueil, et le menu n'expliquerait pas son état.
- **Un sous-menu pour deux statuts** : plus de code et de découverte qu'un menu qui se replie.

## Risks / Trade-offs

- **L'accueil devient une liste complète des feuilles non terminées** → un compte très fourni peut avoir une longue colonne « À faire ». Acceptable pour un outil personnel ; un filtre par domaine ou un repli par colonne serait une évolution séparée.
- **Le sens de « À faire » inclut « En cours »** → une tâche commencée est actionnable, mais l'utilisateur peut s'attendre à une colonne unique par statut. Le badge « En cours » et le titre en gras lèvent l'ambiguïté ; déposer une carte déjà dans la colonne ne la rétrograde pas.
- **Les lignes mères ne sont pas classables depuis l'accueil** → leur statut se règle dans l'outline et la cascade s'applique. C'est cohérent avec la règle « une carte = une action feuille », mais une mère `waiting` avec des feuilles `todo` n'apparaît pas en attente. Les feuilles concernées restent visibles dans « À faire ».
- **Le glisser-déposer n'est pas accessible seul** → le menu de rubrique et l'annonce `aria-live` fournissent le chemin clavier/lecteur d'écran ; le glisser reste une accélération, pas le seul moyen.
- **La poignée tactile peut être manquée** → elle est visible en permanence, avec une cible d'au moins 24 px, et le menu reste disponible.
- **Le remplacement du tableau perd le focus** → restauration explicite sur le lien de la carte déplacée et annonce vocale ; à défaut, le focus revient au début du tableau.
- **Deux implémentations à maintenir** → mêmes noms, mêmes classes, mêmes tests de comportement ; la revue doit vérifier la parité du balisage.
- **Un ancien client ou un retour arrière ne connaît pas `waiting`/`someday`** → les statuts sont stockés tels quels et l'outline les affiche sans style ; aucune donnée n'est perdue, l'ancienne page d'accueil ignore simplement ces tâches. Le retour arrière est donc sûr.
- **Le menu de ligne à cinq statuts peut déborder** → `flex-wrap` et largeur maximale bornée à la fenêtre ; à vérifier en 390 px.

## Migration Plan

Aucune migration de données : `waiting` et `someday` sont des valeurs additives d'un champ déjà présent. Le déploiement publie les deux serveurs et les assets (`app.js`, `style.css`) avec un incrément de `CACHE_VERSION` dans `public/sw.js` ; les service workers installés prennent le nouveau cache à la prochaine visite.

Ordre de mise en œuvre : modèle et rendu serveur (Node puis Rust), route de statut, assets, tests. La fonctionnalité est visible dès que la page d'accueil est rechargée ; aucun script de bascule n'est nécessaire.

Retour arrière : retirer les deux statuts du menu et du rendu, restaurer `renderHomePage`/`render_home_page` et la route de statut sans `vue`, restaurer les styles et la version de cache. Les tâches classées `waiting`/`someday` restent dans les outlines avec un statut inconnu de l'ancien rendu, sans perte de données ; elles réapparaîtront correctement après un nouveau déploiement.

## Open Questions

Aucune question bloquante. Le réordonnancement manuel dans une rubrique, le filtrage par domaine et une colonne « Terminé » sont volontairement hors périmètre de cette première version.
