# docdoc

Outliner de gestion de projets personnels (maison, voitures, voyages). Application Node.js + Express qui rend le HTML côté serveur, enrichie par htmx, avec les données dans un bucket compatible S3 et un accès verrouillé par passkeys.

Production : <https://docdoc.re>

## Par où commencer

| Je veux… | Lire |
| --- | --- |
| installer et lancer l'application en local | ce README, jusqu'à « Première connexion » |
| poser des points d'arrêt et déboguer | [Déboguer](#déboguer) |
| créer ou modifier l'infrastructure cloud | [docs/deployer-infrastructure.md](docs/deployer-infrastructure.md) |
| compiler et déployer une nouvelle version | [docs/publier-une-version.md](docs/publier-une-version.md) |
| comprendre les passkeys, les données, la PWA | [docs/exploitation.md](docs/exploitation.md) |

La documentation est du Markdown versionné avec le code : pas de site séparé, pas de générateur. Ce README est le point d'entrée du développeur ; les procédures d'exploitation vivent dans `docs/`.

## Prérequis

| Outil | Version | Rôle |
| --- | --- | --- |
| Node.js | 22 ou plus | Runtime de l'application (l'image de production utilise `node:22-alpine`). |
| npm | fourni avec Node | Installation et scripts. `pnpm` fonctionne aussi : le dépôt porte les deux lockfiles. |
| Docker + Compose v2 | récent | MinIO (stockage S3 local) et Mailpit (boîte aux lettres locale). |
| Git | — | Le dépôt. |
| Chrome ou Edge | — | DevTools. `npm run test:e2e` pilote le Chrome installé (`channel: 'chrome'`), sans télécharger de navigateur. |

Vérification en une commande :

```bash
node --version && npm --version && docker compose version
```

Sous Windows, les commandes sont données pour Git Bash. Sous PowerShell, remplacer `cp` par `Copy-Item` et `rm` par `Remove-Item` ; le reste est identique.

## Démarrage en quatre étapes

### 1. Installer les dépendances

```bash
npm install
```

`package-lock.json` est la référence : c'est ce que l'image de release installe avec `npm ci`. Si tu préfères pnpm, `pnpm install` utilise `pnpm-lock.yaml` ; ne mélange pas les deux gestionnaires dans un même `node_modules`.

### 2. Démarrer le stockage et la boîte aux lettres

```bash
docker compose up -d minio mailpit
docker compose ps
```

**Nomme les services.** Le service `web` de `docker-compose.yml` est actif : un `docker compose up -d` sans nom construit aussi l'image et démarre l'application dans un conteneur sur le port 3000, en concurrence avec `npm start`. Pour ne lancer que les dépendances, la commande ci-dessus est la bonne (variante tout-en-conteneurs plus bas).

