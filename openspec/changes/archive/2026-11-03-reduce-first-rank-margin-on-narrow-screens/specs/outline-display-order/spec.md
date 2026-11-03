## MODIFIED Requirements

### Requirement: Display the outline as a flat sequence of depth-annotated lines

Le système SHALL rendre l'outline d'un domaine comme une **suite plate** de lignes, chaque ligne portant explicitement sa profondeur hiérarchique (`data-depth`) et l'identifiant de son parent (`data-parent`, vide pour un projet racine), de sorte que la position verticale d'une ligne ne dépende pas de la seule imbrication DOM. Chaque ligne SHALL être visuellement indentée d'un niveau par profondeur. Sur un écran de 640 px de large ou moins, les lignes de premier rang SHALL pouvoir être désindentées de 1 rem, comme décrit par l'exigence **Réduire la marge gauche des lignes de premier rang sur écran étroit** de la capacité `project-outliner` : toutes les autres lignes restent indentées de *n* niveaux par rapport au bord de l'outline. Les sous-lignes d'une ligne SHALL être affichées **après** elle, mais elles ne SHALL PAS être supposées immédiatement consécutives : une ligne insérée juste sous une ligne X s'affiche entre X et les sous-lignes de X, si bien qu'un sous-arbre est identifié par la **chaîne des parents** (`data-parent`), et non par la contiguïté ni par la seule profondeur.

#### Scenario: Each rendered line carries its depth
- **WHEN** une ligne de l'outline est rendue
- **THEN** l'élément de cette ligne porte sa profondeur hiérarchique (0 pour un projet de niveau 1, 1 pour une tâche, etc.)

#### Scenario: Each rendered line carries its parent
- **WHEN** une ligne de l'outline est rendue
- **THEN** l'élément de cette ligne porte l'identifiant de son parent (`data-parent`, vide pour un projet racine)

#### Scenario: Indentation follows the depth
- **WHEN** une ligne de profondeur *n* est affichée
- **THEN** elle est indentée de *n* niveaux par rapport au bord de l'outline, quel que soit son emplacement dans le document — sauf, sur un écran de 640 px de large ou moins, les lignes de premier rang, désindentées de 1 rem

#### Scenario: A line's sub-lines follow it and are found by their parent
- **WHEN** une ligne a des sous-lignes affichées
- **THEN** ces sous-lignes et leurs propres descendants sont affichés après elle, et sont identifiés par la chaîne de leurs parents (`data-parent`) et non par leur position ou leur seule profondeur

#### Scenario: A line inserted below another one is displayed before its sub-lines
- **WHEN** une ligne N est insérée juste sous une ligne X qui a des sous-lignes
- **THEN** les sous-lignes de X sont affichées après N : le sous-arbre de X n'est donc pas une plage contiguë de lignes, et reste néanmoins identifié correctement par `data-parent`
