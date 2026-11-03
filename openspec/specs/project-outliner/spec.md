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

### Requirement: Indicate that a collapsed line has sub-tasks

Le système SHALL, lorsqu'une ligne possède des sous-lignes et qu'elle est repliée, afficher sa puce sans attendre le survol — y compris sur un écran large — et SHALL la marquer d'un anneau superposé signalant que la ligne est composée de sous-tâches masquées. Il SHALL laisser la puce dans son état habituel (révélée au survol seulement sur un écran large) lorsque la ligne est dépliée ou lorsqu'elle ne possède aucune sous-ligne. L'anneau SHALL occuper l'emplacement existant de la puce sans décaler le titre de la ligne ni celui des lignes voisines. Il SHALL être remplacé par la poignée de glisser lorsque la ligne repliée devient la tête sélectionnée, la poignée occupant l'emplacement de la puce, et SHALL revenir avec le point dès que la sélection est levée. L'état annoncé par l'étiquette accessible de la puce SHALL préciser que la ligne est repliée et qu'elle contient des sous-tâches masquées.

#### Scenario: Une ligne repliée montre sa puce sans survol
- **WHEN** une ligne qui possède des sous-tâches est repliée et que ni le pointeur ni la sélection ne la survole, dans une fenêtre de 1280 px
- **THEN** sa puce est visible et l'anneau de composition est affiché

#### Scenario: L'anneau signale la composition en sous-tâches
- **WHEN** la puce d'une ligne repliée est affichée avec l'anneau
- **THEN** l'anneau est un cercle d'un pixel de bordure, superposé au point de sélection, et sa présence distingue la ligne d'une ligne sans sous-tâche

#### Scenario: Une ligne dépliée garde la puce habituelle
- **WHEN** une ligne qui possède des sous-tâches est dépliée, dans une fenêtre de 1280 px et sans survol
- **THEN** elle n'affiche pas d'anneau et sa puce reste masquée jusqu'au survol, comme avant

#### Scenario: Une ligne sans sous-tâche n'affiche jamais d'anneau
- **WHEN** une ligne ne possède aucune sous-ligne
- **THEN** sa puce n'affiche pas d'anneau, qu'elle soit survolée, sélectionnée ou non

#### Scenario: Le dépliage retire l'anneau
- **WHEN** l'utilisateur déplie une ligne repliée en double-cliquant sa puce
- **THEN** ses sous-lignes redeviennent visibles, l'anneau disparaît et la puce reprend son état habituel

#### Scenario: Le repliage ajoute l'anneau
- **WHEN** l'utilisateur replie une ligne qui possède des sous-tâches en double-cliquant sa puce
- **THEN** ses sous-lignes sont masquées, l'anneau apparaît et la puce reste visible sans survol

#### Scenario: Une ligne dépliée par la révélation n'affiche pas d'anneau
- **WHEN** la page est ouverte avec `?reveal=<id>` et que la ligne cible a un ancêtre persisté replié, qui est donc affiché déplié
- **THEN** cet ancêtre n'affiche pas d'anneau, et l'anneau revient quand la même page est ouverte sans `?reveal`

#### Scenario: L'anneau ne décale pas le titre
- **WHEN** une ligne passe de dépliée à repliée, puis de repliée à dépliée
- **THEN** le titre de cette ligne et celui des lignes voisines conservent exactement la même position horizontale

#### Scenario: La poignée de la tête sélectionnée remplace l'anneau
- **WHEN** une ligne repliée qui possède des sous-tâches est sélectionnée comme tête
- **THEN** sa puce affiche la poignée de glisser à l'emplacement du point, sans anneau, et l'anneau revient avec le point quand la sélection est levée

#### Scenario: L'étiquette accessible annonce le repli
- **WHEN** une lectrice d'écran lit l'étiquette de la puce d'une ligne repliée qui possède des sous-tâches
- **THEN** l'étiquette mentionne que la ligne est repliée et qu'elle contient des sous-tâches masquées

### Requirement: Reveal a selection button on hover

Le système SHALL afficher le bouton de sélection d'une ligne lorsque le pointeur la survole. Il SHALL le garder visible sans survol lorsque la fenêtre fait 640 px de large ou moins, ou lorsque l'appareil ne dispose pas d'un pointeur capable de survol ; dans ce cas, la cible tactile du bouton SHALL mesurer au moins 24 × 24 px. Sur un écran large doté d'un pointeur, le bouton SHALL se cacher dès que le pointeur quitte la ligne.

