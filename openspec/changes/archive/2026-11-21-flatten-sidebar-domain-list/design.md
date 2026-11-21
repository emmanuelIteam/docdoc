## Context

Le panneau latéral est rendu par `renderSidebar` : un bloc Accueil, un titre « Domaines », puis `nav#sidebar-nav` alimenté par `renderSidebarNav`. Cette fonction groupe aujourd'hui les domaines par thème (`space.themes`), ajoute une section « Sans thème » pour les domaines sans étiquette et liste un domaine sous chacun de ses thèmes. La liste est donc à deux niveaux, duplique les domaines multi-thèmes et ne montre pas l'ordre réel.

L'ordre des domaines existe déjà : chaque domaine porte un champ `order`, `rebuildDomainList` trie `space.domainList` par `order` puis par nom, et `moveDomain` échange un domaine avec son voisin. La page Administration expose déjà ce classement avec deux formulaires ↑/↓ (`adminMoveForms`) vers `POST /api/domains/:id/move`. La page d'accueil parcourt `space.domainList` pour lister les tâches en cours : elle dépend donc du même ordre.

Deux contraintes du code actuel comptent pour ce changement :

- `redirectAfter` n'honore que `returnTo === '/administration'` ; les autres formulaires retombent sur un chemin par défaut. Un formulaire de classement placé dans le panneau doit revenir sur la page courante, pas forcer Administration.
- La route des étiquettes renvoie le panneau en *out-of-band* après un attachement ou un détachement, parce que les étiquettes étaient la clé de regroupement. Une fois la liste plate, ce rafraîchissement n'a plus d'objet.
- Sur un écran étroit, le repli du panneau écoute les clics sur `#sidebar a[href]` ; les contrôles de classement seront des `<button>` dans des `<form>`, donc ils ne déclencheront pas ce repli.

Le runtime publié sur `http://localhost:3000` est désormais le portage Rust (`rust/src`, binaire `/app/docdoc` dans le conteneur Compose), qui partage `public/style.css` et doit rendre le même balisage que `server.js`. Les décisions ci-dessous valent donc pour les deux implémentations : le conteneur reconstruit sert le binaire Rust, et les tests Rust couvrent la liste plate et le classement.

## Goals / Non-Goals

**Goals :**

- Remplacer les groupes de thèmes du panneau par une liste à un seul niveau, une entrée par domaine actif.
- Faire suivre à cette liste l'ordre manuel déjà persisté, partagé avec Administration et la page d'accueil.
- Ajouter dans le panneau des contrôles ↑/↓ discrets, accessibles et utilisables sans JavaScript, qui déplacent un domaine d'un cran et laissent l'utilisateur sur sa page.
- Conserver les thèmes comme étiquettes (barre, pastilles, matrice, gestion dans Administration) sans qu'ils regroupent le panneau.
- Garder le panneau sans aucun contrôle de création, renommage, suppression ou archivage.

**Non-Goals :**

- Aucun glisser-déposer dans le panneau (les contrôles ↑/↓ suffisent et restent accessibles au clavier).
- Aucun nouveau champ, aucune nouvelle route, aucune migration : `order` et `labels` sont réutilisés tels quels.
- Aucun changement de la page Administration, de la matrice, de la barre d'étiquettes ou de la page d'accueil, sinon la suppression du rafraîchissement *out-of-band* du panneau.
- Aucun filtre, aucune recherche, aucun repli de groupes de domaines : la demande est une liste plate.
- Aucune icône ni pastille de thème sur les entrées du panneau.

## Decisions

### 1. Une liste plate rendue depuis `space.domainList`

`renderSidebarNav` parcourt directement `space.domainList` et rend une entrée par domaine. Les thèmes ne sont plus lus pour la navigation : plus d'en-tête `.theme-group`, plus de section « Sans thème », plus de pastille. `.theme-dot` reste dans la feuille de styles pour la matrice, les pastilles d'étiquettes et l'Administration.

*Alternatives écartées :*

- **Garder les groupes mais les replier par défaut** : la demande est une liste à un seul niveau ; replier ne supprime ni la duplication d'un domaine multi-thèmes ni la lecture par étiquette.
- **Afficher une pastille de thème sur chaque domaine** : un domaine peut porter plusieurs thèmes ; une pastille unique serait mensongère, plusieurs pastilles recréeraient le bruit visuel que le changement supprime.

### 2. Réutiliser la route et le champ d'ordre existants

Les contrôles du panneau postent vers `POST /api/domains/:id/move`, la même route que les flèches d'Administration, avec le même `dir=up|down`. `moveDomain` échange le domaine avec son voisin, normalise les `order` hérités égaux, reconstruit `space.domainList` et persiste les domaines modifiés. Le panneau, la table d'Administration et la page d'accueil lisent donc la même source : aucun ordre parallèle ne peut diverger.

*Alternatives écartées :*

- **Une route dédiée au panneau** : deux routes pour la même mutation, deux occasions de diverger.
- **Un tableau d'identifiants ordonné séparé** : nouveau format de données et migration, alors que `order` porte déjà l'information.

### 3. Un POST classique avec retour sur la page courante, pas de htmx

Chaque formulaire de classement porte un `returnTo` rendu par le serveur (le chemin de la page courante : `/`, `/administration`, `/aide` ou `/domaine/<slug>`) et un `dir`. Après le déplacement, la route redirige vers ce chemin local. La page est rechargée : le panneau, la table d'Administration et la liste de l'accueil sont tous re-rendus cohérents, sans *out-of-band* ni ciblage conditionnel.

