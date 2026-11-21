## 1. Format, export et validation (serveur Node)

- [x] 1.1 Ajouter dans `server.js` les constantes du format (`BACKUP_FORMAT = 'docdoc-backup'`, `BACKUP_VERSION = 1`, `BACKUP_MAX_BYTES = 10 * 1024 * 1024`) et un helper `readArchivedDomains(space)` qui lit chaque clé de `storage.listArchiveKeys(space.userId)`, ignore les objets illisibles ou non conformes comme `listArchivedDomains`, normalise chaque domaine avec `normalizeDomain`, répare son `displayOrder` avec `ensureDisplayOrder` et retourne les objets triés par nom puis id.
- [x] 1.2 Ajouter `exportBackup(space)` : attendre `space.writeQueue`, construire un objet `{ format, version, exportedAt: new Date().toISOString(), themes, domains, archives }` à partir de `space.themes` (ordre de la palette) et des domaines de `space.domains` (tri par `order` puis nom), sérialiser chaque domaine et chaque archive avec `domainPayload` après avoir réparé `displayOrder` sans le persister ; ne jamais inclure `account.json`, l'email ni les passkeys.
- [x] 1.3 Ajouter `validateBackup(doc)` qui vérifie, sans écrire : objet racine, `format`, `version`, présence des trois tableaux, formes des thèmes, des domaines, des archives et des nœuds (`projects` tableau, nœuds avec id/titre/enfants, statut absent ou dans `todo|in_progress|done`), unicité des ids entre domaines et archives et des ids de nœuds dans un domaine, unicité des slugs entre domaines actifs, et libellés tous rattachés à un thème du document. Retourner `{ ok: true, value }` avec les `displayOrder` réparés, ou `{ ok: false, message }` avec un message français désignant le premier problème. Ne pas s'appuyer sur `normalizeDomain` pour la validation : il filtre silencieusement les nœuds et les libellés invalides.
- [x] 1.4 Ajouter `restoreBackup(space, value)` : lister les clés `domains/` et `archive/` actuelles, écrire `themes.json` puis chaque domaine et chaque archive avec `storage.writeJson`, puis supprimer les clés absentes du document avec `storage.deleteObject`. Ne jamais toucher aux clés du compte autres que ces trois familles. Retourner les compteurs écrits. La fonction doit pouvoir être relancée sans effet de bord.

## 2. Routes (serveur Node)

