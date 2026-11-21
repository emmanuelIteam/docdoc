# Déployer l'infrastructure sur Scaleway

Procédure de création et de mise à jour des ressources cloud de docdoc : namespace et conteneur Serverless, bucket S3, clés IAM, domaine personnalisé et envoi des emails.

Retour au [README](../README.md) · Étape suivante : [publier une version](publier-une-version.md).

## Ce que crée `main.tf`

| Ressource | Rôle |
| --- | --- |
| `scaleway_container_namespace.main` | Namespace `docdoc-namespace` qui porte le conteneur. |
| `scaleway_container.app` | Conteneur `docdoc-app` : image `var.app_image`, port `3000`, une instance (`min_scale` = 1 ou 0 selon `keep_warm`), palier 128 Mo / 70 mVCPU. |
| `scaleway_object_bucket.json_data` | Bucket `docdoc-json-storage` qui contient toutes les données. `force_destroy = false` : un destroy échoue tant qu'il n'est pas vide. |
| `scaleway_iam_application.api` + politiques | Identité de l'application, avec `ObjectStorageFullAccess` sur le projet et `TransactionalEmailFullAccess`. |
| `scaleway_iam_api_key.s3_credentials` | Clé de cette application, injectée dans le conteneur (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`). Elle porte une date d'expiration imposée par l'organisation. |
| `scaleway_domain_record.app`, `scaleway_container_domain.app` | Domaine personnalisé et certificat TLS, uniquement si `var.domain_name` est renseigné. |
| `scaleway_tem_domain.docdoc` + enregistrements SPF/DKIM/MX/DMARC + validation | Domaine d'envoi `docdoc.re` pour Transactional Email. |
| `output.app_url`, `output.rp_id`, `output.s3_bucket_name` | Valeurs utiles après l'apply. |

L'état OpenTofu est **local** (`terraform.tfstate` à la racine) : il n'y a pas de backend distant. Un `apply` lancé depuis une autre machine ne voit pas l'infrastructure existante et tenterait de la recréer. Travaille depuis un seul poste, ou mets en place un backend avant de changer de machine.

## Prérequis

- Un compte Scaleway et un projet.
- Une clé API IAM (Access Key + Secret Key) pour le provider OpenTofu.
- [OpenTofu](https://opentofu.org/) (`tofu`) et [SOPS](https://getsops.io/) avec age.
- Une image publiée sur Docker Hub (`docker.io/emmanuel7044/docdoc:<tag>`), via la [procédure de release](publier-une-version.md) ou à la main.
- Un domaine enregistré chez **Scaleway Domains & DNS** si tu veux servir un domaine personnalisé. C'est aussi le préalable à un domaine d'envoi authentifié.
- L'offre **Transactional Email « Essential »** souscrite dans la console Scaleway : l'abonnement n'est pas exposé par Terraform, et `main.tf` déclare le domaine d'envoi `docdoc.re` quel que soit `email_provider`.

## 1. Récupérer les identifiants Scaleway

Console Scaleway → profil (en haut à droite) → **IAM & API Keys** → onglet *API Keys* → **+ Generate API key**.

Conserver :

- l'**Access Key** (`SCWXXXXXXXXXXXXX`) ;
- la **Secret Key**, affichée une seule fois.

Renseigner aussi l'**organisation** et le **projet** (même écran). Le provider les lit dans l'environnement :

| Variable | Rôle |
| --- | --- |
| `SCW_ACCESS_KEY` | Access Key du provider. |
| `SCW_SECRET_KEY` | Secret Key du provider. |
| `SCW_DEFAULT_ORGANIZATION_ID` | Organisation qui porte les ressources. |
| `SCW_DEFAULT_PROJECT_ID` | Projet par défaut. |

```bash
export SCW_ACCESS_KEY=...
export SCW_SECRET_KEY=...
export SCW_DEFAULT_ORGANIZATION_ID=...
export SCW_DEFAULT_PROJECT_ID=...
```

Sous PowerShell : `$env:SCW_ACCESS_KEY = "..."`, etc. Ces valeurs vont ensuite dans `secrets.sops.yaml` (section suivante) plutôt que dans un fichier du dépôt.

## 2. Secrets : SOPS et `TF_VAR_*`

`main.tf` déclare `variable "session_secret"` **sans défaut** : tout `plan` ou `apply` échoue sans elle. Les valeurs sensibles ne sont pas versionnées en clair : elles vivent dans `secrets.sops.yaml`, chiffré avec SOPS + age.

### Fournir les variables OpenTofu

OpenTofu ne lit pas `.env`. Il connaît `terraform.tfvars`, `*.auto.tfvars`, `-var-file`, `-var` et les variables d'environnement `TF_VAR_<nom>`. Le préfixe est le pont : `TF_VAR_session_secret` alimente `variable "session_secret"`.

Le secret de session se génère **une seule fois** (`openssl rand -hex 32`). Le régénérer invalide toutes les sessions actives à chaque déploiement ; les passkeys, elles, vivent dans le bucket et ne sont pas touchées.

### Mise en place de SOPS (quatre commandes)

```bash
# 1. La clé age, à l'emplacement que sops cherche sous Windows.
#    Relancer la commande échoue sans rien écraser.
mkdir -p "$HOME/AppData/Roaming/sops/age"
age-keygen -o "$HOME/AppData/Roaming/sops/age/keys.txt"
#    >>> Sauvegarder ce fichier (gestionnaire de mots de passe) : sans lui,
#    >>> les secrets chiffrés sont irrécupérables.

# 2. La règle de chiffrement : quelle clé publique pour quel fichier.
PUB="$(age-keygen -y "$HOME/AppData/Roaming/sops/age/keys.txt")"
printf 'creation_rules:\n  - path_regex: secrets\\.sops\\.yaml$\n    age: %s\n' "$PUB" > .sops.yaml
cat .sops.yaml

# 3. Le squelette, encore en clair, puis son chiffrement.
cat > secrets.sops.yaml <<'EOF'
SCW_ACCESS_KEY: remplacer
SCW_SECRET_KEY: remplacer
SCW_DEFAULT_ORGANIZATION_ID: remplacer
SCW_DEFAULT_PROJECT_ID: remplacer
TF_VAR_session_secret: remplacer
EOF
sops -e -i secrets.sops.yaml
head -1 secrets.sops.yaml     # doit afficher ENC[AES256_GCM,...

# 4. Saisir les vraies valeurs : sops déchiffre dans l'éditeur et rechiffre
#    à l'enregistrement. (EDITOR=vim, nano, ou « code --wait ».)
EDITOR="code --wait"
sops secrets.sops.yaml
```

### Quelles valeurs, et d'où elles viennent

| Clé | Origine | Requis |
| --- | --- | --- |
| `SCW_ACCESS_KEY`, `SCW_SECRET_KEY` | Console → IAM & API keys, identifiants du provider. | oui |
| `SCW_DEFAULT_ORGANIZATION_ID`, `SCW_DEFAULT_PROJECT_ID` | Même écran. | oui |
| `TF_VAR_session_secret` | À générer : `openssl rand -hex 32`. | oui |
| `TF_VAR_tem_secret_key`, `TF_VAR_tem_project_id` | Clé IAM autorisée à envoyer via Transactional Email ; par défaut la clé de l'application est utilisée. | non |
| `SESSION_SECRET` | Même valeur que `TF_VAR_session_secret`, utile pour lancer l'application en local via sops. | non |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Produits par Terraform, injectés dans le conteneur. Ne servent qu'à faire tourner l'application locale contre le bucket Scaleway. | non |

### Utiliser les secrets

```bash
sops exec-env secrets.sops.yaml 'tofu plan'
sops exec-env secrets.sops.yaml 'tofu apply'
```

Pour lancer l'application en local avec ces secrets, le plus simple reste d'exporter `TF_VAR_session_secret` (pont ci-dessus) puis de lancer l'implémentation voulue : `npm start` pour la référence Node, ou `cd rust && cargo run` pour le serveur publié. `sops exec-env` est prévu pour une commande passée en un seul argument, ce qui complique les commandes composées sous Windows.

Ne jamais déchiffrer vers un fichier (`sops -d secrets.sops.yaml > secrets.yaml`) : les valeurs se saisissent dans sops, et le YAML en clair ne doit jamais exister sur le disque.

### Pont ponctuel avec `.env`

Si `.env` est ta source unique pour le développement, exporte le secret au lieu de le dupliquer :

```bash
export TF_VAR_session_secret="$(sed -n 's/^SESSION_SECRET=//p' .env)"
```

### Trois pièges vérifiés sous Windows

- SOPS ne cherche pas `~/.config/sops/age/keys.txt` mais `%APPDATA%\sops\age\keys.txt` : d'où le chemin de l'étape 1.
- `sops exec-env` attend la commande en **un seul argument** (`exec-env <fichier> '<commande>'`), sans passer par un shell : pas de guillemets imbriqués à l'intérieur.
- Un chemin POSIX (`/c/Users/...`) dans `SOPS_AGE_KEY_FILE` échoue : MSYS convertit les arguments de commande, pas les variables d'environnement.

## 3. Variables OpenTofu

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `app_image` | `docker.io/emmanuel7044/docdoc:1.11` | Image du conteneur. Vérifie ce défaut : il peut être en retard sur le dernier tag publié. Un `tofu apply` impose cette valeur. |
| `keep_warm` | `true` | `true` : une instance reste allumée (réponse immédiate, toujours 0 € au palier 128 Mo). `false` : mise à l'échelle à zéro, quelques secondes de démarrage à la première requête. |
| `rp_id` | déduit | RP ID WebAuthn (nom d'hôte sans schéma ni port). Vide : déduit du domaine personnalisé, sinon de l'endpoint généré. |
| `rp_origin` | `https://` + RP ID | Origine WebAuthn complète. Vide : déduite. |
| `domain_name` | `""` | Domaine personnalisé, par exemple `docdoc.re`. Vide : endpoint généré. Le domaine doit déjà exister dans Scaleway Domains & DNS. |
| `domain_record_name` | `""` | `""` pour la racine ; `app` ou `www` pour un sous-domaine. |
| `domain_record_type` | `ALIAS` | `ALIAS` à la racine ; `CNAME` dès que `domain_record_name` n'est pas vide. |
| `attach_domain` | `true` | `false` crée le seul enregistrement DNS, sans déclarer l'endpoint (première étape de l'apply en deux temps). |
| `authorized_emails` | `emmanuel.grandiere@laposte.net` | Adresses autorisées, séparées par des virgules. |
| `email_provider` | `scaleway` | Fournisseur des codes. Ne jamais laisser `dev` en production. |
| `email_from` | `noreply@docdoc.re` | Expéditeur, sur un domaine authentifié SPF/DKIM. |
| `session_secret` | — (**obligatoire**) | Signature du cookie. Via `TF_VAR_session_secret`. |
| `tem_secret_key`, `tem_project_id` | `""` | Clé et projet dédiés à Transactional Email ; par défaut la clé de l'application. |

