## Why

Le panneau latéral classe aujourd'hui les domaines en groupes de thèmes : un en-tête par thème, puis la section « Sans thème ». Ce classement impose une lecture par étiquette, fait apparaître un domaine plusieurs fois lorsqu'il porte plusieurs thèmes et allonge la liste sans montrer l'ordre réel des domaines. L'utilisateur veut une liste à un seul niveau, dont il maîtrise l'ordre.

## What Changes

- **Liste plate dans le panneau** : une entrée par domaine, sans en-tête de thème, sans section « Sans thème » et sans pastille de thème. Un domaine qui porte zéro, un ou plusieurs thèmes apparaît exactement une fois.
- **Ordre manuel partagé** : la liste suit le champ `order` déjà persisté, le même ordre que la table des domaines d'Administration et que la liste de la page d'accueil. Aucun nouveau champ, aucune migration.
- **Classement direct dans le panneau** : chaque entrée gagne deux contrôles ↑/↓ discrets qui déplacent le domaine d'un cran. Le déplacement reste sur la page courante et ne replie pas le panneau sur un écran étroit. Les flèches ↑/↓ d'Administration restent disponibles et agissent sur le même ordre.
- **Panneau toujours sans gestion** : le panneau n'offre aucun contrôle de création, renommage, suppression ou archivage d'un domaine ou d'un thème ; il n'ajoute que le classement des domaines.
- **Thèmes conservés comme étiquettes** : la barre d'étiquettes, les pastilles, la matrice et la gestion des thèmes dans Administration sont inchangées. Seul le regroupement du panneau disparaît, et la réponse de la barre d'étiquettes ne rafraîchit plus le panneau, qui ne dépend plus des étiquettes.
- **Aide** : la page Aide documente le classement des domaines depuis le panneau.
- **BREAKING** pour l'affichage : les en-têtes de thème et la section « Sans thème » du panneau disparaissent ; l'ordre des thèmes ne change plus l'ordre du panneau.

## Capabilities

### New Capabilities

- (aucune)

### Modified Capabilities

- `domain-navigation` : la liste groupée par thème devient une liste plate ordonnée manuellement, avec des contrôles de classement dans le panneau ; le panneau reste sans contrôle de gestion des domaines et des thèmes.
- `theme-management` : l'ordre des thèmes ne gouverne plus des groupes du panneau (seulement la matrice et le sélecteur d'étiquettes) ; la barre d'étiquettes ne rafraîchit plus le panneau ; la suppression d'un thème ne le retire plus d'un groupe du panneau.
- `user-guide` : la page Aide documente le classement manuel des domaines depuis le panneau.

## Impact

- **`server.js` et portage Rust (`rust/src/html.rs`, `rust/src/app.rs`)** : `renderSidebarNav` rend une liste plate à partir de `space.domainList` ; `renderSidebar` transmet le chemin de la page courante aux formulaires de classement ; la route existante `POST /api/domains/:id/move` accepte un `returnTo` local validé et redirige vers la page courante ; la route des étiquettes ne renvoie plus le panneau en *out-of-band* ; texte de la page Aide complété. Le runtime publié étant le binaire Rust `/app/docdoc`, le même comportement y est porté à l'identique.
- **`public/style.css`** : styles de la ligne de domaine et des contrôles de classement ; suppression des styles `.theme-group*` devenus inutiles ; `.theme-dot` reste utilisé par la matrice et les étiquettes.
- **`public/sw.js`** : incrément de `CACHE_VERSION` (seule `style.css` change parmi les fichiers précachés).
- **Tests** : `test/e2e/administration.spec.js` (plus de groupes de thèmes ; 6.1, 6.2 et 6.7 réécrits), `test/e2e/sidebar.spec.js` (scénario de classement depuis le panneau, sur écran large et étroit), `test/e2e/administration.spec.js` 6.0 (liste des sections de l'Aide), et test Rust `sidebar_is_flat_and_reorder_returns_to_the_page`.
- **Aucune nouvelle dépendance, aucune nouvelle route, aucune migration de données** : `order` et `labels` gardent leur format ; le retour arrière se limite au balisage, aux styles, au texte de l'Aide et aux tests.
