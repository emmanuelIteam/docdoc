## ADDED Requirements

### Requirement: Afficher la version servie en bas de la page Aide

Le système SHALL afficher, à la fin du contenu de la page « Aide » et à l'intérieur du bloc du manuel, une ligne de version discrète indiquant la version servie par l'application. Cette ligne SHALL reprendre la valeur de la variable d'environnement `APP_VERSION` de l'instance — le tag de release que transporte l'image — et l'afficher telle quelle sous la forme « Version <tag> ». Lorsque `APP_VERSION` est vide ou absent, la ligne SHALL afficher « Version développement » au lieu d'un numéro, afin qu'un build local ne se présente pas comme une release. La valeur SHALL être échappée comme toute donnée insérée dans une page et ne SHALL jamais être interprétée comme du balisage. La ligne SHALL être rendue avec le document, rester visible sans JavaScript, ne SHALL pas tronquer le texte du manuel, et ne SHALL apparaître sur aucune autre page de l'application.

#### Scenario: Le tag de la release est affiché
- **WHEN** l'application est servie par une image dont `APP_VERSION` vaut `2.0.1` et que l'utilisateur ouvre `/aide`
- **THEN** la page affiche « Version 2.0.1 » à la fin de son contenu, sous les sections du manuel

#### Scenario: Un build sans tag se présente comme un développement
- **WHEN** `APP_VERSION` est vide ou absent et que l'utilisateur ouvre `/aide`
- **THEN** la page affiche « Version développement » à la place d'un numéro de version

#### Scenario: Le tag est affiché comme du texte
- **WHEN** `APP_VERSION` contient des caractères de balisage, par exemple `<b>2.0.1</b>`
- **THEN** cette valeur apparaît littéralement dans la ligne de version et aucun élément de balisage n'est créé dans la page

#### Scenario: Les autres pages ne portent pas la version
- **WHEN** la page d'accueil, une page de domaine, la page Administration ou la gestion des passkeys est rendue
- **THEN** aucune ligne de version n'y apparaît

#### Scenario: La version reste lisible sans JavaScript
- **WHEN** la page « Aide » est affichée alors que `app.js` ne s'exécute pas
- **THEN** la ligne de version reste affichée, puisqu'elle fait partie du document rendu par le serveur

#### Scenario: Le tag s'adapte à un écran étroit
- **WHEN** la page « Aide » est affichée sur un écran étroit
- **THEN** la ligne de version revient à la ligne sans masquer ni tronquer de contenu