#### Scenario: Selection button appears on hover
- **WHEN** the pointer hovers over a line
- **THEN** a selection button becomes visible on that line

#### Scenario: Selection button hides when pointer leaves
- **WHEN** le pointeur quitte la ligne dans une fenêtre de plus de 640 px de large dotée d'un pointeur capable de survol
- **THEN** le bouton de sélection n'est plus visible

#### Scenario: Le bouton reste visible sans survol sur un écran étroit
- **WHEN** la fenêtre fait 390 px de large et qu'aucun survol ne se produit
- **THEN** le bouton de sélection de chaque ligne est visible, et sa cible tactile mesure au moins 24 × 24 px

#### Scenario: Le bouton reste visible sur un appareil sans survol
- **WHEN** l'appareil ne dispose pas d'un pointeur capable de survol, même si la fenêtre est large
- **THEN** le bouton de sélection de chaque ligne est visible sans survol

#### Scenario: Le seuil de 640 px est inclusif
- **WHEN** la fenêtre fait exactement 640 px de large
- **THEN** le bouton est visible sans survol ; à 641 px sur un écran doté d'un pointeur, il n'apparaît qu'au survol

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

Le système SHALL afficher les lignes de l'outline avec un espacement vertical compact lorsque la largeur de la fenêtre est supérieure à 640 px, et SHALL donner à chaque ligne une hauteur d'au moins 2,475 rem (39,6 px à la taille de police par défaut de 16 px, soit 90 % de la hauteur de 2,75 rem retenue auparavant) lorsque cette largeur est inférieure ou égale à 640 px, afin que chaque ligne reste une cible tactile utilisable au doigt tout en resserrant la liste. La hauteur SHALL être une hauteur minimale : une ligne dont le titre revient sur plusieurs lignes SHALL grandir au-delà de 2,475 rem sans que son texte soit tronqué. L'espacement SHALL être purement visuel : la profondeur portée par chaque ligne (`data-depth`), son parent (`data-parent`), l'ordre d'affichage et la hiérarchie SHALL rester inchangés. Le changement de hauteur SHALL suivre un redimensionnement de la fenêtre sans rechargement de la page.

#### Scenario: Lignes compactes sur un écran large

- **WHEN** la fenêtre fait 1280 px de large
- **THEN** chaque ligne conserve la hauteur compacte actuelle, d'environ 21 px (à la taille de police par défaut de 16 px), et l'espacement vertical entre lignes voisines reste minimal

#### Scenario: Hauteur tactile sur un écran étroit

- **WHEN** la fenêtre fait 390 px de large
- **THEN** chaque ligne mesure au moins 39,6 px de haut, son titre est centré verticalement, et deux lignes voisines ne se chevauchent pas

#### Scenario: Le seuil de 640 px est inclusif

- **WHEN** la fenêtre fait exactement 640 px de large
- **THEN** chaque ligne mesure au moins 39,6 px de haut ; à 641 px, elle retrouve la hauteur compacte

#### Scenario: Un titre sur plusieurs lignes n'est pas tronqué

- **WHEN** un titre revient sur plusieurs lignes dans une fenêtre étroite
- **THEN** la ligne grandit au-delà de 39,6 px et affiche le titre entier, sans troncature ni ellipse

#### Scenario: La profondeur, le parent et l'ordre sont inchangés

- **WHEN** l'espacement change à cause de la largeur de la fenêtre
- **THEN** chaque ligne conserve son `data-depth`, son `data-parent` et sa place dans l'ordre affiché ; seule sa hauteur change

#### Scenario: La bascule suit un redimensionnement sans rechargement

- **WHEN** la fenêtre est redimensionnée de 1280 px à 390 px puis de nouveau à 1280 px
- **THEN** les lignes passent de la hauteur compacte à la hauteur tactile puis reviennent à la hauteur compacte, sans rechargement de la page ni requête au serveur

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

