## Context

Le domaine est un **arbre** (`projects[]`, `{id, title, status, collapsed, children[]}`) persisté, rendu comme une **suite plate de lignes** : chaque `<li class="line">` porte `data-id`, `data-parent` et `data-depth`, et l'ordre vertical vient de `domain.displayOrder` (liste d'ids). La profondeur, elle, est **dérivée de l'arbre** (`indexOutline`), jamais de l'ordre : une position affichée et une profondeur sont donc deux informations indépendantes, et l'application exploite déjà cette liberté (`displayInsertAfter` affiche une ligne insérée sous X **avant** les sous-lignes de X ; la spec `outline-display-order` dit explicitement qu'un sous-arbre n'est pas une plage contiguë).

Le réindent existe des deux côtés : `reindentNode(domain, id, direction)` (`server.js`), exposé par `POST /domaine/:slug/api/nodes/:id/indent` et `.../outdent`, déclenché par le menu contextuel (`→` / `←`) et, depuis le change `tab-indents-line`, par `Tab` / `MAJ+Tab` (client `public/app.js`). Ses deux branches font deux choses à la fois — muter l'arbre **et** replacer le bloc dans `displayOrder` :

- `indent` : la ligne devient la dernière enfant de son frère précédent et son bloc est déplacé en fin de bloc de ce frère (`displayMoveToBlockEnd`) ;
- `outdent` : la ligne devient le frère suivant de son ancien parent et son bloc est déplacé **juste sous la ligne de cet ancien parent, avant ses sous-lignes restantes** (`displayMoveAfter`).

C'est ce second déplacement qui est en cause : avec `A` (ligne 1) / `B1` (ligne 2) / `B2` (ligne 3, toutes deux enfants de `A`), `MAJ+Tab` sur `B2` produit l'ordre `A, B2, B1` — la tâche remonte au-dessus de `B1`, alors qu'elle n'a perdu qu'un cran d'indentation.

Le client, lui, retrouve la ligne par `data-id` après le re-rendu pour restaurer le curseur ou la sélection, et teste la faisabilité du déplacement **avant** d'appeler le serveur (`canReindent`, basé sur l'ordre affiché) : ces deux mécanismes supposent que l'ordre affiché et l'ordre des frères dans l'arbre restent cohérents.

## Goals / Non-Goals

**Goals:**

- `MAJ+Tab` (et le bouton `←`, même route) **ne réordonne plus l'outline** : la ligne désindentée reste à la ligne où elle était, seule sa profondeur diminue d'un cran.
- Garantir la lecture du scénario dans les deux sens : sur `A` / `B1` / `B2` avec le curseur sur `B2`, `MAJ+Tab` puis `Tab` laissent `B2` sur sa ligne.
- Vérifier l'**ordre affiché**, et non seulement la profondeur et le parent : c'est l'ordre qui était faux, et les tests actuels ne l'assertent pas.
- Ne rien changer d'autre : ni le client, ni les routes, ni le format persisté, ni les placements explicites (glisser-déposer, « Ajouter une tâche »), ni le sens `Tab`.

**Non-Goals:**

- Pas de changement de la sémantique d'`indent` : la ligne indentée devient la dernière sous-ligne de son frère précédent, affichée en fin de bloc de celui-ci.
- Pas de re-tri de l'ordre d'affichage persisté des domaines existants, ni de migration de données.
- Pas de refonte du glisser-déposer ni de `moveNode` (les dépôts « sous Y », « au-dessus de Y », « dans Y » restent des placements explicites).
- Pas de nouvelle route, pas de nouveau raccourci, pas de changement de style ou de libellé du pied de page.

## Decisions

### 1. Désindenter ne change que la hiérarchie

La branche `outdent` de `reindentNode` conserve sa mutation d'arbre (la ligne sort des enfants de son parent et s'insère comme frère suivant de celui-ci) et **cesse de toucher à `displayOrder`** : ni `displayMoveAfter`, ni `extractBlock`, ni réinsertion. La ligne garde donc sa position affichée, et sa profondeur — dérivée de l'arbre — diminue d'un cran. C'est exactement le comportement attendu d'un outliner plat (Workflowy, Dynalist, OmniOutliner, Notion) : `MAJ+Tab` décale l'élément vers la gauche *sur place*, sans le déplacer.

