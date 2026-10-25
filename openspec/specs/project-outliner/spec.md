# project-outliner Specification

## Purpose
TBD - created by archiving change add-projects-outliner. Update Purpose after archive.
## Requirements
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

### Requirement: Collapse and expand outline lines
The system SHALL allow each line to be collapsed to hide its children and expanded to show them.

#### Scenario: Collapse a node hides its children
- **WHEN** the user collapses a node
- **THEN** all descendants of that node are hidden from the view

#### Scenario: Expand a node shows its children
- **WHEN** the user expands a previously collapsed node
- **THEN** its children become visible again

#### Scenario: Collapsed state is preserved on reload
- **WHEN** a node was collapsed and the user reloads the page
- **THEN** the node remains collapsed

### Requirement: Reveal a selection button on hover
The system SHALL show a selection button on a line when the pointer hovers over it.

#### Scenario: Selection button appears on hover
- **WHEN** the pointer hovers over a line
- **THEN** a selection button becomes visible on that line

#### Scenario: Selection button hides when pointer leaves
- **WHEN** the pointer moves off the line
- **THEN** the selection button is no longer visible

### Requirement: Keep the selection button in front of the text without shifting it
The selection button SHALL be positioned before (in front of) the line's title text, and its appearance SHALL NOT rearrange, move, or shift the line's text or the text of neighboring lines.

#### Scenario: Revealing the button does not move the title
- **WHEN** the selection button becomes visible on a line
- **THEN** the button remains in front of the title and the title stays at the same horizontal position

#### Scenario: Hiding the button does not move the title back
- **WHEN** the selection button is hidden again after the pointer leaves the line
- **THEN** the title returns to the same horizontal position (identical to when the button was visible)

#### Scenario: Neighboring lines stay aligned while hovering
- **WHEN** a line is hovered and its selection button appears
- **THEN** the titles of the other lines keep their positions (no line is pushed aside)

### Requirement: Show a context menu on hover or selection
The system SHALL display a context menu for a line only when that line is selected, and SHALL keep the menu open only while the pointer is on the selected line or on its menu. When the pointer moves off the selected line (and off its menu), the system SHALL close the context menu and clear the selection. The menu SHALL be laid out as a single horizontal row of icon-only action buttons with no visible text labels, each action button SHALL expose its action name through a `title` tooltip, and the menu SHALL be positioned above the selected line. Moving the pointer onto the menu (a child of the line) SHALL NOT count as leaving the line, so the menu stays open and its actions remain clickable.

#### Scenario: Context menu appears only on selection
- **WHEN** a line is selected
- **THEN** a context menu appears offering the available formatting actions

#### Scenario: Context menu does not appear on hover
- **WHEN** a line is hovered but not selected
- **THEN** no context menu is shown

#### Scenario: Context menu is horizontal and above the line
- **WHEN** a line is selected and its context menu is shown
- **THEN** the menu is laid out as a single horizontal row and is positioned above the selected line

#### Scenario: Context menu actions are icon-only
- **WHEN** the context menu is shown
- **THEN** each action is displayed as an icon without a visible text label, and each action icon exposes a `title` tooltip with its action name

#### Scenario: Context menu offers formatting actions
- **WHEN** the context menu is shown
- **THEN** it offers an action to mark the line in progress and an action to mark the line done

#### Scenario: Context menu closes when the pointer leaves the selected line
- **WHEN** the pointer moves off the selected line (and off its menu)
- **THEN** the context menu is no longer displayed and the line is deselected

#### Scenario: Context menu stays open while the pointer is on the menu
- **WHEN** the pointer moves from the selected line onto its menu
- **THEN** the context menu remains displayed so its actions can be clicked

### Requirement: Toggle collapse on double-click
The system SHALL allow a line that has children to be collapsed or expanded by double-clicking its selection button.

#### Scenario: Double-click collapses a node
- **WHEN** the user double-clicks the selection button of an expanded node that has children
- **THEN** the node is collapsed and its children are hidden

