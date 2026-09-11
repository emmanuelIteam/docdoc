## ADDED Requirements

### Requirement: Address each line as a stable anchor
Le système SHALL rendre chaque ligne de l'outline avec un attribut `id` unique et stable égal à `node-<id>` où `<id>` est l'id persistant du nœud, afin que chaque ligne projet ou tâche puisse être ciblée comme fragment d'ancre (`#node-<id>`) sur la page du domaine. L'id d'ancre SHALL être dérivé de l'id du nœud et SHALL rester inchangé lors des renommages et des re-rendus.

#### Scenario: Each line carries an anchor id
- **WHEN** une ligne est rendue
- **THEN** l'élément de cette ligne a un `id` égal à `node-<id>` correspondant à son `data-id`

#### Scenario: The anchor id is stable across renames and re-renders
- **WHEN** une ligne est renommée ou que l'outline est re-rendue après une action
- **THEN** la ligne garde le même id d'ancre (il dérive de l'id persistant du nœud)

### Requirement: Reveal a linked line hidden under collapsed ancestors
Le système SHALL, quand la page du domaine est ouverte avec un paramètre de requête `reveal` nommant un id de nœud, rendre les ancêtres de ce nœud dépliés afin que la ligne liée soit visible et présente dans le DOM, sans modifier l'état déplié/replié persistant de ces ancêtres.

#### Scenario: Reveal a line hidden under a collapsed ancestor
- **WHEN** la page est ouverte avec `?reveal=<id>` et que la ligne cible a un ancêtre replié
- **THEN** la ligne cible est visible (ses lignes ancêtres sont affichées dépliées) et la ligne cible est présente dans le DOM

#### Scenario: Reveal does not persist the expanded state
- **WHEN** la même page de domaine est ensuite ouverte sans le paramètre `?reveal`
- **THEN** les ancêtres sont affichés dans leur état sauvegardé d'origine (la révélation ne l'a pas modifié)

#### Scenario: An unknown reveal target is ignored
- **WHEN** la page est ouverte avec `?reveal=<inconnu>`
- **THEN** l'outline est rendue normalement sans révélation appliquée

#### Scenario: The reveal stays active across outline re-renders
- **WHEN** une action sur une ligne re-rend l'outline pendant qu'une révélation est active
- **THEN** les ancêtres de la ligne révélée restent dépliés afin que la ligne cible reste visible

### Requirement: Scroll to and highlight a linked line
Le système SHALL, quand une ligne est la cible d'ancre courante, défiler jusqu'à cette ligne et la surligner d'une façon visuellement distincte du surlignage de sélection.

#### Scenario: Scroll to the linked line
- **WHEN** le fragment d'ancre d'une ligne est présent dans l'URL
- **THEN** le navigateur fait défiler cette ligne dans le champ de vision

#### Scenario: The linked line is highlighted distinctly
- **WHEN** une ligne est la cible d'ancre courante
- **THEN** elle est affichée avec un surlignage lié visuellement différent d'une ligne sélectionnée

### Requirement: Copy a deep link to a line
Le système SHALL proposer, dans le menu contextuel de chaque ligne, une action icône seule « copier le lien » qui copie un lien profond pointant vers cette ligne, afin que l'utilisateur puisse partager un lien direct vers un projet ou une tâche.

#### Scenario: The context menu offers a copy-link action
- **WHEN** le menu contextuel d'une ligne est affiché
- **THEN** il inclut une action icône seule « copier le lien » avec une infobulle `title`

#### Scenario: Copying produces a deep link to the line
- **WHEN** l'utilisateur invoque l'action « copier le lien » sur une ligne
- **THEN** un lien incluant le paramètre de révélation et le fragment d'ancre de la ligne (ex. `/domaine/<slug>?reveal=<id>#node-<id>`) est copié dans le presse-papiers
