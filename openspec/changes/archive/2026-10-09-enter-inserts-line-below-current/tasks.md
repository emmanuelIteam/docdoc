# Tasks

## 1. Ordre d'affichage du domaine (serveur, données)

- [x] 1.1 Ajouter `displayOrder` (liste d'ids) au modèle de domaine : le lire/valider dans `normalizeDomain` et le persister dans `domainPayload` (`server.js`). Nommé `displayOrder` et non `order`, déjà utilisé pour la position du domaine dans le panneau latéral.
- [x] 1.2 Ajouter un index de l'outline (`indexOutline(projects)`) : table `id -> { node, parent, depth }` construite par un parcours de l'arbre, utilisée par le rendu et par la gestion de l'ordre.
- [x] 1.3 Implémenter `ensureDisplayOrder(projects, displayOrder)` : canonisation en parcours pré-ordre quand l'ordre est absent/vide, suppression des ids inconnus, dédoublonnage, et insertion des nœuds manquants après le bloc de leur parent (fin d'outline pour un projet racine).
- [x] 1.4 Implémenter les helpers d'ordre plat : `blockEnd`, `insertBlock`/`extractBlock`, `displayInsertAfter`, `displayAppendToBlock`, `displayRemoveBlock`, `displayMoveAfter`/`displayMoveBefore`/`displayMoveToBlockEnd`/`displayMoveToEnd`.
- [x] 1.5 Normaliser l'ordre au chargement (`normalizeDomain`) et avant chaque écriture (`persistDomain`), et à chaque rendu (`renderOutline`).

## 2. Rendu plat de l'outline (serveur)

- [x] 2.1 Réécrire `renderOutline` en rendu plat : parcourir `displayOrder`, résoudre chaque id via l'index (profondeur, parent, nœud), et émettre une ligne par nœud sous la forme `<li class="line" id="node-<id>" data-id data-parent data-depth style="--depth:n">`.
- [x] 2.2 Sauter au rendu les nœuds masqués par un ancêtre replié (`hiddenNodeIds`, résolution **par ascendance** et non par position), en conservant l'exception de révélation (`expandIds`) et le fait qu'une ligne sœur insérée juste sous une ligne repliée reste affichée.
- [x] 2.3 Conserver le contenu de ligne existant (bouton `.bullet` draggable, `.title` avec statut, `.menu` complet) et l'ancre `id="node-<id>"` ; supprimer l'enveloppe `<li class="node">` et le conteneur `<ul class="children">`.
- [x] 2.4 Remplacer l'expression `scopeExpr` des boutons de statut par un appel au helper client : `js:{status:"…", scope:window.outlineSubtreeHasSelected && window.outlineSubtreeHasSelected(this) ? "subtree" : "head"}`.
- [x] 2.5 Garantir qu'aucune ligne ne disparaisse : l'ordre est réparé avant le rendu (`ensureDisplayOrder`), donc tout nœud de l'arbre est émis.

## 3. Mutations alignées sur la règle d'insertion

- [x] 3.1 `createNodeAfter` (Entrée) : insérer le nœud comme frère suivant dans l'arbre **et** son id immédiatement après la ligne de l'ancre dans `displayOrder`.
- [x] 3.2 `createNode` (« Ajouter une tâche » +) : dernier enfant dans l'arbre **et** id inséré en fin de bloc du parent dans `displayOrder`.
- [x] 3.3 `deleteNode` : retirer de `displayOrder` le nœud et **ses seules lignes descendantes** (repérées par ascendance), en laissant en place les lignes sœurs intercalées.
- [x] 3.4 `reindentNode` : indenter → id déplacé en fin de bloc du frère précédent ; désindenter → id déplacé juste après la ligne de l'ancien parent (avant ses sous-lignes restantes).
- [x] 3.5 `moveNode` : `before` → juste avant la ligne cible ; `after` → juste après la ligne cible (avant ses sous-lignes) ; `inside` → fin de bloc de la cible ; dépôt sur la racine → fin de l'outline ; le bloc déplacé emporte ses descendants dans le bon ordre relatif.
- [x] 3.6 Vérifié : `toggleCollapse`, `setStatus` et le renommage n'appellent aucun helper d'ordre (le repli et le statut ne déplacent aucune ligne).

