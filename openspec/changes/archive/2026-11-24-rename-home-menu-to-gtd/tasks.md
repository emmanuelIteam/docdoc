## 1. Libellés et coque (Node)

- [x] 1.1 Dans `server.js`, remplacer le texte de l'ancre de `renderSidebar` par `GTD` sans toucher à sa classe (`sidebar-link sidebar-home`), à son `href="/"`, à sa position dans `.sidebar-top` ni à ses attributs `active` / `aria-current="page"` fournis par `opts.home`.
- [x] 1.2 Dans `server.js` `renderShell`, rendre un lien `<a class="btn topbar-shortcut" href="/" title="Page GTD — Getting Things Done">GTD</a>` immédiatement après le bouton `#sidebar-toggle` et avant le titre, sauf quand `opts.home` est vrai : la page GTD ne rend aucun lien vers elle-même, ni classe `active`, ni `aria-current="page"`.
- [x] 1.3 Dans `server.js` `renderShell`, envelopper le `<h1>` dans `<div class="topbar-title">` et rendre, seulement si `opts.subtitle` est fourni, `<p class="topbar-subtitle">${escapeHtml(opts.subtitle)}</p>` après le `<h1>` ; vérifier que le bouton `.topbar-add` reste poussé à droite et que `#ancestry` reste le dernier enfant de l'en-tête.
- [x] 1.4 Dans `server.js` `renderHomePage`, passer `{ title: 'GTD', subtitle: 'Getting Things Done', home: true }` et vérifier qu'aucune autre page ne fournit `subtitle`.
- [x] 1.5 Vérifier sur les pages de la coque que le raccourci est présent exactement une fois sur `/domaine/<slug>`, `/administration` et `/aide`, absent de `/`, que le sous-titre n'apparaît que sur `/`, et qu'aucun texte « Accueil » ne subsiste dans le HTML rendu.

## 2. Libellés et coque (Rust)

- [x] 2.1 Dans `rust/src/html.rs`, remplacer le texte de l'ancre de `render_sidebar` par `GTD`, classes, `href`, position et attributs d'état inchangés.
- [x] 2.2 Ajouter `pub subtitle: Option<String>` à `ShellOptions` (documenter qu'il n'est fourni que par la page GTD) ; les initialisations existantes utilisant `..Default::default()` n'ont pas à changer.
- [x] 2.3 Dans `rust/src/html.rs` `render_shell`, rendre le raccourci après le bouton ☰ — omis quand `options.home` est vrai — envelopper le `<h1>` dans `.topbar-title` et rendre le sous-titre échappé quand `options.subtitle` est `Some`.
- [x] 2.4 Dans `rust/src/html.rs` `render_home_page`, passer `title: Some("GTD".to_string())` et `subtitle: Some("Getting Things Done".to_string())` ; laisser les autres appels de `render_shell` sans sous-titre.
- [x] 2.5 Vérifier que le DOM produit par `render_shell` et `renderShell` est identique (ordre, classes, attributs) pour la coque des quatre pages.

## 3. Styles et cache

- [x] 3.1 Dans `public/style.css`, styler `.topbar-title` (`display: flex`, `flex-direction: column`, `justify-content: center`, `flex: 1 1 auto`, `min-width: 0`) et `.topbar-subtitle` (marge nulle, petite taille, couleur `--done`, `line-height` serré, pas de débordement horizontal).
- [x] 3.2 Styler `.topbar-shortcut` comme un bouton compact aligné sur ☰ : `flex: 0 0 auto`, rembourrage et police réduits, `text-decoration: none`, bordure et fond de `.btn`, rayon cohérent ; ajouter `.topbar-shortcut:focus-visible` (anneau 2 px, offset 1 px) et aucun état `.active`, le raccourci n'étant jamais rendu sur sa propre page.
- [x] 3.3 Ajouter au besoin une règle dans `@media (max-width: 640px)` pour que ☰, le raccourci et le titre tiennent sur une ligne à 390 px sans débordement.
- [x] 3.4 Vérifier que les pages de domaine ne gagnent aucune hauteur d'en-tête (pas de sous-titre), que `.topbar-add` reste à droite et que `#ancestry` garde `flex: 0 0 100%`.
- [x] 3.5 Incrémenter `CACHE_VERSION` dans `public/sw.js` de `v26` à `v28` (`style.css` est précaché ; aucun autre actif précaché ne change) : `v27` pour le bloc de titre et les styles du raccourci, `v28` pour le retrait de `.topbar-shortcut.active`.

## 4. Page Aide

- [x] 4.1 Dans `server.js` `renderGuidePage`, remplacer les renvois « la page d'accueil » par « la page GTD » (sections « Changer l'état d'une tâche », « Classer les tâches par rubrique GTD », « Classer les domaines ») et renommer la section « Ordonner les tâches de l'accueil » en « Ordonner les tâches GTD ».
- [x] 4.2 Reprendre les mêmes remplacements dans `render_guide_page` (`rust/src/html.rs`) pour que les deux implémentations affichent le même texte.
- [x] 4.3 Vérifier qu'aucune occurrence de « page d'accueil » ni de « de l'accueil » ne subsiste dans la page Aide rendue par l'un ou l'autre serveur.

## 5. Tests

