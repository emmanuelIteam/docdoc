# Gestion de projet perso

## deepseek harness
https://github.com/deepseek-ai/deepseek-harness

### Facturation
https://platform.deepseek.com/usage

## Scaleway  
### Générer une Clé API Scaleway (IAM)  
https://console.scaleway.com/billing/overview

OpenTofu a besoin d'identifiants pour interagir avec ton compte via l'API Scaleway.  
Rends-toi sur la Console Scaleway.  
En haut à droite, clique sur ton profil puis sur IAM & API Keys.  
Onglet API Keys $\rightarrow$ clique sur + Generate API key.  
Conserve précieusement :  Access Key (ex: SCWXXXXXXXXXXXXX)  
Secret Key (affichée une seule fois à la création, ex: 11111111-2222-3333-4444-555555555555)  

## Configuration opentofu
Création du fichier .env et référencement dans gitignore pour l'écarter de la SCM

Enregistrement des variables d'environnement sur le compte windows personnel

```bash
.env
```

## Stockage des données (bucket S3)

L'application persiste ses données (domaines + thèmes) dans un bucket compatible S3, et non plus dans le filesystem local. Elle est configurée via ces variables d'environnement :

| Variable | Rôle |
| --- | --- |
| `S3_ENDPOINT` | URL de l'API S3 (`https://s3.fr-par.scw.cloud` en prod, `http://minio:9000` en local) |
| `S3_REGION` | Région (`fr-par`) |
| `S3_BUCKET` | Nom du bucket (`docdoc-json-storage`) |
| `AWS_ACCESS_KEY_ID` | Clé d'accès S3 (prod : clé IAM ; local : `minioadmin`) |
| `AWS_SECRET_ACCESS_KEY` | Clé secrète S3 |

En production, ces variables sont déjà injectées par le `main.tf` dans le conteneur Scaleway (voir plus bas).

### Développement local avec MinIO

Pour un dev local sans identifiants cloud, `docker-compose.yml` lance un service **MinIO** (object storage compatible S3) et câble le service `web` dessus. Au premier démarrage contre un bucket vide, l'application importe automatiquement les fichiers locaux de `data/` dans le bucket.

```bash
docker compose up --build
```

Le bucket et les données sont alors persistés dans le volume MinIO (`gestion-prj-perso-minio-data`).
URL : http://localhost:9000
Compte : minioadmin:minioadmin

## Compilation pour démarrer localement l'application
```bash
pnpm start
```

## Compilation de l'application

```bash
docker login
```

emmanuel7044

## Création et enregistrement de l'image docker
```bash
docker build -t emmanuel7044/docdoc:1.1 .
```

### Approvisionnement des ressources sur le PaaS scaleway
```bash
docker push emmanuel7044/docdoc:1.1
```

## Approvisionnement des ressources sur le PaaS scaleway
# 1. Initialiser le projet et télécharger le provider Scaleway
```bash
tofu init
```

# 2. Prévisualiser les modifications qui vont être appliquées
```bash
tofu plan
```

# 3. Créer l'infrastructure sur Scaleway
```bash
tofu apply
```

## Test de l'application à l'adresse suivante
https://<nom-de-votre-conteneur>-<hash-unique>.functions.fnc.fr-par.scw.cloud
https://docdocnamespace572c01fb-docdoc-app.functions.fnc.fr-par.scw.cloud
