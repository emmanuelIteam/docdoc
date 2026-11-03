## Why

Publier une version est aujourd'hui une suite d'actions manuelles : construire l'image, la pousser sous un tag choisi à la main, puis mettre à jour le conteneur Scaleway et espérer que le tag de l'image corresponde bien à celui de `main.tf` et des sources. Le Readme en garde la trace (« le tag poussé doit correspondre à `var.app_image` ») et les versions publiées (`1.0`, `1.1`, `1.9`) montrent que cette coordination est fragile : rien n'empêche d'étiqueter une image avec un tag qui ne correspond pas aux sources, ni d'oublier de basculer le conteneur. Un tag git est déjà l'identité d'une version ; le pipeline doit en faire l'unique déclencheur et la seule étiquette de l'image.

## What Changes

- **Un workflow GitHub Actions `Release` déclenché par un tag.** Un `push` de tag lance le pipeline ; le nom du tag est repris **tel quel** comme étiquette Docker et comme version de la release. Aucun autre déclencheur : ni branche, ni manuel.
- **Validation du tag avant tout travail.** Le tag doit être une version numérique sans préfixe (`1.2`, `1.9`, `1.2.3`) et une étiquette Docker valide ; un tag qui ne respecte pas ce format arrête le pipeline avec un message explicite plutôt que de publier une image mal nommée.
- **Compilation (minification) intégrée à l'image.** Une étape de build dédiée minifie `public/app.js`, `public/auth.js`, `public/pwa.js` et `public/style.css` (esbuild pour le JavaScript, lightningcss pour le CSS) et remplace la constante `CACHE_VERSION` de `public/sw.js` par le tag de release. Les bundles déjà minifiés (`htmx.min.js`, `simplewebauthn.js`) sont livrés tels quels. Les **noms de fichiers et les URL servies restent identiques** : `server.js`, `sw.js` et les pages n'ont pas à changer.
- **Image construite en deux étapes.** L'étape de compilation tourne sur une base Debian (glibc, pour les binaires natifs d'esbuild et lightningcss) et l'image finale reste `node:22-alpine`, avec ses dépendances de production et ses assets minifiés. Les sources du dépôt ne sont pas modifiées par un build local.
- **Publication sur Docker Hub.** L'image est poussée sur `docker.io/emmanuel7044/docdoc:<tag>`, en `linux/amd64` (seule architecture publiée aujourd'hui), authentifiée par un jeton d'accès Docker Hub. Aucun tag `latest` n'est poussé : seul le tag de version identifie la release.
- **Déploiement du conteneur Scaleway.** Après publication, le pipeline met à jour l'image du conteneur Serverless `docdoc-app` (namespace `docdoc-namespace`) avec la même référence, via l'API/CLI Scaleway, puis attend que le déploiement soit `ready` et vérifie que l'image rapportée est bien celle du tag. Un échec de l'une de ces étapes fait échouer le pipeline.
- **Le déploiement manuel reste possible.** `main.tf` continue de piloter l'image (`tofu apply -var app_image=…`) ; le pipeline la met à jour par l'API Scaleway sans passer par OpenTofu. Les deux chemins sont documentés, avec la règle d'alignement qui évite qu'un apply ramène une ancienne image.
- **Documentation.** Le Readme remplace la procédure manuelle (build/tag/push, puis `app_image`) par la création d'un tag, décrit les secrets et variables à configurer dans GitHub et la procédure de retour arrière.

## Capabilities

### New Capabilities

- `release-pipeline`: publication d'une version déclenchée par un tag git — validation du tag, construction et minification de l'image, poussée sur Docker Hub sous l'étiquette du tag, mise à jour et vérification du conteneur Scaleway, avec échec explicite et retour arrière documenté.

### Modified Capabilities

- `docker-deployment` : l'image n'est plus construite en copiant les sources telles quelles ; elle est produite en deux étapes et embarque les assets statiques minifiés sous leurs URL existantes, sans changement du runtime (utilisateur non-root, port, répertoire de données).
- `offline-shell` : la version du cache du service worker n'est plus une constante à incrémenter à la main avant chaque release ; le build de l'image y substitue le tag de release, de sorte qu'une nouvelle version invalide le cache PWA sans intervention. Le développement local garde la constante du dépôt.

## Impact

- **Nouveaux fichiers** : `.github/workflows/release.yml` et `scripts/build-assets.js` (minification et substitution de `CACHE_VERSION`).
- **`Dockerfile`** : ajout d'une étape `assets` (Debian, dépendances de build) et copie de `public/` minifié dans l'étape finale `node:22-alpine` ; `ARG APP_VERSION` pour transporter le tag.
- **`package.json` / `package-lock.json` / `pnpm-lock.yaml`** : `esbuild` et `lightningcss` en `devDependencies` (uniquement nécessaires au build de l'image ; les dépendances de production ne changent pas).
- **`public/sw.js`** : `CACHE_VERSION` reste la constante de développement ; le build la remplace dans l'image. Aucune URL ni logique de cache ne change.
- **`main.tf`** : la description de `var.app_image` décrit les deux chemins de déploiement et la règle d'alignement ; aucune exception `ignore_changes`.
- **`Readme.md`** : sections « Création et enregistrement de l'image docker », « Compilation de l'application » et « Déploiement » réécrites autour du tag ; liste des secrets/variables GitHub.
- **Secrets GitHub requis** : `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` (jeton d'accès en lecture/écriture), `SCW_ACCESS_KEY`, `SCW_SECRET_KEY`. **Variables GitHub** : `SCW_DEFAULT_PROJECT_ID`, `SCW_DEFAULT_REGION` (`fr-par`), `SCW_CONTAINER_ID`, éventuellement `APP_URL` pour le contrôle HTTP final.
- **Comportement au runtime** : inchangé — même image de base, même utilisateur non-root, même port, mêmes routes, même stockage S3 ; seuls le poids des assets servis et le nom du cache PWA changent.
- **Retour arrière** : remettre l'image du conteneur sur le tag précédent (`scw container container update <id> image=docker.io/emmanuel7044/docdoc:<tag-précédent>` ou console Scaleway), sans reconstruire ni republier ; les images publiées restent disponibles sur Docker Hub.
