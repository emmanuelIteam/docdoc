## MODIFIED Requirements

### Requirement: Render projects as a hierarchical bullet list

Le système SHALL rendre l'outline du domaine actif sur la page de ce domaine comme une suite plate de lignes à puce, chaque ligne portant sa profondeur hiérarchique : chaque projet du domaine est une ligne de niveau 1 (profondeur 0), ses tâches des lignes de profondeur 1, et les sous-tâches plus profondes une profondeur de plus par niveau. Les sous-lignes d'une ligne SHALL être affichées après elle, indentées d'un niveau par profondeur, sans que l'imbrication DOM des éléments ne détermine leur position verticale.

#### Scenario: Show the domain's projects as top-level bullets
- **WHEN** the user opens a domain page
- **THEN** that domain's projects are displayed as level-1 bullet lines

#### Scenario: Show subtasks nested under their parent
- **WHEN** a project or task has child items
- **THEN** each child is indented one level beneath its parent

#### Scenario: Only the active domain's outline is shown
- **WHEN** a domain page is rendered
- **THEN** the outline shows the projects of that domain only, and not those of another domain

#### Scenario: A line's vertical position comes from the display order
- **WHEN** l'outline est rendue
- **THEN** la position verticale de chaque ligne est déterminée par l'ordre d'affichage du domaine et sa profondeur, et non par l'imbrication des éléments dans le document

#### Scenario: Indentation is preserved across the flat rendering
- **WHEN** une ligne de profondeur *n* est affichée
- **THEN** son retrait à gauche correspond à *n* niveaux d'indentation, identique au retrait qu'elle avait en rendu imbriqué

## ADDED Requirements

### Requirement: Identify a line's subtree by ancestry in the flat outline

Le système SHALL déterminer le sous-arbre d'une ligne affichée (pour la sélection, la portée des statuts, le fantôme de glisser-déposer et le rejet d'un dépôt sur un descendant) comme l'ensemble des lignes affichées après elle dont la chaîne des parents (`data-parent`) contient cette ligne, et SHALL ne plus se reposer sur l'imbrication DOM pour ce calcul. La profondeur seule ne SHALL PAS servir à délimiter un sous-arbre : une ligne insérée juste sous une ligne X s'affiche entre X et ses sous-lignes, donc les sous-lignes d'une ligne ne sont pas nécessairement les lignes qui la suivent immédiatement.

#### Scenario: Selecting a line selects its displayed sub-lines
- **WHEN** l'utilisateur clique sur le bouton de sélection d'une ligne
- **THEN** la ligne et toutes les lignes affichées dont la chaîne des parents la contient sont sélectionnées

#### Scenario: An inserted sibling between a line and its sub-lines does not join its subtree
- **WHEN** une ligne N est insérée juste sous une ligne X et s'affiche entre X et les sous-lignes de X
- **THEN** sélectionner X sélectionne les sous-lignes de X et **pas** N, et la ligne suivante de même profondeur que X n'interrompt pas la recherche des sous-lignes de X

#### Scenario: Status scope is derived from the displayed subtree
- **WHEN** l'utilisateur applique un statut sur une ligne dont une sous-ligne affichée est sélectionnée
- **THEN** le statut s'applique à tout le sous-arbre affiché, sinon à la seule ligne d'en-tête

#### Scenario: The drag ghost shows the whole subtree
- **WHEN** un glisser-déposer commence sur une ligne ayant des sous-lignes affichées
- **THEN** le fantôme de glisser représente la ligne et toutes les lignes affichées de son sous-arbre

#### Scenario: Dropping on a descendant is rejected
- **WHEN** le pointeur survole, pendant un glisser, la ligne déplacée ou l'une des lignes affichées de son sous-arbre
- **THEN** la cible est marquée invalide et le dépôt ne déplace pas la ligne
