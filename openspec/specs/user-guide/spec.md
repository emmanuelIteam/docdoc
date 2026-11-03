# user-guide Specification

## Purpose
Page « Aide » d'un espace : la route `GET /aide`, son entrée dans le pied du panneau juste après Administration, l'absence de documentation en pied de page, et le manuel des interactions de l'outline présenté en sections.
## Requirements
### Requirement: Serve the user guide at /aide

Le système SHALL servir une page « Aide » à `GET /aide` pour une session authentifiée, rendue dans la coquille habituelle (panneau latéral avec la navigation des domaines, en-tête et boîte de session) avec le titre « Aide », et SHALL n'afficher dans son contenu principal aucune ligne d'outline, aucun formulaire de mutation ni barre d'étiquettes.

#### Scenario: The guide is displayed

- **WHEN** l'utilisateur authentifié navigue vers `/aide`
- **THEN** la page s'affiche avec le titre « Aide » et le contenu de documentation des interactions

#### Scenario: An unauthenticated request is refused

- **WHEN** une requête sans session valide cible `/aide`
- **THEN** le garde d'accès répond à la place de la page « Aide »

#### Scenario: The guide works with an empty space

- **WHEN** l'espace de la session ne contient aucun domaine
- **THEN** la page « Aide » s'affiche normalement et aucune redirection vers un domaine n'a lieu

### Requirement: Keep the documentation out of the page footer

Le système SHALL NOT rendre la documentation des interactions dans un pied de page au bas des pages. Aucune page rendue par la coquille SHALL contenir le paragraphe d'aide ni un pied de page de documentation : la page « Aide » SHALL être le seul endroit où cette documentation est rendue.

#### Scenario: A domain page has no documentation footer

- **WHEN** la page d'un domaine est rendue
- **THEN** aucun pied de page de documentation n'apparaît sous le contenu, et le paragraphe d'aide n'est pas rendu en bas de page

#### Scenario: The administration page has no documentation footer

- **WHEN** la page Administration est rendue
- **THEN** aucun pied de page de documentation n'apparaît sous les sections d'administration

#### Scenario: The empty state has no documentation footer

- **WHEN** la page d'accueil est rendue alors qu'aucun domaine n'existe
- **THEN** l'état vide est affiché sans pied de page de documentation

#### Scenario: The guide is the only rendering of the documentation

- **WHEN** la page « Aide » est rendue
- **THEN** la documentation apparaît dans le contenu principal de la page et aucun pied de page de documentation n'est rendu

### Requirement: Reach the guide from the sidebar footer after Administration

Le système SHALL afficher une entrée « Aide » dans le pied du panneau latéral gauche, immédiatement après l'entrée « Administration », liée à `/aide` et présente sur toutes les pages. Le système SHALL marquer cette entrée active et lui poser `aria-current="page"` uniquement lorsque la page « Aide » est affichée ; sur les autres pages, elle SHALL rester inactive même quand l'entrée Administration est active.

#### Scenario: The entry is present on every page

- **WHEN** une page quelconque est rendue
- **THEN** le pied du panneau latéral affiche l'entrée « Aide » pointant vers `/aide`

#### Scenario: The entry comes right after Administration

- **WHEN** le pied du panneau latéral est rendu
- **THEN** l'entrée « Aide » suit immédiatement l'entrée « Administration », dans le même groupe de navigation et sans autre entrée entre les deux

#### Scenario: The entry is active on the guide page

- **WHEN** la page « Aide » est affichée
- **THEN** l'entrée « Aide » est surlignée et porte `aria-current="page"`

#### Scenario: The entry is not active elsewhere

- **WHEN** une page de domaine ou la page Administration est affichée
- **THEN** l'entrée « Aide » n'est pas surlignée et ne porte pas `aria-current="page"`

#### Scenario: The entry is present with an empty space

- **WHEN** aucun domaine n'existe et que la page d'accueil vide est rendue
- **THEN** l'entrée « Aide » est tout de même présente dans le pied du panneau

### Requirement: Document the outline interactions in the guide

