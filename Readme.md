# docdoc : Gestion de projet perso
https://docdocnamespace572c01fb-docdoc-app.functions.fnc.fr-par.scw.cloud

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

### Développement local : MinIO + Mailpit

`docker-compose.yml` lance deux services, et l'application tourne sur l'hôte :

| Service | Rôle | Adresse |
| --- | --- | --- |
| `minio` | Stockage objet compatible S3 (les données) | API http://127.0.0.1:19000 · console `http://127.0.0.1:19001` |
| `mailpit` | Catcher SMTP : reçoit tous les emails au lieu d'une vraie boîte | SMTP localhost:1026 · interface `http://localhost:8025` |

```bash
docker compose up -d          # MinIO + Mailpit
cp .env.example .env          # déjà réglé pour ce montage
```
```bash
pnpm start                    
```
#### l'application sur `http://localhost:3000`

Le fichier `.env.example` est pré-réglé pour ce montage : `S3_ENDPOINT=http://127.0.0.1:19000`,
`EMAIL_PROVIDER=smtp`, `SMTP_HOST=localhost`, `SMTP_PORT=1026`. Les messages sont conservés en
mémoire par Mailpit : ils disparaissent à l'arrêt du conteneur, ce qui est le comportement voulu
pour un catcher. Aucun compte, aucun domaine à authentifier, aucune clé à demander. http://127.0.0.1:19001

#### Console d'admin MinIO : `http://127.0.0.1:19001`
Utilisateur et mot de passe : `minioadmin`

