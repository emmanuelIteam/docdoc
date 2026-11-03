## ADDED Requirements

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
