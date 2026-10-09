# node-management Specification

## Purpose
TBD - created by archiving change add-projects-outliner. Update Purpose after archive.
## Requirements
### Requirement: Create a node
The system SHALL allow the user to create a new project as a level-1 line and a new task or subtask as a child of an existing line, and SHALL reveal the newly created line immediately.

#### Scenario: Create a new project
- **WHEN** the user creates a new project
- **THEN** a new level-1 line is added to the outline

#### Scenario: Create a child node
- **WHEN** the user invokes the add-child action on a line
- **THEN** a new line is inserted nested beneath that line

#### Scenario: Creating a child node reveals it
- **WHEN** a child node is created under an expanded line
- **THEN** the new child line is displayed immediately

### Requirement: Rename a node
The system SHALL allow the user to edit the title of an existing node.

#### Scenario: Edit a node title
- **WHEN** the user edits the title of a node
- **THEN** the node title is updated and displayed with the new text

#### Scenario: Caret opens at the click position
- **WHEN** the user clicks a line's title to rename it
- **THEN** the edit field opens with the caret at the position of the click within the title, and the title is not selected

### Requirement: Reindent a node
The system SHALL allow the user to move a node up or down one level in the hierarchy, through the line's indent/outdent context-menu actions as well as through the keyboard shortcuts `Tab` (indent) and `Shift+Tab` (outdent) applied to the current line. Reindenting SHALL NOT reorder the outline: outdenting a node SHALL change its depth only and SHALL leave the node displayed at the position it already occupied — it SHALL NOT be displayed above the lines it followed; indenting a node SHALL make it the last child of its previous sibling and display it at the end of that sibling's block, never above that sibling.

#### Scenario: Indent a node
- **WHEN** the user indents a node
- **THEN** the node becomes a child of the previous sibling (or its parent)

#### Scenario: Outdent a node
- **WHEN** the user outdents a node
- **THEN** the node moves up one level and becomes a sibling of its former parent

#### Scenario: Outdenting a line leaves it where it is
- **WHEN** the user outdents a line that is displayed after other lines of its former parent, with `Shift+Tab` or with the line's outdent menu action
- **THEN** the line is outdented one level and stays displayed at the same position, after the lines it followed: it is not moved above them

#### Scenario: Indenting a line leaves it where it is under a leaf previous sibling
- **WHEN** the user indents a line whose previous sibling has no sub-line
- **THEN** the line becomes that sibling's child, is indented one level, and stays displayed at the same position

#### Scenario: Reindenting keeps the line on its line
- **WHEN** the outline shows a task A on line 1 with two sub-tasks B1 on line 2 and B2 on line 3, the caret is on line 3, and the user presses `Shift+Tab` and then `Tab`
- **THEN** B2 loses one level and then gains it back, while remaining on line 3 after each of the two keystrokes

#### Scenario: Tab indents the line being edited
- **WHEN** the user is editing a line's title and presses Tab
- **THEN** that line is indented one level, the browser's default focus move is prevented, and the edit field stays open on that same line

#### Scenario: Shift+Tab outdents the line being edited
- **WHEN** the user is editing a line's title and presses Shift+Tab
- **THEN** that line is outdented one level, the browser's default focus move is prevented, and the edit field stays open on that same line

#### Scenario: Tab indents a selected line
- **WHEN** a line is selected and is not being edited, and the user presses Tab
- **THEN** that line is indented one level and stays selected

#### Scenario: Shift+Tab outdents a selected line
- **WHEN** a line is selected and is not being edited, and the user presses Shift+Tab
- **THEN** that line is outdented one level and stays selected

#### Scenario: The typed title survives a keyboard reindent
- **WHEN** the user presses Tab or Shift+Tab while a line's title has been modified in the edit field but not yet committed
- **THEN** the modified title is saved, and the edit field reopens on the same line with the caret at the same position

#### Scenario: Keyboard reindent can be repeated
- **WHEN** the user presses Tab twice in a row on the same line, having a previous sibling whose own previous sibling also exists
- **THEN** the line is indented two levels, and the editing or selection context is still active on that line

#### Scenario: Indenting the first child does nothing
- **WHEN** the user presses Tab on a line that has no previous sibling
- **THEN** nothing happens: no request is sent, the hierarchy is unchanged, and the line stays in its current editing or selection state

#### Scenario: Outdenting a top-level line does nothing
- **WHEN** the user presses Shift+Tab on a line that is already at the top level
- **THEN** nothing happens: no request is sent, the hierarchy is unchanged, and the line stays in its current editing or selection state

#### Scenario: Tab keeps its normal meaning outside an outline line
- **WHEN** the user presses Tab while the focus is in a field that is not an outline line (such as a sidebar or theme form field), or presses Tab with Ctrl, Alt, or Meta held
- **THEN** the browser's normal tab navigation applies and no line is reindented

