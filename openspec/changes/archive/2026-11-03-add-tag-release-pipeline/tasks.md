## 1. Outillage de minification

- [x] 1.1 Ajouter `esbuild` et `lightningcss` en `devDependencies` de `package.json`, à versions exactes (pas de `^`)
- [x] 1.2 Régénérer `package-lock.json` (`npm install --package-lock-only`) et `pnpm-lock.yaml` (`pnpm install --lockfile-only`) pour qu'ils restent cohérents avec `package.json`
- [x] 1.3 Créer `scripts/build-assets.js` : minifier `app.js`, `auth.js`, `pwa.js` (esbuild) et `style.css` (lightningcss) vers le même chemin ; laisser sans les toucher `htmx.min.js`, `simplewebauthn.js`, `offline.html`, `manifest.webmanifest`, `sw.js`, `icons/`
- [x] 1.4 Dans `scripts/build-assets.js` : si `APP_VERSION` est défini, remplacer l'unique occurrence de `const CACHE_VERSION = '…';` dans `sw.js` par cette version, et échouer si le motif est absent ou trouvé plusieurs fois
- [x] 1.5 Dans `scripts/build-assets.js` : échouer si un fichier source attendu manque ou si une sortie est vide, et journaliser la taille avant/après de chaque fichier
- [x] 1.6 Mettre à jour le commentaire d'en-tête de `public/sw.js` pour décrire la substitution de `CACHE_VERSION` au build et l'incrément manuel en développement local
- [x] 1.7 Vérifier localement : `APP_VERSION=1.10 node scripts/build-assets.js` produit des fichiers plus petits et `CACHE_VERSION = '1.10'` ; sans `APP_VERSION`, la constante du dépôt est conservée

## 2. Image Docker multi-étapes

- [x] 2.1 Ajouter au `Dockerfile` une étape `assets` (`node:22-bookworm-slim`) qui copie `package.json`, `package-lock.json`, `public/` et `scripts/`, exécute `npm ci`, puis `node scripts/build-assets.js`
- [x] 2.2 Déclarer `ARG APP_VERSION` dans le `Dockerfile` et le transmettre au script ; l'étape finale `node:22-alpine` copie `public/` depuis l'étape `assets` au lieu du contexte
- [x] 2.3 Vérifier que l'étape finale reste inchangée pour le reste : `npm ci --omit=dev`, code applicatif, `USER node`, `EXPOSE 3000`, `CMD` identiques
- [x] 2.4 Construire localement : `docker build --build-arg APP_VERSION=1.10 -t docdoc:test .`, puis vérifier les tailles servies et `const CACHE_VERSION = '1.10'` dans `/sw.js`
- [x] 2.5 Vérifier que `esbuild` et `lightningcss` sont absents de l'image finale et que `htmx.min.js`/`icons/` sont identiques aux sources
- [x] 2.6 Construire sans argument (`docker build -t docdoc:dev .`) et vérifier que la constante du dépôt est conservée et que le conteneur démarre sur `PORT`

## 3. Workflow GitHub Actions

- [x] 3.1 Créer `.github/workflows/release.yml` avec `on: push: tags: ['*']`, `permissions: contents: read` et `concurrency: group: release-${{ github.ref_name }}`
- [x] 3.2 Ajouter un job `prepare` qui valide le tag par `^[0-9]+\.[0-9]+(\.[0-9]+)?$`, échoue avec le format attendu sinon, et expose en sortie le tag et la référence `docker.io/emmanuel7044/docdoc:<tag>`
- [x] 3.3 Ajouter un job `build` qui se connecte à Docker Hub (`docker/login-action` avec `DOCKERHUB_USERNAME`/`DOCKERHUB_TOKEN`) puis construit et pousse avec `docker/build-push-action` : `platforms: linux/amd64`, `provenance: false`, `sbom: false`, `build-args: APP_VERSION=<tag>`, cache `type=gha`
- [x] 3.4 Ajouter un job `deploy` qui installe une version épinglée de `scw`, s'authentifie par `SCW_ACCESS_KEY`/`SCW_SECRET_KEY`/`SCW_DEFAULT_PROJECT_ID`/`SCW_DEFAULT_REGION` et met à jour l'image de `SCW_CONTAINER_ID`
- [x] 3.5 Dans le job `deploy`, attendre le statut `ready` avec l'image attendue (sondage de `scw container container get … -o json`, intervalle 10 s, plafond 10 min) et échouer avec le dernier statut observé en cas de dépassement
- [x] 3.6 Ajouter le contrôle facultatif de `APP_URL` : `GET $APP_URL/sw.js` avec réessais, échec si le corps ne déclare pas `CACHE_VERSION = '<tag>'`, étape ignorée si la variable n'est pas définie
- [x] 3.7 Publier un résumé de run (`$GITHUB_STEP_SUMMARY`) avec le tag, la référence d'image, le digest, le conteneur ciblé et le résultat du contrôle
- [x] 3.8 Vérifier que le job `deploy` est conditionné au succès de `build` (aucun appel Scaleway si la poussée a échoué)

## 4. Infrastructure et configuration

- [x] 4.1 Mettre à jour la description de `var.app_image` dans `main.tf` (deux chemins : pipeline et `tofu apply`, règle d'alignement) et ne pas ajouter d'exception `ignore_changes`, pour que le déploiement manuel par OpenTofu reste effectif
- [x] 4.2 Documenter les secrets (`DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `SCW_ACCESS_KEY`, `SCW_SECRET_KEY`) et variables (`SCW_DEFAULT_PROJECT_ID`, `SCW_DEFAULT_REGION`, `SCW_CONTAINER_ID`, `APP_URL`) à créer dans GitHub
- [x] 4.3 Vérifier l'identifiant du conteneur cible (namespace `docdoc-namespace`, conteneur `docdoc-app`) et la région `fr-par` avant la première exécution

## 5. Documentation

- [x] 5.1 Remplacer dans `Readme.md` les sections « Création et enregistrement de l'image docker » et « Déploiement » par la procédure par tag, et supprimer la consigne « le tag poussé doit correspondre à `var.app_image` »
- [x] 5.2 Ajouter au Readme la liste des secrets/variables GitHub et la procédure de retour arrière (remettre l'image du conteneur sur le tag précédent, sans reconstruction)
- [x] 5.3 Préciser dans le Readme la règle de `CACHE_VERSION` : incrément manuel en développement local, substitution par le tag dans l'image publiée
- [x] 5.4 Mentionner dans le Readme qu'un tag publié ne doit plus être déplacé (un correctif prend un nouveau numéro)

## 6. Vérification de bout en bout

- [x] 6.1 Pousser un tag `1.10` et vérifier : run vert, image `docker.io/emmanuel7044/docdoc:1.10` présente sur Docker Hub, conteneur `ready` sur cette image, `/sw.js` déclare `CACHE_VERSION = '1.10'`
- [x] 6.2 Pousser un tag invalide (`v1.11`) et vérifier que le run échoue à la validation, sans image publiée ni conteneur modifié
- [x] 6.3 Simuler un retour arrière vers le tag précédent et vérifier que `/sw.js` sert de nouveau l'ancienne version de cache
