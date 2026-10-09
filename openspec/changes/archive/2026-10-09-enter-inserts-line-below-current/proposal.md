## Why

Appuyer sur Entrée en fin de ligne crée aujourd'hui un vrai frère dans l'arbre (`createNodeAfter` insère le nœud juste après l'ancre dans la liste des frères), mais le rendu est un **arbre imbriqué** (`<li class="node">ligne<ul class="children">…</ul></li>`) : un frère est donc forcément peint **après toute la descendance** de la ligne courante. Vérifié sur l'instance locale : Entrée sur « Choisir les meubles » (qui a la sous-ligne « Comparer 3 devis ») fait apparaître « Nouvelle tâche » **sous** « Comparer 3 devis », très loin du curseur. L'utilisateur perd le fil de sa saisie : la nouvelle ligne doit apparaître juste sous la ligne où il écrit, avant ses sous-lignes, même quand cette ligne en a.

## What Changes

- **Nouvelle règle d'insertion** : la ligne créée par Entrée (curseur en fin de ligne) est affichée **immédiatement sous la ligne courante, avant ses sous-lignes**, tout en restant au **même niveau hiérarchique** (frère/sœur de la ligne courante).
- **BREAKING (interne, pas d'API)** : l'outline n'est plus rendu comme un arbre imbriqué de listes mais comme une **suite plate de lignes**, chaque ligne portant sa profondeur (`data-depth`). L'indentation devient visuelle (marge par niveau, 1,6 rem comme aujourd'hui) au lieu d'être structurelle.
- **Ordre d'affichage explicite** : l'arbre reste la source de vérité de la hiérarchie (parents/enfants, repli, statuts, déplacement), et un **ordre d'affichage** propre au domaine est maintenu à part — nouvelle liste d'ids `order` persistée avec le domaine, réparée au chargement si elle est absente ou incohérente (rétro-compatible : les fichiers existants sont canonisés).
- **Règle d'affichage unifiée** pour toutes les insertions : insertion comme *frère suivant* de X → affichée juste sous la ligne X (avant ses sous-lignes) ; insertion comme *dernier enfant* de X → affichée en fin de bloc de X. S'applique à Entrée, au bouton « Ajouter une tâche » (+), à indenter/désindenter et au glisser-déposer (au-dessus / en dessous / dans).
- **Repli/dépli inchangé** : replier une ligne masque toujours toute sa descendance ; la nouvelle ligne reste visible juste sous la ligne mère, que celle-ci soit repliée ou dépliée.
- **Sélection et glisser-déposer adaptés au rendu plat** : « la ligne et ses sous-lignes », la portée des statuts et l'aperçu de glisser (fantôme, cibles invalides) sont calculés par profondeur (`data-depth`) au lieu de s'appuyer sur l'imbrication DOM.
- **Aucun changement** de routes, d'API HTTP, de modèle de hiérarchie ni de format des autres champs persistés (seul un champ `order` optionnel s'ajoute au document du domaine).

## Capabilities

### New Capabilities
- `outline-display-order`: règle et invariants de l'ordre d'affichage des lignes (suite plate, position d'une ligne fraîchement insérée, persistance et réparation de l'ordre, stabilité à travers les re-rendus et le repli).

### Modified Capabilities
- `project-outliner`: le rendu passe d'un arbre imbriqué à une suite plate de lignes indentées par profondeur (`data-depth`), la position d'affichage d'une nouvelle ligne change (juste sous la ligne courante), et les calculs de sous-arbre (sélection, glisser-déposer) se font par profondeur.
- `node-management`: l'action Entrée en fin de ligne insère un frère affiché juste sous la ligne courante, et les insertions (Entrée, ajout de tâche, indentation/désindentation, déplacement) précisent la position d'affichage résultante.

## Impact

- **Backend (`server.js`)** : `renderNode`/`renderOutline` réécrits en rendu plat avec profondeur ; `createNodeAfter` (Entrée) place la nouvelle ligne sous l'ancre ; `createNode` (+), `deleteNode`, `reindentNode`, `moveNode` mettent à jour l'ordre d'affichage ; nouveau `ensureDisplayOrder` (canonisation/réparation) ; `normalizeDomain` et `domainPayload` prennent en charge le champ `order`.
- **Frontend (`public/app.js`)** : helpers de sous-arbre par profondeur pour la sélection (`targets`, `hadSubtreeSelected`), la portée des statuts (`hx-vals` js) et le glisser-déposer (fantôme du sous-arbre, détection de cible invalide) ; la ligne n'étant plus enveloppée dans `.node`, les `closest('.node')` disparaissent.
- **Frontend (`public/style.css`)** : suppression de `.outline .children`, indentation par `data-depth` (`padding-left: calc(var(--depth) * 1.6rem)`), adaptation des règles de repli.
- **Données** : nouveau champ optionnel `order` (liste d'ids) dans le document JSON d'un domaine, sur S3 comme dans l'import legacy `data/projects.json` ; un document sans `order` est canonisé au chargement (aucune migration manuelle).
- **Hors périmètre** : Entrée au milieu du texte (curseur pas en fin de ligne) conserve le comportement actuel ; aucune modification des routes, du stockage S3, des thèmes, des domaines ni de l'authentification.
