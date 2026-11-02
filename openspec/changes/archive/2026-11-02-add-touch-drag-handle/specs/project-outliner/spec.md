## MODIFIED Requirements

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

### Requirement: Document line interactions in a page footer

Le système SHALL rendre le paragraphe de documentation d'utilisation des lignes de l'outline dans un pied de page qui s'étend sur toute la largeur de la page, sous le panneau latéral et la colonne de contenu, au lieu de la zone d'actions située au-dessus de l'outline. La documentation SHALL décrire les interactions prises en charge : bouton de sélection et menu révélés au survol, bouton restant visible sans survol sur un écran étroit, sélection d'une ligne avec ses sous-lignes par un clic, second clic sur la tête pour ne sélectionner que celle-ci, fermeture du menu et de la sélection quand la souris quitte la ligne, double-clic sur le bouton pour replier/déplier, glisser depuis le bouton pour déplacer, poignée affichée sur la ligne sélectionnée et glisser de cette poignée au doigt pour déplacer la ligne, clic sur un titre pour le renommer, indentation d'une ligne par la touche `Tab` et désindentation par `MAJ+Tab`, et collage d'une étiquette de thème sur le domaine.

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

#### Scenario: Le pied de page documente la poignée et le glisser au doigt
- **WHEN** la page d'un domaine est rendue
- **THEN** le paragraphe de documentation mentionne la poignée affichée sur la ligne sélectionnée et le fait de la faire glisser au doigt pour déplacer la ligne

## ADDED Requirements

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
