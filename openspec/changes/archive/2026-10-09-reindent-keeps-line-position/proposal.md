## Why

`MAJ+Tab` — comme le bouton `←` du menu, qui partage la même route — ne fait pas que désindenter : il **réordonne l'outline**. La ligne désindentée est réaffichée juste sous la ligne de son ancien parent, donc **au-dessus** des frères qu'elle suivait. Sur `A` / `B1` / `B2` (curseur sur `B2`, ligne 3), `MAJ+Tab` fait remonter `B2` au-dessus de `B1` : la tâche change de ligne alors que l'utilisateur n'attend qu'un cran d'indentation en moins. Un réindent doit changer l'indentation, pas la place de la ligne dans l'outline.

## What Changes

- **Désindenter ne réordonne plus l'outline** : `MAJ+Tab`, le bouton `←` du menu et la route `POST /domaine/:slug/api/nodes/:id/outdent` changent la hiérarchie (la ligne devient le **frère suivant de son ancien parent**) **sans toucher à l'ordre d'affichage** : la ligne reste exactement là où elle était, seule sa profondeur diminue d'un cran.
- **Conséquences directes** : la ligne désindentée ne peut plus « sauter » au-dessus des lignes qu'elle suivait, et elle ne peut plus disparaître de l'outline (elle ne devient jamais la descendante masquée d'une ligne repliée).
- **Indenter est inchangé** : la ligne devient la dernière sous-ligne de son frère précédent et s'affiche en fin de bloc de celui-ci ; dans le scénario `A` / `B1` / `B2`, elle reste donc sur sa ligne, avant comme après la désindentation.
- **Le glisser-déposer et « Ajouter une tâche » sont inchangés** : ce sont des placements **explicites** (sous Y, au-dessus de Y, en fin de bloc de Y) et ils gardent leurs règles.
- **Vérification** : l'ordre affiché est asserté sur la topologie exacte du scénario, côté serveur (fragment re-rendu) et dans un vrai navigateur (suite Playwright existante).
- **Aucun changement** de route, d'API, de modèle de données, de format persisté, de feuille de style, ni du client (`public/app.js`).

## Capabilities

### New Capabilities

Aucune : le réindent et l'ordre d'affichage sont des capacités existantes ; cette évolution précise où atterrit une ligne désindentée.

### Modified Capabilities

- `node-management` : l'exigence **Reindent a node** précise que le réindent ne réordonne pas l'outline — une désindentation ne change que la profondeur, la ligne reste à sa place — et couvre le scénario `A` / `B1` / `B2` dans les deux sens (`MAJ+Tab`, puis `Tab`).
- `outline-display-order` : l'exigence **Display a re-levelled line just below its new reference line** distingue désormais les **placements explicites** (dépôt sous / au-dessus / dans une ligne, ajout d'une sous-ligne, indentation en fin de bloc du frère précédent) de la **désindentation**, qui n'est plus un replacement : la ligne désindentée conserve sa position affichée.

## Impact

- **`server.js`** : `reindentNode` — la branche `outdent` n'appelle plus `displayMoveAfter` et ne mute que l'arbre (`projects` / `children`). `displayMoveAfter` / `displayMoveBefore` / `displayMoveToBlockEnd` restent utilisés par l'indentation et par le glisser-déposer (`moveNode`).
- **`public/app.js`** : aucun changement. Le client retrouve la ligne par `data-id` après le re-rendu ; comme une désindentation ne peut plus masquer la ligne, la restauration du curseur / de la sélection aboutit toujours dans ce sens. Le test de faisabilité du client (`canReindent`) reste équivalent à celui du serveur.
- **Aucun impact** sur les routes, le stockage S3, les thèmes, l'authentification, `public/style.css`, ni sur les domaines existants : l'ordre d'affichage déjà persisté n'est pas réécrit (seules les prochaines désindentations se comportent autrement).
- **Vérification** : `test/e2e/reindent.spec.js` (topologie `A` / `B1` / `B2`, ordre des lignes avant / après, curseur et sélection conservés) et `test/passkey-flow.js` (ordre du fragment renvoyé par `indent` / `outdent`).