`memory_limit` et `cpu_limit` ne sont pas des variables : ils sont fixés dans `main.tf` au palier 128 Mo / 70 mVCPU. Passer au palier supérieur (256 Mo / 140 mVCPU) dépasse les plafonds du free tier, pour environ 1,90 €/mois.

## 4. Créer l'infrastructure

```bash
tofu init
sops exec-env secrets.sops.yaml 'tofu plan'
sops exec-env secrets.sops.yaml 'tofu apply'
```

Sans `-var domain_name`, l'application reste sur son endpoint généré (`https://docdocnamespace…functions.fnc.fr-par.scw.cloud`) et aucun enregistrement DNS n'est créé.

Après l'apply :

```bash
tofu output app_url
tofu output rp_id
tofu output s3_bucket_name
```

Ouvre `app_url` et crée le premier compte (adresse de `authorized_emails`, code reçu par email, passkey).

> **Fais-le après avoir figé le nom d'hôte.** Une passkey est liée à vie au RP ID. Tant que le conteneur n'expose que son endpoint généré, recréer le namespace change ce nom et invalide toutes les passkeys enregistrées. Rattacher le domaine personnalisé **avant** la première passkey est la seule façon de figer la valeur ; en attendant, la récupération par code email reste possible.

## 5. Rattacher le domaine personnalisé