| Service | Rôle | Adresse |
| --- | --- | --- |
| `minio` | Stockage objet compatible S3 (les données) | API <http://127.0.0.1:19000> · console <http://127.0.0.1:19001> |
| `mailpit` | Catcher SMTP : reçoit tous les emails (conservés en mémoire, perdus à l'arrêt du conteneur) | SMTP `localhost:1026` · interface <http://localhost:8025> |

Identifiants MinIO : `minioadmin` / `minioadmin`. Les ports publiés sont `19000`/`19001` et non `9000`/`9001` : sur certains postes Windows, un agent d'interception réseau d'entreprise répond à la place du conteneur sur `9000` et toutes les lectures S3 restent suspendues (voir « Dépannage local »). À l'intérieur du conteneur, les ports restent `9000`/`9001`.

Le service `minio` utilise `pgsty/silo`, fork maintenu de MinIO (images MinIO retirées de Docker Hub), épinglé volontairement. Le premier démarrage télécharge donc l'image : c'est normal qu'il soit plus lent que les suivants.

### 3. Créer le fichier `.env`

```bash
cp .env.example .env
```

`.env.example` est déjà réglé pour ce montage : `S3_ENDPOINT=http://127.0.0.1:19000`, `EMAIL_PROVIDER=smtp`, `SMTP_HOST=localhost`, `SMTP_PORT=1026`. L'application lit `.env` au démarrage **sans écraser** les variables déjà présentes dans l'environnement (celles injectées par le conteneur restent prioritaires), et OpenTofu ne lit jamais `.env`.

Si un `.env` existe déjà, ne l'écrase pas : il peut contenir les identifiants Scaleway du provider OpenTofu. Fusionne les deux jeux de variables.

Les variables qui comptent en local :

| Variable | Valeur locale | Rôle |
| --- | --- | --- |
| `S3_ENDPOINT` | `http://127.0.0.1:19000` | API S3 de MinIO, vue depuis l'hôte. |
| `S3_BUCKET` | `docdoc-json-storage` | Bucket des données. |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | `minioadmin`, `minioadmin` | Identifiants MinIO. |
| `EMAIL_PROVIDER` | `smtp` | `smtp` vers Mailpit ; `dev` écrit le code dans les journaux. |
| `SMTP_HOST`, `SMTP_PORT` | `localhost`, `1026` | Relais Mailpit vu depuis l'hôte. |
| `SESSION_SECRET` | `dev-secret-a-remplacer` | Signature du cookie. Le changer déconnecte les sessions. |
| `AUTHORIZED_EMAILS` | `emmanuel.grandiere@laposte.net` | Seules ces adresses peuvent créer un espace. |
| `PORT` | `3000` | Port d'écoute. |

Référence complète (toutes les variables, fournisseurs d'email, OTP) : [docs/exploitation.md](docs/exploitation.md).

### 4. Lancer l'application

```bash
npm start
```

L'application écoute sur <http://localhost:3000>. Au démarrage, les journaux annoncent le mode d'envoi des codes, le bucket utilisé, les comptes autorisés, puis :

```
Projets outliner lancé sur http://localhost:3000
```

Le bucket est créé au premier démarrage s'il n'existe pas. Contre un bucket vide, l'application importe une seule fois les fichiers historiques de `data/`.

`Ctrl+C` arrête le serveur. Il n'y a **aucune étape de compilation** en développement : le HTML est rendu par le serveur et `public/` est servi tel quel. La minification n'existe que dans l'image de release.

## Première connexion

1. Ouvrir <http://localhost:3000> : la page d'accueil propose « Créer un compte » et « Se connecter ».
2. Saisir une adresse présente dans `AUTHORIZED_EMAILS` (par défaut `emmanuel.grandiere@laposte.net`). Une adresse absente est refusée **avant** tout envoi.
3. Récupérer le code à six chiffres :
   - avec `EMAIL_PROVIDER=smtp` (le défaut), dans Mailpit : <http://localhost:8025> ;
   - avec `EMAIL_PROVIDER=dev`, directement dans le terminal : `[docdoc][dev] code pour … : 123456 (valable 10 min)`.
4. Enregistrer la passkey (Windows Hello, Touch ID, clé de sécurité, gestionnaire de mots de passe). L'espace est créé à ce moment-là.

Une passkey est liée au **nom d'hôte** servi : ouvre toujours l'application par la même adresse (`localhost` ou `127.0.0.1`, pas les deux en alternance), sinon le navigateur ne propose pas la passkey. En développement, le RP ID et l'origine sont déduits de l'adresse utilisée.

Récupération (appareil perdu, toutes les passkeys perdues), structure des données et configuration des emails : [docs/exploitation.md](docs/exploitation.md).

## Déboguer

### Points d'arrêt Node.js

```bash
node --inspect server.js
```

Puis ouvrir `chrome://inspect` (ou `edge://inspect`) et cliquer sur **Open dedicated DevTools for Node** : les points d'arrêt se posent dans `server.js`, `storage.js`, `accounts.js`… Pour s'arrêter dès la première ligne, utiliser `node --inspect-brk server.js`.

Le port du débogueur est `9229`, indépendant du port applicatif `3000`.

Dans VS Code, la configuration d'attachement équivalente (débogueur JavaScript intégré, aucune extension) :

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Attach docdoc",
      "type": "node",
      "request": "attach",
      "port": 9229
    }
  ]
}
```

### Redémarrer à chaque modification

```bash
node --watch server.js
```

`--watch` (Node 22+) redémarre le processus quand un fichier chargé change. Les modifications de `.env` ne sont pas surveillées : relance le serveur pour les prendre en compte.

### Lire les codes d'accès dans le terminal

Dans `.env`, passer `EMAIL_PROVIDER=dev` puis relancer : aucun email n'est envoyé, le code s'affiche dans les journaux. Le serveur annonce son mode au démarrage (`Envoi des codes : …`). Ce mode est refusé en production.

### Front-end : aucun build en développement

`public/app.js`, `auth.js`, `style.css`, `pwa.js` sont servis tels quels : modifier le fichier puis recharger la page suffit. Seule l'image de release les minifie (`scripts/build-assets.js`).

Si tu modifies un fichier précaché par le service worker (`style.css`, `app.js`, `pwa.js`, `auth.js`, `simplewebauthn.js`, `htmx.min.js`, `manifest.webmanifest`, `offline.html`, une icône), **incrémente `CACHE_VERSION`** dans `public/sw.js` (`v1` → `v2`). Sinon le navigateur peut continuer à servir l'ancienne copie. En développement, le plus simple reste DevTools → Application → Service Workers → *Update on reload*, ou *Bypass for network*.

### Tests

```bash
npm test          # parcours d'accès par passkey, sans navigateur
npm run test:e2e  # tests Playwright dans le Chrome installé
```

| Commande | Ce qu'elle fait | Prérequis |
| --- | --- | --- |
| `npm test` | Pilote un serveur réel en HTTP avec un authentificateur logiciel (port `3456`), sur un répertoire de données jetable. Le `.env` du développeur est ignoré (`DOCDOC_ENV_FILE`). | Aucun conteneur. |
| `npm run test:e2e` | Démarre l'application dans le processus de test (port `3499`, données jetables), pilote Chrome avec un authentificateur virtuel. `E2E_PORT` change le port. | Chrome installé ; pas de Docker. |

### Suivre une requête

Les échanges htmx se lisent dans l'onglet **Réseau** des DevTools : les réponses sont des fragments HTML. Le serveur ne journalise pas chaque requête ; pour suivre un aller-retour précis, poser un point d'arrêt dans la route concernée de `server.js`.

## Arrêter et réinitialiser

| Besoin | Commande |
| --- | --- |
| Arrêter l'application | `Ctrl+C` dans le terminal. |
| Arrêter les conteneurs | `docker compose stop` |
| Supprimer les conteneurs (données conservées) | `docker compose down` |
| **Effacer les données locales** | `docker compose down -v` — supprime le volume `gestion-prj-perso-minio-data`. |

Après `down -v`, le prochain démarrage recrée un bucket vide et réimporte une fois les fichiers de `data/`. Les passkeys enregistrées sur l'appareil pointent alors vers un compte disparu : il faut recréer un espace avec la même adresse.

Inspecter le bucket en ligne de commande (le conteneur embarque le client `mc`) :

```bash
docker compose exec minio mc ls --recursive local/docdoc-json-storage/
docker compose exec minio mc cat local/docdoc-json-storage/users/<id>/themes.json
```

Journaux des dépendances : `docker compose logs -f minio mailpit`.

## Variante : tout dans Docker

Pour lancer l'application elle-même dans Compose (elle est alors configurée avec `S3_ENDPOINT=http://minio:9000` et `SMTP_HOST=mailpit`) :

