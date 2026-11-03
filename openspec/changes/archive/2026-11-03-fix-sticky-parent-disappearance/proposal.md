## Why

Quand une tâche mère glisse sous la barre collante, son libellé doit passer de la ligne de l'outline au maillon de la chaîne. Le calcul actuel ne s'appuie que sur le **bas** de la ligne : le maillon est retiré dès que le bas de la ligne réapparaît sous la barre, alors que le titre est encore presque entièrement masqué. En remontant, la tâche mère disparaît donc pendant environ une hauteur de ligne — le temps que sa ligne sorte de derrière la barre — avant de réapparaître. En descendant, le maillon n'apparaît qu'au moment où la ligne est entièrement cachée : un défilement rapide peut donc le manquer pendant une frame.

## What Changes

- **Épinglage au haut de la ligne.** Une tâche mère est ajoutée à la chaîne dès que le **haut** de sa ligne passe sous la barre, et non plus seulement quand toute la ligne est cachée.
- **Désépinglage à la visibilité complète.** Elle reste dans la chaîne tant que sa ligne n'est pas entièrement visible sous la barre ; le maillon n'est retiré qu'à ce moment-là, quand le libellé est de nouveau lisible dans l'outline.
- **Continuité du libellé.** Entre ces deux seuils, la tâche mère est affichée à la fois par sa ligne partiellement visible et par son maillon : aucune frame ne la montre absente des deux endroits.
- **Seules les tâches mères sont ajoutées.** Une ligne sans sous-tâche affichée ne s'ajoute pas à sa propre chaîne : la chaîne reste celle des tâches mères de la ligne lue, et reste vide sur un projet racine entièrement visible.
- **Aucun changement de rendu, de style, de route ni de données** : le maillon supplémentaire réutilise le rendu existant de `#ancestry`.

## Capabilities

### New Capabilities

- (aucune)

### Modified Capabilities

- `project-outliner` : l'exigence de la barre collante précise que la chaîne inclut la tâche mère en cours d'épinglage ou de désépinglage tant que sa ligne n'est pas entièrement visible, et qu'elle ne disparaît donc jamais, même temporairement.

## Impact

- **`public/app.js`** : index des tâches mères recalculé avec l'outline, et construction de la chaîne qui ajoute la ligne lue lorsqu'elle est une tâche mère partiellement masquée par la barre.
- **`test/e2e/reindent.spec.js`** : nouveau cas 12.8 (ligne entièrement visible, ligne à cheval sur la barre, ligne entièrement cachée) et mise à jour du calcul attendu du cas 12.7, qui doit connaître la même règle.
- **`public/sw.js`** : incrément de `CACHE_VERSION`, `app.js` étant précaché.
- **`openspec/specs/project-outliner/spec.md`** : exigence mise à jour à l'archivage.
- **Aucune migration de données** : le comportement est purement client.