Le domaine s'achète dans **Domains & Web Hosting → Domains and DNS** (l'enregistrement d'un `.re` est facturé à l'année, zone DNS incluse). Une fois la zone hébergée chez Scaleway, `main.tf` sait y écrire ; le certificat TLS de l'endpoint personnalisé est émis et renouvelé gratuitement par Let's Encrypt.

Scaleway impose un **ordre** : l'enregistrement DNS doit d'abord résoudre vers l'endpoint du conteneur, et seulement ensuite le domaine est déclaré sur le conteneur. Dans l'autre sens, le challenge HTTP-01 échoue après 3 minutes et l'endpoint reste en statut `error`. D'où un apply en deux temps :

```bash
# 1. L'enregistrement DNS seul (ALIAS à la racine, vers l'endpoint du conteneur)
sops exec-env secrets.sops.yaml 'tofu apply -var domain_name=docdoc.re -var attach_domain=false'

# 2. Vérifier que la résolution pointe bien vers le conteneur
dig docdoc.re @1.1.1.1
dig docdoc.re @8.8.8.8

# 3. Déclarer l'endpoint personnalisé sur le conteneur (certificat TLS émis ici)
sops exec-env secrets.sops.yaml 'tofu apply -var domain_name=docdoc.re'
```

`attach_domain` ne vaut `false` qu'à l'étape 1 : sa valeur par défaut (`true`) garantit qu'un apply ultérieur, même sans variable, ne retire jamais l'endpoint personnalisé par inadvertance. Si l'étape 3 rend un endpoint en statut `error`, la résolution n'était pas encore visible : relancer simplement `tofu apply`.

