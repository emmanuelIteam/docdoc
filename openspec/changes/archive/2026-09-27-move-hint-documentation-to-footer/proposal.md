## Why

Le paragraphe d'aide « Survolez une ligne : bouton de sélection et menu. … » est rendu aujourd'hui dans le bandeau d'actions de la page de domaine (`renderDomainActions`), juste au-dessus de l'outline. Or il ne documente pas les actions du bandeau (nouveau projet, étiquettes, renommage, archivage) : il décrit des interactions avec les lignes de l'outline. En le laissant là, il occupe une ligne de la zone d'action, repousse l'outline sous un contexte visuel de « barre d'outils » et se trouve noyé au milieu d'actions qu'il n'explique pas. On propose de le sortir de cette zone et de le placer dans un **pied de page pleine largeur**, sous le panneau latéral et la colonne de contenu, où il devient une documentation d'utilisation disponible en bas de page sans gêner la saisie.

## What Changes

- Déplace la documentation d'interaction hors du bandeau d'actions de la page de domaine.
- Ajoute un `<footer>` pleine largeur rendu par `renderShell`, en bas de la grille `.shell`, sous le panneau latéral et la colonne de contenu (il s'étend sur toute la largeur de la fenêtre).
- Restructure la grille `.shell` en deux rangées : la rangée principale (panneau latéral + contenu) occupe l'espace restant (`1fr`), le `footer` occupe la rangée du bas sur toute la largeur (`grid-column: 1 / -1`). Avec `min-height: 100vh`, le footer est poussé en bas du viewport.
- Supprime le `<p class="hint">` de `renderDomainActions` et réutilise ce texte (et sa classe de style) dans le nouveau footer.
- Aucun changement de logique métier, de routes, d'API ou de modèle de données.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `project-outliner`: La page du domaine rend désormais la documentation d'interaction des lignes en pied de page (pleine largeur, sous le panneau latéral et l'outline) au lieu de la zone d'actions située au-dessus de l'outline.

## Impact

- **Backend (`server.js`)**: `renderShell` gagne un `<footer>` contenant le texte de documentation ; `renderDomainActions` perd le `<p class="hint">`. Le texte est ainsi global (présent sur toutes les pages rendues par `renderShell`).
- **Frontend (`public/style.css`)**: la grille `.shell` passe de `grid-template-columns: auto 1fr` seule à `grid-template-columns: auto 1fr; grid-template-rows: 1fr auto` ; le `footer` reçoit `grid-column: 1 / -1` ; styles du textes de documentation en pied de page (classe `.hint` conservée ou nouvelle classe `.footer`).
- **Pas de changement** aux routes, à l'API, au modèle de données, à `public/app.js` (aucun script n'interagit avec `.hint`), ni aux autres capacités (domaines, thèmes, stockage).
