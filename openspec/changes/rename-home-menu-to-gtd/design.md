## Context

La page racine `/` est le tableau GTD : elle est rendue par `renderHomePage` (Node) / `render_home_page` (Rust), dans la coque commune `renderShell` / `render_shell`. Aujourd'hui, trois noms désignent cette page sans se recouper : l'entrée du panneau s'appelle « Accueil », le `<h1>` de l'en-tête « Tableau de bord », et la méthode n'apparaît nulle part. L'entrée du panneau vit dans `.sidebar-top`, en tête du panneau, et porte la classe `active` et `aria-current="page"` fournies par `opts.home` / `options.home`.

L'en-tête est rendu par la coque pour toutes les pages : bouton ☰ (`#sidebar-toggle`), `<h1>` du titre, bouton d'ajout de projet sur une page de domaine, puis barre de hiérarchie. C'est une rangée `display: flex` ; `.topbar h1` porte déjà `min-width: 0` et l'ellipse, et `.topbar-add` est poussé à droite par `margin-left: auto`. La page de gestion des passkeys n'utilise pas la coque : elle n'a ni ☰ ni en-tête, donc le raccourci ne la concerne pas.

Le projet entretient deux implémentations du même rendu : `server.js` (référence de développement, couverte par Playwright) et `rust/src/html.rs` (runtime publié par l'image). Toute modification de coque ou de libellé doit être portée à l'identique dans les deux.

Le libellé « Accueil » apparaît aussi dans deux capacités : `home-dashboard` (entrée du panneau) et `domain-navigation` (exigence de repli du panneau), ainsi que dans les renvois de la page « Aide » (« la page d'accueil »). Le titre « Tableau de bord » est vérifié par `test/passkey-flow.js`, deux cas de `test/e2e/home.spec.js` et un cas Rust de `mod http_tests`.

## Goals / Non-Goals

**Goals:**

- Un seul nom pour la page : « GTD » dans le panneau, dans le `<h1>` et dans le titre du document ; « Getting Things Done » en sous-titre de la page.
- Un raccourci « GTD » dans l'en-tête de toutes les pages de la coque, à droite du bouton ☰, donc visible même quand le panneau est replié, sur écran étroit compris.
- Un sous-titre affiché sur la seule page GTD, lisible sans JavaScript et sans interaction.
- Aucune route, aucun format de donnée, aucune dépendance, aucune migration ; comportement identique en Node et en Rust.

**Non-Goals:**

- Ajouter une route `/gtd` ou renommer l'URL `/` : les liens existants (`href="/"`), les favoris et les redirections d'après connexion restent valides.
- Changer le tableau, ses rubriques, ses statuts, son ordre ou ses interactions.
- Ajouter le raccourci à la page de gestion des passkeys, qui n'a pas d'en-tête ni de bouton ☰.
- Ajouter une nouvelle section d'aide documentant le raccourci : la page « Aide » est seulement mise en cohérence avec le nouveau nom.
- Rendre le libellé ou le sous-titre configurables.

## Decisions

### 1. Un seul vocabulaire : « GTD » pour l'entrée, le titre et le raccourci

L'entrée du panneau, le `<h1>` de `/` et le raccourci d'en-tête disent tous « GTD » ; le sous-titre « Getting Things Done » développe le sigle. On supprime ainsi « Accueil » et « Tableau de bord », qui nommaient la même destination de deux façons différentes et ne disaient pas ce qu'on y fait.

L'entrée du panneau garde son ancre exacte (`a.sidebar-link.sidebar-home`, `href="/"`), sa place dans `.sidebar-top` et son état actif : seul le texte change. Le titre du document (`<title>`) suit le titre de page, comme pour toutes les autres pages.

*Alternatives écartées :*

- **Garder « Tableau de bord » en titre** : le sous-titre « Getting Things Done » serait rattaché à un titre qui ne porte pas le nom de la méthode, et le raccourci « GTD » voisinerait un titre différent. Le nom unique rend le retour à la page immédiatement identifiable.
- **Garder « Accueil » dans le panneau et ne renommer que la page** : c'est exactement le décalage que la demande corrige.

### 2. Le sous-titre est rattaché au titre, dans l'en-tête

Le titre et son sous-titre sont regroupés dans un bloc `.topbar-title` :

```html
<div class="topbar-title">
  <h1>GTD</h1>
  <p class="topbar-subtitle">Getting Things Done</p>
</div>
```

Le bloc est un enfant `flex` de l'en-tête (`flex: 1 1 auto; min-width: 0`) : le `<h1>` garde son ellipse quand le nom est long, et le sous-titre reste sous le titre, sans ajouter de ligne dans le contenu principal. Le sous-titre n'est rendu que si `opts.subtitle` / `options.subtitle` est fourni ; seule `renderHomePage` / `render_home_page` le fournit, donc les pages de domaine, Administration et Aide n'en portent pas — et leur en-tête collant ne gagne aucune hauteur.

*Alternatives écartées :*

- **Sous-titre dans `<main>`, au-dessus du tableau** : il serait séparé du titre par la marge et le filet de l'en-tête, et se lirait comme une introduction du tableau plutôt que comme le sous-titre de la page.
- **Un `<h1>` unique « GTD — Getting Things Done »** : sur un écran étroit, la ligne se tronque ou passe à la ligne, et la hiérarchie titre/sous-titre disparaît.
- **Un attribut `title` ou un texte lu par les seuls lecteurs d'écran** : le sous-titre demandé doit être visible.

### 3. Le raccourci est un lien de la coque, juste après ☰

Le raccourci est rendu par `render_shell` / `renderShell`, pas par une page :

```html
<a class="btn topbar-shortcut" href="/" title="Page GTD — Getting Things Done">GTD</a>
```

Il est placé immédiatement après `#sidebar-toggle` et avant le bloc de titre, sur toutes les pages de la coque. Un seul point de rendu suffit donc, aucune page ne peut l'oublier, et il n'est jamais dupliqué par un swap htmx puisqu'il vit hors de `#outline` et hors de `#home-board`.

Sur la page GTD, il porte en plus la classe `active` et `aria-current="page"`, exactement comme l'entrée du panneau : les deux contrôles désignent la page courante et restent cohérents. Sur les autres pages, il ne porte ni l'un ni l'autre.

Le libellé est le texte visible « GTD », doublé d'une infobulle qui développe le sigle. Le lien est un `<a>` natif : il s'active avec `Entrée`, reçoit un anneau de focus visible, et ne demande aucun JavaScript.

*Alternatives écartées :*

- **Réutiliser l'entrée du panneau comme seul accès** : sur un téléphone, le panneau est souvent replié (état persisté) et l'entrée n'est alors pas visible ; le raccourci doit précisément éviter d'ouvrir le panneau.
- **Un bouton avec gestionnaire JavaScript** : un lien suffit pour une navigation, et un `<button>` perdrait le clic milieu, « ouvrir dans un nouvel onglet » et l'activation native au clavier.
- **Masquer le raccourci sur la page GTD** : l'en-tête changerait de structure d'une page à l'autre et le titre se décalerait à gauche ; l'état actif suffit à expliquer la présence du lien sur sa propre page.
- **Une icône seule** : aucune icône existante ne signifie « GTD » sans ambiguïté ; le texte est plus clair et tient dans l'en-tête, y compris à 390 px.

### 4. Le raccourci ne change pas l'état du panneau

Le raccourci est hors du panneau. Le repli automatique après navigation écoute `#sidebar a[href]` (`public/app.js`) : il ne le concerne donc pas, et un clic sur le raccourci laisse l'état du panneau inchangé, exactement comme un lien du contenu (par exemple « Administration » dans l'état vide). Sur un écran étroit, si le panneau était ouvert, la page GTD arrive avec le panneau ouvert et le bouton ☰ permet de le replier ; si le panneau était replié, il le reste. Aucun nouvel état client, aucun nouveau cas particulier.

*Alternative écartée :* étendre l'écouteur de repli au raccourci. Cela ferait replier le panneau par un contrôle qui n'en dépend pas, alors que la règle actuelle — « seules les entrées du panneau replient le panneau » — est simple et testée ; le cas laissé de côté (panneau ouvert, clic sur le raccourci) se résout avec le bouton ☰ déjà présent.

### 5. Mise en forme : un bouton compact aligné sur ☰

`.topbar-shortcut` reprend la forme de `.btn` (bordure, fond de carte, rayon) avec un rembourrage plus court et une police plus petite, pour s'aligner sur la hauteur du bouton ☰ sans le dépasser. Il est `flex: 0 0 auto` : un titre long se tronque au lieu de le pousser hors de l'en-tête. L'état `.active` reprend les couleurs de `.sidebar-link.active` (fond `#eef2ff`, texte `--accent-dark`) et l'anneau de focus est le même que celui de `.topbar-add`. Sur un écran étroit, le rembourrage est réduit pour que ☰, le raccourci et le titre tiennent sur une ligne.

Aucune règle n'est nécessaire sur `.topbar-sticky` : le sous-titre n'existe pas sur les pages de domaine, et le raccourci est un enfant fixe de la rangée, comme le bouton d'ajout de projet.

### 6. Mise en cohérence de l'aide et des capacités

La page « Aide » renvoie à « la page d'accueil » à plusieurs endroits ; ces renvois deviennent « la page GTD », et la section « Ordonner les tâches de l'accueil » devient « Ordonner les tâches GTD ». Le contenu normatif ne change pas, seul le nom de la page citée suit.

Dans les spécifications, l'entrée du panneau est renommée dans `home-dashboard` et dans l'exigence de repli de `domain-navigation`. Le delta `home-dashboard` aligne au passage la phrase de repli du panneau sur le comportement réel décrit par `domain-navigation` (repli après l'ouverture d'une page sur un écran étroit) : l'ancienne rédaction « la sélection ne replie pas le panneau » contredisait l'implémentation et les tests Playwright, et l'exigence est de toute façon réécrite pour le nouveau libellé.

### 7. Deux implémentations, un seul contrat DOM

`server.js` et `rust/src/html.rs` rendent le même bloc de titre, le même raccourci avec les mêmes classes, le même ordre et les mêmes attributs (`active`, `aria-current`, `title`). Node reste la référence couverte par Playwright ; Rust porte les mêmes assertions dans ses tests unitaires. Aucun nom de classe n'est propre à une implémentation.

## Risks / Trade-offs

- **« GTD » deux fois dans l'en-tête de la page GTD** (raccourci puis titre) → le raccourci est un bouton bordé, plus petit, avec l'état actif, et le titre est le grand `<h1>` ; la lecture reste hiérarchisée et l'en-tête ne bouge pas d'une page à l'autre.
- **Panneau ouvert + raccourci sur un téléphone** → la page GTD arrive avec le panneau ouvert, comme après tout clic sur un lien du contenu ; le bouton ☰ le referme. Aucun état supplémentaire n'est introduit.
- **Titre de domaine long** → le bloc de titre rétrécit (`min-width: 0`) et le `<h1>` s'ellipse ; le raccourci et le bouton d'ajout de projet restent fixes (`flex: 0 0 auto`), donc rien n'est poussé hors de l'en-tête.
- **En-tête collant d'une page de domaine** → le bloc de titre n'y porte pas de sous-titre, et la barre de hiérarchie garde `flex: 0 0 100%` ; la hauteur de l'en-tête est inchangée.
- **Ancien cache CSS** → `CACHE_VERSION` est incrémenté ; `style.css` est précaché, donc sans cela l'ancien style du raccourci pourrait être servi.
- **Un nouveau venu ne connaît pas le sigle** → le sous-titre « Getting Things Done » sur la page et l'infobulle du raccourci développent le nom ; le panneau garde l'entrée en tête, à la même place.
- **Deux implémentations** → mêmes classes et même ordre DOM des deux côtés ; le test Rust et le test Playwright couvrent chacun la sienne, comme pour les changements précédents.
- **Tests existants qui citent les anciens libellés** → mis à jour dans le même changement : deux cas de `home.spec.js`, la liste des titres de l'Aide dans `administration.spec.js`, `passkey-flow.js` et le cas Rust de `mod http_tests`.

## Migration Plan

Aucune migration de données : rien n'est persisté de nouveau, aucun champ ni aucune clé ne change, et `/` reste l'URL de la page. Le déploiement est un remplacement d'assets et de rendu, avec incrément de `CACHE_VERSION` pour que les navigateurs reprennent `style.css`. Retour arrière : rétablir les libellés « Accueil » et « Tableau de bord », retirer le sous-titre, le raccourci et leurs styles, puis rétablir les assertions de test ; les données des comptes ne sont pas concernées.

## Open Questions

Aucune question bloquante.