```bash
docker compose up -d --build
docker compose logs -f web
```

L'application répond sur <http://localhost:3000>. Arrêter d'abord `npm start` : les deux se disputent le port. `NODE_ENV` reste `development` dans Compose, ce qui est voulu sur `http://localhost` (cookie non `Secure`, RP déduit).

## Ports et services

| Port | Service |
| --- | --- |
| `3000` | Application (`npm start`, `docker compose` ou `PORT`). |
| `19000` / `19001` | API S3 / console MinIO. |
| `1026` / `8025` | SMTP / interface Mailpit. |
| `9229` | Débogueur Node (`--inspect`). |
| `3456` | `npm test` (interne). |
| `3499` | `npm run test:e2e` (interne, `E2E_PORT` pour changer). |

## Dépannage local

| Symptôme | Cause probable | Solution |
| --- | --- | --- |
| `EADDRINUSE` sur `3000` | `npm start` déjà lancé, ou service `web` de Compose. | `docker compose stop web`, ou `Get-NetTCPConnection -LocalPort 3000` sous PowerShell. |
| L'application démarre mais toute lecture de données reste suspendue | Le port `9000` de l'hôte est capté par un agent d'interception (Zscaler). | Utiliser `19000` et `127.0.0.1` (réglage par défaut de `.env.example`). |
| `ECONNRESET: socket hang up` au démarrage | `localhost` résolu en `::1`, qui traverse l'agent d'interception. | `S3_ENDPOINT=http://127.0.0.1:19000`, jamais `localhost`. |
| Aucun code reçu | Mauvais fournisseur ou mauvaise boîte. | Vérifier `EMAIL_PROVIDER` ; `smtp` → Mailpit `8025`, `dev` → journaux. |
| La passkey n'est pas proposée | Origine changée (`localhost` ↔ `127.0.0.1`), ou compte absent. | Toujours la même adresse ; recréer l'espace par code email si besoin. |
| Le navigateur sert une ancienne version du front | Service worker et cache précaché. | DevTools → Application → Service Workers (mise à jour), ou incrémenter `CACHE_VERSION`. |
| `module « esbuild » introuvable` | Dépendances non installées. | `npm install`. |
| Compose semble bloqué au premier lancement | Téléchargement de `pgsty/silo` et de Mailpit. | Attendre, puis `docker compose ps`. |