## 4. Client (`public/app.js`)

- [x] 4.1 Ajouter les helpers de lecture plate : `depthOf(line)`, `outlineRows()` et `subtreeRows(line)` (lignes suivantes de la région, identifiées par leur chaîne de `data-parent`).
- [x] 4.2 Remplacer les calculs de sous-arbre de la sélection (`.node`, `querySelectorAll('.line')`, `hadSubtreeSelected`) par `subtreeRows(line)`.
- [x] 4.3 Exposer `window.outlineSubtreeHasSelected(el)` (vrai si une ligne de `subtreeRows(ligne du bouton)` porte `.selected`) pour les `hx-vals` des boutons de statut, avec repli sur `head` si l'élément n'est pas résolu.
- [x] 4.4 Adapter le glisser-déposer : fantôme construit en clonant la ligne et son bloc (`subtreeRows`) dans `.drag-ghost` hors écran, ajouté au document puis retiré au `dragend` ; détection de cible invalide via `subtreeRows`.
- [x] 4.5 Vérifié : le chemin Entrée (`startRename` → `POST /api/nodes/:id/next` → focus via `X-New-Node-Id`) et le double-clic sur `.bullet` (repli/dépli) fonctionnent sans `.node`.

## 5. Styles (`public/style.css`)

- [x] 5.1 Supprimer la règle `.outline .children` et indenter par profondeur avec `.line { margin-left: calc(var(--depth, 0) * 1.6rem); }` — une **marge** (et non un padding) pour que le menu contextuel en `position:absolute; left:0` reste aligné sur la ligne indentée.
- [x] 5.2 Vérifier que `.line` posé sur un `<li>` conserve la mise en page (flex, `position: relative` pour le menu ancré, pont de survol, `.line:target`, compactage vertical) et que `.outline` reste sans puce ni marge ; ajouter le style du conteneur `.drag-ghost`.

## 6. Validation

- [x] 6.1 Entrée en fin de ligne sur une ligne à sous-lignes dépliées : la nouvelle ligne apparaît juste sous la ligne éditée, au-dessus de ses sous-lignes, au même niveau (vérifié sur l'instance locale).
- [x] 6.2 Entrée sur une ligne à sous-lignes repliées, Entrée sur une feuille, et saisie enchaînée (chaque nouvel Entrée crée la ligne suivante juste en dessous de la précédente).
- [x] 6.3 Repli/dépli après insertion : la ligne insérée reste affichée juste sous la ligne mère et ne bouge pas ; seules les sous-lignes apparaissent/disparaissent.
- [x] 6.4 Sélection d'une ligne avec ses sous-lignes et portée des statuts (`head` vs `subtree`) : logique client testée hors navigateur (sous-arbre identifié par `data-parent`, y compris quand une ligne sœur s'intercale avant les sous-lignes) et expression `hx-vals` vérifiée dans le HTML rendu.
- [x] 6.5 Glisser-déposer : sémantique serveur vérifiée de bout en bout (au-dessus / en dessous / dans / sur la racine, bloc complet emporté, refus d'un dépôt sur un descendant) ; fantôme de glisser et rejet visuel implémentés côté client.
- [x] 6.6 Ancres profondes : `?reveal=<id>#node-<id>` déplie les ancêtres (page et fragment htmx), l'état replié reste inchangé sans `reveal`.
- [x] 6.7 Rétro-compatibilité : un domaine persisté sans `displayOrder` s'affiche dans l'ordre canonique, le champ `order` du panneau latéral est préservé, `displayOrder` est bien persisté et un id supprimé dans l'ordre est réparé (vérifié par tests unitaires sur le code réel).
- [x] 6.8 Nettoyage : plus aucune référence à `.node` ou `.children` dans `server.js`, `public/app.js` et `public/style.css` ; `openspec validate --changes "enter-inserts-line-below-current" --strict` passe.
- [ ] 6.9 Passe manuelle en navigateur (non réalisable ici) : clics de sélection et cycle tête/groupe, menu contextuel (ouverture/fermeture au départ du pointeur), glisser-déposer visuel (fantôme du sous-arbre, indicateurs avant/après/dans, cible invalide), copie du lien profond, rendu de l'indentation et du menu ancré sur les lignes profondes.
