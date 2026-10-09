## MODIFIED Requirements

### Requirement: Display a re-levelled line just below its new reference line

Le système SHALL, quand la hiérarchie d'une ligne change par un **placement explicite**, l'afficher à la position correspondant à sa nouvelle place : une ligne **déposée sous** une ligne Y est affichée juste sous Y (avant les sous-lignes de Y) ; une ligne **déposée au-dessus** de Y est affichée juste avant Y ; une ligne devenue **dernier enfant** de Y (ajout d'une tâche, dépôt « dans » Y, indentation sur son frère précédent) est affichée en fin de bloc de Y. La **désindentation** ne SHALL PAS déplacer la ligne : elle ne change que sa profondeur, et la ligne reste à la position affichée qu'elle occupait — elle n'est pas affichée juste sous la ligne de son ancien parent.

#### Scenario: Outdenting a line does not move it
- **WHEN** l'utilisateur désindente une ligne dont le parent est Y, par le raccourci `MAJ+Tab` ou par l'action de désindentation du menu
- **THEN** la ligne devient sœur suivante de Y dans la hiérarchie, mais reste affichée à la position qu'elle occupait : seule sa profondeur diminue d'un cran, et elle n'est pas affichée juste sous la ligne Y

#### Scenario: An outdented line stays below the lines it followed
- **WHEN** une ligne affichée après d'autres lignes de son ancien parent est désindentée
- **THEN** elle reste affichée après ces lignes, et l'ordre affiché des autres lignes est inchangé

#### Scenario: Dropping below a line displays the moved line just under it
- **WHEN** une ligne est déposée juste en dessous de la ligne Y
- **THEN** la ligne déplacée est affichée juste sous Y, avant les sous-lignes de Y

#### Scenario: Dropping above a line displays the moved line just over it
- **WHEN** une ligne est déposée juste au-dessus de la ligne Y
- **THEN** la ligne déplacée est affichée juste avant la ligne Y

#### Scenario: Indenting a line displays it at the end of the previous sibling's block
- **WHEN** l'utilisateur indente une ligne dont le frère précédent est Z
- **THEN** la ligne devient la dernière sous-ligne de Z et est affichée après la dernière ligne du bloc de Z

#### Scenario: A re-levelled line carries its subtree
- **WHEN** une ligne ayant des sous-lignes change de niveau
- **THEN** toutes ses sous-lignes sont affichées avec elle, à la suite, à leurs profondeurs relatives inchangées