Le système SHALL permettre de déplacer une ligne, avec tout son sous-arbre, en pressant puis en faisant glisser son bouton de sélection, aussi bien au pointeur (glisser-déposer natif) qu'au doigt (glisser tactile). Un glisser tactile SHALL n'être reconnu qu'après un déplacement d'au moins 8 px ; en deçà, le geste SHALL rester un tap et SHALL sélectionner la ligne sans la déplacer. Pendant un glisser tactile, le système SHALL afficher un fantôme de la ligne et de son sous-arbre suivant le doigt, SHALL faire défiler la page automatiquement lorsque le doigt approche du bord haut ou bas de la fenêtre, SHALL indiquer la cible valide et la position d'insertion (au-dessus, en dessous, ou comme dernier enfant), SHALL masquer le menu contextuel de la ligne glissée, SHALL refuser un dépôt sur la ligne déplacée ou l'un de ses descendants, SHALL annuler sans aucune modification un glisser interrompu par le navigateur ou relâché hors d'une cible, et SHALL re-rendre l'outline après un dépôt réussi.

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

#### Scenario: Un glisser tactile déplace la ligne et son sous-arbre
- **WHEN** sur un appareil tactile, l'utilisateur presse la poignée d'une ligne sélectionnée, déplace le doigt d'au moins 8 px puis le relâche sur une autre ligne
- **THEN** la requête de déplacement porte la cible et la position indiquées, et l'outline re-rendue affiche la ligne déplacée, avec ses sous-lignes, à son nouvel emplacement

#### Scenario: Un tap sur la poignée sélectionne sans déplacer
- **WHEN** l'utilisateur presse puis relâche la poignée en déplaçant le doigt de moins de 8 px
- **THEN** la sélection change comme aujourd'hui et aucune requête de déplacement n'est envoyée

#### Scenario: Le fantôme suit le doigt pendant un glisser tactile
- **WHEN** un glisser tactile est en cours
- **THEN** un fantôme de la ligne et de son sous-arbre est affiché au doigt, et aucune ligne n'est déplacée avant le relâchement

#### Scenario: Le défilement automatique rend une cible hors écran atteignable
- **WHEN** l'utilisateur maintient le doigt près du bord bas de la fenêtre pendant un glisser tactile
- **THEN** la page défile automatiquement et une ligne initialement hors de l'écran peut devenir la cible du dépôt

#### Scenario: Le menu contextuel est masqué pendant le glisser
- **WHEN** le menu contextuel de la ligne sélectionnée est ouvert au début d'un glisser tactile
- **THEN** il est masqué pendant toute la durée du glisser et ne peut pas intercepter la cible du dépôt

#### Scenario: Un glisser interrompu ne change rien
- **WHEN** un glisser tactile est annulé par le navigateur ou relâché hors de toute ligne de l'outline
- **THEN** aucune requête de déplacement n'est envoyée et les indicateurs de dépôt sont effacés

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

Le système SHALL afficher les lignes de l'outline avec un pas d'indentation de 1,6 rem par niveau lorsque la largeur de la fenêtre est supérieure à 640 px, et de 0,8 rem par niveau — la moitié — lorsque cette largeur est inférieure ou égale à 640 px. Le pas SHALL s'appliquer à partir des lignes de profondeur 1 : une ligne de profondeur 1 est décalée de 0,8 rem par rapport au bord gauche de l'outline, une ligne de profondeur 2 de 1,6 rem, et ainsi de suite. La marge gauche des lignes de premier rang (profondeur 0) sur un écran étroit relève de l'exigence **Réduire la marge gauche des lignes de premier rang sur écran étroit** et ne SHALL PAS être déduite de ce pas. La réduction SHALL être purement visuelle : la profondeur portée par chaque ligne (`data-depth`), son parent (`data-parent`), l'ordre d'affichage et la hiérarchie SHALL rester inchangés. Le changement de pas SHALL suivre un redimensionnement de la fenêtre sans rechargement de la page.

#### Scenario: Pas plein sur un écran large

- **WHEN** la fenêtre fait 1280 px de large
- **THEN** chaque niveau d'indentation vaut 1,6 rem : une ligne de profondeur 1 est décalée de 25,6 px et une ligne de profondeur 2 de 51,2 px par rapport au bord gauche de l'outline (à la taille de police par défaut de 16 px)

#### Scenario: Moitié sur un écran étroit

