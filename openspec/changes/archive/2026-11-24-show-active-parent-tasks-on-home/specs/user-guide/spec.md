## MODIFIED Requirements

### Requirement: Document what the GTD board excludes

Le système SHALL indiquer dans la page « Aide » que chaque ligne active sans descendant actif appartient à exactement une rubrique, qu'une tâche mère active dont aucun descendant n'est actif y figure comme une autre tâche, et qu'une mère dont un descendant est actif est représentée par sa ligne active la plus profonde. Il SHALL préciser que les tâches « En projet », les tâches terminées, les domaines archivés et le statut hérité « Un jour peut-être » (lu comme « En projet ») ne sont pas listés.

#### Scenario: The guide explains what is not listed

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique que les tâches « En projet », les tâches terminées et les domaines archivés ne figurent pas dans les rubriques

#### Scenario: An active task belongs to exactly one rubrique

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique qu'une ligne active sans descendant actif est classée dans une seule des deux rubriques

#### Scenario: The guide explains that an active parent can be listed

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique qu'une tâche mère active dont aucune sous-tâche n'est active apparaît sur l'accueil comme une autre tâche

#### Scenario: The guide explains the one-card-per-branch rule

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique qu'une tâche mère dont une sous-tâche est active est représentée par la carte de cette sous-tâche, et non par une carte propre

#### Scenario: The legacy someday value is documented

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique qu'une tâche « Un jour peut-être » est désormais lue comme « En projet » et n'apparaît pas sur l'accueil
