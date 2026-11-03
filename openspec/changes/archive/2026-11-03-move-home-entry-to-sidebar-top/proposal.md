## Why

L'entrée « Accueil » existe depuis `add-homepage-open-tasks`, mais elle est rangée dans le pied du panneau avec Administration et Aide : elle se confond avec les liens de service et n'apparaît qu'en bas du panneau. La page d'accueil est pourtant le point d'entrée naturel de l'application : la placer dans une rubrique en tête du panneau, au-dessus de « Domaines », rend le retour à l'accueil immédiat et visible dès l'ouverture du panneau.

## What Changes

- **Nouvelle rubrique « Accueil » en tête du panneau latéral**, au-dessus du titre « Domaines » et de la liste des domaines. Elle contient un lien vers `/`.
- **Déplacement, pas duplication.** L'entrée Accueil est retirée du pied du panneau ; Administration et Aide y restent seules. Il n'y a donc jamais deux liens « Accueil » ni deux états actifs.
- **Comportement inchangé.** L'entrée garde sa classe `sidebar-home`, son état actif (`active` + `aria-current="page"`) sur l'accueil, son `href="/"`, et sa sélection ne replie pas le panneau sur un écran étroit (comme Administration et Aide). Le panneau replié masque la rubrique avec le reste du panneau.
- **Aucun changement de données, d'API, de route ni de JavaScript.** Seuls le balisage de `renderSidebar`, les styles et les tests changent.

## Capabilities

### New Capabilities

- (aucune)

### Modified Capabilities

- `home-dashboard` : l'exigence d'accès à l'accueil depuis le panneau passe du pied à une rubrique en tête, sans doublon.
- `domain-navigation` : l'exigence de repli du panneau sur écran étroit énumère aussi l'entrée Accueil parmi celles qui ne referment pas le panneau (le comportement normatif « seule la sélection d'un domaine replie » la couvrait déjà, l'énumération est mise à jour).

## Impact

- **`server.js`** : dans `renderSidebar`, un bloc `div.sidebar-top` est rendu avant `.sidebar-header` et l'ancre Accueil y est déplacée depuis `.sidebar-extra` ; l'option `home` et les classes existantes sont conservées.
- **`public/style.css`** : styles de la rubrique d'en-tête (séparation avec « Domaines », poids du lien, état actif, cible tactile sur écran étroit).
- **`public/sw.js`** : incrément de `CACHE_VERSION` (seule `style.css` change parmi les fichiers précachés).
- **Tests** : `test/e2e/administration.spec.js` (le pied n'a plus que deux entrées), `test/e2e/home.spec.js` (position en tête, absence de doublon), `test/e2e/sidebar.spec.js` (Accueil ne referme pas le panneau).
- **Retour arrière** : remettre l'ancre dans `.sidebar-extra`, retirer le bloc `sidebar-top` et ses styles ; aucune donnée n'est concernée.
