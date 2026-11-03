## Why

Le menu contextuel d'une ligne sait déjà copier un lien profond vers cette ligne, mais ce lien reste une URL brute une fois collé : pour référencer « Tache 3 » depuis une autre ligne, l'utilisateur doit coller une longue adresse illisible, et le nom de la tâche n'apparaît nulle part. L'utilisateur veut qu'un lien de tâche copié, une fois collé, devienne directement un lien hypertexte nommé d'après la tâche cible. C'est la brique manquante pour relier les tâches entre elles sans bruit visuel et sans sortir de l'outline.

## What Changes

- **Liens de tâche inline dans les titres.** Un titre de ligne peut contenir un ou plusieurs liens internes sous la forme `[libellé](/domaine/<slug>?reveal=<id>#node-<id>)` ; ils sont rendus comme des ancres cliquables et le reste du titre reste du texte. Le titre demeure une simple chaîne : aucun champ, aucune migration, aucune nouvelle clé de stockage.
- **Collage d'un lien copié.** Coller dans le champ de titre d'une ligne un lien de tâche copié (même origine, domaine + `reveal` + `#node-<id>`) insère `[<titre de la tâche cible>](<lien>)` à la place du curseur ou de la sélection, au lieu de coller l'URL brute. Le titre de la cible est résolu depuis le DOM quand la ligne est visible dans le domaine courant, sinon par une nouvelle route légère.
- **Nouvelle route de résolution.** `GET /domaine/:slug/api/nodes/:id` renvoie `{ id, title }` pour un nœud du compte, et 404 sinon. Elle permet de nommer un lien vers une tâche d'un autre domaine, ou vers une ligne repliée donc absente du DOM.
- **Replis sûrs.** Si le texte collé n'est pas un lien de tâche de la même origine, si la cible n'existe plus, ou si la résolution échoue, le collage brut habituel est conservé ; aucun lien n'est inventé et aucun contenu n'est perdu.
- **Navigation au clic.** Un clic sur le lien suit le lien profond et réutilise le comportement existant de révélation des ancêtres, de défilement et de surlignage. Le renommage reste disponible en cliquant sur le titre hors du lien, sur l'espace libre de la ligne, ou depuis une nouvelle action « renommer » du menu contextuel — nécessaire quand le titre est entièrement occupé par un lien.
- **Édition et retrait.** Le champ de renommage expose le titre source : le libellé et l'URL peuvent être modifiés ou supprimés comme du texte. Le libellé est figé au moment du collage ; renommer la tâche cible plus tard ne réécrit pas les liens existants.
- **Documentation et style.** Le pied de page de l'outline documente le collage d'un lien de tâche et son ouverture au clic ; un style `.title-link` distingue le lien du texte et du surlignage de sélection.

## Capabilities

### New Capabilities

- `task-links` : liens inline entre lignes de l'outline — format persistant, collage d'un lien copié, résolution du libellé de la cible, rendu et navigation, édition et retrait du lien.

### Modified Capabilities

- `node-management` : le clic sur un lien de tâche intégré au titre suit le lien au lieu d'ouvrir le champ de renommage ; le renommage reste possible hors du lien, sur l'espace libre de la ligne ou depuis le menu contextuel.
- `project-outliner` : la documentation des interactions du pied de page mentionne le collage d'un lien de tâche et son ouverture au clic.

## Impact

- **`server.js`** : `renderLine` rend le titre via un helper qui échappe le texte et transforme les liens internes validés en `<a class="title-link">` ; le titre source est exposé dans un attribut `data-title` pour l'édition ; ajout de la route `GET /domaine/:slug/api/nodes/:id` et d'une action « Renommer » au menu contextuel des lignes, sans requête serveur, pour garder l'édition accessible quand le titre est entièrement un lien.
- **`public/app.js`** : interception du collage dans `.title-input` (résolution du libellé puis insertion au curseur, repli sur le collage natif) ; le gestionnaire de clic ignore les ancres pour ne pas ouvrir le renommage ; `startRename` lit le titre source et mappe la position du clic du texte affiché vers la source, et dimensionne le champ sur la longueur affichée.
- **`public/style.css`** : style `.title-link` (couleur d'accent, soulignement, focus visible), compatible avec les styles de statut `done` / `in_progress`.
- **API** : une route GET en lecture seule, scopée au compte par la session ; aucune route existante ne change.
- **Données** : aucun changement de modèle ni de migration ; les titres existants restent du texte et s'affichent à l'identique.
- **Dépendances** : aucune.
- **Tests** : nouveau `test/e2e/task-links.spec.js` (collage d'un lien dans une ligne, rendu du lien, navigation vers la cible révélée, repli sur une URL inconnue, édition/retrait du lien) et vérification de la route API (200/404).
- **Retour arrière** : retirer l'interception du collage, le rendu des liens et la route suffit ; les titres contenant la syntaxe de lien redeviennent du texte brut, sans perte de données.
