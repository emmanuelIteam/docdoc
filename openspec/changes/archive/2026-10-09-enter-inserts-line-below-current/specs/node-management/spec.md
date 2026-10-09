## ADDED Requirements

### Requirement: Insert a line directly below the current line when pressing Enter

Le système SHALL, quand l'utilisateur appuie sur Entrée pendant l'édition en ligne du titre d'une ligne avec le curseur en fin de texte, enregistrer la modification éventuelle du titre, créer une nouvelle ligne **au même niveau** que la ligne éditée, l'afficher **immédiatement sous la ligne éditée et au-dessus de ses sous-lignes** — que la ligne éditée ait ou non des sous-lignes — puis ouvrir cette nouvelle ligne en édition avec son texte d'attente sélectionné afin que l'utilisateur puisse continuer à saisir.

#### Scenario: Entrée en fin de ligne avec sous-lignes dépliées
- **WHEN** l'utilisateur place le curseur en fin de texte d'une ligne X qui a des sous-lignes dépliées et appuie sur Entrée
- **THEN** une nouvelle ligne de même niveau que X est créée et affichée juste sous la ligne X, au-dessus des sous-lignes de X

#### Scenario: Entrée en fin de ligne avec sous-lignes repliées
- **WHEN** l'utilisateur appuie sur Entrée en fin de texte d'une ligne X repliée qui a des sous-lignes
- **THEN** la nouvelle ligne est affichée juste sous la ligne X, au même niveau, et les sous-lignes de X restent repliées

#### Scenario: Entrée en fin de ligne sans sous-ligne
- **WHEN** l'utilisateur appuie sur Entrée en fin de texte d'une ligne sans sous-ligne
- **THEN** la nouvelle ligne est affichée juste sous cette ligne, au même niveau

#### Scenario: La saisie se poursuit sur la nouvelle ligne
- **WHEN** la nouvelle ligne est créée
- **THEN** elle est ouverte en édition avec son texte d'attente sélectionné, et un nouvel appui sur Entrée crée la ligne suivante juste en dessous d'elle

#### Scenario: Entrée au milieu du texte conserve la création au même niveau
- **WHEN** l'utilisateur appuie sur Entrée alors que le curseur n'est pas en fin de texte
- **THEN** une ligne de même niveau est créée et affichée juste sous la ligne éditée, au-dessus de ses sous-lignes (aucun découpage du titre)

#### Scenario: La modification du titre est enregistrée avant la création
- **WHEN** l'utilisateur modifie le texte de la ligne puis appuie sur Entrée
- **THEN** le titre modifié est enregistré et la nouvelle ligne est créée juste sous la ligne éditée
