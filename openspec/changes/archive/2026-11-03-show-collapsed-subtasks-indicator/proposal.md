## Why

Quand une tâche qui contient des sous-tâches est repliée, ses sous-lignes disparaissent sans laisser aucune trace : la ligne redevient visuellement identique à une tâche sans sous-tâche. Depuis la suppression du bouton de pli `▸`/`▾`, la puce elle-même est masquée hors survol sur un écran large, si bien qu'en parcourant l'outline l'utilisateur ne peut pas voir qu'une tâche est repliée ni qu'elle est composée de sous-tâches.

## What Changes

- **Puce révélée pour une tâche repliée.** Une ligne qui a des sous-lignes et qui est repliée affiche sa puce en permanence, y compris sans survol sur un écran large.
- **Puce cerclée.** La puce d'une tâche repliée est entourée d'un anneau : elle montre que la ligne contient des sous-tâches masquées. Une ligne dépliée avec des sous-lignes, ou une ligne sans sous-ligne, garde la puce actuelle.
- **État annoncé.** L'étiquette accessible de la puce d'une ligne repliée mentionne que la tâche est repliée et qu'elle contient des sous-tâches masquées.
- **Geste de repli fiabilisé.** Le double-clic sur la puce est reconnu à partir de deux clics rapprochés (même puce, même position) au lieu de dépendre de l'événement natif `dblclick` : celui-ci peut ne pas être émis quand le glyphe change entre les deux clics (point → anneau/poignée) ou sur un double-tap tactile. Le repli ne dépend donc plus du navigateur pour reconnaître le geste.
- **Aucun décalage.** L'anneau se superpose à l'emplacement existant de la puce : le titre de la ligne et celui des lignes voisines ne bougent pas.
- **Aucun changement de données ni d'API** : le drapeau `collapsed` et la route de pli restent inchangés.

## Capabilities

### New Capabilities

- (aucune)

### Modified Capabilities

- `project-outliner` : une nouvelle exigence précise l'indicateur de composition affiché par la puce d'une ligne repliée (visibilité permanente, anneau, absence sur une ligne dépliée ou sans sous-ligne, absence quand `?reveal` a déplié la ligne, étiquette accessible).

## Impact

- **`server.js`** : `renderOutline` calcule l'état replié réellement affiché (en tenant compte de `expandIds`) et le passe à `renderLine` ; `renderLine` ajoute la classe `collapsed` à la ligne et un marqueur `.bullet-subtasks` dans la puce, et adapte son étiquette accessible.
- **`public/style.css`** : la puce d'une ligne `.collapsed` devient visible sans survol ; le marqueur est un anneau superposé, positionné dans l'emplacement existant pour ne rien décaler.
- **`public/app.js`** : le double-clic sur la puce est détecté à partir de deux clics (seuil de temps et d'écart), ce qui remplace l'écoute de l'événement natif `dblclick` et ne dépend plus du glyphe sous le pointeur ; l'état replié reste rendu par le serveur.
- **`public/sw.js`** : incrément de `CACHE_VERSION` (`style.css` et `app.js` sont précachés).
- **Données / API** : aucun changement de modèle ni de route.
- **Tests** : nouveaux cas e2e (puce visible et cerclée sur une ligne repliée, absente sur une ligne dépliée ou sans sous-ligne, retirée après dépliage, ignorée quand `?reveal` déplie la ligne, titre non décalé).
- **Retour arrière** : retirer la classe et le marqueur du rendu, et les règles CSS associées ; aucun état persisté n'est concerné.
