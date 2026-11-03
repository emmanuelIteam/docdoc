## Context

L'outline est rendu côté serveur : `renderLine` (`server.js`) produit un `<li class="line" id="node-<id>" data-id="<id>" data-depth="…">` dont le titre est un `<span class="title" data-id="<id>">${escapeHtml(node.title)}</span>`. Le titre est une chaîne unique, sans structure : c'est à la fois ce qui est affiché et ce qui est persisté dans le JSON du domaine (bucket S3), et il n'existe aucune migration ni champ libre.

L'édition d'un titre vit dans `public/app.js`, fonction `startRename` : au clic, le `<span>` est remplacé par un `<input class="title-input">` dont la valeur est `span.textContent`, la largeur est calée sur la longueur du texte, le curseur est posé à l'offset calculé par `caretOffsetAtPoint`, et la validation (`Entrée`, `Tab`, perte de focus) envoie `PUT /domaine/:slug/api/nodes/:id` puis re-rend l'outline. Un clic sur l'espace libre de la ligne ouvre le même champ avec le curseur à la fin.

Les liens profonds existent déjà : le menu contextuel copie `origin + pathname + "?reveal=<id>#node-<id>"`, la page ouverte avec `reveal` déplie les ancêtres de la cible, et le fragment `#node-<id>` fait défiler et surligne la ligne (change `add-line-anchors`). Il manque seulement le maillon « coller ce lien dans un titre » : aujourd'hui il insère l'URL brute dans un champ texte, qui ne peut afficher ni libellé ni ancre.

Contraintes : garder le rendu serveur de l'outline, ne pas changer le modèle persisté, ne pas ajouter de dépendance, préserver le renommage, le glisser-déposer, les statuts, la sélection, le comportement mobile, et incrémenter `CACHE_VERSION` dans `public/sw.js` puisque `app.js` et `style.css` sont précachés.

## Goals / Non-Goals

**Goals:**

- Coller dans le titre d'une ligne le lien copié d'une tâche produit un lien inline dont le libellé est le titre de la tâche cible.
- Un titre peut contenir un ou plusieurs liens de tâche mêlés à du texte, rendus comme des ancres cliquables côté serveur.
- Cliquer sur un lien suit le lien profond et réutilise révélation, défilement et surlignage existants.
- La cible peut appartenir à un autre domaine du compte, ou être masquée sous un ancêtre replié.
- Le titre reste éditable (libellé, cible, suppression du lien), avec le curseur au bon endroit, et le renommage reste accessible quand tout le titre est un lien.
- Aucun changement de schéma, de clé S3, de route existante ni de dépendance.

**Non-Goals:**

- Liens externes, auto-linkification d'URL brutes, aperçus de lien ou favicons.
- Éditeur riche / WYSIWYG multi-lignes : le titre reste un `<input>` simple.
- Mise à jour automatique du libellé quand la tâche cible est renommée (libellé figé au collage).
- Presse-papiers HTML enrichi pour Word ou les emails (le copier continue de produire une URL).
- Déplacer un lien entre lignes, le glisser, ou en faire une entité séparée du titre.
- Modification des routes existantes, du modèle `{id, title, status, collapsed, children}` ou de l'ordre d'affichage.

## Decisions

### 1. Liens inline stockés dans la chaîne du titre, en syntaxe Markdown

Le titre accepte la forme `[libellé](/domaine/<slug>?reveal=<id>#node-<id>)`, par exemple :

```
Voir [Tache 3](/domaine/maison?reveal=8f14e45f#node-8f14e45f) avant de commander
```

Le titre persisté reste exactement cette chaîne. Aucun champ `link`, aucun tableau de plages, aucune migration : les données existantes sont déjà des titres valides, et un titre sans syntaxe s'affiche à l'identique.

*Alternatives écartées :*

- **Ancre HTML stockée dans le titre** : impose de parser et d'assainir du HTML à chaque rendu, avec un risque XSS plus large et un attribut `data-title` beaucoup plus lourd.
- **Tableau de liens avec des offsets** : impose un schéma, une migration, et la réécriture des offsets à chaque frappe ; un simple déplacement de texte invalide les plages.
- **Champ `link` sur le nœud (tout le titre cliquable)** : ne permet pas de mêler texte et lien, alors que l'utilisateur a demandé un lien inséré dans le texte.

### 2. Seuls les liens internes sont des liens de tâche

Une séquence n'est reconnue que si elle est de la forme exacte `[libellé](/domaine/<slug>?reveal=<id>#node-<id>)`, avec le même `<id>` dans `reveal` et dans le fragment. Le slug et l'id sont limités à `[a-z0-9-]` et `[A-Za-z0-9-]` ; tout le reste (`https://`, `//`, `javascript:`, ids discordants, crochets imbriqués) reste du texte littéral.