#### Scenario: Double-click expands a node
- **WHEN** the user double-clicks the selection button of a collapsed node that has children
- **THEN** the node is expanded and its children become visible

#### Scenario: Double-click on a leaf does nothing
- **WHEN** the user double-clicks the selection button of a node that has no children
- **THEN** the node's state is unchanged

### Requirement: Render lines with compact vertical spacing
The system SHALL render outline lines with reduced vertical spacing so the outline is compact.

#### Scenario: Lines are compactly spaced
- **WHEN** the outline is rendered
- **THEN** the vertical spacing between adjacent lines is kept minimal

### Requirement: Select a line with its sub-lines and narrow to the head line
The system SHALL select a line together with all of its sub-lines (its entire descendant subtree) when the user clicks the line's selection button, and SHALL highlight every selected line. The context menu SHALL be shown for the selected head line only and not for its sub-lines. Clicking the selection button of the already-selected head line SHALL narrow the selection so that only the head line stays selected and its sub-lines are deselected. Clicking the selection button of the narrowed head line once more SHALL re-select the head line together with all of its sub-lines, so that repeated clicks on the head line toggle the selection between the whole group and the head line alone.

#### Scenario: Selecting a line selects its sub-lines
- **WHEN** the user clicks the selection button of a line that has child lines and the line is not selected
- **THEN** the line and all of its sub-lines are selected

#### Scenario: Sub-lines are highlighted but only the head shows its context menu
- **WHEN** a line and its sub-lines are selected by clicking the line's selection button
- **THEN** each selected sub-line is highlighted as selected, and the context menu is shown only on the clicked head line

#### Scenario: Selecting a line selects descendants at every depth
- **WHEN** the user clicks the selection button of a line whose sub-lines are nested at more than one depth
- **THEN** the line and all of its descendants at every depth are selected

#### Scenario: Clicking the selected head line again selects only the head line
- **WHEN** a line and its sub-lines are selected and the user clicks the selection button of the already-selected head line
- **THEN** only the head line stays selected and its sub-lines become deselected

#### Scenario: Clicking the narrowed head line again re-selects the whole group
- **WHEN** only the head line of a task is selected and the user clicks its selection button again
- **THEN** the head line and all of its sub-lines are selected again

#### Scenario: Selecting a leaf line selects only that line
- **WHEN** the user clicks the selection button of a line that has no children
- **THEN** only that line is selected

### Requirement: Drag a task to move it into another task
The system SHALL let the user begin a drag only by pressing and moving a line's selection button, SHALL represent the dragged line together with its subtree as the drag ghost, SHALL highlight a valid drop target under the pointer and show whether the line would be inserted above it, below it, or as its last child, SHALL reject a drop onto the dragged line or onto one of its descendants, and SHALL re-render the outline after a successful drop.

#### Scenario: Drag starts only from the selection button
- **WHEN** the user presses the selection button on a line and then moves the pointer
- **THEN** a drag begins for that line; pressing and moving on the line's title does not begin a drag

#### Scenario: The drag ghost represents the line and its subtree
- **WHEN** a drag begins
- **THEN** the drag ghost shows the whole dragged line together with its descendants

#### Scenario: A valid drop target is highlighted
- **WHEN** the pointer hovers over a valid drop target during a drag
- **THEN** that target is highlighted as the current drop target

#### Scenario: The drop position is indicated
- **WHEN** the pointer hovers over a line during a drag
- **THEN** an indicator shows whether the dragged line would be inserted above that line, below it, or as its last child

#### Scenario: Dropping on the dragged line or a descendant is rejected
- **WHEN** the pointer hovers over the dragged line itself or over one of its descendants
- **THEN** the target is marked invalid and the drop does not move the line

#### Scenario: The outline re-renders after a successful drop
- **WHEN** a valid drop completes
- **THEN** the drag indicators are cleared and the outline is re-rendered with the line in its new place