### Requirement: Delete a node
The system SHALL allow the user to delete a node together with all of its descendants.

#### Scenario: Delete a node removes its subtree
- **WHEN** the user deletes a node
- **THEN** that node and all of its descendants are removed from the outline

### Requirement: Move a node to a new parent or sibling position
The system SHALL move a node together with its entire descendant subtree when the user drops it onto another node (as that node's last child), above or below another node (as its immediate previous or next sibling), or onto the outline root (as a top-level project), and SHALL reject any move that would place a node inside itself or inside one of its own descendants.

#### Scenario: Move a node onto another node as its last child
- **WHEN** a node is dropped onto another node
- **THEN** the node becomes the last child of that node

#### Scenario: Move a node above another node as its previous sibling
- **WHEN** a node is dropped just above another node
- **THEN** the node is inserted immediately before that node at the same level

#### Scenario: Move a node below another node as its next sibling
- **WHEN** a node is dropped just below another node
- **THEN** the node is inserted immediately after that node at the same level

#### Scenario: Moving a node carries its whole subtree
- **WHEN** a node that has descendants is moved
- **THEN** all of its descendants move with it, unchanged, at every depth

#### Scenario: Move a node to the root level
- **WHEN** a node is dropped onto the outline's root area
- **THEN** the node becomes a top-level project

#### Scenario: A root project can be moved into another project
- **WHEN** a project is dropped onto another project
- **THEN** it becomes a subtask of that project

#### Scenario: A node cannot be moved inside itself or a descendant
- **WHEN** the user tries to move a node onto itself or onto one of its descendants
- **THEN** the move is rejected and the tree is unchanged

### Requirement: Scope node operations to the active domain
The system SHALL scope create, rename, reindent, delete, and move operations to the outline of the active domain, accessed through domain-scoped routes under `/domaine/:slug/...`, so that an operation never affects another domain.

#### Scenario: Create within the active domain
- **WHEN** the user creates a project or task on a domain page
- **THEN** it is added to that domain's outline and persisted in that domain's file

#### Scenario: Rename within the active domain
- **WHEN** the user renames a node on a domain page
- **THEN** the node's title is updated in that domain's outline only

#### Scenario: Delete within the active domain
- **WHEN** the user deletes a node on a domain page
- **THEN** the node is removed from that domain's outline only

#### Scenario: Move within the active domain
- **WHEN** the user moves a node on a domain page
- **THEN** the node is reordered within that domain's outline only

### Requirement: Insert a line directly below the current line when pressing Enter

Le système SHALL, quand l'utilisateur appuie sur Entrée pendant l'édition en ligne du titre d'une ligne avec le curseur en fin de texte, enregistrer la modification éventuelle du titre, créer une nouvelle ligne **au même niveau** que la ligne éditée, l'afficher **immédiatement sous la ligne éditée et au-dessus de ses sous-lignes** — que la ligne éditée ait ou non des sous-lignes — puis ouvrir cette nouvelle ligne en édition avec son texte d'attente sélectionné afin que l'utilisateur puisse continuer à saisir.

#### Scenario: Entrée en fin de ligne avec sous-lignes dépliées
- **WHEN** l'utilisateur place le curseur en fin de texte d'une ligne X qui a des sous-lignes dépliées et appuie sur Entrée
- **THEN** une nouvelle ligne de même niveau que X est créée et affichée juste sous la ligne X, au-dessus des sous-lignes de X

#### Scenario: Entrée en fin de ligne avec sous-lignes repliées
- **WHEN** l'utilisateur appuie sur Entrée en fin de texte d'une ligne X repliée qui a des sous-lignes
- **THEN** la nouvelle ligne est affichée juste sous la ligne X, au même niveau, et les sous-lignes de X restent repliées

#### Scenario: Entrée en fin de ligne sans sous-ligne
- **WHEN** l'utilisateur appuie sur Entrée en fin de texte d'une ligne sans sous-ligne
- **THEN** la nouvelle ligne est affichée juste sous cette ligne, au même niveau

#### Scenario: La saisie se poursuit sur la nouvelle ligne
- **WHEN** la nouvelle ligne est créée
- **THEN** elle est ouverte en édition avec son texte d'attente sélectionné, et un nouvel appui sur Entrée crée la ligne suivante juste en dessous d'elle

#### Scenario: Entrée au milieu du texte conserve la création au même niveau
- **WHEN** l'utilisateur appuie sur Entrée alors que le curseur n'est pas en fin de texte
- **THEN** une ligne de même niveau est créée et affichée juste sous la ligne éditée, au-dessus de ses sous-lignes (aucun découpage du titre)

#### Scenario: La modification du titre est enregistrée avant la création
- **WHEN** l'utilisateur modifie le texte de la ligne puis appuie sur Entrée
- **THEN** le titre modifié est enregistré et la nouvelle ligne est créée juste sous la ligne éditée