Le serveur ne construit jamais l'URL : il réutilise la sous-chaîne validée, après échappement HTML. Le libellé est échappé, et l'absence de protocole dans le `href` interdit les liens externes et les schémas actifs. C'est plus strict qu'un rendu Markdown générique, volontairement : la fonctionnalité est un lien entre tâches, pas un moteur de rendu.

### 3. Collage : interception synchrone, résolution du libellé, repli brut

Un gestionnaire `paste` délégué sur le document cible `.title-input`. À la réception :

1. lire `text/plain` et le passer à `parseTaskLink` (origine identique, chemin `/domaine/<slug>`, `reveal=<id>`, hash `#node-<id>` concordants) ;
2. si ce n'est pas un lien de tâche valide : ne rien intercepter, laisser le collage natif ;
3. sinon `preventDefault()` immédiatement — la résolution peut être asynchrone, on ne peut pas attendre avant d'annuler le collage par défaut ;
4. résoudre le libellé : d'abord le DOM si le domaine est le domaine actif et que `#node-<id> .title` existe (cas courant, instantané) ; sinon `GET /domaine/<slug>/api/nodes/<id>` ;
5. si la résolution échoue ou renvoie un titre non représentable (crochets ou saut de ligne dans le libellé), insérer le texte brut à la place du curseur ;
6. sinon insérer `[libellé](href)` avec `input.setRangeText(snippet, selectionStart, selectionEnd, 'end')`, déclencher un événement `input` (pour la largeur du champ), conserver le focus et vérifier que le champ est toujours dans le document après l'await.

Le `href` inséré est normalisé en chemin relatif (`/domaine/<slug>?reveal=<id>#node-<id>`) même si le presse-papiers contenait une URL absolue de la même origine. Le libellé est le texte affiché de la cible : si le titre de la cible contient lui-même un lien, on ne récupère que son libellé.

*Alternatives écartées :*

- **Lire le HTML du presse-papiers pour y trouver le libellé** : ne marche que si le copier a écrit du HTML, n'est pas disponible partout, et ne couvre pas un lien copié depuis la barre d'adresse.
- **Résoudre via `GET /api/outline`** : renvoie tout l'outline du domaine pour un seul titre, et couple la résolution à la forme complète des données.
- **Coller le libellé sans cible puis reconstruire le lien** : impossible sans stocker la cible ailleurs.

### 4. Une route de résolution dédiée, en lecture seule

`GET /domaine/:slug/api/nodes/:id` renvoie `{ id, title }` et `404` si le domaine ou le nœud n'existe pas. Elle est déclarée avec les autres routes `/domaine/:slug/api/*`, donc derrière `auth.guard` et `withSpace` : la session résout le compte, et `findDomainBySlug(req.space, slug)` ne peut voir que les domaines de ce compte. Un lien vers le domaine d'un autre compte est donc un 404, jamais une fuite.

Le titre renvoyé est la chaîne source ; le client en dérive le libellé affiché. Cette route sert aussi au cas « cible repliée », absente du DOM.

*Alternatives écartées :*

- **Ajouter le libellé dans l'URL copiée** (`?name=…`) : pollue un lien destiné au partage, se désynchronise du vrai titre, et ne couvre pas un lien copié depuis la barre d'adresse.
- **Résoudre au rendu** : le serveur devrait charger les autres domaines de manière synchrone pour chaque lien, et le libellé changerait avec le titre de la cible — contraire à la sémantique Markdown et au choix de libellé figé.

### 5. Rendu serveur : texte échappé + ancres, titre source exposé

`renderLine` remplace `escapeHtml(node.title)` par `renderTitleHtml(node.title)` et ajoute `data-title="${escapeHtml(node.title)}"` sur le `<span class="title">`. `renderTitleHtml` découpe la chaîne en segments texte / lien, échappe chaque segment texte, et produit pour chaque lien :

```html
<a class="title-link" href="/domaine/maison?reveal=8f14e45f#node-8f14e45f">Tache 3</a>
```

Le `data-title` est indispensable : `startRename` doit éditer la source complète, alors que `span.textContent` ne contient que le libellé affiché. Il est échappé comme le reste.

Après une validation, `finish` remplace l'`<input>` par un `<span>` : il doit peindre le titre source, pas seulement `textContent`, sinon un simple blur sans modification laisserait la syntaxe Markdown visible. Un helper client `paintTitle(span, source)` reconstruit les nœuds texte et les ancres avec `document.createTextNode` / `createElement` (aucune injection HTML), met à jour `data-title`, et laisse le re-rendu serveur suivant confirmer.

*Alternatives écartées :*

- **Rendu uniquement côté client** : l'outline est déjà rendue par le serveur et doit rester lisible sans exécuter de JavaScript pour l'affichage.
- **Garder `data-title` absent et relire le titre par une requête** : coûteux, asynchrone, et ne permet pas d'ouvrir le champ avec le bon contenu hors ligne.

