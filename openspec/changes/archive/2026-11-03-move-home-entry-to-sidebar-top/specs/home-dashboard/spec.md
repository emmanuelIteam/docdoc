## MODIFIED Requirements

### Requirement: Atteindre la page d'accueil depuis le panneau latéral

Le système SHALL afficher une entrée « Accueil » pointant vers `/` dans une rubrique propre, en tête du panneau latéral, placée avant le titre « Domaines » et avant la liste des domaines. L'entrée SHALL NOT être répétée dans le pied du panneau. L'entrée SHALL être marquée active (classe `active` et `aria-current="page"`) sur la page d'accueil et SHALL NOT l'être sur les autres pages. La sélection de l'entrée SHALL NOT replier le panneau latéral, y compris sur un écran étroit, comme celles d'Administration et d'Aide.

#### Scenario: L'entrée Accueil est présente sur toute page

- **WHEN** une page est rendue pour un compte authentifié
- **THEN** le panneau latéral contient une entrée « Accueil » dont le `href` est `/`

#### Scenario: L'entrée est en tête du panneau

- **WHEN** une page est rendue pour un compte authentifié
- **THEN** l'entrée « Accueil » précède le titre « Domaines » et la liste des domaines dans le panneau latéral

#### Scenario: L'entrée n'est pas répétée dans le pied du panneau

- **WHEN** une page est rendue pour un compte authentifié
- **THEN** le pied du panneau ne contient aucune entrée « Accueil »

#### Scenario: L'entrée est active sur la page d'accueil

- **WHEN** la page d'accueil est affichée
- **THEN** l'entrée « Accueil » porte la classe `active` et `aria-current="page"`

#### Scenario: L'entrée n'est pas active sur une page de domaine

- **WHEN** la page d'un domaine est affichée
- **THEN** l'entrée « Accueil » ne porte ni la classe `active` ni `aria-current`

#### Scenario: L'entrée mène à l'accueil

- **WHEN** l'utilisateur active l'entrée « Accueil » depuis une page de domaine
- **THEN** la page d'accueil est affichée à la racine

#### Scenario: Le panneau reste ouvert au clic sur un écran étroit

- **WHEN** dans une fenêtre de 390 px de large, le panneau latéral est ouvert et l'utilisateur active l'entrée « Accueil »
- **THEN** la page d'accueil est affichée et le panneau latéral reste ouvert