`rp_id` et `rp_origin` sont alors calculés automatiquement (`docdoc.re` et `https://docdoc.re`) et injectés dans le conteneur. Pour servir un sous-domaine plutôt que la racine :

```bash
sops exec-env secrets.sops.yaml 'tofu apply -var domain_name=docdoc.re -var domain_record_name=app -var domain_record_type=CNAME'
```

L'hôte devient `app.docdoc.re`. Retour en arrière : un apply **sans** `-var domain_name` retire l'endpoint personnalisé et l'enregistrement DNS. Le domaine, lui, reste enregistré et facturé.

## 6. Emails (Transactional Email)

`main.tf` déclare le domaine d'envoi `docdoc.re` et crée les enregistrements SPF, DKIM, MX « trou noir » et DMARC à partir des valeurs exposées par le provider, puis attend la validation Scaleway (30 minutes au plus). Aucune valeur n'est recopiée à la main.

Deux préalables hors Terraform :

1. Souscrire à l'offre **TEM « Essential »** sur le projet, dans la console.
2. Utiliser un expéditeur sur un **domaine authentifié** : une adresse `@laposte.net` serait rejetée.

Le chemin Terraform configure Scaleway TEM ; `email_provider = "brevo"` n'est pas câblé par `main.tf` (aucune injection de `BREVO_API_KEY`). Pour Brevo, il faut ajouter la variable au conteneur à la main.

## 7. Coûts

Le free tier Serverless Containers est de **400 000 GB/s et 200 000 vCPU/s par compte et par mois**. Au palier 128 Mo / 0,07 vCPU, une instance allumée 30 jours consomme 324 000 GB/s et 181 440 vCPU/s : le conteneur peut rester allumé en permanence sans rien coûter.

| Poste | Coût |
| --- | --- |
| Conteneur 128 Mo / 70 mVCPU, une instance | 0 € dans le free tier. |
| Conteneur 256 Mo / 140 mVCPU | ~1,90 €/mois (plafonds dépassés). |
| Domaine `.re` | Facturé à l'année chez Scaleway Domains & DNS. |
| Transactional Email | Offre Essential, facturée séparément. |

