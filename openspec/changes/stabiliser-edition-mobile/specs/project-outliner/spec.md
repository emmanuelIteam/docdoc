## MODIFIED Requirements

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
