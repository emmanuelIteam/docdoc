## 1. Version dans l'application

- [x] 1.1 Dans `server.js`, lire `APP_VERSION` au chargement à côté de `PORT` et `AUTHORIZED_EMAILS` : `String(process.env.APP_VERSION || '').trim()`, documenté comme le tag de l'image de release (vide en développement).
- [x] 1.2 Dans `renderGuidePage`, rendre à la fin du bloc `.guide` une ligne `<p class="guide-version">Version …</p>`, avec le tag quand il est défini et « développement » sinon, la valeur passée par `escapeHtml`.
- [x] 1.3 Vérifier qu'aucun autre point de rendu (`renderShell`, `renderHomePage`, page de domaine, Administration, gestion des passkeys) ne porte la ligne de version : le test d'intégration le contrôle sur `/administration` et `/domaine/voyages`.

## 2. Image et configuration

- [x] 2.1 Déclarer `ARG APP_VERSION=""` puis `ENV APP_VERSION=$APP_VERSION` dans l'étape finale `node:22-alpine` du `Dockerfile`, avec un commentaire renvoyant à la pipeline ; l'étape `assets` n'est pas touchée.
- [x] 2.2 Vérifier la transmission par un build local : `docker build --build-arg APP_VERSION=9.9.9 -t docdoc:version-check .` produit une image dont le conteneur rapporte `APP_VERSION=9.9.9` (`docker run --rm … node -p "process.env.APP_VERSION"`), et un build sans argument laisse la variable vide (`[]`). Les deux images de contrôle ont été supprimées après vérification.
- [x] 2.3 Documenter `APP_VERSION` dans `.env.example` (section « Application ») comme une valeur normalement posée par l'image de release, vide en développement local.

## 3. Style et service worker

- [x] 3.1 Ajouter dans `public/style.css`, section « User guide page », la règle `.guide-version` : filet `--border` en haut, couleur `--done`, taille réduite, marges cohérentes avec `.guide-section`.
- [x] 3.2 `CACHE_VERSION` de `public/sw.js` est incrémenté dans l'arbre de travail (`v15` au moment de l'application, par le changement voisin `collapse-sidebar-on-page-navigation` qui touche aussi `style.css`) : l'ajout CSS est couvert par cet incrément, sans second bump pour la même livraison.

## 4. Tests

- [x] 4.1 Dans `test/passkey-flow.js`, poser `process.env.APP_VERSION = '1.2.3'` avec les autres variables lues au chargement du serveur.
- [x] 4.2 Dans le même fichier, compléter le contrôle de `/aide` : la page contient `class="guide-version">Version 1.2.3</`, en fin de manuel.
- [x] 4.3 Vérifier dans le même contrôle que `/administration` et `/domaine/voyages` ne contiennent pas `guide-version`.
- [x] 4.4 Dans `test/e2e/task-links.spec.js`, compléter le cas 6.3 qui visite `/aide` : le serveur enfant reçoit `APP_VERSION=''`, donc la ligne affiche « Version développement ».
- [x] 4.5 Échappement : vérifié par relecture (la valeur passe par `escapeHtml`) plutôt que par un test dédié — `APP_VERSION` est une variable d'environnement posée par l'opérateur, et le cas « balisage » ne peut pas être produit dans le même processus que le test d'intégration, qui fixe une seule valeur.

## 5. Documentation

- [x] 5.1 Dans `Readme.md`, section « Ce que fait le pipeline », préciser que l'étape finale conserve le tag dans `APP_VERSION` et que la page Aide l'affiche (le contrôle de la pipeline reste `/sw.js`).
- [x] 5.2 Mentionner la page Aide dans « Déploiement manuel » (mention « Version développement » sans `--build-arg`) et dans « Retour arrière ».

## 6. Vérifications

- [x] 6.1 `node --check` sur `server.js`, `test/passkey-flow.js`, `test/e2e/task-links.spec.js` et `public/sw.js`.
- [x] 6.2 `node test/passkey-flow.js` : 41 vérifications passées, dont les trois nouvelles.
- [x] 6.3 `npx playwright test test/e2e/task-links.spec.js --grep "6.3 un lien est rendu"` : 1 test passé.
- [x] 6.4 `openspec validate show-version-on-help-page --strict`.