Surveille la consommation du mois dans la [console de facturation](https://console.scaleway.com/billing/overview) avant toute augmentation de `memory_limit` ou `cpu_limit`.

## 8. Mettre à jour l'infrastructure

```bash
sops exec-env secrets.sops.yaml 'tofu plan'
sops exec-env secrets.sops.yaml 'tofu apply'
```

`app_image` est un champ comme un autre : un apply l'impose. Or le pipeline de release met le conteneur à jour par l'API Scaleway **sans** modifier `main.tf`. Un seul écrivain à la fois :

- après une release, aligne `app_image` sur le tag déployé (ou passe `-var app_image=…`) avant le prochain apply, sinon l'image revient à l'ancienne version ;
- le `plan` affiche ce changement d'image avant de l'appliquer.

La clé S3 du conteneur porte une date d'expiration (`expires_at` dans `main.tf`). Pour la renouveler, change cette date puis applique : lis le `plan` pour savoir si la clé est remplacée (nouvelle paire, à récupérer dans le conteneur) ou seulement prolongée.

## 9. Détruire l'infrastructure

```bash
sops exec-env secrets.sops.yaml 'tofu destroy'
```

Le bucket a `force_destroy = false` : le destroy **échoue** tant qu'il contient des objets. Vider le bucket d'abord (console Scaleway ou un client S3), puis relancer. Le domaine enregistré et l'abonnement TEM ne sont pas détruits par Terraform : ils restent facturés.

Sauvegarder le bucket **avant** toute destruction ou bascule : l'adoption des données déplace des clés, elle ne les copie pas.

## 10. Dépannage

| Erreur | Cause | Solution |
| --- | --- | --- |
| `denied authentication: API key is expired` | La clé API Scaleway a expiré (politique d'organisation). | Régénérer une clé dans IAM & API keys et la saisir dans `secrets.sops.yaml`. |
| `invalid API key format or empty value` | Seul le couple organisation/projet est présent. | Renseigner aussi `SCW_ACCESS_KEY` et `SCW_SECRET_KEY`. |
| Endpoint personnalisé en statut `error` après 3 minutes | Le challenge HTTP-01 a eu lieu avant que le DNS ne résolve. | Vérifier `dig`, puis relancer `tofu apply`. |
| Le conteneur ne démarre pas, image introuvable | Le tag n'a pas été publié sur Docker Hub, ou l'image n'est pas `amd64`. | Publier l'image, puis relancer l'apply ou le pipeline. |
| L'application renvoie des erreurs S3 en production | La clé S3 a expiré ou la politique IAM a changé. | Vérifier `AWS_ACCESS_KEY_ID` dans le conteneur, renouveler la clé (`expires_at`). |
| `tofu` veut recréer des ressources existantes | État local absent ou obsolète (autre poste, état supprimé). | Restaurer `terraform.tfstate` ; ne pas appliquer depuis deux machines. |

## 11. Secrets versionnés : à vérifier

Deux fichiers peuvent contenir des secrets en clair :

- `.env` (identifiants Scaleway du provider) ;
- `terraform.tfstate` (clé S3, `session_secret`, clé TEM, valeurs injectées).

SOPS chiffre la **source**, pas l'état. Vérifie ce qui est réellement suivi par git :

```bash
git ls-files .env terraform.tfstate terraform.tfstate.backup
```

Si l'un d'eux apparaît, retire-le de l'index et ajoute-le au `.gitignore` :

```bash
git rm --cached .env terraform.tfstate terraform.tfstate.backup
printf '.env\nterraform.tfstate*\n' >> .gitignore
```

Le retrait de l'index ne supprime pas l'historique : considère les valeurs exposées comme compromises et fais tourner les clés concernées (IAM, `session_secret`, TEM). Conserve une copie de l'état hors du dépôt : sans lui, OpenTofu perd la trace des ressources.