*Alternatives écartées :*
- **Conserver `displayMoveAfter`** (statu quo) : c'est le défaut rapporté — la tâche saute au-dessus des lignes qu'elle suivait.
- **Déplacer le bloc en fin de bloc de l'ancien parent** (`displayMoveToBlockEnd`) : corrige le cas rapporté (dernier enfant), mais reste un replacement — désindenter le **premier** enfant le ferait descendre sous ses anciens frères, soit la même surprise « la tâche change de ligne », dans l'autre sens.
- **Recalculer l'ordre canonique** : effacerait les positions choisies par l'utilisateur (lignes insérées sous une ligne, déplacements) à chaque désindentation.
- **Faire aussi de `Tab` un simple changement de profondeur** : hors périmètre. La destination d'une indentation est *définie* par le bloc du frère précédent (la ligne devient sa dernière sous-ligne, donc à l'intérieur de ce bloc) et le scénario rapporté est déjà satisfait dans ce sens ; y toucher modifierait une sémantique documentée et testée par le change précédent sans demande. Voir la question ouverte.

### 2. Le client reste inchangé, et l'équivalence des tests de faisabilité est préservée

`canReindent(line, 'outdent')` (« a un parent ») est toujours exact. Pour `indent`, le client cherche le **frère précédent affiché** (`previousSiblingRow`, marche arrière sur `data-parent`) là où le serveur lit le **frère précédent dans l'arbre** (`found.index === 0`). Ces deux tests restent équivalents parce que la nouvelle règle préserve l'ordre relatif des frères dans l'affichage :

- la ligne désindentée `N` était affichée **après la ligne de son parent `Y`** (invariant du modèle : une ligne est toujours affichée après sa ligne parente) ; elle est donc après tous les frères **précédents** de `Y`, dont `Y` lui-même ;
- les frères **suivants** de `Y` sont affichés après la fin du bloc de `Y` **dans l'état d'avant** — bloc qui contenait `N` (alors descendante de `Y`) — donc après `N` ; l'ordre affiché n'étant pas modifié, ils restent après `N`.

Aucune modification de `public/app.js` n'est donc nécessaire. Le repli `if (titleEl)` / `if (moved)` du client (ligne introuvable après re-rendu) reste en place : il n'est plus atteignable par une désindentation, mais il l'est toujours par une **indentation** sous un frère précédent replié.

*Alternative écartée :* faire tester au client la seule `data-depth` — insuffisant, la suite plate entrelace sous-lignes et frères ; c'est `data-parent` qui identifie les frères.

### 3. Une désindentation ne peut plus masquer la ligne