- **WHEN** la fenêtre fait 390 px de large
- **THEN** chaque niveau d'indentation vaut 0,8 rem à partir des lignes de profondeur 1 : une ligne de profondeur 1 est décalée de 12,8 px et une ligne de profondeur 2 de 25,6 px par rapport au bord gauche de l'outline

#### Scenario: Le seuil de 640 px est inclusif

- **WHEN** la fenêtre fait exactement 640 px de large
- **THEN** le pas est réduit de moitié ; à 641 px, il reprend sa valeur pleine

#### Scenario: La profondeur, le parent et l'ordre sont inchangés

- **WHEN** le pas d'indentation change à cause de la largeur de la fenêtre
- **THEN** chaque ligne conserve son `data-depth`, son `data-parent` et sa place dans l'ordre affiché ; seule sa position horizontale change

#### Scenario: La bascule suit un redimensionnement sans rechargement

- **WHEN** la fenêtre est redimensionnée de 1280 px à 390 px puis de nouveau à 1280 px
- **THEN** le pas d'indentation devient la moitié puis redevient plein, sans rechargement de la page ni requête au serveur

### Requirement: Réduire la marge gauche des lignes de premier rang sur écran étroit

Le système SHALL, lorsque la largeur de la fenêtre est inférieure ou égale à 640 px, décaler les lignes de profondeur 0 (les projets) de 1 rem vers la gauche par rapport à leur position sur un écran large : leur marge gauche passe ainsi de 1,5 rem — la gouttière du contenu — à 0,5 rem, et leur titre dispose de 1 rem (16 px à la taille de police par défaut de 16 px) de largeur supplémentaire. Sur un écran de plus de 640 px, une ligne de profondeur 0 SHALL conserver la marge de 0 rem qu'elle avait (la gouttière de 1,5 rem du contenu reste la seule marge à gauche). Le décalage SHALL être purement visuel et en CSS : la profondeur portée par chaque ligne (`data-depth`), son parent (`data-parent`), l'ordre d'affichage et la hiérarchie SHALL rester inchangés, et les lignes de profondeur 1 et plus SHALL conserver exactement leur position. Le décalage SHALL suivre un redimensionnement de la fenêtre sans rechargement de la page. La ligne épinglée qui représente un projet dans la barre de hiérarchie SHALL recevoir le même décalage, afin de rester exactement alignée avec la ligne qu'elle représente, et SHALL rester entièrement visible : sa puce et son libellé ne SHALL PAS être rognés par la barre. L'anneau qui signale un dépôt à la racine SHALL rester aligné sur le bord gauche des lignes de premier rang et SHALL entourer toutes les lignes.

#### Scenario: Lignes de premier rang sur un écran étroit

- **WHEN** la fenêtre fait 390 px de large
- **THEN** chaque ligne de profondeur 0 a une marge gauche calculée de −1 rem (−16 px), son bord gauche se trouve à 8 px du bord de la fenêtre et son titre est 16 px plus large qu'à 1280 px, pour un même titre et une même ouverture de panneau

#### Scenario: Marge de bureau conservée

- **WHEN** la fenêtre fait 1280 px de large
- **THEN** chaque ligne de profondeur 0 a une marge gauche de 0 rem : la gouttière de 1,5 rem du contenu reste la seule marge à gauche

#### Scenario: Le seuil de 640 px est inclusif

- **WHEN** la fenêtre fait exactement 640 px de large
- **THEN** les lignes de premier rang sont décalées de −1 rem ; à 641 px, elles retrouvent leur marge de 0 rem

#### Scenario: Les lignes de tâches ne bougent pas

- **WHEN** la fenêtre fait 390 px de large
- **THEN** les lignes de profondeur 1 et 2 conservent une marge gauche de 12,8 px et de 25,6 px par rapport au bord de l'outline, identique à leur marge avant le changement

#### Scenario: La profondeur, le parent et l'ordre sont inchangés

- **WHEN** la marge des lignes de premier rang change à cause de la largeur de la fenêtre
- **THEN** chaque ligne conserve son `data-depth`, son `data-parent` et sa place dans l'ordre affiché, et l'indentation comme la désindentation se comportent comme avant

#### Scenario: La bascule suit un redimensionnement sans rechargement

