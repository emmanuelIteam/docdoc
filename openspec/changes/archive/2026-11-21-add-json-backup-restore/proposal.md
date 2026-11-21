## Why

Les données d'un espace — thèmes, domaines, archives — ne vivent que dans le bucket S3 du compte. L'application n'offre aujourd'hui aucun moyen d'en emporter une copie ni d'en restaurer une : une suppression accidentelle, un espace recréé après la perte de toutes les passkeys ou un changement de stockage ne peuvent être rattrapés qu'en intervenant à la main sur le bucket. Un export JSON téléchargeable et une restauration depuis ce fichier donnent à l'utilisateur une sauvegarde qu'il contrôle, lisible et versionnée, sans dépendre d'un accès à l'infrastructure.

## What Changes

- **Nouvelle section « Sauvegarde » dans la page Administration**, après Archives : un encart explicatif, un lien de téléchargement et un formulaire de restauration replié.
- **`GET /api/backup`** : télécharge un document JSON unique contenant les thèmes (dans l'ordre de la palette), les domaines actifs et les archives du compte de la session — identifiants, slugs, ordres, libellés, statuts, état de repli et ordre d'affichage compris. L'adresse email, les passkeys et les index de compte n'y figurent pas.
- **Format `docdoc-backup` version 1** : `format`, `version`, `exportedAt`, `themes`, `domains`, `archives`. Le document est autoportant et conserve les identifiants et les slugs pour que les liens de tâche internes (`/domaine/<slug>?reveal=<id>#node-<id>`) continuent de fonctionner après une restauration.
- **`POST /api/restore?confirm=replace`** : restaure l'espace depuis un tel document. La restauration **remplace intégralement** les thèmes, domaines actifs et archives du compte ; les objets absents du fichier sont supprimés. Elle exige une confirmation explicite, valide tout le document avant la moindre écriture, écrit les nouveaux objets avant de supprimer les absents, puis recharge l'espace.
- **Validation stricte** : format et version connus, structure des tableaux, des domaines, des archives et des tâches, identifiants uniques, slugs actifs uniques, libellés rattachés à un thème du document, statuts valides, corps limité à 10 Mo. Un fichier invalide est refusé en bloc (400, 413, 415 ou 422) sans aucune modification.
- **Interface** : l'export est un simple lien, utilisable sans JavaScript ; la restauration lit le fichier dans le navigateur, l'envoie en JSON, affiche l'erreur du serveur en cas de refus et revient sur la page Administration avec un message de succès. Sans JavaScript, la section indique que la restauration en dépend.
- **Aucune rupture de format ni de route existante** : `account.json`, les index email/passkey, les clés `users/{userId}/domains/`, `archive/` et `themes.json` gardent leur forme. L'export ne fait que lire l'espace ; la restauration réécrit ces mêmes objets.
- **Parité Node et Rust** : les mêmes routes, le même format et les mêmes règles s'appliquent au serveur Node de référence et au portage Rust qui sert la production.

## Capabilities

### New Capabilities

- `data-backup` : export JSON de l'espace, format versionné, restauration par remplacement intégral, validation et section de la page Administration.

### Modified Capabilities

- `space-administration` : la page gagne une section Sauvegarde après ses trois sections de gestion (Thèmes, Domaines, Archives) ; elle porte l'export et la restauration.
- `user-guide` : une section « Sauvegarder et restaurer ses données » documente le fichier, ses exclusions, le remplacement et l'emplacement des commandes.

## Impact

- **`server.js`** : routes `GET /api/backup` et `POST /api/restore` ; helpers `exportBackup(space)`, `readArchivedDomains(space)`, `validateBackup(doc)` et `restoreBackup(space, doc)` ; parseur JSON dédié avec limite de 10 Mo ; invalidation de l'espace après restauration ; section dans `renderAdminPage` (message de succès via `?restaure=ok`) et dans `renderGuidePage`.
- **`storage.js`** : aucune nouvelle clé ni nouveau format d'objet. Réutilisation de `listDomainKeys`, `listArchiveKeys`, `readJson`, `writeJson` et `deleteObject`.
- **`public/app.js`** : envoi du fichier de restauration par `fetch` en `application/json`, contrôle de la confirmation, message d'erreur en cas de refus et rechargement de la page en cas de succès.
- **`public/style.css`** : styles de la section Sauvegarde (encart, formulaire replié, case de confirmation, messages d'erreur et de succès), adaptation aux écrans étroits.
- **`public/sw.js`** : incrément de `CACHE_VERSION` (`app.js` et `style.css` changent).
- **`rust/src/app.rs`, `rust/src/html.rs`, `rust/src/model.rs`** : routes `GET /api/backup` et `POST /api/restore`, limite de corps dédiée, mêmes validations, même rendu de section et même message de succès, invalidation de l'espace en cache.
- **`docs/exploitation.md`** : section « Sauvegarde et restauration » (format, routes, exclusions, remplacement, limite).
- **Specs** : nouvelle capacité `data-backup` ; `space-administration` et `user-guide` modifiées ; `domain-storage`, `theme-storage` et `user-space` inchangées.
- **Tests** : nouveau parcours Playwright `test/e2e/backup.spec.js` (export, restauration, confirmation, refus, confinement) ; tests de routeur Rust ; les suites existantes restent vertes.
- **Retour arrière** : retirer les deux routes, la section et les styles ; aucune donnée n'est concernée, puisque le format persisté ne change pas.