L'ordre affiché n'étant pas touché et les ancêtres de `N` devenant un sous-ensemble de ses ancêtres précédents (son ancien parent devient son frère), `N` et son sous-arbre restent visibles : plus de cas « la ligne a disparu sous un parent replié » dans ce sens. La branche défensive correspondante du client est conservée telle quelle (coût nul, et elle sert encore à l'indentation).

### 4. Les placements explicites gardent leurs règles

`moveNode` (glisser-déposer : « sous Y » → `displayMoveAfter`, « au-dessus de Y » → `displayMoveBefore`, « dans Y » → `displayMoveToBlockEnd`) et `createNode` / `createNodeAfter` (« Ajouter une tâche », `Entrée`) sont inchangés : ce sont des **placements demandés**, où l'utilisateur désigne lui-même la position, au contraire d'un réindent où seul le niveau change. `displayMoveAfter` reste donc utilisé par le serveur.

### 5. Vérification par l'ordre affiché

Le défaut est un défaut d'**ordre** : les tests existants assertent `data-depth` et `data-parent`, jamais la position. La recette assert donc la séquence des lignes :

- `test/passkey-flow.js` : après `POST .../outdent` sur le dernier enfant d'un parent qui a d'autres sous-lignes, le fragment renvoyé présente l'ordre `parent, …, ligne désindentée` (la ligne ne remonte pas), et après `POST .../indent` elle revient sous sa nouvelle place sans changer de rang.
- `test/e2e/reindent.spec.js` : topologie exacte du scénario (`A`, `B1`, `B2` enfants de `A`, curseur sur la 3ᵉ ligne), ordre des lignes relevé avant / après `MAJ+Tab`, puis après `Tab`, plus la conservation du curseur et de la sélection.
- Ces assertions **échouent avant le correctif** (c'est ce qui leur donne des dents) : `MAJ+Tab` plaçait `B2` en deuxième position.

## Risks / Trade-offs

- **[Une ligne désindentée peut s'afficher au-dessus des sous-lignes restantes de son ancien parent]** (`A`, `B1` désindentée, `C1` encore enfant de `A` → `A, B1, C1`) — l'entrelacement existe déjà par construction (une ligne insérée sous X s'affiche avant les sous-lignes de X) et la spec `outline-display-order` l'assume. *Mitigation* : les helpers du client sont fondés sur la **chaîne des parents** (`subtreeRows`, `previousSiblingRow`), pas sur la contiguïté ; la profondeur affichée reste exacte, et la ligne ne peut pas être prise pour une sous-ligne.
- **[Le bouton `←` du menu change aussi de comportement]** — c'est la même opération et la même route : la cohérence est voulue (le clavier et le menu ne peuvent pas diverger). *Mitigation* : le change le documente et la recette couvre le bouton `←` en plus du raccourci.
- **[Les domaines déjà désindentés gardent l'ordre existant]** — aucune migration : l'ordre persisté fait foi et n'est pas réécrit ; seules les prochaines désindentations suivent la nouvelle règle. *Alternative écartée* : re-normaliser les ordres persistés, migration sans bénéfice et à risque pour les positions choisies.
- **[Divergence possible entre le test client et le serveur]** (le client refuserait un réindent que le serveur appliquerait) → l'invariant de l'ordre des frères démontré en décision 2 ; le serveur reste de toute façon l'autorité, et un cas impossible qui passerait le test client reste un no-op silencieux (comportement actuel).
- **[Indentation sous un frère précédent replié : la ligne disparaît]** — défaut pré-existant, hors périmètre (voir la question ouverte du change `tab-indents-line`) ; il ne concerne pas la désindentation, qui ne peut plus masquer de ligne.

## Migration Plan

1. Déployer `server.js` (application mono-service : un redémarrage suffit). `public/app.js` est inchangé.
2. Aucune migration de données : l'ordre d'affichage persisté reste tel quel, aucune route ni aucun format ne change.
3. Recette sur un domaine de démonstration : reproduire `A` / `B1` / `B2`, curseur sur la 3ᵉ ligne, vérifier `MAJ+Tab` (la tâche reste sur sa ligne, un cran en moins) puis `Tab` (elle reste encore sur sa ligne), avec le bouton `←` et à la souris via le menu.
4. Rollback : redéployer la version précédente. Aucune donnée n'ayant été transformée, le retour arrière est sans effet de bord (les ordres déjà écrits restent valides, ils sont simplement moins « rangés »).

## Open Questions

- **`Tab` doit-il, à terme, devenir lui aussi un pur changement de profondeur ?** Aujourd'hui, indenter une ligne affichée avant les sous-lignes de son frère précédent (cas d'une ligne créée par `Entrée`) la fait descendre en fin de bloc de ce frère. Le scénario rapporté n'est pas concerné (le frère précédent n'a pas de sous-ligne), et la destination d'une indentation est définie par le bloc du frère précédent. À confirmer après recette : si l'utilisateur veut la même stabilité de ligne dans ce cas, ce sera un change dédié.
- **Faut-il déplier le nouveau parent lors d'une indentation** pour qu'une ligne indentée sous un frère précédent replié reste visible ? (Défaut pré-existant, non traité ici.)
