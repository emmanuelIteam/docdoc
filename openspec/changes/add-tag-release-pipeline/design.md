## Context

Rien n'automatise aujourd'hui la publication : le Readme décrit `docker build -t emmanuel7044/docdoc:<version>`, `docker push`, puis la mise à jour de `var.app_image` dans `main.tf` et un `tofu apply`. Trois conséquences :

- l'étiquette de l'image et le tag git ne sont corrélés par aucune règle, seulement par la vigilance ;
- le conteneur Scaleway (`docdoc-app`, namespace `docdoc-namespace`) ne bascule que si quelqu'un y pense, et rien ne vérifie que l'image annoncée est bien celle qui tourne ;
- la version du cache du service worker (`CACHE_VERSION` dans `public/sw.js`) est une constante à incrémenter à la main ; un oubli laisse les clients PWA sur d'anciens assets après un déploiement.

L'application n'a pas d'étape de build : `server.js` rend le HTML et sert des fichiers statiques sous des URL fixes (`/app.js`, `/style.css`, `/sw.js`…), que le service worker précache par ces mêmes URL. Toute minification doit donc **conserver les noms de fichiers**, sous peine de devoir modifier `server.js`, `sw.js` et les pages.

Contraintes du dépôt : image finale `node:22-alpine`, utilisateur non-root, dépendances de production installées par `npm ci --omit=dev` depuis `package-lock.json` ; dépôt GitHub `emmanuelIteam/docdoc` ; image publique `docker.io/emmanuel7044/docdoc`, amd64 uniquement.

## Goals / Non-Goals

**Goals:**

- Un tag git poussé est l'unique déclencheur et l'unique étiquette : `1.10` produit l'image `docker.io/emmanuel7044/docdoc:1.10` et la déploie.
- La minification fait partie de la construction de l'image, pas du dépôt : les sources restent lisibles, l'image publiée est la seule à contenir les assets minifiés.
- Chaque release invalide le cache PWA sans intervention manuelle.
- Le pipeline échoue explicitement si le tag est invalide, si un asset ne peut pas être minifié, si la poussée Docker Hub échoue, ou si le conteneur Scaleway ne devient pas `ready` sur la bonne image.
- Le retour arrière ne demande ni reconstruction ni republication.

**Non-Goals:**

- Lancer les tests (`npm test`, Playwright) dans le pipeline — décision explicite : le pipeline reste court et se limite à build + publication + déploiement.
- Construire plusieurs architectures (`arm64`) ou publier un tag `latest` : l'image reste amd64 et seul le tag de version identifie la release.
- Faire tourner `tofu apply` dans la CI : l'état Terraform est versionné et les `TF_VAR` sensibles n'ont pas à être dupliqués dans GitHub.
- Créer la release GitHub, noter le changelog ou bumper `package.json`.
- Migrer l'image vers Scaleway Container Registry.

## Decisions

### 1. Le tag git est l'identité de la release, validé avant tout travail

Le workflow se déclenche sur `push` de tags (`tags: ['*']`), puis un job `prepare` valide le nom par expression régulière : `^[0-9]+\.[0-9]+(\.[0-9]+)?$`. Un tag qui ne correspond pas (par exemple `v1.2`, `test`, `1.2-rc1`) arrête le pipeline avec un message qui indique le format attendu. Le job expose en sortie le tag et la référence d'image `docker.io/emmanuel7044/docdoc:<tag>`.

- *Pourquoi pas un filtre de tags glob (`tags: ['[0-9]*']`)* : les filtres GitHub utilisent des globs, pas des expressions régulières ; `[0-9]*` accepterait `1.2abc`. La validation explicite donne aussi un message d'erreur lisible.
- *Pourquoi pas une action `semver`* : une dépendance de plus pour une validation qui tient en une ligne de `grep -E`.
- Conséquence assumée : un tag de préversion (`1.3.0-rc1`) est refusé. Le format peut être élargi plus tard en une seule expression.

### 2. Minification dans une étape du `Dockerfile`, pas dans un job CI séparé

Le `Dockerfile` devient multi-étapes :

```
FROM node:22-bookworm-slim AS assets     # glibc : binaires natifs esbuild/lightningcss
COPY package.json package-lock.json ./
RUN npm ci                              # devDependencies incluses
COPY public ./public
COPY scripts ./scripts
ARG APP_VERSION=""
RUN node scripts/build-assets.js        # minifie sur place, substitue CACHE_VERSION
```

L'étape finale reste `node:22-alpine`, avec `npm ci --omit=dev` et `COPY --from=assets /app/public ./public`. Le reste du `Dockerfile` (code applicatif, `USER node`, `EXPOSE 3000`) est inchangé.

