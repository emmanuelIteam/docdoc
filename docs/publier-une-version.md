# Publier une version

Procédure pour compiler l'image, la publier sur Docker Hub et basculer le conteneur Scaleway. Le chemin normal est un **tag git** : le pipeline GitHub fait tout, puis vérifie la version réellement servie.

Retour au [README](../README.md) · Infrastructure : [deployer-infrastructure.md](deployer-infrastructure.md).

## Principe

Pousser un tag de version déclenche [`.github/workflows/release.yml`](../.github/workflows/release.yml). Le pipeline construit et minifie l'image, la publie sous l'étiquette du tag, bascule le conteneur `docdoc-app` sur cette image et attend qu'il soit `ready`. Si `APP_URL` est configurée, il vérifie en plus que `/sw.js` déclare bien le tag servi.

Un tag publié **ne se déplace plus** : un correctif prend un nouveau numéro.

## Prérequis (une fois)

- Le conteneur `docdoc-app` existe : il est créé par [l'infrastructure](deployer-infrastructure.md).
- Le dépôt Docker Hub `emmanuel7044/docdoc` est accessible en écriture avec le jeton de la CI.
- Les secrets et variables GitHub sont déclarés dans **Settings → Secrets and variables → Actions**.

### Secrets

| Nom | Valeur |
| --- | --- |
| `DOCKERHUB_USERNAME` | Compte Docker Hub propriétaire de `emmanuel7044/docdoc`. |
| `DOCKERHUB_TOKEN` | Jeton d'accès Docker Hub en lecture/écriture (jamais le mot de passe). |
| `SCW_ACCESS_KEY` | Clé d'accès Scaleway dédiée à la CI. |
| `SCW_SECRET_KEY` | Clé secrète associée. |

### Variables

| Nom | Valeur |
| --- | --- |
| `SCW_DEFAULT_PROJECT_ID` | Projet Scaleway qui porte le conteneur. |
| `SCW_DEFAULT_ORGANIZATION_ID` | Organisation Scaleway. `scw` l'exige même pour une commande conteneur ; à défaut, le pipeline reprend l'identifiant du projet. |
| `SCW_DEFAULT_REGION` | `fr-par` (facultatif, c'est la valeur par défaut). |
| `SCW_CONTAINER_ID` | Identifiant du conteneur `docdoc-app` : le seul UUID, **sans** le préfixe `fr-par/` que montre l'état Terraform. `scw container container list` le donne. |
| `APP_URL` | URL publique, par exemple `https://docdoc.re`. Active le contrôle `/sw.js` ; sans elle, l'étape est ignorée. |

La clé Scaleway de la CI n'a besoin que du droit de modifier le conteneur. Une clé dédiée se révoque sans casser `tofu apply`.

## Procédure

### 1. Choisir le numéro

Le tag doit être une version numérique, sans préfixe ni suffixe, conforme à `^[0-9]+\.[0-9]+(\.[0-9]+)?$` :

| Accepté | Refusé |
| --- | --- |
| `1.2`, `1.10`, `1.2.3` | `v1.10`, `1.10-rc`, `release-1.10` |

Un tag invalide est refusé au premier job, sans rien publier. Les numéros se comparent comme des versions : `1.10` vient après `1.9`.

### 2. Préparer le commit

Sur `main`, avec un arbre propre :

```bash
git status
```

Aligne `app_image` dans `main.tf` sur la version que tu publies, et commite ce changement **dans le commit qui sera tagué**. Sinon, après la release, l'état OpenTofu et `main.tf` désignent encore l'ancienne image : le prochain `tofu apply` remettrait le conteneur dessus. Ne lance pas d'`apply` entre ce commit et la fin de la release : l'image n'existe pas encore.

```bash
git add main.tf
git commit -m "Préparer la version 1.12"
```

Si la release échoue avant publication, reviens sur ce commit. Si l'image n'est pas partie, le tag peut être supprimé puis reposé (`git push --delete origin 1.12` puis `git tag -d 1.12`) ; dès que l'image est publiée, le tag ne bouge plus.

### 3. Poser et pousser le tag

```bash
git tag 1.12
git push origin main 1.12
```

Le pipeline démarre sur le push du tag. Suivre l'exécution dans l'onglet **Actions** du dépôt (`Release` → le run du tag).

### 4. Vérifier

Quand le job `deploy` est vert :

```bash
curl -fsS https://docdoc.re/sw.js | grep CACHE_VERSION
```

La réponse doit contenir `const CACHE_VERSION = '1.12';`. C'est le contrôle le plus direct : `/sw.js` est servi en `no-cache` et le tag y est inscrit par le build.

Deux autres vérifications :

- la page **Aide** (`/aide`) affiche le tag en bas de son manuel ;
- côté Scaleway, le conteneur est `ready` sur la bonne image :

```bash
scw container container get <SCW_CONTAINER_ID> -o json | jq '.status, .image'
```

## Ce que fait le pipeline

| Étape | Détail |
| --- | --- |
| Validation | Le tag doit correspondre à `^[0-9]+\.[0-9]+(\.[0-9]+)?$`. |
| Build | `docker build --build-arg APP_VERSION=<tag>` : l'étape `assets` du `Dockerfile` minifie `app.js`, `auth.js`, `pwa.js` et `style.css`, et inscrit le tag dans `CACHE_VERSION` de `sw.js`. L'étape finale le conserve dans `APP_VERSION`, que la page Aide affiche. |
| Publication | `docker.io/emmanuel7044/docdoc:<tag>`, image `linux/amd64` unique, sans tag `latest`. |
| Déploiement | `scw container container update` sur `docdoc-app`, puis attente du statut `ready` sur la nouvelle image (10 minutes au plus). |
| Contrôle | Si `APP_URL` est définie, `GET /sw.js` doit déclarer `CACHE_VERSION = '<tag>'` (2 minutes au plus) ; sinon l'étape est ignorée. |
| Résumé | Un tableau récapitulatif (image, digest, conteneur, contrôle) est ajouté au résumé du run. |

Une release n'a pas besoin d'incrémenter `CACHE_VERSION` à la main : le build remplace la constante par le tag, donc chaque version publiée part sur un cache neuf.

## Échecs courants

| Symptôme | Cause | Que faire |
| --- | --- | --- |
| `Invalid release tag` au job `prepare` | Préfixe `v`, suffixe `-rc`, ou caractère non numérique. | Re-taguer une version valide. |
| `Missing secret` / `Missing variable` | `DOCKERHUB_*`, `SCW_*` ou `SCW_CONTAINER_ID` absent. | Les déclarer dans Settings → Actions. |
| Échec au login Docker Hub | Jeton expiré ou droits insuffisants. | Régénérer un jeton en lecture/écriture. |
| `Container did not become ready … within 10 minutes` | Image non publiée, image `amd64` absente, ou conteneur en erreur. | Vérifier l'image sur Docker Hub et les logs du conteneur dans la console Scaleway. |
| `Stale version served` | `APP_URL` pointe ailleurs, ou un proxy sert un ancien `/sw.js`. | Vérifier `APP_URL`, puis `curl -fsS <url>/sw.js`. |
| Un second run attend le premier | Deux pushes sur le même tag sont sérialisés (`concurrency`). | Laisser le premier terminer ; ne pas pousser un second tag pour le même contenu. |

## Déploiement manuel (sans le pipeline)

Le pipeline n'est pas obligatoire : l'ordre reste « publier l'image, puis basculer le conteneur ».

```bash
docker build --build-arg APP_VERSION=1.12 -t emmanuel7044/docdoc:1.12 .
docker push emmanuel7044/docdoc:1.12
```

Puis deux façons équivalentes de basculer le conteneur :

```bash
# 1. Par OpenTofu : var.app_image est la valeur que l'apply impose
sops exec-env secrets.sops.yaml 'tofu apply -var app_image=docker.io/emmanuel7044/docdoc:1.12'

# 2. Par la CLI Scaleway, sans état Terraform (même appel que le pipeline)
sops exec-env secrets.sops.yaml 'scw container container update <id-du-conteneur> image=docker.io/emmanuel7044/docdoc:1.12'
```

Sans `--build-arg`, la constante `CACHE_VERSION` du dépôt est conservée : c'est le comportement voulu en développement local, et la page Aide annonce alors « Version développement » au lieu d'un tag.

L'image est **amd64 uniquement**. Sur une machine ARM (Apple Silicon), construire avec `--platform linux/amd64`.

## Retour arrière

Remettre le conteneur sur le tag précédent, sans reconstruire ni republier :

```bash
scw container container update <id-du-conteneur> image=docker.io/emmanuel7044/docdoc:<tag-précédent>
```

Le même geste se fait depuis la console Scaleway (conteneur → Image). Les images publiées restent disponibles sur Docker Hub ; `/sw.js` confirme que l'ancienne version sert de nouveau, et la page Aide en affiche le tag.

Le retour arrière ne touche ni les données (bucket S3) ni les passkeys (le RP ID n'a pas changé). Si le tag précédent a été construit avant un changement de format de données, vérifier la compatibilité avant de basculer.

## Liste de contrôle

- [ ] `main` est propre et les tests passent (`npm test`).
- [ ] `app_image` dans `main.tf` désigne la version publiée, et le changement est commité.
- [ ] Le tag est numérique, sans préfixe ni suffixe, et n'a jamais été publié.
- [ ] Le run `Release` est vert jusqu'au job `deploy`.
- [ ] `/sw.js` déclare le tag, et la page Aide l'affiche.
- [ ] Le conteneur est `ready` sur la bonne image.