`returnTo` est validé comme chemin local : chaîne, commençant par `/`, ne commençant pas par `//`, sans barre oblique inverse ni caractère de contrôle. Un `returnTo` absent ou invalide retombe sur `/administration`. La route continue d'utiliser `redirectAfter` en lui passant le chemin validé comme chemin par défaut, ce qui préserve le comportement des formulaires d'Administration.

*Alternatives écartées :*

- **htmx ciblant `#sidebar-nav`** : il faudrait aussi rafraîchir en *out-of-band* la table d'Administration et la liste de l'accueil, et gérer le focus perdu dans le panneau. La cohérence demanderait plus de code que le rechargement.
- **Rediriger vers `req.headers.referer`** : une requête forgée depuis un autre site ferait une redirection ouverte ; le chemin rendu par le serveur est plus sûr.

### 4. Des contrôles discrets, réservés au classement

Chaque entrée devient une ligne `.sidebar-domain` : le lien `.sidebar-link` existant (classe `active` et `aria-current` conservés) et deux boutons `.btn-mini` ↑/↓ dans deux formulaires. Les boutons portent un `title` et un `aria-label` incluant le nom du domaine (« Monter “Maison” »), sont désactivés au premier/dernier rang et restent des boutons natifs, donc utilisables au clavier. Leur largeur est réservée en permanence pour éviter tout décalage de mise en page ; ils sont révélés au survol et au focus (`:focus-within`), et restent visibles en permanence sur un appareil sans survol (`@media (hover: none)`). Le panneau n'offre rien d'autre : pas de formulaire de création, de renommage, de suppression ni d'archivage.

*Alternatives écartées :*

- **Des boutons toujours visibles sur ordinateur** : deux flèches sur chaque ligne surchargent une colonne de 240 px ; la révélation au survol garde la liste lisible tout en laissant les contrôles atteignables au clavier et au doigt.
- **Un glisser-déposer** : plus agréable pour déplacer loin, mais coûteux en accessibilité (clavier, lecteurs d'écran, tactile) et en code pour un besoin qui se satisfait d'un déplacement d'un cran.

### 5. Les étiquettes ne rafraîchissent plus le panneau

La route `POST /domaine/:slug/api/labels` renvoyait la barre et le panneau dans la même réponse htmx. La liste plate ne dépendant plus des étiquettes, la réponse ne renvoie plus que la barre. Le commentaire et le code de regroupement disparaissent ; le comportement visible de la barre (chips, picker, absence de rechargement) est inchangé.

*Alternatives écartées :*

- **Conserver le panneau en *out-of-band*** : un rafraîchissement inutile à chaque étiquette, et un invariant (« le panneau suit les étiquettes ») qui ne serait plus vrai.

### 6. Une section d'Aide dédiée au classement

La page Aide gagne une section « Classer les domaines » entre « Rattacher un thème » et « Gérer les thèmes et les domaines ». Elle décrit les contrôles ↑/↓, l'ordre partagé avec Administration et l'accueil, et le fait que les thèmes restent des étiquettes. Elle n'ajoute pas de second lien vers `/administration` : le test existant vérifie qu'il n'y en a qu'un.

*Alternatives écartées :*

- **Modifier seulement le paragraphe « Gérer les thèmes et les domaines »** : le classement est une interaction du panneau, il mérite sa propre section dans un manuel qui documente déjà chaque geste.

## Risks / Trade-offs

- **Le panneau ne donne plus de vue par thème** → les thèmes restent visibles dans la barre d'étiquettes, les pastilles et la matrice d'Administration ; c'est le prix demandé pour une liste plate.
- **Un domaine multi-thèmes n'apparaît plus qu'une fois** → c'est le comportement voulu ; les tests vérifient qu'il n'est ni dupliqué ni masqué.
- **Le panneau n'est plus en lecture seule** → il n'offre que le classement, jamais la création, le renommage, la suppression ou l'archivage ; le test 6.2 est ajusté pour distinguer ces contrôles.
- **Un rechargement par cran déplacé** → le rechargement garde toutes les vues cohérentes et fonctionne sans JavaScript ; il réinitialise le défilement de la page, comme les flèches d'Administration aujourd'hui. Un déplacement de plusieurs crans demande plusieurs clics.
- **Perte du focus après un rechargement** → le bouton activé disparaît avec la page ; le clavier peut retrouver la ligne au rechargement suivant. Une restauration du focus demanderait htmx ou du JavaScript, écartée pour garder la cohérence.
- **`returnTo` élargi à des chemins locaux** → validation stricte (chemin commençant par `/`, refus de `//`, de `\` et des caractères de contrôle) ; la valeur reste rendue par le serveur, jamais concaténée depuis une entrée utilisateur.
- **Ordres hérités égaux** → `moveDomain` les normalise déjà en 0..n-1 au premier déplacement ; aucun cas nouveau.
- **Styles `.theme-group*` supprimés** → vérifier qu'ils ne servent qu'au panneau ; `.theme-dot`, `.theme-group` n'est pas utilisé ailleurs. La suppression se limite au bloc CSS devenu mort.

## Migration Plan

Aucune migration de données : `order` et `labels` gardent leur format et les domaines existants apparaissent dans leur ordre actuel. Déploiement normal avec incrément de `CACHE_VERSION` (seule `style.css` change parmi les fichiers précachés). Retour arrière : restaurer `renderSidebarNav`, les styles `.theme-group*`, la réponse *out-of-band* des étiquettes et le texte de l'Aide, puis retirer les contrôles et les tests de classement ; les données ne sont pas concernées.

## Open Questions

Aucune question bloquante. Un glisser-déposer pour déplacer un domaine de plusieurs crans, ou un filtre par thème dans le panneau, pourraient être envisagés plus tard sans changer le modèle de données.
