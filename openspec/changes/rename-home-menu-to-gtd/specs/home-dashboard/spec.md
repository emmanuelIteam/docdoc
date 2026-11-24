## RENAMED Requirements

- FROM: `### Requirement: Atteindre la page d'accueil depuis le panneau latéral`
- TO: `### Requirement: Atteindre la page GTD depuis le panneau latéral`

## MODIFIED Requirements

### Requirement: Atteindre la page GTD depuis le panneau latéral

Le système SHALL afficher une entrée « GTD » pointant vers `/` dans une rubrique propre, en tête du panneau latéral, placée avant le titre « Domaines » et avant la liste des domaines. L'entrée SHALL NOT être répétée dans le pied du panneau. L'entrée SHALL être marquée active (classe `active` et `aria-current="page"`) sur la page GTD et SHALL NOT l'être sur les autres pages. Comme les autres entrées du panneau qui ouvrent une page, sa sélection SHALL suivre la règle de repli du panneau définie par l'exigence de navigation du panneau : sur un écran étroit, la page demandée est chargée puis le panneau se replie ; sur un écran large, l'état du panneau reste inchangé.

#### Scenario: L'entrée GTD est présente sur toute page

- **WHEN** une page est rendue pour un compte authentifié
- **THEN** le panneau latéral contient une entrée « GTD » dont le `href` est `/`

#### Scenario: L'entrée est en tête du panneau

- **WHEN** une page est rendue pour un compte authentifié
- **THEN** l'entrée « GTD » précède le titre « Domaines » et la liste des domaines dans le panneau latéral

#### Scenario: L'entrée n'est pas répétée dans le pied du panneau

- **WHEN** une page est rendue pour un compte authentifié
- **THEN** le pied du panneau ne contient aucune entrée « GTD »

#### Scenario: L'entrée est active sur la page GTD

- **WHEN** la page GTD est affichée à la racine
- **THEN** l'entrée « GTD » porte la classe `active` et `aria-current="page"`

#### Scenario: L'entrée n'est pas active sur une page de domaine

- **WHEN** la page d'un domaine est affichée
- **THEN** l'entrée « GTD » ne porte ni la classe `active` ni `aria-current`

#### Scenario: L'entrée mène à la page GTD

- **WHEN** l'utilisateur active l'entrée « GTD » depuis une page de domaine
- **THEN** la page GTD est affichée à la racine

#### Scenario: Le panneau se replie après le clic sur un écran étroit

- **WHEN** dans une fenêtre de 390 px de large, le panneau latéral est ouvert et l'utilisateur active l'entrée « GTD »
- **THEN** la page GTD est chargée, puis le panneau latéral se replie

#### Scenario: Un écran large garde le panneau ouvert

- **WHEN** dans une fenêtre de 1280 px de large, l'utilisateur active l'entrée « GTD »
- **THEN** la page GTD est affichée et le panneau latéral reste ouvert

## ADDED Requirements

### Requirement: Afficher le titre et le sous-titre de la page GTD

Le système SHALL afficher « GTD » comme titre de la page servie à la racine, à la fois dans l'en-tête de la page et dans le titre du document, et SHALL afficher, immédiatement sous ce titre, le sous-titre « Getting Things Done ». Le sous-titre SHALL être visible sans survol ni interaction et SHALL NOT apparaître sur une autre page. Le titre et le sous-titre SHALL être affichés y compris lorsque le compte n'a encore aucun domaine.

#### Scenario: La page GTD affiche son titre et son sous-titre

- **WHEN** un utilisateur connecté ouvre `/`
- **THEN** l'en-tête affiche le titre « GTD » et, sous lui, le sous-titre « Getting Things Done »

#### Scenario: Le sous-titre est placé sous le titre

- **WHEN** la page GTD est rendue
- **THEN** le sous-titre suit le titre dans l'en-tête, sur la ligne du dessous, sans être séparé de lui par le contenu principal

#### Scenario: Le titre du document est GTD

- **WHEN** la page GTD est rendue
- **THEN** le titre du document est « GTD »

#### Scenario: Le sous-titre est absent des autres pages

- **WHEN** une page de domaine, la page Administration ou la page Aide est rendue
- **THEN** aucune page n'affiche le sous-titre « Getting Things Done »

#### Scenario: L'état vide garde le titre et le sous-titre

- **WHEN** le compte n'a aucun domaine et que l'utilisateur ouvre `/`
- **THEN** l'en-tête affiche « GTD » et « Getting Things Done » au-dessus de l'état vide invitant à créer un domaine

### Requirement: Atteindre la page GTD depuis l'en-tête de chaque page

Le système SHALL afficher dans l'en-tête de chaque page rendue par la coque — la page GTD, une page de domaine, la page Administration et la page Aide — un raccourci « GTD » vers `/`, placé immédiatement à droite du bouton d'affichage/masquage du panneau (☰) et avant le titre de la page. Le raccourci SHALL être un lien dont le texte visible est « GTD », SHALL être activable au clavier, et SHALL rester visible et utilisable quand le panneau latéral est replié. Sur la page GTD, il SHALL porter la classe `active` et `aria-current="page"` ; sur les autres pages, il SHALL ne porter ni l'un ni l'autre. Son activation SHALL charger la page GTD sans modifier l'état du panneau latéral. La page de gestion des passkeys, qui n'a ni en-tête ni bouton menu, n'est pas concernée.

#### Scenario: Le raccourci est présent sur chaque page de la coque

- **WHEN** la page GTD, une page de domaine, la page Administration ou la page Aide est rendue
- **THEN** l'en-tête contient un lien « GTD » vers `/`

#### Scenario: Le raccourci est à droite du bouton menu

- **WHEN** une page de la coque est rendue
- **THEN** le raccourci « GTD » suit immédiatement le bouton ☰ dans l'en-tête, avant le titre de la page

#### Scenario: Le raccourci mène à la page GTD

- **WHEN** l'utilisateur active le raccourci « GTD » depuis la page d'un domaine
- **THEN** la page GTD est affichée à la racine

#### Scenario: Le raccourci est actif sur la page GTD seulement

- **WHEN** la page GTD est affichée
- **THEN** le raccourci porte la classe `active` et `aria-current="page"` ; sur une page de domaine, la page Administration ou la page Aide, il ne porte ni l'un ni l'autre

#### Scenario: Le raccourci reste visible quand le panneau est replié

- **WHEN** le panneau latéral est replié sur un écran de 390 px de large
- **THEN** le raccourci « GTD » reste affiché dans l'en-tête et activable

#### Scenario: Le raccourci s'active au clavier

- **WHEN** le raccourci « GTD » reçoit le focus au clavier et que l'utilisateur appuie sur `Entrée`
- **THEN** la page GTD est affichée

#### Scenario: Le raccourci ne change pas l'état du panneau

- **WHEN** dans une fenêtre de 390 px de large, le panneau latéral est ouvert et l'utilisateur active le raccourci « GTD »
- **THEN** la page GTD est chargée et l'état d'ouverture du panneau n'est pas modifié par le raccourci
