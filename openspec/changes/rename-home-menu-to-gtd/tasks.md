## 1. Libellés et coque (Node)

- [x] 1.1 Dans `server.js`, remplacer le texte de l'ancre de `renderSidebar` par `GTD` sans toucher à sa classe (`sidebar-link sidebar-home`), à son `href="/"`, à sa position dans `.sidebar-top` ni à ses attributs `active` / `aria-current="page"` fournis par `opts.home`.
- [x] 1.2 Dans `server.js` `renderShell`, rendre un lien `<a class="btn topbar-shortcut" href="/" title="Page GTD — Getting Things Done">GTD</a>` immédiatement après le bouton `#sidebar-toggle` et avant le titre ; lui ajouter ` active` et ` aria-current="page"` quand `opts.home` est vrai.
- [x] 1.3 Dans `server.js` `renderShell`, envelopper le `<h1>` dans `<div class="topbar-title">` et rendre, seulement si `opts.subtitle` est fourni, `<p class="topbar-subtitle">${escapeHtml(opts.subtitle)}</p>` après le `<h1>` ; vérifier que le bouton `.topbar-add` reste poussé à droite et que `#ancestry` reste le dernier enfant de l'en-tête.
- [x] 1.4 Dans `server.js` `renderHomePage`, passer `{ title: 'GTD', subtitle: 'Getting Things Done', home: true }` et vérifier qu'aucune autre page ne fournit `subtitle`.
- [x] 1.5 Vérifier sur les quatre pages de la coque (`/`, `/domaine/<slug>`, `/administration`, `/aide`) que le raccourci est présent exactement une fois, que le sous-titre n'apparaît que sur `/`, et qu'aucun texte « Accueil » ne subsiste dans le HTML rendu.

## 2. Libellés et coque (Rust)

- [x] 2.1 Dans `rust/src/html.rs`, remplacer le texte de l'ancre de `render_sidebar` par `GTD`, classes, `href`, position et attributs d'état inchangés.
- [x] 2.2 Ajouter `pub subtitle: Option<String>` à `ShellOptions` (documenter qu'il n'est fourni que par la page GTD) ; les initialisations existantes utilisant `..Default::default()` n'ont pas à changer.
- [x] 2.3 Dans `rust/src/html.rs` `render_shell`, rendre le raccourci après le bouton ☰, envelopper le `<h1>` dans `.topbar-title`, rendre le sous-titre échappé quand `options.subtitle` est `Some`, et ajouter `active` + `aria-current="page"` quand `options.home` est vrai.
- [x] 2.4 Dans `rust/src/html.rs` `render_home_page`, passer `title: Some("GTD".to_string())` et `subtitle: Some("Getting Things Done".to_string())` ; laisser les autres appels de `render_shell` sans sous-titre.
- [x] 2.5 Vérifier que le DOM produit par `render_shell` et `renderShell` est identique (ordre, classes, attributs) pour la coque des quatre pages.

## 3. Styles et cache

- [x] 3.1 Dans `public/style.css`, styler `.topbar-title` (`display: flex`, `flex-direction: column`, `justify-content: center`, `flex: 1 1 auto`, `min-width: 0`) et `.topbar-subtitle` (marge nulle, petite taille, couleur `--done`, `line-height` serré, pas de débordement horizontal).
- [x] 3.2 Styler `.topbar-shortcut` comme un bouton compact aligné sur ☰ : `flex: 0 0 auto`, rembourrage et police réduits, `text-decoration: none`, bordure et fond de `.btn`, rayon cohérent ; ajouter `.topbar-shortcut.active` (fond `#eef2ff`, texte `--accent-dark`, bordure accent) et `.topbar-shortcut:focus-visible` (anneau 2 px, offset 1 px).
- [x] 3.3 Ajouter au besoin une règle dans `@media (max-width: 640px)` pour que ☰, le raccourci et le titre tiennent sur une ligne à 390 px sans débordement.
- [x] 3.4 Vérifier que les pages de domaine ne gagnent aucune hauteur d'en-tête (pas de sous-titre), que `.topbar-add` reste à droite et que `#ancestry` garde `flex: 0 0 100%`.
- [x] 3.5 Incrémenter `CACHE_VERSION` dans `public/sw.js` de `v26` à `v27` (`style.css` est précaché ; aucun autre actif précaché ne change).

## 4. Page Aide

