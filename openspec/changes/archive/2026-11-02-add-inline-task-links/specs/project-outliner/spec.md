## MODIFIED Requirements

### Requirement: Document line interactions in a page footer

Le système SHALL rendre le paragraphe de documentation d'utilisation des lignes de l'outline dans un pied de page qui s'étend sur toute la largeur de la page, sous le panneau latéral et la colonne de contenu, au lieu de la zone d'actions située au-dessus de l'outline. La documentation SHALL décrire les interactions prises en charge : bouton de sélection et menu révélés au survol, bouton restant visible sans survol sur un écran étroit, sélection d'une ligne avec ses sous-lignes par un clic, second clic sur la tête pour ne sélectionner que celle-ci, fermeture du menu et de la sélection quand la souris quitte la ligne, double-clic sur le bouton pour replier/déplier, glisser depuis le bouton pour déplacer, poignée affichée sur la ligne sélectionnée et glisser de cette poignée au doigt pour déplacer la ligne, clic sur un titre hors lien ou action « renommer » du menu pour renommer, collage d'un lien de tâche copié dans le titre pour le transformer en lien nommé, clic sur un lien de tâche pour ouvrir la ligne cible, indentation d'une ligne par la touche `Tab` et désindentation par `MAJ+Tab`, et collage d'une étiquette de thème sur le domaine.

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

#### Scenario: Le pied de page documente les liens de tâche
- **WHEN** la page d'un domaine est rendue
- **THEN** le paragraphe de documentation mentionne le collage d'un lien de tâche copié dans un titre et l'ouverture de la ligne cible par un clic sur le lien