- *Pourquoi pas un job CI qui produit `dist/` puis le transmet à l'image* : deux artefacts et deux sources de vérité ; un `docker build` local ne produirait pas la même image que la CI. Ici, `docker build --build-arg APP_VERSION=1.10 .` suffit à reproduire exactement la release.
- *Pourquoi une base Debian pour l'étape de build* : `esbuild` et `lightningcss` sont des binaires natifs ; la variante glibc évite les surprises de résolution des paquets optionnels musl sur Alpine. Les sorties sont des fichiers texte, leur copie vers Alpine est sans risque.
- *Pourquoi des `devDependencies` plutôt que `npx`* : `npm ci` depuis `package-lock.json` rend les versions reproductibles et fait échouer le build si le lockfile n'est pas à jour. `npx esbuild` téléchargerait une version flottante.

### 3. `scripts/build-assets.js` : liste explicite, échec bruyant

Le script minifie, vers le même chemin, `public/app.js`, `public/auth.js` et `public/pwa.js` avec esbuild (`--minify`) et `public/style.css` avec lightningcss. Il laisse sans les toucher `public/htmx.min.js` et `public/simplewebauthn.js` (bundles déjà minifiés, qui portent leur bandeau de licence), `public/offline.html`, `public/manifest.webmanifest`, `public/sw.js` et `public/icons/`. Il remplace ensuite l'unique occurrence de `const CACHE_VERSION = '…';` par le tag reçu dans `APP_VERSION`, et **ne fait rien** si `APP_VERSION` est vide (un `docker build` local garde donc la constante du dépôt).

Le script échoue si un fichier attendu manque, si une sortie est vide, ou si le motif `CACHE_VERSION` n'est pas trouvé exactement une fois. Il affiche pour chaque fichier la taille avant/après.

- *Pourquoi ne pas minifier `sw.js`* : le worker reste lisible, et surtout la version de cache y reste visible en clair — c'est ce que le contrôle HTTP final lit.
- *Pourquoi `externals`/bundle désactivés* : ces fichiers sont déjà des scripts autonomes chargés par `<script src>` ; les regrouper changerait les URL servies et la liste de précache.

### 4. `CACHE_VERSION` = tag de release, développement local inchangé

L'argument `APP_VERSION` est passé par `docker build --build-arg APP_VERSION=<tag>` (via `build-args` de `docker/build-push-action`). Dans l'image publiée, `sw.js` contient `const CACHE_VERSION = '1.10';` : le cache devient `docdoc-static-1.10`, l'ancien est supprimé à l'activation, et chaque release invalide donc le cache sans geste manuel. En local (`pnpm start`, `docker compose up`), la constante du dépôt (`v11`) reste utilisée ; le Readme continue de demander de l'incrémenter quand on modifie un asset précaché hors release.

- *Alternative écartée* : une constante `BUILD_VERSION` injectée côté serveur et exposée à `/sw.js` dynamiquement. Cela obligerait `server.js` à rendre le worker, à changer son `Cache-Control` et les tests du worker.
- *Effet de bord accepté* : deux releases avec le même tag (repoussé) produisent le même nom de cache. C'est cohérent avec la règle « un tag publié ne bouge plus ».

### 5. Publication Docker Hub en amd64, sans attestations

`docker/login-action` s'authentifie avec `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` (`--password-stdin`, jamais en argument), puis `docker/build-push-action` construit et pousse avec `platforms: linux/amd64`, `provenance: false`, `sbom: false` et un cache GitHub Actions (`cache-from`/`cache-to: type=gha`). Aucun `latest`.

- *Pourquoi désactiver provenance/SBOM* : ils transforment l'image en index multi-manifest ; le conteneur Serverless Scaleway attend une image simple, et l'attestation n'apporte rien ici.
- *Pourquoi pas `docker build`/`docker push` bruts* : `build-push-action` gère proprement le cache de couches entre releases, sans changer l'artefact produit.

### 6. Déploiement par l'API Scaleway (`scw`), pas par Terraform

Le job `deploy` installe une version épinglée du binaire `scw` (téléchargé depuis les releases GitHub), s'authentifie par `SCW_ACCESS_KEY` / `SCW_SECRET_KEY` / `SCW_DEFAULT_PROJECT_ID` / `SCW_DEFAULT_REGION`, puis :

1. `scw container container update "$SCW_CONTAINER_ID" image="docker.io/emmanuel7044/docdoc:$TAG"` ;
2. boucle d'attente (10 s, plafond 10 min) sur `scw container container get "$SCW_CONTAINER_ID" -o json` jusqu'à `status == "ready"` **et** `image` égale la référence attendue ;
3. si la variable `APP_URL` est définie, `GET $APP_URL/sw.js` (avec réessais) et vérification que le corps déclare `CACHE_VERSION = '<tag>'` ; sinon l'étape est ignorée.

- *Pourquoi pas `tofu apply -var app_image=…`* : il faudrait l'état Terraform (aujourd'hui versionné, donc modifiable par deux exécutions concurrentes) et tous les `TF_VAR` sensibles dans GitHub. La CLI ne touche qu'un champ du conteneur.
- *Pourquoi `sw.js` comme sonde* : il est servi en `Cache-Control: no-cache`, ne dépend pas de la session, et contient le tag de la release. Un `200` sur `/` prouverait seulement qu'une instance répond — pas que c'est la nouvelle. `APP_URL` reste facultatif car l'endpoint généré du conteneur peut changer.
- *Pourquoi l'attente avant la sonde* : pendant le rolling update, l'ancienne instance peut encore répondre ; le statut `ready` de Scaleway indique que la nouvelle révision est en place.

