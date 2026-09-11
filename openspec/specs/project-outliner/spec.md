# project-outliner Specification

## Purpose
TBD - created by archiving change add-projects-outliner. Update Purpose after archive.
## Requirements
### Requirement: Render projects as a hierarchical bullet list
The system SHALL render the active domain's outline as a bullet list on that domain's page, where each project of the domain is a level-1 line, its tasks are level-2 lines, and deeper subtasks nest one level per depth.

#### Scenario: Show the domain's projects as top-level bullets
- **WHEN** the user opens a domain page
- **THEN** that domain's projects are displayed as level-1 bullet lines

#### Scenario: Show subtasks nested under their parent
- **WHEN** a project or task has child items
- **THEN** each child is indented one level beneath its parent

#### Scenario: Only the active domain's outline is shown
- **WHEN** a domain page is rendered
- **THEN** the outline shows the projects of that domain only, and not those of another domain

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