### 6. Renommage : même champ, source complète, curseur mappé, largeur affichée

`startRename` lit `span.dataset.title ?? span.textContent`. Quand le titre contient des liens, l'offset renvoyé par `caretOffsetAtPoint` est un offset dans le texte affiché ; un helper `sourceOffset(title, displayOffset)` le convertit en offset source en parcourant les mêmes segments (les caractères du libellé se projetent dans la partie libellé de `[...](...)`, le texte littéral se décale de la longueur de la syntaxe). La largeur du champ est calculée sur la longueur affichée (`displayTitle(value).length`), pas sur la longueur source, sinon une URL de 60 caractères ferait exploser l'`<input>`.

Le champ affiche la source complète (`Voir [Tache 3](...)`). C'est le compromis assumé de la v1 : le lien est éditable et supprimable comme du texte, sans éditeur riche. La documentation du pied de page le dit.

Le clic sur un lien ne doit pas ouvrir ce champ : le gestionnaire de clic de `document` commence par ignorer `e.target.closest('.title a')`. Le renommage reste accessible par un clic sur le texte hors lien, sur l'espace libre de la ligne, ou par une nouvelle action « Renommer » (✎) du menu contextuel. Cette action est nécessaire pour un titre entièrement occupé par un lien, surtout sur téléphone où il ne reste aucun espace libre ; elle est sans requête serveur, appelle `startRename` sur la ligne et laisse le menu se fermer au re-rendu.

### 7. Libellé figé au collage

Le libellé est résolu une fois, au moment du collage, et vit ensuite dans la chaîne du titre comme n'importe quel texte. Renommer la tâche cible ne réécrit pas les liens existants. C'est la sémantique d'un lien Markdown, c'est prévisible, et cela évite de charger d'autres domaines au rendu. L'URL, elle, reste valide tant que le domaine et la ligne cible existent.

### 8. Style et accessibilité

`.title-link` reprend la couleur d'accent, un soulignement discret et un `:focus-visible` visible. Les styles `.title.status-done` et `.title.status-in-progress` restent appliqués au conteneur : un lien dans une ligne terminée garde la couleur et la rayure du statut (l'ancre ne doit pas réintroduire une couleur de texte qui écrase l'état). L'ancre est un vrai `<a href>` : focusable, activable par `Entrée`, et le navigateur gère naturellement `Ctrl`/`Cmd`-clic et le menu contextuel. Pas de `target="_blank"` : un lien de tâche reste dans l'onglet courant, comme un lien profond ordinaire ; `draggable="false"` évite qu'un glisser de souris démarre le drag natif de l'URL.

## Risks / Trade-offs

- **La syntaxe Markdown est visible pendant l'édition** → assumé pour la v1 ; le curseur et la largeur sont mappés pour que l'édition reste utilisable, et le pied de page l'explique. Un éditeur à puces pourra remplacer le champ plus tard sans changer le stockage.
- **Deux implémentations du parseur (serveur et client)** → elles partagent la même grammaire stricte ; les tests e2e couvrent le rendu serveur, le collage client et le repli, et un commentaire renvoie de l'une à l'autre. La duplication est de quelques lignes, contre l'ajout d'un module partagé, d'un `<script>` et d'une entrée de précache.
- **Un titre entièrement occupé par un lien n'a plus de zone de clic pour renommer** → l'action « Renommer » du menu contextuel couvre ce cas, y compris au doigt.
- **Un libellé contenant `[`, `]` ou un saut de ligne casserait la syntaxe** → la résolution retombe sur le collage brut du lien, jamais sur une insertion tronquée.
- **Le libellé ne suit pas le renommage de la cible** → choix documenté ; l'URL continue de pointer vers la bonne ligne.
- **Lien vers un domaine archivé ou renommé** → la navigation aboutit à un 404, comme tout lien profond existant ; le libellé reste lisible.
- **Collage asynchrone et champ détruit entre-temps** (perte de focus, re-rendu htmx) → vérification `isConnected` après l'await, abandon silencieux ; le collage brut sert de repli.
- **Ancien service worker servant l'ancien `app.js`** → incrément `CACHE_VERSION` dans `public/sw.js`, déjà la règle du dépôt pour tout actif précaché.

## Migration Plan

Aucune migration : le titre reste une chaîne, et les titres existants ne contiennent pas la syntaxe (ou s'affichent littéralement s'ils en contiennent par hasard). Déploiement normal de l'image ; incrémenter `CACHE_VERSION`. Retour arrière : retirer le rendu des liens, l'interception du collage et la route ; les titres contenant la syntaxe redeviennent du texte brut, sans perte de données.

## Open Questions

Aucune question bloquante. Les points laissés à l'implémentation (libellé des liens eux-mêmes, cache de résolution) sont couverts par les replis et ne changent ni les exigences ni le stockage.
