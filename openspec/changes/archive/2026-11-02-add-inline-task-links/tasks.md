## 1. Serveur : rendu des liens dans les titres

- [x] 1.1 Dans `server.js`, ajouter le parseur strict des liens de tâche (`/domaine/<slug>?reveal=<id>#node-<id>`, `reveal` et fragment concordants, slug et id limités à `[a-z0-9-]` / `[A-Za-z0-9-]`) et `renderTitleHtml(title)` : échapper chaque segment de texte, produire un `<a class="title-link" href="…">libellé</a>` par lien valide, laisser tout le reste littéral.
- [x] 1.2 Dans `renderLine`, remplacer `escapeHtml(node.title)` par `renderTitleHtml(node.title)` et ajouter `data-title="<titre source échappé>"` sur le `<span class="title">`.
- [x] 1.3 Vérifier qu'un titre sans syntaxe est rendu à l'identique (aucune ancre, aucun caractère modifié) et qu'un titre contenant `<`, `>`, guillemets, crochets ou une URL externe reste du texte échappé.
- [x] 1.4 Vérifier que les classes de statut (`status-in-progress`, `status-done`) restent sur le conteneur et s'appliquent au lien.

## 2. Serveur : résolution d'une tâche

- [x] 2.1 Ajouter `GET /domaine/:slug/api/nodes/:id` avec `findDomainBySlug(req.space, …)` et `findNode`, renvoyant `200 { id, title }` ou `404` si le domaine ou le nœud n'existe pas ; la déclarer avec les autres routes `/domaine/:slug/api/*`, derrière `auth.guard` et `withSpace`.
- [x] 2.2 Vérifier en HTTP : 200 avec l'id et le titre d'un nœud existant, 404 pour un id inconnu, 404 pour un domaine inconnu, et aucune donnée d'un autre compte accessible.

## 3. Client : édition d'un titre lié

- [x] 3.1 Dans `public/app.js`, ajouter les helpers de titre : `titleSegments(source)` (segments texte / lien), `displayTitle(source)` (libellés + texte), `sourceOffset(source, displayOffset)` (projection du curseur affiché vers la source) et `paintTitle(span, source)` (reconstruction par `createTextNode` / `createElement`, mise à jour de `data-title`).
- [x] 3.2 Dans `startRename`, lire `span.dataset.title || span.textContent`, convertir l'offset du clic avec `sourceOffset`, dimensionner le champ avec la longueur affichée, et peindre la source (et non `textContent`) dans le `<span>` de remplacement à la validation, y compris lorsqu'aucune modification n'a été faite.
- [x] 3.3 Dans le gestionnaire de clic du document, ignorer `e.target.closest('.title a')` avant d'ouvrir le renommage, sans casser le clic sur l'espace libre ni le clic sur le texte hors lien.
- [x] 3.4 Ajouter au menu de `renderLine` un bouton `.menu-item.rename` (icône `✎`, `title="Renommer"`, sans htmx) et un gestionnaire délégué qui ouvre `startRename` sur la ligne, afin de renommer un titre entièrement occupé par un lien.

## 4. Client : collage d'un lien de tâche

- [x] 4.1 Ajouter `parseTaskLink(text)` : normaliser l'URL relative ou absolue, exiger la même origine, le chemin `/domaine/<slug>`, `reveal=<id>` et `#node-<id>` concordants, et renvoyer `{ slug, id, href }` ou `null`.
- [x] 4.2 Ajouter un gestionnaire `paste` délégué sur `.title-input` : ne l'intercepter que pour un lien de tâche valide, appeler `preventDefault()` immédiatement, résoudre le libellé depuis le DOM si le domaine est actif (`.line[data-id] .title`), sinon via `GET /domaine/<slug>/api/nodes/<id>`.
- [x] 4.3 Insérer `[libellé](href)` avec `input.setRangeText(…, 'end')`, déclencher un événement `input`, conserver le focus, et vérifier `input.isConnected` après l'await.
- [x] 4.4 En repli (lien non reconnu, cible introuvable, erreur réseau, libellé vide ou contenant `[`, `]` ou un saut de ligne), insérer le texte brut du presse-papiers à la place du curseur ou de la sélection, sans perte de contenu.
- [x] 4.5 Vérifier que le collage ne modifie jamais la ligne cible, que la sélection est remplacée, et que le titre est enregistré par la validation normale (`Entrée`, `Tab`, blur).

## 5. Style, documentation et cache

- [x] 5.1 Ajouter `.title-link` dans `public/style.css` : couleur d'accent, soulignement discret, `:hover`, `:focus-visible`, et compatibilité avec `.title.status-done` (la rayure et la couleur du statut ne sont pas écrasées par l'ancre) ; `draggable="false"` sur les ancres.
- [x] 5.2 Mettre à jour le paragraphe du pied de page dans `server.js` : collage d'un lien de tâche copié dans un titre, ouverture de la ligne cible par clic, renommage depuis le menu pour un titre entièrement lié.
- [x] 5.3 Incrémenter `CACHE_VERSION` dans `public/sw.js` (les actifs `app.js` et `style.css` sont précachés).

## 6. Tests et vérification

- [x] 6.1 Créer `test/e2e/task-links.spec.js` en reprenant le harnais de `test/e2e/reindent.spec.js` (serveur en processus, session, fixture) et couvrir : collage d'un lien de tâche, liaison affichée après validation, texte autour conservé, sélection remplacée.
- [x] 6.2 Ajouter les cas : cible dans un autre domaine, cible sous un ancêtre replié (absente du DOM), lien inconnu/malformé collé brut, libellé de la cible contenant un lien.
- [x] 6.3 Couvrir le clic sur le lien (navigation vers la ligne révélée et surlignée, pas de champ de renommage), le renommage depuis le menu contextuel, l'édition du libellé, le retrait de la syntaxe, et l'échappement d'un libellé contenant du HTML.
- [x] 6.4 Vérifier la route API (200/404) via le contexte de session Playwright, puis lancer `node --check server.js`, `node --check public/app.js` et `npm run test:e2e`.
- [x] 6.5 Vérification manuelle dans un navigateur : coller le lien copié d'une tâche dans une autre ligne, ouvrir le lien, revenir, renommer la cible et constater que le libellé existant reste figé ; contrôler le rendu sur un écran étroit.