- [x] 4.1 Dans `server.js` `renderGuidePage`, remplacer les renvois « la page d'accueil » par « la page GTD » (sections « Changer l'état d'une tâche », « Classer les tâches par rubrique GTD », « Classer les domaines ») et renommer la section « Ordonner les tâches de l'accueil » en « Ordonner les tâches GTD ».
- [x] 4.2 Reprendre les mêmes remplacements dans `render_guide_page` (`rust/src/html.rs`) pour que les deux implémentations affichent le même texte.
- [x] 4.3 Vérifier qu'aucune occurrence de « page d'accueil » ni de « de l'accueil » ne subsiste dans la page Aide rendue par l'un ou l'autre serveur.

## 5. Tests

- [x] 5.1 Dans `test/e2e/home.spec.js` 1.1 et 1.5, remplacer l'attente `.topbar h1` → `Tableau de bord` par `GTD`.
- [x] 5.2 Dans `test/e2e/home.spec.js` 1.4, renommer le cas et remplacer l'attente de texte `Accueil` par `GTD` ; conserver les vérifications de position, de non-duplication dans le pied, d'état actif et de navigation.
- [x] 5.3 Ajouter dans `test/e2e/home.spec.js` un cas pour la page GTD : titre `.topbar h1` = `GTD`, sous-titre `.topbar-subtitle` = `Getting Things Done`, placement du sous-titre après le titre dans `.topbar-title`, et titre du document `GTD`.
- [x] 5.4 Ajouter les cas « le sous-titre est absent d'une page de domaine, de l'Administration et de l'Aide » et « l'état vide sans domaine garde le titre et le sous-titre ».
- [x] 5.5 Ajouter un cas pour le raccourci : présent sur `/`, une page de domaine, Administration et Aide ; immédiatement après `#sidebar-toggle` dans l'en-tête (`compareDocumentPosition`) ; `href="/"` ; texte `GTD`.
- [x] 5.6 Vérifier dans ce cas que le raccourci porte `active` et `aria-current="page"` sur `/` seulement, et qu'un clic depuis une page de domaine charge `/`.
- [x] 5.7 Ajouter les cas « le raccourci s'active au clavier » (`focus` puis `Entrée` → `/`), « à 390 px il reste visible et cliquable quand le panneau est replié » (`#sidebar` de largeur 0) et « il ne modifie pas l'état du panneau » (panneau ouvert, clic, état inchangé).
- [x] 5.8 Dans `test/e2e/administration.spec.js` 6.0, remplacer dans la liste des titres de sections `Ordonner les tâches de l'accueil` par `Ordonner les tâches GTD` et vérifier que l'Aide ne contient plus « page d'accueil ».
- [x] 5.9 Dans `test/passkey-flow.js`, remplacer l'assertion `/Tableau de bord/` par une assertion sur `/GTD/` (ou plus précisément `/<h1>GTD<\/h1>/`).
- [x] 5.10 Dans `rust/src/app.rs` `mod http_tests`, remplacer `home.contains("Tableau de bord")` par les assertions `GTD`, sous-titre `Getting Things Done`, présence du raccourci `topbar-shortcut` avec `href="/"` et absence du sous-titre sur une page de domaine.
- [x] 5.11 Ajouter au besoin un cas unitaire dans `rust/src/html.rs` : `render_home_page` contient le titre, le sous-titre et le raccourci actif, et `render_page` ne contient pas de sous-titre.
- [x] 5.12 Lancer `node --check server.js` et `node --check public/app.js`, puis les specs Playwright ciblées (`home`, `administration`, `sidebar`, `passkey-flow`) et corriger toute régression.
- [ ] 5.13 Lancer `cargo fmt --check` et `cargo test --offline` dans `rust/` avec la toolchain locale du dépôt (`RUSTUP_HOME=.rustup`, `CARGO_HOME=.cargo`), puis vérifier le rendu en 1280 px et 390 px (titre, sous-titre, raccourci, état actif, focus, panneau replié).

> Blocage local constaté : `cargo test --offline --no-run` compile les deux binaires de test et `rustfmt --check` passe, mais l'exécution d'un binaire non signé est refusée par la stratégie de contrôle d'application de la machine (`os error 4551`), y compris avec la permission de bac à sable la plus large et après copie dans le dossier temporaire. À rejouer sur une machine qui autorise l'exécution des binaires locaux. Le rendu 1280 px / 390 px est couvert par les cas Playwright 1.4b à 1.4e, 1.6 et 12.6, tous verts.

## 6. Clôture

- [x] 6.1 Lancer `openspec validate "rename-home-menu-to-gtd"` et vérifier que `openspec status --change "rename-home-menu-to-gtd" --json` donne tous les artefacts en `done`.