### 7. `main.tf` cesse de piloter l'image

`scaleway_container.app` reçoit `lifecycle { ignore_changes = [image] }`. Sans cela, un `tofu apply` ultérieur ramènerait l'image au défaut de `var.app_image` (`1.9`) et annulerait silencieusement la release. La variable reste utile à la création initiale du conteneur ; sa description est mise à jour pour le dire.

- *Alternative écartée* : faire écrire `var.app_image` par la CI dans `main.tf` puis committer. Cela mélange release et infrastructure, exige un jeton à droit d'écriture sur le dépôt et crée des conflits avec les travaux en cours.

### 8. Politique de reprise

Une réexécution du workflow est autorisée : elle repousse le même tag et redéploie. Un `concurrency: group: release-${{ github.ref_name }}` sérialise deux exécutions sur le même tag ; l'annulation d'une exécution en cours ne laisse donc jamais deux déploiements concurrents. Un échec après la poussée Docker Hub laisse l'image publiée : la réexécution répare le déploiement sans reconstruire depuis zéro (le cache de couches aide).

## Risks / Trade-offs

- **Tag repoussé = contenu différent sous la même étiquette** → règle documentée : un tag publié ne bouge plus ; un correctif prend un nouveau numéro. Le pipeline ne peut pas l'imposer techniquement (Docker Hub autorise l'écrasement), et l'interdire bloquerait la reprise après un échec de déploiement.
- **`ignore_changes` masque une dérive** : une modification manuelle de l'image dans la console Scaleway ne sera plus corrigée par `tofu apply` → assumé, le pipeline devient la source de vérité ; documenté dans le Readme.
- **Le build dépend de binaires natifs** (esbuild, lightningcss) → versions épinglées dans `package-lock.json`, étape de build en glibc, échec explicite si la minification produit un fichier vide. Ces dépendances n'entrent pas dans l'image finale.
- **Rupture du lockfile** : ajouter des `devDependencies` sans régénérer `package-lock.json` ferait échouer `npm ci` dans l'étape `assets` → tâche dédiée de mise à jour du lockfile (+ `pnpm-lock.yaml`, utilisé en local).
- **`sw.js` ne contient pas le motif attendu** (renommage de la constante, minification accidentelle) → le script échoue avant la poussée, plutôt que de publier une image dont le cache PWA ne serait pas versionné.
- **Déploiement Scaleway lent ou bloqué** (pull Docker Hub, quotas, rate limit anonyme) → attente bornée à 10 min avec message explicite ; une nouvelle exécution reprend. Un miroir d'image ou des identifiants de pull Scaleway restent hors périmètre.
- **Secrets** : un jeton Docker Hub et une clé Scaleway vivent dans GitHub. La clé Scaleway de la CI devrait être dédiée et restreinte au projet, avec expiration alignée sur la politique d'organisation (cf. `expires_at` dans `main.tf`).
- **Pas de tests dans le pipeline** → une régression fonctionnelle peut être publiée. Compensé par le contrôle de version servi ; les tests restent lancés localement.

## Migration Plan

1. Créer les secrets (`DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `SCW_ACCESS_KEY`, `SCW_SECRET_KEY`) et les variables (`SCW_DEFAULT_PROJECT_ID`, `SCW_DEFAULT_REGION=fr-par`, `SCW_CONTAINER_ID`, `APP_URL` si un domaine est rattaché) dans les réglages GitHub du dépôt.
2. Merger le workflow, le `Dockerfile` multi-étapes, `scripts/build-assets.js` et les `devDependencies`.
3. Vérifier localement : `docker build --build-arg APP_VERSION=1.10 -t docdoc:test .`, lancer le conteneur, constater les tailles réduites et `const CACHE_VERSION = '1.10'` dans `/sw.js`.
4. Première release : `git tag 1.10 && git push origin 1.10`. Vérifier la poussée sur Docker Hub, le statut `ready` du conteneur et le contenu de `/sw.js` servi.
5. Retour arrière : `scw container container update "$SCW_CONTAINER_ID" image="docker.io/emmanuel7044/docdoc:<tag-précédent>"` (ou console Scaleway), puis vérifier de la même façon. Aucun rebuild, aucune republication.
6. Mise à jour du Readme dans le même changement, pour que la procédure manuelle ne subsiste pas à côté du pipeline.

## Open Questions

- Faut-il exiger une approbation manuelle (environnement GitHub `production`) avant le déploiement Scaleway ? Le design ne l'impose pas — ajouter `environment: production` au job `deploy` suffirait à l'activer sans changer le pipeline.
- Faut-il publier aussi `latest` pour les tags stables ? Non retenu ici (une étiquette par release), mais trivial à ajouter si le besoin apparaît.