### Requirement: Address each line as a stable anchor
Le système SHALL rendre chaque ligne de l'outline avec un attribut `id` unique et stable égal à `node-<id>` où `<id>` est l'id persistant du nœud, afin que chaque ligne projet ou tâche puisse être ciblée comme fragment d'ancre (`#node-<id>`) sur la page du domaine. L'id d'ancre SHALL être dérivé de l'id du nœud et SHALL rester inchangé lors des renommages et des re-rendus.

#### Scenario: Each line carries an anchor id
- **WHEN** une ligne est rendue
- **THEN** l'élément de cette ligne a un `id` égal à `node-<id>` correspondant à son `data-id`

#### Scenario: The anchor id is stable across renames and re-renders
- **WHEN** une ligne est renommée ou que l'outline est re-rendue après une action
- **THEN** la ligne garde le même id d'ancre (il dérive de l'id persistant du nœud)

### Requirement: Reveal a linked line hidden under collapsed ancestors
Le système SHALL, quand la page du domaine est ouverte avec un paramètre de requête `reveal` nommant un id de nœud, rendre les ancêtres de ce nœud dépliés afin que la ligne liée soit visible et présente dans le DOM, sans modifier l'état déplié/replié persistant de ces ancêtres.

#### Scenario: Reveal a line hidden under a collapsed ancestor
- **WHEN** la page est ouverte avec `?reveal=<id>` et que la ligne cible a un ancêtre replié
- **THEN** la ligne cible est visible (ses lignes ancêtres sont affichées dépliées) et la ligne cible est présente dans le DOM

#### Scenario: Reveal does not persist the expanded state
- **WHEN** la même page de domaine est ensuite ouverte sans le paramètre `?reveal`
- **THEN** les ancêtres sont affichés dans leur état sauvegardé d'origine (la révélation ne l'a pas modifié)

#### Scenario: An unknown reveal target is ignored
- **WHEN** la page est ouverte avec `?reveal=<inconnu>`
- **THEN** l'outline est rendue normalement sans révélation appliquée

#### Scenario: The reveal stays active across outline re-renders
- **WHEN** une action sur une ligne re-rend l'outline pendant qu'une révélation est active
- **THEN** les ancêtres de la ligne révélée restent dépliés afin que la ligne cible reste visible

### Requirement: Scroll to and highlight a linked line
Le système SHALL, quand une ligne est la cible d'ancre courante, défiler jusqu'à cette ligne et la surligner d'une façon visuellement distincte du surlignage de sélection.

#### Scenario: Scroll to the linked line
- **WHEN** le fragment d'ancre d'une ligne est présent dans l'URL
- **THEN** le navigateur fait défiler cette ligne dans le champ de vision

#### Scenario: The linked line is highlighted distinctly
- **WHEN** une ligne est la cible d'ancre courante
- **THEN** elle est affichée avec un surlignage lié visuellement différent d'une ligne sélectionnée

### Requirement: Copy a deep link to a line
Le système SHALL proposer, dans le menu contextuel de chaque ligne, une action icône seule « copier le lien » qui copie un lien profond pointant vers cette ligne, afin que l'utilisateur puisse partager un lien direct vers un projet ou une tâche.

#### Scenario: The context menu offers a copy-link action
- **WHEN** le menu contextuel d'une ligne est affiché
- **THEN** il inclut une action icône seule « copier le lien » avec une infobulle `title`

#### Scenario: Copying produces a deep link to the line
- **WHEN** l'utilisateur invoque l'action « copier le lien » sur une ligne
- **THEN** un lien incluant le paramètre de révélation et le fragment d'ancre de la ligne (ex. `/domaine/<slug>?reveal=<id>#node-<id>`) est copié dans le presse-papiers

