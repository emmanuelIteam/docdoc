## Why

Sur smartphone, passer en édition — ou en sortir — se lit comme un saut : le clavier virtuel apparaît ou disparaît pendant que l'application change tout en une frame. La ligne éditée est re-rendue, un titre long se replie sur une seule ligne, et la sortie remplace toute l'outline au moment même où le clavier se ferme. L'utilisateur perd le repère de la ligne qu'il modifie.

## What Changes

- **Un état d'édition visible et stable** : la ligne éditée garde un fond teinté et un soulignement pendant toute la saisie ; le champ reprend la hauteur et le retour à la ligne du titre affiché (champ multi-ligne auto-dimensionné), donc les lignes suivantes ne bougent plus à l'ouverture ni à la fermeture.
- **La sortie d'édition ne re-rend plus l'outline** : un renommage met la ligne à jour en place et enregistre en arrière-plan ; la liste n'est re-rendue que pour les actions qui changent la structure (Entrée, Tab).
- **Le clavier n'impose qu'un seul déplacement** : le focus ne déclenche plus le défilement du navigateur (`preventScroll`), l'application publie l'encoche du clavier (`visualViewport`) et n'amène la ligne au-dessus du clavier qu'une fois, après stabilisation, et seulement si elle n'était pas déjà visible.
- **Valider une ligne ne détruit plus la suivante** : le champ ouvert sur une autre ligne n'est plus remplacé par l'enregistrement d'une édition antérieure, et plus aucun re-rendu applicatif ne vient fermer le clavier au moment du passage d'une ligne à l'autre.
- **Le bandeau d'ancêtres ne bouge plus pendant l'édition** : un changement de hauteur de fenêtre dû au clavier ne le redimensionne plus ; il est remesuré à la fermeture du champ.
- **Le mouvement réduit est respecté** : pas de transition d'état ni de défilement animé quand `prefers-reduced-motion: reduce` est actif.
- **Périmètre inchangé** : mêmes gestes d'entrée en édition, mêmes raccourcis, mêmes routes, mêmes données, même validation serveur.

## Capabilities

### New Capabilities

- (aucune)

### Modified Capabilities

- `node-management` : l'exigence « Rename a node » précise la continuité de l'édition — état visuel persistant, hauteur et retour à la ligne conservés, validation sans re-rendu de l'outline, champ ouvert jamais remplacé, et un seul déplacement dû au clavier virtuel.
- `project-outliner` : l'exigence « Keep the domain name and the parent-task hierarchy pinned while scrolling » précise que la barre de hiérarchie n'est pas redimensionnée par un changement de hauteur de fenêtre pendant l'édition d'un titre, et qu'elle est remesurée à la fermeture du champ.

## Impact

- **`public/app.js`** : `startRename` (champ multi-ligne, hauteur, état d'édition, focus sans défilement), `finish` (enregistrement en arrière-plan, jeton de génération, ordre du remplacement), `reloadOutline`, gel du bandeau d'ancêtres, nouveau suivi de `visualViewport` et de la préférence de mouvement.
- **`public/style.css`** : styles de la ligne en édition et du champ multi-ligne, `scroll-padding-bottom` alimenté par l'encoche du clavier, neutralisation sous `prefers-reduced-motion: reduce`.
- **`public/sw.js`** : incrément de `CACHE_VERSION` (`app.js` et `style.css` sont précachés).
- **`test/e2e/reindent.spec.js`** : nouvelle section « stabiliser l'édition sur smartphone » dans le contexte tactile existant.
- **Aucune migration de données, aucune route serveur modifiée.**