- **WHEN** la fenêtre est redimensionnée de 1280 px à 390 px puis de nouveau à 1280 px
- **THEN** la marge des lignes de premier rang passe de 0 rem à −1 rem puis revient à 0 rem, sans rechargement de la page ni requête au serveur

#### Scenario: La ligne épinglée d'un projet est alignée sur sa ligne

- **WHEN** la fenêtre fait 390 px de large et qu'un projet est à cheval sur la barre de hiérarchie
- **THEN** la ligne épinglée qui représente ce projet commence à la même abscisse que le titre de la ligne qu'elle représente, à 1 px près, et sa puce est entièrement visible (non rognée par la barre)

#### Scenario: La barre de hiérarchie ne déborde pas de la page

- **WHEN** la fenêtre fait 390 px de large et que des lignes épinglées sont affichées
- **THEN** la barre conserve la largeur du contenu et n'ajoute aucun défilement horizontal à la page

#### Scenario: L'anneau de dépôt racine entoure les lignes de premier rang

- **WHEN** un glisser vers la racine survole l'outline dans une fenêtre de 390 px de large
- **THEN** l'anneau de dépôt a son bord gauche au même niveau que le bord gauche des lignes de premier rang et entoure toutes les lignes de l'outline

### Requirement: Show a drag handle on the selected line

Le système SHALL afficher, à la tête de la ligne sélectionnée, une poignée de glisser — un symbole de préhension à six points — à la place du point de sélection, afin de signaler que la ligne peut être saisie pour être déplacée. Les sous-lignes sélectionnées SHALL conserver le point. La poignée SHALL occuper le même emplacement que le point : la bascule entre les deux glyphes SHALL ne décaler ni le titre de la ligne ni celui des lignes voisines. La poignée SHALL être remplacée par le point dès que la sélection est levée.

#### Scenario: La ligne de tête sélectionnée montre une poignée
- **WHEN** une ligne est sélectionnée comme tête
- **THEN** son bouton de tête affiche la poignée à six points, et le point de sélection n'est pas affiché

#### Scenario: Les sous-lignes sélectionnées gardent le point
- **WHEN** une ligne et ses sous-lignes sont sélectionnées ensemble
- **THEN** les sous-lignes affichent le point et seule la ligne de tête affiche la poignée

#### Scenario: La poignée disparaît avec la sélection
- **WHEN** la sélection de la ligne de tête est levée
- **THEN** la poignée est remplacée par le point, dans le même emplacement

#### Scenario: La poignée ne décale pas le titre
- **WHEN** le bouton d'une ligne passe du point à la poignée, puis de la poignée au point
- **THEN** le titre de cette ligne et celui des lignes voisines conservent exactement la même position horizontale

#### Scenario: La poignée est atteignable au doigt
- **WHEN** une ligne est sélectionnée sur un appareil tactile ou dans une fenêtre de 640 px de large ou moins
- **THEN** la poignée est visible sans survol et sa cible tactile mesure au moins 24 × 24 px

### Requirement: Keep the domain name and the parent-task hierarchy pinned while scrolling

Le système SHALL, sur la page d'un domaine, maintenir en haut de la fenêtre une barre d'en-tête qui affiche le nom du domaine puis, sous lui, les lignes des tâches mères de la première ligne visible de l'outline, du projet de niveau 1 jusqu'à son parent immédiat. Chaque ligne épinglée SHALL reprendre l'anatomie de la ligne de l'outline — même puce, même largeur de puce, même pas d'indentation et même typographie — afin que son alignement avec les sous-tâches qui restent visibles soit exact. Lorsqu'une tâche mère dont le titre est partiellement masqué par la barre est la première ligne visible, seul le fragment masqué de son titre SHALL être épinglé, comme dernier maillon, et la partie visible du titre SHALL rester dans la ligne : le libellé SHALL être partagé par la barre de séparation sans être dupliqué ni absent. La barre de séparation entre les lignes épinglées et les lignes affichées SHALL se déplacer en douceur quand une ligne est épinglée ou désépinglée, et la liste SHALL glisser d'une ligne au lieu de sauter ; la hauteur totale de la page SHALL rester constante. La barre SHALL rester collée en haut de la fenêtre pendant tout le défilement de la page. L'ensemble SHALL être recalculé quand le défilement fait entrer une autre ligne sous la barre. Il SHALL être vide lorsque la première ligne visible est un projet de niveau 1 entièrement visible sous la barre, et le nom du domaine SHALL rester affiché. Chaque ligne épinglée SHALL rester un lien vers l'ancre de la tâche. Une ligne atteinte par une ancre SHALL s'arrêter sous la barre et ne SHALL PAS être masquée par elle. Tant qu'un titre de ligne est en cours d'édition, un changement de la hauteur de la fenêtre — notamment celui causé par l'apparition du clavier virtuel — SHALL NOT redimensionner la barre : sa hauteur SHALL rester celle qu'elle avait à l'ouverture du champ, et elle SHALL être remesurée à la fermeture de celui-ci. La barre SHALL continuer de suivre le défilement pendant l'édition.

