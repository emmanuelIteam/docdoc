## ADDED Requirements

### Requirement: Keep the domain name and the parent-task hierarchy pinned while scrolling

Le système SHALL, sur la page d'un domaine, maintenir en haut de la fenêtre une barre d'en-tête qui affiche le nom du domaine puis, sous lui, la chaîne des tâches mères de la première ligne visible de l'outline : les ancêtres de cette ligne, du projet de niveau 1 jusqu'à son parent immédiat, chacun sur sa propre ligne et indenté d'un cran de plus que le niveau précédent. La barre SHALL rester collée en haut de la fenêtre pendant tout le défilement de la page. La chaîne SHALL être recalculée quand le défilement fait entrer une autre ligne sous la barre, afin de toujours décrire la première ligne visible. Elle SHALL être vide lorsque la première ligne visible est un projet de niveau 1, et le nom du domaine SHALL rester affiché. La chaîne SHALL faire partie de l'en-tête : les lignes de l'outline SHALL commencer sous la barre et ne SHALL PAS être recouvertes par elle ; la hauteur totale de la page SHALL rester constante quand la chaîne grandit ou rétrécit, afin que le défilement ne soit pas rappelé en fin de page. Chaque élément de la chaîne SHALL reprendre le libellé affiché de la tâche et SHALL être un lien vers l'ancre de cette tâche. Une ligne atteinte par une ancre SHALL s'arrêter sous la barre et ne SHALL PAS être masquée par elle.

#### Scenario: La barre reste collée en haut pendant le défilement
- **WHEN** l'utilisateur fait défiler la page d'un domaine
- **THEN** l'en-tête reste à la même position en haut de la fenêtre et le nom du domaine reste affiché

#### Scenario: La chaîne est empilée sur plusieurs lignes
- **WHEN** la première ligne visible sous la barre est une sous-tâche de profondeur 2
- **THEN** son projet et sa tâche mère sont affichés chacun sur leur propre ligne, la tâche étant indentée sous le projet et chaque niveau précédé d'un chevron

#### Scenario: La chaîne suit le défilement
- **WHEN** le défilement amène sous la barre une ligne d'une autre branche
- **THEN** la chaîne est remplacée par celle de la nouvelle première ligne visible

#### Scenario: Un projet racine n'a pas de tâche mère
- **WHEN** la première ligne visible est un projet de niveau 1
- **THEN** la chaîne est vide et seul le nom du domaine reste affiché

#### Scenario: Chaque maillon ramène à sa tâche
- **WHEN** l'utilisateur active un maillon de la chaîne
- **THEN** la page défile jusqu'à cette tâche et la ligne s'arrête sous la barre, sans être masquée

#### Scenario: La chaîne survit à un re-rendu de l'outline
- **WHEN** l'outline est re-rendue par une action (statut, déplacement, pli, renommage) alors que la page est défilée
- **THEN** la chaîne est recalculée et décrit toujours la première ligne visible

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