- [x] 2.1 Ajouter `GET /api/backup` après le garde d'accès et `withSpace` : en-têtes `Content-Type: application/json; charset=utf-8`, `Content-Disposition: attachment; filename="docdoc-sauvegarde-<AAAA-MM-JJ>.json"` et `Cache-Control: no-store`, corps `JSON.stringify(await exportBackup(req.space), null, 2)` suivi d'un saut de ligne.
- [x] 2.2 Monter sur `/api/restore` un parseur `express.raw({ type: 'application/json', limit: '10mb' })` avant le `express.json()` global (dont la limite de 100 ko reste inchangée), avec un gestionnaire d'erreur qui répond 413 en texte clair pour `entity.too.large`.
- [x] 2.3 Ajouter `POST /api/restore` : refuser sans `req.query.confirm === 'replace'` (422), refuser un type de contenu autre que `application/json` (415), refuser un corps vide (400), refuser un corps dépassant `BACKUP_MAX_BYTES` (413), parser le JSON après avoir retiré un éventuel BOM (400 en cas d'échec), valider avec `validateBackup` (422), restaurer avec `restoreBackup`, répondre 500 en cas d'échec d'écriture, invalider l'espace avec `invalidateSpace(req.session.userId)` dans tous les cas, puis rediriger en 303 vers `/administration?restaure=ok#admin-backup` en cas de succès.
- [x] 2.4 Faire accepter à `renderAdminPage(space, opts)` un drapeau `restored` (calculé dans la route par `req.query.restaure === 'ok'`) et rendre, dans la section Sauvegarde, le message de succès statique ; ne jamais insérer la valeur du paramètre dans le HTML.

## 3. Interface d'administration

- [x] 3.1 Ajouter dans `renderAdminPage` la section `#admin-backup` après la section Archives : titre « Sauvegarde », encart expliquant le contenu du fichier et l'exclusion de l'email et des passkeys, lien `<a class="btn" href="/api/backup" download>Exporter mes données</a>`, formulaire de restauration dans un `<details class="admin-restore">` avec `#restore-form`, `#restore-file` (`accept=".json,application/json"`, `required`), `#restore-confirm` (`required`), un bouton d'envoi désactivé par défaut et `#restore-status`, plus un `<noscript>` indiquant que la restauration nécessite JavaScript.
- [x] 3.2 Ajouter dans `public/app.js` l'activation du bouton et l'écoute de `submit` de `#restore-form` : contrôler la case et la taille du fichier (10 Mo), lire le fichier avec `file.text()`, envoyer `fetch('/api/restore?confirm=replace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text })`, désactiver le bouton pendant l'envoi, afficher le texte d'erreur du serveur dans `#restore-status` (avec `role="alert"`) en cas de refus, et naviguer vers `/administration?restaure=ok#admin-backup` en cas de succès.
- [x] 3.3 Ajouter dans `public/style.css` les styles de `.admin-hint`, `.admin-notice`, `.admin-restore`, de la ligne de confirmation et de `#restore-status`, avec une mise en page pleine largeur du champ de fichier et du bouton sous 640 px.
- [x] 3.4 Incrémenter `CACHE_VERSION` dans `public/sw.js` (`app.js` et `style.css` changent).

## 4. Aide et documentation

- [x] 4.1 Ajouter dans `renderGuidePage` une section « Sauvegarder et restaurer ses données » après « Gérer les thèmes et les domaines » : contenu du fichier (thèmes, domaines actifs, archives), exclusion de l'email et des passkeys, remplacement intégral lors de la restauration, et lien vers la section Sauvegarde de `/administration`.
- [x] 4.2 Ajouter dans `docs/exploitation.md`, après « Où vivent les données », une section « Sauvegarde et restauration » décrivant le format version 1, les routes `GET /api/backup` et `POST /api/restore?confirm=replace`, la limite de 10 Mo, le remplacement intégral, les exclusions (`account.json`, passkeys, index) et l'absence d'historique côté serveur.

## 5. Portage Rust

- [x] 5.1 Ajouter dans `rust/src/app.rs` les routes protégées `GET /api/backup` et `POST /api/restore`, avec `DefaultBodyLimit::max(10 * 1024 * 1024)` appliqué à la seule route de restauration ; conserver les codes 400, 413, 415, 422 et 500 et le même message de succès.
- [x] 5.2 Implémenter l'export : lire les archives complètes avec `list_archive_keys` et `read_json`, construire le document indenté avec `serde_json`, réparer `display_order` avec `ensure_display_order`, trier domaines et archives de façon déterministe, et poser les en-têtes `Content-Type`, `Content-Disposition` et `Cache-Control`.
- [x] 5.3 Implémenter `validate_backup` et la restauration : mêmes règles que côté Node (ne pas se contenter de `normalize_domain`, qui filtre les nœuds et libellés invalides), écriture de `themes.json` puis des domaines et archives via `state.storage`, suppression des clés absentes, puis `state.invalidate_space(&auth.user_id)` et redirection vers `/administration?restaure=ok#admin-backup`.
- [x] 5.4 Étendre `html::render_admin_page` avec la section `#admin-backup` (mêmes ids et classes que `server.js`) et le message de succès quand la requête porte `restaure=ok`, et `html::render_guide_page` avec la section « Sauvegarder et restaurer ses données ».

## 6. Tests

- [x] 6.1 Ajouter `test/e2e/backup.spec.js` sur le modèle de `test/e2e/administration.spec.js` (serveur enfant, deux comptes autorisés, données jetables) : un compte avec plusieurs thèmes, plusieurs domaines à plusieurs profondeurs (statuts variés, ligne repliée, ordre d'affichage personnalisé) et au moins une archive ; un second compte avec un domaine.
- [x] 6.2 Couvrir l'export : `GET /api/backup` répond 200 avec `Content-Disposition` et `Cache-Control`, le JSON porte `format`, `version: 1`, `exportedAt` et les trois tableaux, les thèmes/domaines/archives attendus sont présents avec leurs ids, slugs, libellés, statuts et ordres, l'ordre est déterministe, et aucun champ email/passkey n'apparaît.
- [x] 6.3 Couvrir la restauration : modifier l'espace (renommer, supprimer, ajouter), restaurer le fichier exporté, vérifier le retour exact à l'état initial (thèmes, domaines, archives, slugs, ordres, statuts, libellés, ordre d'affichage), l'arrivée sur `/administration?restaure=ok#admin-backup` et le message de succès.
- [x] 6.4 Couvrir les refus sans modification : absence de `confirm=replace`, corps non JSON, `Content-Type` incorrect, JSON invalide, format inconnu, `version: 2`, id dupliqué, slug dupliqué, libellé orphelin, statut inconnu et corps supérieur à 10 Mo ; vérifier les codes 400, 413, 415 et 422.
- [x] 6.5 Couvrir le confinement et les identifiants : la restauration du compte A ne crée, ne modifie ni ne supprime aucun objet du compte B ; `account.json` et les passkeys du compte A restent inchangés et la session reste valide après la restauration.
- [x] 6.6 Couvrir l'interface : section présente après Archives, export fonctionnel sans JavaScript, bouton de restauration désactivé sans JavaScript et note affichée, envoi impossible sans la case de confirmation, erreur du serveur affichée pour un fichier invalide, et message de succès pour un fichier valide.
- [x] 6.7 Ajouter dans `rust/src/app.rs` des tests de routeur : export (en-têtes et contenu), restauration (remplacement, archives, message), refus (400, 413, 415, 422) et invalidation de l'espace en cache.

## 7. Vérifications

- [x] 7.1 Lancer `node --check server.js` et `node --check public/app.js`.
- [x] 7.2 Lancer `npm test` et `npm run test:e2e`.
- [x] 7.3 Lancer `cd rust && cargo fmt --check && cargo test` (et `cargo clippy --all-targets` si disponible).
- [x] 7.4 Vérifier à l'écran la section Sauvegarde en 1280 px et en 390 px (export, restauration, erreurs, succès), puis vérifier la parité : exporter depuis le serveur Node et restaurer le même fichier sur le serveur Rust, et inversement.
- [x] 7.5 Lancer `openspec validate add-json-backup-restore --strict` avant de clore le changement.