#### Scenario: La barre reste collée en haut pendant le défilement
- **WHEN** l'utilisateur fait défiler la page d'un domaine
- **THEN** l'en-tête reste à la même position en haut de la fenêtre et le nom du domaine reste affiché

#### Scenario: Les lignes épinglées ont l'anatomie de l'outline
- **WHEN** une tâche est épinglée
- **THEN** son libellé porte la même puce et commence à la même abscisse que le libellé de la ligne de même profondeur, chaque niveau restant indenté d'un cran de plus que le précédent

#### Scenario: Le libellé à cheval est partagé par la barre de séparation
- **WHEN** une tâche mère dont le titre est partiellement masqué par la barre est la première ligne visible
- **THEN** seul le fragment masqué de son titre est épinglé en bas de la barre, la partie visible reste dans la ligne, et les deux fragments se rejoignent au séparateur sans doublon ni trou

#### Scenario: La barre de séparation se déplace en douceur
- **WHEN** une ligne est épinglée ou désépinglée
- **THEN** la hauteur de la barre change avec une transition courte, la liste glisse d'une ligne au lieu de sauter, et la position de défilement reste stable

#### Scenario: La chaîne suit le défilement
- **WHEN** le défilement amène sous la barre une ligne d'une autre branche
- **THEN** la chaîne est remplacée par celle de la nouvelle première ligne visible

#### Scenario: Un projet racine n'a pas de tâche mère
- **WHEN** la première ligne visible est un projet de niveau 1 entièrement visible sous la barre
- **THEN** la chaîne est vide et seul le nom du domaine reste affiché

#### Scenario: Chaque maillon ramène à sa tâche
- **WHEN** l'utilisateur active un maillon de la chaîne
- **THEN** la page défile jusqu'à cette tâche et la ligne s'arrête sous la barre, sans être masquée

#### Scenario: La chaîne survit à un re-rendu de l'outline
- **WHEN** l'outline est re-rendue par une action (statut, déplacement, pli, renommage) alors que la page est défilée
- **THEN** la chaîne est recalculée, ses lignes sont réutilisées par identifiant et décrivent toujours la première ligne visible

#### Scenario: L'outline n'est pas recouvert par la barre
- **WHEN** la chaîne est affichée au-dessus de l'outline
- **THEN** la première ligne de l'outline commence sous l'en-tête et n'est pas masquée par la chaîne

#### Scenario: Le défilement reste stable en fin de page
- **WHEN** la page est défilée jusqu'à son extrémité et que la chaîne change de hauteur
- **THEN** la position de défilement reste stable, sans oscillation entre deux états de la chaîne

#### Scenario: La barre reste lisible sur un écran étroit
- **WHEN** la fenêtre fait 390 px de large et que la page est défilée
- **THEN** le nom du domaine et la chaîne restent affichés dans la barre, sans dépasser la largeur de la fenêtre

#### Scenario: Le menu contextuel reste accessible sous la barre
- **WHEN** une ligne située juste sous la barre est sélectionnée
- **THEN** son menu contextuel s'affiche au-dessus de la barre et reste cliquable

#### Scenario: La hauteur de la barre ne change pas pendant l'édition
- **WHEN** un titre de ligne est en cours d'édition et que la hauteur de la fenêtre change, par exemple à l'apparition du clavier virtuel
- **THEN** la hauteur de la barre de hiérarchie reste inchangée et l'outline ne se décale pas ; à la fermeture du champ, la barre est remesurée selon la première ligne visible