Le système SHALL documenter dans la page « Aide » les interactions prises en charge par l'outline : bouton de sélection et menu révélés au survol, bouton restant visible sans survol sur un écran étroit ou un appareil sans souris, sélection d'une ligne avec ses sous-lignes par un clic, second clic sur la tête pour ne sélectionner que celle-ci, fermeture du menu et de la sélection quand le pointeur quitte la ligne, double-clic sur le bouton pour replier/déplier, glisser depuis le bouton pour déplacer, poignée affichée sur la ligne sélectionnée et glisser de cette poignée au doigt, renommage par un clic sur le titre hors lien ou par l'action « Renommer » du menu, ajout d'une sous-tâche par l'action + du menu qui ouvre son titre pour la nommer, collage d'un lien de tâche copié dans un titre pour le transformer en lien nommé, ouverture de la ligne cible par un clic sur ce lien, indentation d'une ligne par `Tab` et désindentation par `MAJ+Tab` pendant l'édition d'un titre ou sur une ligne sélectionnée, et collage d'une étiquette de thème sur le domaine. Elle SHALL aussi indiquer que les thèmes et les domaines se gèrent depuis la page Administration et contenir un lien vers `/administration`.

#### Scenario: The guide documents selection and the context menu

- **WHEN** la page « Aide » est rendue
- **THEN** elle décrit la révélation du bouton de sélection et du menu au survol, leur maintien sans survol sur un écran étroit, la sélection de la ligne et de ses sous-lignes au clic, la sélection de la seule tête au second clic, et la fermeture du menu et de la sélection au départ du pointeur

#### Scenario: The guide documents collapse and expansion

- **WHEN** la page « Aide » est rendue
- **THEN** elle mentionne le double-clic sur le bouton pour replier ou déplier une ligne

#### Scenario: The guide documents moving a line

- **WHEN** la page « Aide » est rendue
- **THEN** elle décrit le glisser depuis le bouton, la poignée affichée sur la ligne sélectionnée et le glisser de cette poignée au doigt pour déplacer la ligne et ses sous-lignes

#### Scenario: The guide documents renaming

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique qu'un clic sur un titre hors lien ou l'action « Renommer » du menu ouvre l'édition du titre

#### Scenario: The guide documents adding a sub-task

- **WHEN** la page « Aide » est rendue
- **THEN** elle mentionne l'action + du menu, qui ajoute une sous-tâche et ouvre son titre pour la nommer

#### Scenario: The guide documents task links

- **WHEN** la page « Aide » est rendue
- **THEN** elle mentionne le collage d'un lien de tâche copié dans un titre pour le transformer en lien nommé, et l'ouverture de la ligne cible par un clic sur ce lien

#### Scenario: The guide documents the indent and outdent shortcuts

- **WHEN** la page « Aide » est rendue
- **THEN** elle mentionne la touche `Tab` pour indenter une ligne et la combinaison `MAJ+Tab` pour la désindenter

#### Scenario: The guide documents theme labels

- **WHEN** la page « Aide » est rendue
- **THEN** elle mentionne le collage d'une étiquette de thème sur le domaine pour le rattacher à un thème

#### Scenario: The guide points to the administration page

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique que les thèmes et les domaines se gèrent depuis la page Administration et contient un lien vers `/administration`

### Requirement: Present the guide as readable sections

Le système SHALL présenter la documentation de la page « Aide » en sections titrées — au moins la sélection et le menu, le repli, le déplacement, le renommage, l'ajout d'une sous-tâche, les liens de tâche, l'indentation, les étiquettes et l'administration — plutôt qu'en un paragraphe unique. Le contenu SHALL rester lisible sans JavaScript et SHALL ne rien tronquer.

#### Scenario: Each topic has its own title

- **WHEN** la page « Aide » est rendue
- **THEN** chaque sujet documenté est porté par un titre de section, et son texte suit sous forme de liste ou de paragraphe

#### Scenario: The guide works without JavaScript

- **WHEN** la page « Aide » est rendue alors que `app.js` ne s'exécute pas
- **THEN** la documentation reste entièrement affichée et l'entrée « Aide » du panneau reste un lien fonctionnel

#### Scenario: The guide does not truncate the documentation

- **WHEN** la page « Aide » est affichée sur un écran étroit
- **THEN** le texte revient à la ligne et aucun contenu documenté n'est masqué ni tronqué

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

