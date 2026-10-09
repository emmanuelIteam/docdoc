# outline-display-order Specification

## Purpose
TBD - created by archiving change enter-inserts-line-below-current. Update Purpose after archive.
## Requirements
### Requirement: Display the outline as a flat sequence of depth-annotated lines

Le système SHALL rendre l'outline d'un domaine comme une **suite plate** de lignes, chaque ligne portant explicitement sa profondeur hiérarchique (`data-depth`) et l'identifiant de son parent (`data-parent`, vide pour un projet racine), de sorte que la position verticale d'une ligne ne dépende pas de la seule imbrication DOM. Chaque ligne SHALL être visuellement indentée d'un niveau par profondeur. Les sous-lignes d'une ligne SHALL être affichées **après** elle, mais elles ne SHALL PAS être supposées immédiatement consécutives : une ligne insérée juste sous une ligne X s'affiche entre X et les sous-lignes de X, si bien qu'un sous-arbre est identifié par la **chaîne des parents** (`data-parent`), et non par la contiguïté ni par la seule profondeur.

#### Scenario: Each rendered line carries its depth
- **WHEN** une ligne de l'outline est rendue
- **THEN** l'élément de cette ligne porte sa profondeur hiérarchique (0 pour un projet de niveau 1, 1 pour une tâche, etc.)

#### Scenario: Each rendered line carries its parent
- **WHEN** une ligne de l'outline est rendue
- **THEN** l'élément de cette ligne porte l'identifiant de son parent (`data-parent`, vide pour un projet racine)

#### Scenario: Indentation follows the depth
- **WHEN** une ligne de profondeur *n* est affichée
- **THEN** elle est indentée de *n* niveaux par rapport au bord de l'outline, quel que soit son emplacement dans le document

#### Scenario: A line's sub-lines follow it and are found by their parent
- **WHEN** une ligne a des sous-lignes affichées
- **THEN** ces sous-lignes et leurs propres descendants sont affichés après elle, et sont identifiés par la chaîne de leurs parents (`data-parent`) et non par leur position ou leur seule profondeur

#### Scenario: A line inserted below another one is displayed before its sub-lines
- **WHEN** une ligne N est insérée juste sous une ligne X qui a des sous-lignes
- **THEN** les sous-lignes de X sont affichées après N : le sous-arbre de X n'est donc pas une plage contiguë de lignes, et reste néanmoins identifié correctement par `data-parent`

### Requirement: Display a newly inserted line directly below the line it follows

Le système SHALL, quand un nœud est inséré comme **frère suivant** d'une ligne X, l'afficher **immédiatement sous la ligne X et au-dessus des sous-lignes de X**, que X ait ou non des sous-lignes et que X soit repliée ou dépliée. La ligne X et la nouvelle ligne SHALL avoir la même profondeur affichée.

#### Scenario: Insert below a line that has expanded sub-lines
- **WHEN** une ligne X possède des sous-lignes dépliées et qu'un nœud est inséré comme frère suivant de X
- **THEN** l'ordre affiché est : ligne X, nouvelle ligne (même profondeur), puis les sous-lignes de X

#### Scenario: Insert below a line whose sub-lines are collapsed
- **WHEN** une ligne X possède des sous-lignes repliées et qu'un nœud est inséré comme frère suivant de X
- **THEN** la nouvelle ligne est affichée juste sous la ligne X, au même niveau, et les sous-lignes de X restent repliées

#### Scenario: Insert below a leaf line
- **WHEN** une ligne sans sous-ligne est suivie d'une insertion de frère suivant
- **THEN** la nouvelle ligne est affichée juste sous la ligne, avant toute autre ligne suivante

#### Scenario: The line below stays in place when the reference line is collapsed or expanded
- **WHEN** une ligne insérée sous une ligne X est affichée, puis que X est repliée ou dépliée
- **THEN** la ligne insérée reste affichée juste sous la ligne X (seules les sous-lignes de X apparaissent ou disparaissent)

### Requirement: Display a last-child insertion at the end of the parent's block