### Requirement: Document line interactions in a page footer
Le système SHALL rendre le paragraphe de documentation d'utilisation des lignes de l'outline dans un pied de page qui s'étend sur toute la largeur de la page, sous le panneau latéral et la colonne de contenu, au lieu de la zone d'actions située au-dessus de l'outline. La documentation SHALL décrire les interactions prises en charge : bouton de sélection et menu révélés au survol, sélection d'une ligne avec ses sous-lignes par un clic, second clic sur la tête pour ne sélectionner que celle-ci, fermeture du menu et de la sélection quand la souris quitte la ligne, double-clic sur le bouton pour replier/déplier, glisser depuis le bouton pour déplacer, clic sur un titre pour le renommer, indentation d'une ligne par la touche `Tab` et désindentation par `MAJ+Tab`, et collage d'une étiquette de thème sur le domaine.

#### Scenario: The footer documents line interactions
- **WHEN** la page d'un domaine est rendue
- **THEN** un pied de page est affiché en bas de page, s'étendant sur toute la largeur sous le panneau latéral et le contenu, et décrivant les interactions avec les lignes

#### Scenario: The footer documents the indent and outdent shortcuts
- **WHEN** la page d'un domaine est rendue
- **THEN** le paragraphe de documentation mentionne la touche `Tab` pour indenter une ligne et la combinaison `MAJ+Tab` pour la désindenter

#### Scenario: The documentation is not in the action toolbar
- **WHEN** la page d'un domaine est rendue
- **THEN** le paragraphe de documentation n'apparaît pas dans la zone d'actions / bandeau au-dessus de l'outline

#### Scenario: The footer spans the full page width below the shell
- **WHEN** la page est rendue avec un panneau latéral et une colonne de contenu
- **THEN** le pied de page est positionné en bas sur toute la largeur sous les deux colonnes (et non dans la seule colonne de contenu)

#### Scenario: The footer is shown even without a domain
- **WHEN** la page est rendue alors qu'aucun domaine n'existe
- **THEN** le pied de page de documentation est tout de même affiché en bas de page

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

### Requirement: Réduire le pas d'indentation sur écran étroit

Le système SHALL afficher les lignes de l'outline avec un pas d'indentation de 1,6 rem par niveau lorsque la largeur de la fenêtre est supérieure à 640 px, et de 0,8 rem par niveau — la moitié — lorsque cette largeur est inférieure ou égale à 640 px. La réduction SHALL être purement visuelle : la profondeur portée par chaque ligne (`data-depth`), son parent (`data-parent`), l'ordre d'affichage et la hiérarchie SHALL rester inchangés. Le changement de pas SHALL suivre un redimensionnement de la fenêtre sans rechargement de la page.

#### Scenario: Pas plein sur un écran large
- **WHEN** la fenêtre fait 1280 px de large
- **THEN** chaque niveau d'indentation vaut 1,6 rem : une ligne de profondeur 1 est décalée de 25,6 px et une ligne de profondeur 2 de 51,2 px (à la taille de police par défaut de 16 px)

#### Scenario: Moitié sur un écran étroit
- **WHEN** la fenêtre fait 390 px de large
- **THEN** chaque niveau d'indentation vaut 0,8 rem : une ligne de profondeur 1 est décalée de 12,8 px et une ligne de profondeur 2 de 25,6 px

#### Scenario: Le seuil de 640 px est inclusif
- **WHEN** la fenêtre fait exactement 640 px de large
- **THEN** le pas est réduit de moitié ; à 641 px, il reprend sa valeur pleine

#### Scenario: La profondeur, le parent et l'ordre sont inchangés
- **WHEN** le pas d'indentation change à cause de la largeur de la fenêtre
- **THEN** chaque ligne conserve son `data-depth`, son `data-parent` et sa place dans l'ordre affiché ; seule sa position horizontale change

#### Scenario: La bascule suit un redimensionnement sans rechargement
- **WHEN** la fenêtre est redimensionnée de 1280 px à 390 px puis de nouveau à 1280 px
- **THEN** le pas d'indentation devient la moitié puis redevient plein, sans rechargement de la page ni requête au serveur