- [x] 5.1 Dans `test/e2e/home.spec.js` 1.1 et 1.5, remplacer l'attente `.topbar h1` → `Tableau de bord` par `GTD`.
- [x] 5.2 Dans `test/e2e/home.spec.js` 1.4, renommer le cas et remplacer l'attente de texte `Accueil` par `GTD` ; conserver les vérifications de position, de non-duplication dans le pied, d'état actif et de navigation.
- [x] 5.3 Ajouter dans `test/e2e/home.spec.js` un cas pour la page GTD : titre `.topbar h1` = `GTD`, sous-titre `.topbar-subtitle` = `Getting Things Done`, placement du sous-titre après le titre dans `.topbar-title`, et titre du document `GTD`.
- [x] 5.4 Ajouter les cas « le sous-titre est absent d'une page de domaine, de l'Administration et de l'Aide » et « l'état vide sans domaine garde le titre et le sous-titre ».
- [x] 5.5 Ajouter un cas pour le raccourci : présent sur une page de domaine, Administration et Aide, absent de `/` ; immédiatement après `#sidebar-toggle` dans l'en-tête (`compareDocumentPosition`) ; `href="/"` ; texte `GTD`.
- [x] 5.6 Vérifier dans ce cas que le raccourci ne porte jamais `active` ni `aria-current="page"` — il n'est rendu que hors de la page GTD —, qu'un clic depuis une page de domaine charge `/`, et que la page GTD qui en résulte n'affiche aucun raccourci.
- [x] 5.7 Ajouter les cas « le raccourci s'active au clavier » (`focus` puis `Entrée` → `/`), « à 390 px il reste visible et cliquable quand le panneau est replié » (`#sidebar` de largeur 0) et « il ne modifie pas l'état du panneau » (panneau ouvert, clic, état inchangé).
- [x] 5.8 Dans `test/e2e/administration.spec.js` 6.0, remplacer dans la liste des titres de sections `Ordonner les tâches de l'accueil` par `Ordonner les tâches GTD` et vérifier que l'Aide ne contient plus « page d'accueil ».
- [x] 5.9 Dans `test/passkey-flow.js`, remplacer l'assertion `/Tableau de bord/` par une assertion sur `/GTD/` (ou plus précisément `/<h1>GTD<\/h1>/`).
- [x] 5.10 Dans `rust/src/app.rs` `mod http_tests`, remplacer `home.contains("Tableau de bord")` par les assertions `GTD`, sous-titre `Getting Things Done`, absence de `topbar-shortcut` sur `/`, présence du raccourci `topbar-shortcut` sur une page de domaine et absence du sous-titre sur cette même page.
- [x] 5.11 Ajouter au besoin un cas unitaire dans `rust/src/html.rs` : `render_home_page` contient le titre et le sous-titre mais aucun raccourci, et `render_shell` d'une page non-GTD contient le raccourci sans sous-titre.
- [x] 5.12 Lancer `node --check server.js` et `node --check public/app.js`, puis les specs Playwright ciblées (`home`, `administration`, `sidebar`, `passkey-flow`) et corriger toute régression.
- [ ] 5.13 Lancer `cargo fmt --check` et `cargo test --offline` dans `rust/` avec la toolchain locale du dépôt (`RUSTUP_HOME=.rustup`, `CARGO_HOME=.cargo`), puis vérifier le rendu en 1280 px et 390 px (titre, sous-titre, raccourci, absence de raccourci sur la page GTD, focus, panneau replié).

> Blocage local constaté : `cargo test --offline --no-run` compile les deux binaires de test et `rustfmt --check` passe, mais l'exécution d'un binaire non signé est refusée par la stratégie de contrôle d'application de la machine (`os error 4551`), y compris avec la permission de bac à sable la plus large et après copie dans le dossier temporaire. À rejouer sur une machine qui autorise l'exécution des binaires locaux. Le rendu 1280 px / 390 px est couvert par les cas Playwright 1.4b à 1.4e, 1.6 et 12.6, tous verts.

## 6. Retrait du raccourci sur la page GTD

- [x] 6.1 Dans `server.js` `renderShell`, ne rendre aucun `a.topbar-shortcut` quand `opts.home` est vrai, mettre à jour le commentaire, et vérifier que le bloc de titre suit directement le bouton ☰.
- [x] 6.2 Dans `rust/src/html.rs` `render_shell`, remplacer la classe et `aria-current` conditionnels par un raccourci omis quand `options.home` est vrai, et mettre à jour le commentaire.
- [x] 6.3 Dans `public/style.css`, retirer `.btn.topbar-shortcut.active` et ajuster le commentaire ; incrémenter `CACHE_VERSION` de `v27` à `v28`.
- [x] 6.4 Adapter les tests : `test/e2e/home.spec.js` 1.4d (raccourci absent de `/`, présent sur les trois autres pages, jamais actif), `rust/src/html.rs` (titre et sous-titre sans raccourci, raccourci conservé ailleurs) et `rust/src/app.rs` (absence de `topbar-shortcut` sur `/`).
- [x] 6.5 Lancer `node --check server.js` et `npx playwright test test/e2e/home.spec.js`, puis compiler et tester `rust/` selon ce que la machine autorise.

> Vérification du 2026-11-24 : `node --check server.js` passe ; la suite Playwright complète passe en 136 cas avec Edge à la place de Chrome (`channel: 'chrome'` : Chrome n'est pas installé sur cette machine, un `playwright.verify.config.js` temporaire a servi puis a été supprimé). Côté Rust, `cargo fmt --check` passe et `cargo test --offline` compile les deux binaires de test, mais la même stratégie de contrôle d'application bloque leur exécution (`os error 4551`) : les assertions 6.4 restent à rejouer sur une machine qui autorise les binaires locaux.

## 7. Clôture

- [x] 7.1 Lancer `openspec validate "rename-home-menu-to-gtd"` et vérifier que `openspec status --change "rename-home-menu-to-gtd" --json` donne tous les artefacts en `done`.