MinIO est publié sur `19000`/`19001` et non sur `9000`/`9001` (les ports internes du conteneur
restent `9000`/`9001`). Sur un poste Windows équipé d'un agent d'interception réseau d'entreprise
(Zscaler Z-Tunnel), le port `9000` de l'hôte est capté par cet agent : il répond à la place de
MinIO, si bien que `HeadBucket` semble réussir (« 200 Connection Established ») alors que tous les
`GET`/`PUT` restent suspendus indéfiniment — l'application démarre, puis la moindre lecture de
données ne revient jamais. `S3_ENDPOINT` vise de plus `127.0.0.1` et non `localhost`, dont la
résolution IPv6 (`::1`) traverse le même agent (d'où un `ECONNRESET: socket hang up` immédiat).

Le service `web` (l'application dans un conteneur) est présent mais **commenté** dans
`docker-compose.yml` : l'activer fait tout tourner dans compose, auquel cas `SMTP_HOST` doit valoir
`mailpit` (le nom du service) et non `localhost`.

Le bucket et les données sont persistés dans le volume MinIO (`gestion-prj-perso-minio-data`). Au
premier démarrage contre un bucket vide, l'application importe les fichiers locaux de `data/`.

## Accès par passkeys (WebAuthn)

L'application est verrouillée : sans session, aucune page, aucun fragment et aucune route API ne
révèle quoi que ce soit. L'authentification se fait par **passkey** (Touch ID, Windows Hello, clé de
sécurité, gestionnaire de mots de passe), amorcée une seule fois par un **code à usage unique envoyé
par email**.

### L'enrôlement, en quatre étapes

1. La page d'accueil indique qu'aucun espace n'est associé au navigateur et propose **deux portes** :
   « Créer un compte » et « Se connecter ». Le serveur ne peut pas savoir si vous avez déjà un
   espace : l'absence de session n'est pas l'absence de compte.
2. Vous saisissez votre adresse email. Elle est comparée à la liste d'habilitation **avant tout
   envoi** : une adresse non autorisée est refusée immédiatement, et aucun email n'est expédié
   (docdoc ne doit pas pouvoir servir de relais d'envoi).
3. Un code à six chiffres est envoyé (valable 10 minutes, usage unique, 5 essais, renvoi possible
   après 60 secondes). Le code ouvre une **session d'enrôlement** limitée : elle ne donne accès ni
   aux domaines, ni aux thèmes, ni à aucune route de données.
4. La passkey est enregistrée. L'espace du compte est créé à ce moment-là seulement.

### Où vivent les données

Chaque compte possède son arborescence dans le bucket :

```
users/
├── by-email/{sha256(email)}.json        index email → compte (aucune adresse en clair)
├── by-credential/{credentialId}.json    index passkey → compte (connexion sans saisir d'email)
└── {userId}/                            userId opaque, jamais l'adresse email
    ├── account.json
    ├── themes.json
    ├── domains/{id}.json
    └── archive/{id}.json
```

Un domaine, un thème ou une archive d'un compte ne peut pas être atteint depuis un autre compte :
toutes les clés sont préfixées par `users/{userId}/`, et le compte est toujours résolu depuis la
session, jamais depuis un paramètre de requête.

### Récupération : appareil perdu, toutes les passkeys perdues

Le parcours par code email **reste disponible en permanence** et constitue la seule porte de secours.

| Situation | Marche à suivre |
| --- | --- |
| Nouvel appareil, passkey existante ailleurs | Page d'accueil → « Se connecter » (aucune adresse à saisir : le navigateur propose la passkey). |
| Appareil perdu, une autre passkey subsiste | Se connecter, puis « Mes passkeys » → révoquer la passkey perdue. |
| Toutes les passkeys perdues | Page d'accueil → « Créer un compte » → saisir l'adresse autorisée → code → enregistrer une passkey. **Le compte existant est réutilisé**, aucune donnée n'est dupliquée. La nouvelle passkey s'ajoute aux anciennes. |
| Adresse email elle-même perdue | Aucun recours : c'est le seul point de défaillance du dispositif. Voir « Risques » ci-dessous. |

La **dernière passkey ne peut pas être révoquée** : l'interface le refuse et demande d'en enregistrer
une autre d'abord.

### Configuration

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `SESSION_SECRET` | — | Signature du cookie de session. **Obligatoire en production** : sans elle le serveur refuse de démarrer. Générer avec `openssl rand -hex 32`. |
| `AUTHORIZED_EMAILS` | `emmanuel.grandiere@laposte.net` | Adresses autorisées, séparées par des virgules. La règle est en configuration, pas en dur dans le code. |
| `RP_ID` | `localhost` en développement | Nom d'hôte servi, **sans schéma ni port** (`docdoc.example.org`). |
| `RP_ORIGIN` | `http://localhost:3000` en développement | Origine complète, schéma et port compris. |
| `EMAIL_PROVIDER` | `dev` | `dev` (code écrit dans les journaux), `smtp`, `scaleway` ou `brevo`. |
| `EMAIL_FROM` | — | Expéditeur. Voir « Domaine d'envoi » ci-dessous. |
| `EMAIL_REGION` | `fr-par` | Région Scaleway Transactional Email. |
| `SMTP_HOST` | — | Relais SMTP : `localhost` pour Mailpit, `mailpit` depuis un conteneur. |
| `SMTP_PORT` | `1026` | Port SMTP (`1026` Mailpit sur cet hôte, `1025` port interne du conteneur, `587` soumission, `465` TLS implicite). |
| `SMTP_SECURE` | `false` | `true` pour du TLS dès le premier octet (port 465). |
| `SMTP_REQUIRE_TLS` | `false` | `true` pour exiger STARTTLS sur un port en clair. |
| `SMTP_ALLOW_SELF_SIGNED` | `false` | `true` pour accepter un certificat auto-signé (vérification active sinon). |
| `SMTP_USER`, `SMTP_PASSWORD` | — | Identifiants du relais, s'il en exige. |
| `SCW_SECRET_KEY` | — | Clé secrète IAM pour l'API Transactional Email (en-tête `X-Auth-Token`). |
| `SCW_DEFAULT_PROJECT_ID` | — | Projet Scaleway rattaché aux envois. |
| `BREVO_API_KEY` | — | Identifiant Brevo si `EMAIL_PROVIDER=brevo`. |
| `OTP_TTL_SECONDS` | `600` | Durée de vie d'un code. |
| `OTP_RESEND_COOLDOWN_SECONDS` | `60` | Délai minimum entre deux demandes de code. |
| `OTP_MAX_ATTEMPTS` | `5` | Essais par code avant invalidation. |
| `OTP_MAX_REQUESTS` | `5` | Demandes de code autorisées par fenêtre. |
| `OTP_REQUEST_WINDOW_SECONDS` | `900` | Durée de la fenêtre de limitation. |
| `DOCDOC_DATA_DIR` | `./data` | Emplacement des fichiers historiques, importés une seule fois. |

### ⚠ Le RP ID gèle les passkeys

Une passkey est liée pour sa vie au **nom d'hôte** servi par l'application. Tant que le conteneur
Scaleway n'expose que son endpoint généré
(`docdocnamespace572c01fb-docdoc-app.functions.fnc.fr-par.scw.cloud`), recréer le namespace change ce
nom et **invalide d'un coup toutes les passkeys enregistrées**. Rattacher un domaine personnalisé au
conteneur (voir « Rattacher le domaine personnalisé » ci-dessous) est la seule façon de figer cette
valeur : `rp_id` et `rp_origin` en sont alors déduits automatiquement. En
attendant, la récupération par code email reste fonctionnelle.

### Domaine d'envoi des emails

**En local, aucun domaine n'est nécessaire** : `EMAIL_PROVIDER=smtp` pointe sur Mailpit, aucun compte
ni authentification SPF/DKIM n'entre en jeu. C'est le montage décrit plus haut.

Pour un envoi réel, en revanche, le fournisseur doit être configuré avec un **domaine authentifié
(SPF/DKIM)**. Une adresse `@laposte.net` comme expéditeur serait rejetée : utilisez un domaine dont
vous maîtrisez les enregistrements DNS. Pour Scaleway, la clé utilisée doit porter
`TransactionalEmail` en écriture.

| Fournisseur | Ce qu'il faut | Remarque |
| --- | --- | --- |
| `smtp` | `SMTP_HOST`, `SMTP_PORT`, `EMAIL_FROM`, éventuellement `SMTP_USER`/`SMTP_PASSWORD` | Fonctionne avec Mailpit en local, et avec les relais SMTP de Scaleway TEM ou de Brevo en production. |
| `scaleway` | `SCW_SECRET_KEY`, `SCW_DEFAULT_PROJECT_ID`, `EMAIL_FROM` | API HTTP, même compte et même région que le conteneur et le bucket. |
| `brevo` | `BREVO_API_KEY`, `EMAIL_FROM` | API HTTP, repli documenté. |

Si `EMAIL_PROVIDER=dev` (la valeur par défaut), **aucun email n'est envoyé** : le code est écrit dans
les journaux du serveur, sur cette ligne :

```
[docdoc][dev] code pour vous@example.com : 123456 (valable 10 min)
```

C'est la première chose à vérifier quand « le code n'arrive pas ». Le serveur annonce son mode au
démarrage (`Envoi des codes : …`) et la page de saisie du code le répète. Un avertissement est en
outre émis au démarrage si ce mode est actif avec `NODE_ENV=production`, ou si les identifiants du
fournisseur configuré sont incomplets.

### Le fichier `.env`

L'application lit un fichier `.env` à la racine au démarrage, sans écraser les variables déjà
présentes dans l'environnement (celles injectées par le conteneur restent prioritaires) :

```bash
cp .env.example .env
```

### Amorçage et migration des données existantes

Les données écrites avant les comptes (clés `domains/`, `archive/`, `themes.json` à la racine du
bucket) sont adoptées dans l'espace du premier compte, **une seule fois**. Pour pré-créer le compte
hors ligne et déclencher l'adoption avant de basculer :

```bash
npm run bootstrap                      # utilise la première adresse de AUTHORIZED_EMAILS
npm run bootstrap -- autre@example.com # ou une adresse explicite
```

La commande est idempotente : la relancer ne déplace rien deux fois. L'application effectue la même
adoption automatiquement à la création d'un compte, si vous ne passez pas par le script.

Un espace neuf **ne reçoit aucun domaine d'exemple** : il démarre vide.

### Rollback

1. Restaurer l'image et `main.tf` précédents (`tofu apply`), ce qui remet en service la version sans
   contrôle d'accès.
2. Les objets déplacés sous `users/{userId}/` restent lisibles par l'ancienne version **uniquement
   après** les avoir remis à la racine du bucket : recopier `users/{userId}/domains/*` vers
   `domains/*`, `users/{userId}/archive/*` vers `archive/*` et `users/{userId}/themes.json` vers
   `themes.json`.
3. Les passkeys enregistrées restent valides — le RP ID n'a pas changé — et redeviennent utilisables
   au redéploiement suivant.

Sauvegarder le bucket **avant** toute bascule : l'adoption déplace les clés, elle ne les copie pas.

## Compilation pour démarrer localement l'application
```bash
pnpm start
```

## Compilation de l'application

## Création et enregistrement de l'image docker
```bash
docker build -t emmanuel7044/docdoc:1.3 .
```
```bash
docker push emmanuel7044/docdoc:1.3
```

> Le tag poussé doit correspondre à `var.app_image` dans `main.tf`
> (`docker.io/emmanuel7044/docdoc:1.1` par défaut).
> Le dépôt Docker Hub `emmanuel7044/docdoc` ne publie que les tags `1.0` et `1.1` — le tag `2.0`
> utilisé par une version antérieure de `main.tf` n'existe pas.
> L'image est **amd64 uniquement**.

## Approvisionnement de l'infrastructure sur Scaleway (offre gratuite)

`main.tf` déploie l'image Docker dans un **conteneur Serverless** Scaleway, dont l'offre gratuite
couvre ce cas d'usage.

### Le budget du free tier

Le free tier Serverless Containers est de **400 000 GB/s et 200 000 vCPU/s par compte et par mois**
([tarifs](https://www.scaleway.com/en/docs/serverless/containers/faq/)). Au palier le plus bas
(**128 Mo / 0,07 vCPU**), une instance allumée 30 jours consomme :

| Ressource | Consommation mensuelle | Plafond gratuit |
| --- | --- | --- |
| Mémoire (0,125 GB × 2 592 000 s) | 324 000 GB/s | 400 000 GB/s |
| vCPU (0,07 × 2 592 000 s) | 181 440 vCPU/s | 200 000 vCPU/s |

Les deux plafonds ne sont pas atteints : **le conteneur peut rester allumé en permanence sans rien
coûter**. Au palier suivant (256 Mo / 0,14 vCPU), les deux plafonds sont dépassés (~1,90 €/mois) :
ne pas augmenter `memory_limit` / `cpu_limit` sans vérifier la consommation du mois dans la
[console Scaleway](https://console.scaleway.com/billing/overview).

> Note : `cpu_limit` vaut 70 mVCPU par défaut. Le champ `memory_limit` est marqué déprécié par le
> provider au profit de `memory_limit_bytes`, mais il est conservé ici car il désigne le palier sans
> ambiguïté d'unité (le provider affiche un avertissement de dépréciation, sans impact).

### Variables

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `app_image` | `docker.io/emmanuel7044/docdoc:1.1` | Image Docker déployée. |
| `keep_warm` | `true` | `true` = une instance reste allumée (réponse instantanée, toujours 0 €). `false` = mise à l'échelle à zéro (quelques secondes de démarrage à la première requête). |
| `rp_id` | domaine personnalisé, sinon endpoint généré | RP ID WebAuthn : nom d'hôte sans schéma ni port. Laisser vide : la valeur est déduite de `domain_name`. Ne renseigner que pour forcer une valeur (par exemple le domaine parent quand l'application est servie sur un sous-domaine). |
| `rp_origin` | `https://` + RP ID effectif | Origine HTTPS complète. Laisser vide : la valeur est déduite. |
| `domain_name` | `""` | Domaine personnalisé rattaché au conteneur, ex. `docdoc.re`. Vide : l'application reste sur l'endpoint généré. Le domaine doit déjà exister dans Scaleway Domains & DNS, qui héberge sa zone. |
| `domain_record_name` | `""` | `""` sert le domaine à la racine ; `app` ou `www` sert un sous-domaine (l'hôte final devient `app.docdoc.re`). |
| `domain_record_type` | `ALIAS` | `ALIAS` à la racine, où un CNAME est interdit et où Scaleway DNS gère les ALIAS ; `CNAME` dès que `domain_record_name` n'est pas vide. |
| `attach_domain` | `true` | `false` crée le seul enregistrement DNS, sans déclarer l'endpoint sur le conteneur : première étape de l'apply en deux temps. Laisser `true` le reste du temps. |
| `authorized_emails` | `emmanuel.grandiere@laposte.net` | Adresses autorisées, séparées par des virgules. |
| `email_provider` | `scaleway` | `scaleway` ou `brevo`. Ne jamais laisser `dev` en production. |
| `email_from` | `""` | Expéditeur des codes, sur un **domaine authentifié SPF/DKIM**. |
| `session_secret` | — (**obligatoire**) | Secret de signature du cookie de session. À fournir via `TF_VAR_session_secret`. |
| `tem_secret_key` | `""` | Clé secrète IAM autorisée à envoyer via Transactional Email. |
| `tem_project_id` | `""` | Projet Scaleway rattaché aux envois. |

#### Fournir les secrets

Les valeurs sans défaut ne sont pas versionnées : OpenTofu les lit dans l'environnement, sous la
forme `TF_VAR_<nom_de_variable>`. Ce préfixe est ce qui relie la variable d'environnement à la
variable déclarée dans `main.tf` : `TF_VAR_session_secret` alimente `variable "session_secret"`.

Deux façons de les fournir : **SOPS** (recommandé — voir « SOPS : en place » plus bas) ou, à la main,
dans `~/.bash_profile` (ci-dessous).

**Le secret de session se génère une seule fois.** Le régénérer avant chaque `tofu apply` change la
clé de signature du cookie à chaque déploiement : toutes les sessions actives sont invalidées et il
faut se réauthentifier. Les passkeys, elles, ne sont pas touchées — elles vivent dans le bucket.

Depuis un bash (Git Bash sous Windows, WSL, macOS, Linux), l'installer une fois pour toutes dans le
fichier de démarrage du shell — donc **hors du dépôt** :

```bash
# À LANCER UNE SEULE FOIS. Le garde-fou grep rend la commande inoffensive si on la relance :
# elle n'ajoute pas de seconde valeur et ne régénère donc jamais le secret.
grep -q TF_VAR_session_secret ~/.bash_profile 2>/dev/null || \
  printf '\n# docdoc : secret de session OpenTofu (généré une seule fois)\nexport TF_VAR_session_secret=%s\n' \
    "$(openssl rand -hex 32)" >> ~/.bash_profile
```

Git Bash démarre bash en shell de *login* : il lit `/etc/profile`, puis le premier fichier existant
parmi `~/.bash_profile`, `~/.bash_login` et `~/.profile`. Écrire dans `~/.bash_profile` garantit donc
d'être lu, sans dépendre du fait que `~/.bashrc` soit sourcé ou non.

Vérification dans un **nouveau** terminal (la longueur doit être 64) :

```bash
echo -n "$TF_VAR_session_secret" | wc -c
```

Si tu préfères ne pas toucher à ton `~/.bash_profile`, écris la ligne `export` dans un fichier hors
dépôt (par exemple `~/.docdoc-secrets`) et fais `source ~/.docdoc-secrets` en début de session :
c'est sans risque, la valeur étant déjà figée.

Sous PowerShell (alternative), l'équivalent persistant est l'environnement utilisateur :

```powershell
# Générer une fois, puis confier la valeur à l'environnement utilisateur
$bytes = [byte[]]::new(32)
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$secret = -join ($bytes | ForEach-Object { $_.ToString('x2') })
[Environment]::SetEnvironmentVariable('TF_VAR_session_secret', $secret, 'User')
```

`openssl rand -hex 32` demande 32 octets aléatoires (256 bits) et les affiche en hexadécimal ;
`$(...)` insère le résultat dans l'affectation ; `export` rend la valeur visible par les processus
enfants, sans quoi la commande `tofu` lancée ensuite ne la verrait pas. `export` est propre à bash :
sous PowerShell, c'est `$env:TF_VAR_session_secret = $secret`.

Pour le développement local, `.env` porte sa propre ligne `SESSION_SECRET=` (voir `.env.example`) :
deux valeurs différentes entre local et production sont normales, ce sont deux environnements
distincts.

##### Pourquoi `.env` ne suffit pas

Rien ne charge `.env` automatiquement dans ce dépôt : pas de `dotenv`, pas de `--env-file`, pas
d'`env_file` dans `docker-compose.yml` — le fichier sert de référence pour lancer l'application à la
main. Surtout, **OpenTofu ne lit pas `.env`** : il ne connaît que `terraform.tfvars`,
`*.auto.tfvars`, `-var-file`, `-var` et les variables d'environnement `TF_VAR_*`. Consommer la même
valeur des deux côtés demande donc un pont explicite :

```bash
# Pont ponctuel, si tu préfères garder .env comme source unique
export TF_VAR_session_secret="$(sed -n 's/^SESSION_SECRET=//p' .env)"
```

##### SOPS : la mise en place, en quatre commandes

Les secrets de déploiement vivent dans `secrets.sops.yaml`, **versionné mais chiffré** (SOPS + age).
La clé privée age reste hors du dépôt ; seule la clé publique figure dans `.sops.yaml`, qui n'est pas
un secret. Rien de tout ceci n'est automatisé : quatre commandes, à lancer une fois.

```bash
# 1. La clé age, à l'emplacement que sops cherche par défaut sous Windows.
#    Relancer cette commande échoue (« Le fichier existe ») sans rien écraser.
mkdir -p "$HOME/AppData/Roaming/sops/age"
age-keygen -o "$HOME/AppData/Roaming/sops/age/keys.txt"
#    >>> Sauvegarder ce fichier (gestionnaire de mots de passe) : sans lui,
#    >>> les secrets chiffrés sont irrécupérables.

# 2. La règle de chiffrement : quelle clé publique pour quel fichier.
PUB="$(age-keygen -y "$HOME/AppData/Roaming/sops/age/keys.txt")"
printf 'creation_rules:\n  - path_regex: secrets\\.sops\\.yaml$\n    age: %s\n' "$PUB" > .sops.yaml
cat .sops.yaml          # vérifier la clé publique et le motif

# 3. Le squelette, encore en clair et sans valeur réelle, puis son chiffrement.
#    Les quatre SCW_* viennent de la console (IAM & API keys) et sont déjà dans
#    .env : les recopier ici est ce qui permettra à sops exec-env de les injecter
#    dans tofu. TF_VAR_session_secret, lui, ne se lit nulle part : il se génère.
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

##### Quelles valeurs, et d'où elles viennent

| Clé | Origine | Requis |
| --- | --- | --- |
| `SCW_ACCESS_KEY`, `SCW_SECRET_KEY` | Console Scaleway → **IAM & API keys**. Identifiants du provider OpenTofu, lus depuis l'environnement ; déjà présents dans `.env`. | oui |
| `SCW_DEFAULT_ORGANIZATION_ID`, `SCW_DEFAULT_PROJECT_ID` | Même écran ; rattachent les ressources au bon projet. | oui |
| `TF_VAR_session_secret` | **À générer** : `openssl rand -hex 32`. Aucun défaut dans `main.tf`, donc obligatoire pour tout apply. | oui |
| `TF_VAR_tem_secret_key`, `TF_VAR_tem_project_id` | Clé IAM autorisée à envoyer via Transactional Email (défaut `""` : l'application démarre sans). | non |
| `SESSION_SECRET` | Même valeur que `TF_VAR_session_secret` ; utile seulement pour lancer l'application en local via sops. | non |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | **Produits par Terraform** (`scaleway_iam_api_key.s3_credentials`) puis injectés dans le conteneur : rien à saisir. Ils ne servent qu'à faire tourner l'application locale contre le bucket Scaleway au lieu de MinIO. | non |

> **Les clés API Scaleway expirent** — la politique d'organisation l'impose (cf. `expires_at` sur la
> clé S3 dans `main.tf`). Symptôme typique : `tofu` échoue avec
> `denied authentication: API key is expired` alors que les identifiants sont bien définis, ou avec
> `invalid API key format or empty value` quand seul le couple organisation/projet est présent.
> Il faut alors régénérer une clé dans **IAM & API keys** et la saisir directement dans
> `secrets.sops.yaml`.

> **`.env` ne sert pas qu'à OpenTofu.** Ce dépôt a deux fichiers `.env` en puissance : celui qui
> existe (identifiants Scaleway du provider, décrit dans « Configuration opentofu ») et
> `.env.example` (variables de l'application : `SESSION_SECRET`, `S3_*`, `EMAIL_*`). Copier
> `.env.example` vers `.env`, comme ce dernier le suggère, **écraserait tes identifiants Scaleway** :
> fusionne les deux jeux de variables dans un seul `.env`, ou renomme l'un des deux.

Ensuite, `TF_VAR_session_secret` arrive par l'environnement du processus enfant : plus rien à mettre
dans `~/.bash_profile`.

```bash
sops exec-env secrets.sops.yaml 'tofu plan'
sops exec-env secrets.sops.yaml 'tofu apply -var domain_name=docdoc.re'
sops exec-env secrets.sops.yaml 'pnpm start'   # exécution locale, mêmes secrets
```

Ne jamais déchiffrer vers un fichier (`sops -d secrets.sops.yaml > secrets.yaml`) : les valeurs se
saisissent **dans** sops, et le YAML en clair ne doit jamais exister sur le disque.

> **Trois pièges vérifiés sous Windows.** SOPS ne cherche pas `~/.config/sops/age/keys.txt` mais
> `%APPDATA%\sops\age\keys.txt` : d'où le chemin de l'étape 1, qui évite de propager
> `SOPS_AGE_KEY_FILE` — variable que PowerShell ne lirait pas dans `~/.bash_profile`. Et
> `sops exec-env` attend la commande en **un seul argument** (`exec-env <fichier> '<commande>'`) sans
> passer par un shell : pas de guillemets imbriqués à l'intérieur. Enfin, sops étant un binaire natif
> Windows, un chemin POSIX (`/c/Users/...`) dans `SOPS_AGE_KEY_FILE` échoue avec « Le chemin d'accès
> spécifié est introuvable » : MSYS convertit les arguments de commande, pas les variables
> d'environnement.

> **Ce que SOPS ne protège pas.** `terraform.tfstate` conserve les valeurs **en clair** : chiffrer la
> source ne chiffre pas l'état. D'où `git rm --cached terraform.tfstate terraform.tfstate.backup`
> puis `printf 'terraform.tfstate*\n' >> .gitignore` — le fichier est aujourd'hui suivi par git.

> **Ordre de bascule.** L'image publiée sous le tag `1.1` **ne contient pas** le contrôle d'accès.
> Publier d'abord une nouvelle image (`1.2`), puis mettre `app_image` à jour et appliquer. Déployer
> le nouveau `main.tf` sans publier l'image laisserait la variable `rp_id` pointer sur une
> application qui l'ignore — sans conséquence, mais l'accès resterait ouvert.

### Déploiement

```bash
# 1. Initialiser le projet et télécharger le provider Scaleway
tofu init

# 2. Prévisualiser les modifications qui vont être appliquées
sops exec-env secrets.sops.yaml 'tofu plan'

# 3. Créer l'infrastructure sur Scaleway et démarrer le conteneur
sops exec-env secrets.sops.yaml 'tofu apply'
```

### Rattacher le domaine personnalisé (`docdoc.re`)

Le domaine s'achète dans **Domains & Web Hosting → Domains and DNS** de la console Scaleway
(**7,91 € TTC/an** pour un `.re`, prix plat création et renouvellement, zone DNS incluse). Une fois
enregistré, sa zone DNS existe chez Scaleway et `main.tf` sait y écrire : le certificat TLS de
l'endpoint personnalisé est, lui, émis et renouvelé gratuitement par Let's Encrypt.

Scaleway impose un **ordre** : l'enregistrement DNS doit d'abord résoudre vers l'endpoint du
conteneur, et seulement ensuite le domaine est déclaré sur le conteneur. Dans l'autre sens, le
challenge HTTP-01 échoue après 3 minutes et l'endpoint reste en statut `error`. D'où un apply en
deux temps :

```bash
# 1. L'enregistrement DNS seul (ALIAS à la racine, vers l'endpoint du conteneur)
sops exec-env secrets.sops.yaml 'tofu apply -var domain_name=docdoc.re -var attach_domain=false'

# 2. Vérifier que la résolution pointe bien vers le conteneur avant de continuer
dig docdoc.re @1.1.1.1
dig docdoc.re @8.8.8.8

# 3. Déclarer l'endpoint personnalisé sur le conteneur (certificat TLS émis ici)
sops exec-env secrets.sops.yaml 'tofu apply -var domain_name=docdoc.re'
```

`attach_domain` ne vaut `false` qu'à l'étape 1 : sa valeur par défaut (`true`) garantit qu'un apply
ultérieur, même sans variable, ne retire jamais l'endpoint personnalisé par inadvertance. Si
l'étape 3 rend un endpoint en statut `error`, c'est que la résolution n'était pas encore visible :
relancer simplement `tofu apply`.

`rp_id` et `rp_origin` sont alors calculés automatiquement (`docdoc.re` et `https://docdoc.re`) et
injectés dans le conteneur : rien à saisir. Pour servir un sous-domaine plutôt que la racine :
`-var domain_record_name=app -var domain_record_type=CNAME`, l'hôte devenant `app.docdoc.re`.

> **À faire avant d'enregistrer la première passkey.** Le RP ID est figé à vie : tant que le domaine
> n'est pas rattaché, les passkeys sont liées à l'endpoint généré, qu'une recréation du namespace
> invaliderait. Après l'opération, les deux endpoints (généré et personnalisé) restent joignables.

Retour en arrière : un apply **sans** `-var domain_name` retire l'endpoint personnalisé et
l'enregistrement DNS. Le domaine, lui, reste enregistré et facturé.

## Test de l'application à l'adresse suivante
https://<nom-de-votre-conteneur>-<hash-unique>.functions.fnc.fr-par.scw.cloud

```bash
tofu output app_url
```

## Destruction de l'infrastructure

```bash
sops exec-env secrets.sops.yaml 'tofu destroy'
```

> ⚠️ `terraform.tfstate` (suivi par git actuellement) contient des secrets **en clair** : clé secrète
> S3, secret de session, clé Transactional Email. SOPS chiffre la source, pas l'état. Pour l'écarter
> de la SCM :
> `git rm --cached terraform.tfstate terraform.tfstate.backup` puis ajouter `terraform.tfstate*`
> au `.gitignore`.
