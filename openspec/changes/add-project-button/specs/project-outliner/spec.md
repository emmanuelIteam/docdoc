## ADDED Requirements

### Requirement: Offrir le contrôle d'ajout de projet dans l'en-tête d'une page de domaine

Le système SHALL afficher, sur chaque page de domaine et sur elle seule, un contrôle d'ajout de projet placé dans l'en-tête de la page, à droite du nom du domaine. Le libellé visible du contrôle SHALL être `+` et son nom accessible SHALL être « Ajouter un projet ». L'en-tête d'une page de domaine SHALL rester collé en haut de la fenêtre pendant le défilement, et le contrôle SHALL y rester visible et activable, sur un écran large comme sur un écran étroit. Le contrôle SHALL rester en place lorsqu'un re-rendu remplace l'outline, et SHALL être désactivé tant qu'une création est en cours.

#### Scenario: The control is shown in the domain page header

- **WHEN** une page de domaine est rendue
- **THEN** son en-tête affiche, à droite du nom du domaine, un bouton `+` dont le nom accessible est « Ajouter un projet »

#### Scenario: No control on the other pages

- **WHEN** la page d'accueil, la page Administration ou la page Aide est rendue
- **THEN** aucun contrôle d'ajout de projet n'y figure

#### Scenario: The control stays reachable while the page scrolls

- **WHEN** une page de domaine longue est défilée
- **THEN** l'en-tête reste collé en haut et le contrôle reste visible et activable

#### Scenario: A narrow screen keeps the control in the header

- **WHEN** la fenêtre fait 390 px de large et que le nom du domaine est long
- **THEN** le contrôle reste sur la première rangée de l'en-tête, à côté du nom tronqué, et sa cible mesure au moins 24 × 24 px

#### Scenario: The control survives an outline re-render

- **WHEN** une action remplace l'outline en place (changement de statut, repli, glisser-déposer)
- **THEN** le contrôle reste unique, inchangé et toujours activable

#### Scenario: The control is disabled during a creation

- **WHEN** le contrôle d'ajout de projet est activé
- **THEN** il est désactivé jusqu'à la fin de la requête, puis réactivé

#### Scenario: The control is a real button

- **WHEN** le contrôle reçoit le focus au clavier
- **THEN** il est identifiable par son nom accessible et s'active avec Entrée ou Espace
