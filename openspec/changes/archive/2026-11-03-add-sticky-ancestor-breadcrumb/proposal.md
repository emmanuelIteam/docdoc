## Why

Dans un projet composé d'une multitude de tâches et de sous-tâches, l'outline devient plus haut que la fenêtre. En défilant, le nom du domaine et les tâches mères de la ligne en cours de lecture sortent de l'écran : une sous-tâche profonde n'affiche plus aucun repère et l'utilisateur ne sait plus à quel projet elle appartient.

## What Changes

- **En-tête collant.** Sur la page d'un domaine, l'en-tête (nom du domaine, déjà présent) est maintenu en haut de la fenêtre pendant tout le défilement, au lieu de sortir de l'écran avec le contenu.
- **Chaîne des tâches mères, une ligne par niveau.** Sous le nom du domaine, l'en-tête empile les ancêtres de la première ligne visible de l'outline : du projet de niveau 1 jusqu'au parent immédiat, chacun sur sa propre ligne et indenté d'un cran par niveau.
- **Suivi du défilement.** La chaîne est recalculée quand le défilement fait entrer une autre ligne sous la barre, et se vide quand la première ligne visible est un projet de niveau 1 (seul le nom du domaine reste).
- **Pas de recouvrement.** La chaîne fait partie de la hauteur de l'en-tête : l'outline commence sous la barre et n'est jamais masqué par elle.
- **Défilement stable en fin de page.** La hauteur de la chaîne varie avec la profondeur ; une réserve en bas de page garde la hauteur totale du document constante, pour que la barre ne fasse pas osciller le défilement à l'extrémité de la page.
- **Navigation depuis la chaîne.** Chaque maillon est un lien vers l'ancre de la tâche correspondante ; une ligne ciblée reste visible sous la barre au lieu d'être masquée par elle.
- **Mise à jour après re-rendu.** La chaîne est également recalculée quand l'outline est re-rendue par htmx (statut, déplacement, pli, renommage).
- **Aucun changement de données ni d'API** : l'outline, ses routes et le modèle du nœud restent inchangés.

## Capabilities

### New Capabilities

- (aucune)

### Modified Capabilities

- `project-outliner` : une nouvelle exigence précise l'en-tête collant, la chaîne empilée des tâches mères et la stabilité du défilement en fin de page.

## Impact

- **`server.js`** : `renderShell` pose un identifiant sur l'en-tête et rend, sur la page d'un domaine uniquement, un emplacement `#ancestry` que le client remplit ; `renderPage` l'active.
- **`public/app.js`** : calcul de la première ligne visible et de sa chaîne d'ancêtres, mise à jour au défilement, au redimensionnement, au basculement du panneau et après un swap htmx ; mesure et publication de la réserve de hauteur.
- **`public/style.css`** : en-tête `position: sticky`, chaîne empilée dans le flux, `scroll-margin-top` des lignes, réserve de bas de page et désactivation de l'ancrage de défilement dans l'outline.
- **`public/sw.js`** : incrément de `CACHE_VERSION` (`style.css` et `app.js` sont précachés).
- **`server.js` (page Aide)** : une section documente la barre collante.
- **Tests** : nouveaux cas e2e dans `test/e2e/reindent.spec.js` (barre collée, nom du domaine, chaîne empilée, suivi du défilement, vide sur un projet racine, navigation par la chaîne, écran étroit, stabilité en fin de page).
- **Retour arrière** : retirer `position: sticky` et la navigation `#ancestry`, l'initialisation client et la réserve associées ; aucun état persisté n'est concerné.
