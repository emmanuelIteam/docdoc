## ADDED Requirements

### Requirement: Store inline task links in a line title

Le système SHALL permettre à un titre de ligne de contenir un ou plusieurs liens de tâche inline sous la forme `[libellé](/domaine/<slug>?reveal=<id>#node-<id>)`. Le titre SHALL rester une chaîne unique, persistée comme les autres titres : aucun champ supplémentaire, aucune migration et aucune nouvelle clé de stockage. Seules les cibles internes à l'application (chemin `/domaine/<slug>`, paramètre `reveal=<id>` et fragment `#node-<id>` cohérents) SHALL être reconnues comme liens de tâche ; toute autre séquence SHALL rester du texte littéral.

#### Scenario: A plain title is unchanged

- **WHEN** une ligne dont le titre ne contient aucune syntaxe de lien est rendue
- **THEN** son titre est affiché tel quel, sans ancre ajoutée

#### Scenario: A valid inline task link is stored in the title

- **WHEN** un titre contient `[Tache 3](/domaine/projets?reveal=a1b2#node-a1b2)` avec le même id dans `reveal` et le fragment
- **THEN** ce titre est persisté comme la chaîne contenant cette syntaxe, sans structure de données supplémentaire

#### Scenario: An external URL is not an inline task link

- **WHEN** un titre contient `[site](https://example.com)`, `[x](//example.com)` ou un lien interne dont les ids `reveal` et `#node-` diffèrent
- **THEN** cette séquence reste du texte littéral et n'est pas rendue comme un lien de tâche

#### Scenario: Un titre existant reste lisible

- **WHEN** un titre existant contient des crochets ou des parenthèses qui ne forment pas un lien de tâche valide
- **THEN** ces caractères sont affichés littéralement

### Requirement: Paste a copied task link as a named hyperlink

Le système SHALL, quand un lien de tâche copié est collé dans le champ d'édition du titre d'une ligne, remplacer le texte collé par un lien inline dont le libellé est le titre affiché de la tâche cible et dont la cible est le lien copié. L'insertion SHALL se faire à la position du curseur, ou remplacer la sélection lorsqu'il y en a une, et le résultat SHALL être enregistré par la validation normale du titre (`Entrée` ou perte de focus). Le collage SHALL NOT modifier la ligne cible.

#### Scenario: Paste a link into a new line

- **WHEN** l'utilisateur colle dans le titre d'une ligne le lien copié de la tâche « Tache 3 » puis valide
- **THEN** le titre de la ligne affiche « Tache 3 » comme un lien hypertexte vers la tâche cible

#### Scenario: The caret position is respected

- **WHEN** le curseur est au milieu d'un titre existant et que l'utilisateur y colle un lien de tâche
- **THEN** le lien est inséré à cette position et le texte qui l'entoure est conservé

#### Scenario: A selected text is replaced

- **WHEN** une partie du titre est sélectionnée et que l'utilisateur y colle un lien de tâche
- **THEN** la sélection est remplacée par le lien nommé

#### Scenario: The label is the target's displayed title

- **WHEN** le titre de la tâche cible est lui-même `[Tache 3](...)`
- **THEN** le libellé inséré est « Tache 3 », sans la syntaxe de lien

#### Scenario: A target in another domain is resolved

- **WHEN** l'utilisateur colle dans un domaine le lien d'une tâche appartenant à un autre domaine de son compte
- **THEN** le libellé est le titre de cette tâche et le lien pointe vers son domaine

#### Scenario: A target hidden under a collapsed line is resolved

- **WHEN** la tâche cible est masquée parce qu'un de ses ancêtres est replié, donc absente du DOM
- **THEN** son titre est tout de même résolu et le lien nommé est inséré

#### Scenario: A non-task text is pasted normally

- **WHEN** le presse-papiers contient un texte sans lien de tâche, une URL externe ou une URL malformée
- **THEN** le collage natif habituel est effectué, sans lien de tâche ajouté

#### Scenario: An unresolvable target falls back to the raw link

- **WHEN** le lien collé désigne un domaine ou un nœud supprimé, ou que la résolution échoue
- **THEN** le texte brut du lien est collé à la place du curseur, sans insertion cassée ni perte du contenu

#### Scenario: An unrepresentable label falls back to the raw link

- **WHEN** le titre de la cible contient un crochet ou un saut de ligne qui casserait la syntaxe du lien
- **THEN** le texte brut du lien est collé à la place du curseur, plutôt qu'un lien malformé

### Requirement: Resolve a task's title by domain and id

Le système SHALL exposer `GET /domaine/:slug/api/nodes/:id`, qui renvoie un JSON `{ id, title }` pour un nœud du domaine demandé, et `404` si le domaine ou le nœud n'existe pas. La route SHALL être limitée au compte de la session : un domaine ou un nœud appartenant à un autre compte SHALL être introuvable.

#### Scenario: An existing node is returned

- **WHEN** `GET /domaine/projets/api/nodes/<id>` est appelé pour un nœud du compte
- **THEN** la réponse est `200`, de type JSON, et contient l'`id` et le `title` du nœud

#### Scenario: An unknown node is not found

- **WHEN** `GET /domaine/projets/api/nodes/<inconnu>` est appelé
- **THEN** la réponse est `404`

#### Scenario: An unknown domain is not found

- **WHEN** `GET /domaine/<domaine-inconnu>/api/nodes/<id>` est appelé
- **THEN** la réponse est `404`

