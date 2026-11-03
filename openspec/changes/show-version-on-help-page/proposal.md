## Why

Personne ne peut dire, depuis l'application, quelle version est réellement servie : le tag de release n'existe aujourd'hui que dans le nom du cache du service worker (`/sw.js`), un fichier qu'on ne consulte pas au quotidien. Pour vérifier qu'une release est bien déployée, il faut passer par la pipeline, la console Scaleway ou une requête sur `/sw.js`. La page « Aide » est le seul endroit de l'interface où une information de version peut vivre sans encombrer les pages de travail ; elle est déjà la page « à propos » de fait.

## What Changes

- **La page « Aide » affiche, en bas de son contenu, une ligne discrète « Version <tag> »** rendue côté serveur, dans le même bloc que les sections du manuel.
- **Le tag vient du build de l'image.** L'étape finale du `Dockerfile` expose au runtime l'argument `APP_VERSION` que la pipeline de release passe déjà à l'étape des assets (celui qui est inscrit dans `CACHE_VERSION` de `sw.js`). Une image de release embarque donc son tag ; aucun réglage du conteneur Scaleway n'est nécessaire.
- **Un build sans tag se présente comme tel.** Quand `APP_VERSION` est absent (build local, `docker compose up`, `pnpm start`), la ligne affiche « Version développement » : on voit immédiatement qu'on n'est pas sur une release, plutôt qu'un numéro inventé.
- **Le tag est affiché comme du texte**, échappé comme toute valeur insérée dans une page ; il n'est jamais interprété comme du balisage.
- **Aucune autre page n'affiche la version**, et aucune route, aucun stockage, aucune donnée ne change.

## Capabilities

### New Capabilities

- (aucune)

### Modified Capabilities

- `user-guide` : ajout d'une exigence « Afficher la version servie en bas de la page Aide » (le tag de release quand il est connu, la mention « développement » sinon, affichage échappé, aucune autre page concernée).
- `docker-deployment` : ajout d'une exigence « Exposer le tag de release à l'application » (l'étape finale de l'image porte `APP_VERSION` comme variable d'environnement, vide pour un build local, sans configuration supplémentaire au démarrage).

## Impact

- **`server.js`** : lecture de `APP_VERSION` au démarrage (comme `PORT` et `AUTHORIZED_EMAILS`), rendu de la ligne dans `renderGuidePage` avec `escapeHtml`.
- **`public/style.css`** : une règle `.guide-version` (filet de séparation, texte discret), dans la section « User guide page ».
- **`Dockerfile`** : `ARG APP_VERSION` + `ENV APP_VERSION` dans l'étape finale `node:22-alpine` ; l'étape `assets` et son commentaire restent inchangés. Le build de release (`build-args: APP_VERSION=<tag>`) alimente les deux étapes avec la même valeur.
- **`public/sw.js`** : incrément de `CACHE_VERSION`, `style.css` étant précaché.
- **`test/passkey-flow.js`** : `APP_VERSION` fixé avant le chargement du serveur, assertions sur la ligne affichée dans `/aide` et sur son absence ailleurs.
- **`test/e2e/task-links.spec.js`** : le cas 6.3 qui visite `/aide` vérifie la mention « développement » du build local (le serveur enfant ne reçoit pas `APP_VERSION`).
- **`Readme.md`** : une phrase rappelle que la page Aide affiche le tag servi, en complément du contrôle de `/sw.js` par la pipeline.
- **Aucune migration de données**, aucune variable à ajouter dans le conteneur Scaleway : le tag voyage dans l'image.