## Structure du dépôt

| Chemin | Rôle |
| --- | --- |
| `server.js` | Routes HTTP, rendu des pages et fragments htmx, démarrage. |
| `storage.js` | Accès S3 : bucket, clés, lecture/écriture des JSON. |
| `accounts.js`, `passkeys.js`, `authroutes.js`, `authpages.js`, `otp.js` | Comptes, WebAuthn, routes et pages d'authentification, codes à usage unique. |
| `mailer.js` | Envoi des codes : `dev`, SMTP, Scaleway TEM, Brevo. |
| `migration.js` | Adoption unique des données antérieures aux comptes. |
| `env.js` | Chargement minimal de `.env`, sans dépendance. |
| `public/` | Assets statiques, `sw.js`, manifeste PWA, `offline.html`. |
| `data/` | Données historiques, importées une seule fois contre un bucket vide. |
| `scripts/` | Amorçage de compte, minification des assets, icônes PWA. |
| `test/` | Parcours d'accès (`passkey-flow.js`) et tests Playwright (`test/e2e`). |
| `main.tf` | Infrastructure Scaleway (conteneur Serverless, bucket, IAM, DNS, emails). |
| `docker-compose.yml`, `Dockerfile` | Développement local et image de release. |

## Documentation et procédures

- [Déployer l'infrastructure sur Scaleway](docs/deployer-infrastructure.md) : identifiants IAM, secrets SOPS, `tofu apply`, domaine personnalisé, coûts, destruction.
- [Publier une version](docs/publier-une-version.md) : tag git, pipeline GitHub, secrets, vérification, déploiement manuel, retour arrière.
- [Exploitation : passkeys, données, PWA](docs/exploitation.md) : parcours d'accès, structure du bucket, configuration de référence, service worker.

Quand une commande ou un réglage change dans le code, mets à jour le document qui la porte : ce README pour le développement, la procédure concernée pour le cloud.

## Assistant de codage (optionnel)

```bash
npx @deepseek-ai/dsh web
```

Suivi de la facturation : <https://platform.deepseek.com/usage>.