#### Scenario: Another account's node is not reachable

- **WHEN** un nœud existe dans le compte A et que la session du compte B demande son id via un domaine du compte B ou d'un domaine inexistant chez B
- **THEN** la réponse est `404` et aucune donnée du compte A n'est renvoyée

### Requirement: Render inline task links as hyperlinks

Le système SHALL rendre chaque lien de tâche inline d'un titre comme un élément `<a>` dont le texte est le libellé et le `href` est le lien profond validé, à l'intérieur du titre de la ligne. Le libellé et l'URL SHALL être échappés, le texte environnant SHALL être conservé, et les styles de statut de la ligne SHALL continuer de s'appliquer. Les URL brutes, les liens externes et les syntaxes invalides SHALL NOT être transformés.

#### Scenario: A link is rendered as an anchor

- **WHEN** une ligne dont le titre contient un lien de tâche valide est rendue
- **THEN** le libellé apparaît dans un `<a>` dont le `href` est le lien profond, et l'ancre porte la classe `title-link`

#### Scenario: Text around the link is preserved

- **WHEN** le titre est `Voir [Tache 3](...) pour la suite`
- **THEN** « Voir », le lien, puis « pour la suite » sont affichés dans cet ordre

#### Scenario: Multiple links are rendered

- **WHEN** un titre contient deux liens de tâche valides
- **THEN** les deux libellés sont rendus comme deux ancres distinctes

#### Scenario: Markup in the label is escaped

- **WHEN** un libellé contient `<script>` ou des guillemets
- **THEN** ces caractères sont affichés comme du texte et aucun élément n'est exécuté

#### Scenario: A bare URL is not linked

- **WHEN** un titre contient une URL brute sans syntaxe `[libellé](...)`
- **THEN** elle est affichée comme du texte, sans ancre

#### Scenario: Status styling still applies

- **WHEN** une ligne dont le titre contient un lien passe au statut terminé
- **THEN** le titre et son lien gardent le style du statut terminé

### Requirement: Follow a task link on click

Le système SHALL suivre un lien de tâche quand l'utilisateur active son libellé dans le titre, en naviguant vers le lien profond. La ligne cible SHALL alors être révélée, défilée et surlignée selon les exigences existantes de l'outline. L'activation du lien SHALL NOT ouvrir le champ de renommage ; elle SHALL être possible au clavier par focus puis `Entrée`.

#### Scenario: Clicking the label follows the link

- **WHEN** l'utilisateur clique sur le libellé d'un lien de tâche
- **THEN** la page navigue vers le lien profond et la ligne cible est révélée, défilée et surlignée

#### Scenario: The rename field does not open

- **WHEN** l'utilisateur clique sur le libellé d'un lien de tâche
- **THEN** aucun champ de renommage ne s'ouvre sur la ligne

#### Scenario: The link is keyboard accessible

- **WHEN** le lien reçoit le focus au clavier et que l'utilisateur appuie sur `Entrée`
- **THEN** la page navigue vers la ligne cible

#### Scenario: A link to a deleted line still navigates

- **WHEN** l'utilisateur active un lien dont la ligne cible n'existe plus
- **THEN** la page du domaine cible est affichée sans révélation, sans erreur bloquante

### Requirement: Edit or remove an inline task link

Le système SHALL ouvrir le champ de renommage d'une ligne liée avec le titre source complet, afin que le libellé et la cible puissent être modifiés ou supprimés. Le renommage SHALL rester accessible depuis le menu contextuel de la ligne, y compris quand le titre est entièrement occupé par un lien. Le libellé SHALL être figé au moment du collage : renommer la tâche cible plus tard SHALL NOT réécrire le libellé des liens existants. Supprimer la syntaxe du lien SHALL laisser le libellé comme texte simple après validation.

#### Scenario: The context menu offers a rename action

- **WHEN** le menu contextuel d'une ligne est affiché
- **THEN** il inclut une action icône seule « Renommer » avec une infobulle `title`, qui ouvre le champ d'édition du titre

#### Scenario: A link-only title is renamed from the menu

- **WHEN** le titre d'une ligne est entièrement occupé par un lien et que l'utilisateur choisit « Renommer » dans son menu contextuel
- **THEN** le champ s'ouvre sur le titre source et permet de modifier le libellé ou le lien

#### Scenario: The source is editable

- **WHEN** l'utilisateur ouvre le renommage d'une ligne dont le titre contient un lien
- **THEN** le champ contient la syntaxe complète du lien et du texte, et son contenu peut être modifié

#### Scenario: The caret follows the displayed click position

- **WHEN** l'utilisateur clique sur du texte du titre situé après un lien de tâche pour le renommer
- **THEN** le champ s'ouvre avec le curseur à la position correspondant au clic dans la source, et non à la position affichée

#### Scenario: Editing the label keeps the link

- **WHEN** l'utilisateur remplace le libellé du lien par un autre texte et valide
- **THEN** le nouveau libellé est affiché comme un lien vers la même cible

#### Scenario: Removing the link syntax removes the hyperlink

- **WHEN** l'utilisateur supprime la syntaxe du lien en ne laissant que le libellé, puis valide
- **THEN** le texte est affiché sans ancre

#### Scenario: Renaming the target does not rewrite existing labels

- **WHEN** la tâche cible est renommée après qu'un lien vers elle a été collé
- **THEN** le libellé du lien existant reste celui figé au moment du collage