Le système SHALL, quand un nœud est inséré comme **dernier enfant** d'une ligne X, l'afficher après la dernière ligne affichée du bloc de X (c'est-à-dire après les sous-lignes déjà existantes de X), à une profondeur supérieure d'un niveau à celle de X.

#### Scenario: Adding a task appends it after existing sub-lines
- **WHEN** l'utilisateur ajoute une tâche (« Ajouter une tâche ») à une ligne X qui a déjà des sous-lignes affichées
- **THEN** la nouvelle tâche est affichée après la dernière sous-ligne de X, à la profondeur des sous-lignes de X

#### Scenario: Dropping inside a line appends it at the end of its block
- **WHEN** une ligne est déposée « dans » une ligne X lors d'un glisser-déposer
- **THEN** la ligne déposée est affichée en fin de bloc de X, à la profondeur des sous-lignes de X

### Requirement: Display a re-levelled line just below its new reference line

Le système SHALL, quand la hiérarchie d'une ligne change par un **placement explicite**, l'afficher à la position correspondant à sa nouvelle place : une ligne **déposée sous** une ligne Y est affichée juste sous Y (avant les sous-lignes de Y) ; une ligne **déposée au-dessus** de Y est affichée juste avant Y ; une ligne devenue **dernier enfant** de Y (ajout d'une tâche, dépôt « dans » Y, indentation sur son frère précédent) est affichée en fin de bloc de Y. La **désindentation** ne SHALL PAS déplacer la ligne : elle ne change que sa profondeur, et la ligne reste à la position affichée qu'elle occupait — elle n'est pas affichée juste sous la ligne de son ancien parent.

#### Scenario: Outdenting a line does not move it
- **WHEN** l'utilisateur désindente une ligne dont le parent est Y, par le raccourci `MAJ+Tab` ou par l'action de désindentation du menu
- **THEN** la ligne devient sœur suivante de Y dans la hiérarchie, mais reste affichée à la position qu'elle occupait : seule sa profondeur diminue d'un cran, et elle n'est pas affichée juste sous la ligne Y

#### Scenario: An outdented line stays below the lines it followed
- **WHEN** une ligne affichée après d'autres lignes de son ancien parent est désindentée
- **THEN** elle reste affichée après ces lignes, et l'ordre affiché des autres lignes est inchangé

#### Scenario: Dropping below a line displays the moved line just under it
- **WHEN** une ligne est déposée juste en dessous de la ligne Y
- **THEN** la ligne déplacée est affichée juste sous Y, avant les sous-lignes de Y

#### Scenario: Dropping above a line displays the moved line just over it
- **WHEN** une ligne est déposée juste au-dessus de la ligne Y
- **THEN** la ligne déplacée est affichée juste avant la ligne Y

#### Scenario: Indenting a line displays it at the end of the previous sibling's block
- **WHEN** l'utilisateur indente une ligne dont le frère précédent est Z
- **THEN** la ligne devient la dernière sous-ligne de Z et est affichée après la dernière ligne du bloc de Z

#### Scenario: A re-levelled line carries its subtree
- **WHEN** une ligne ayant des sous-lignes change de niveau
- **THEN** toutes ses sous-lignes sont affichées avec elle, à la suite, à leurs profondeurs relatives inchangées

### Requirement: Persist and repair the outline display order

Le système SHALL persister avec chaque domaine l'ordre d'affichage de ses lignes (liste d'ids de nœuds) et SHALL réparer cet ordre au chargement s'il est absent ou incohérent : un document persisté sans ordre d'affichage SHALL être affiché dans l'ordre canonique (parcours de haut en bas de la hiérarchie), un id d'ordre ne correspondant à aucun nœud SHALL être ignoré, et un nœud absent de l'ordre SHALL être affiché après le bloc de son parent plutôt que masqué. Aucune ligne existante ne SHALL disparaître de l'affichage à cause d'un ordre incomplet. Une liste d'ids complète mais désordonnée (édition manuelle du document) n'a pas à être re-triée : elle n'occulte aucune ligne et n'affecte que l'ordre vertical affiché.

#### Scenario: A document without a display order is displayed in canonical order
- **WHEN** un domaine persisté avant cette évolution (sans ordre d'affichage) est chargé
- **THEN** ses lignes sont affichées dans l'ordre hiérarchique canonique, chaque sous-ligne sous son parent

#### Scenario: An order entry for a deleted node is ignored
- **WHEN** l'ordre d'affichage référence un id de nœud qui n'existe plus dans l'outline
- **THEN** cette entrée est ignorée et le rendu ne comporte pas de ligne vide

#### Scenario: A node missing from the display order is still displayed
- **WHEN** un nœud de l'outline est absent de l'ordre d'affichage enregistré
- **THEN** il est tout de même affiché, après le bloc de son parent, et jamais masqué

#### Scenario: The display order survives re-renders
- **WHEN** l'outline est re-rendue après une action sur une ligne (statut, repli, renommage, révélation d'une ancre)
- **THEN** l'ordre d'affichage des lignes reste identique

