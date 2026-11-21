# docdoc — implémentation Rust

Réimplémentation du serveur docdoc en Rust, à parité fonctionnelle avec
`server.js` : outliner de projets, rendu HTML côté serveur, fragments htmx,
passkeys WebAuthn, codes à usage unique, stockage objet S3 compatible, pages
d'administration et d'aide.

Le portage réutilise **tels quels** les assets de `../public/` (`app.js`,
`style.css`, htmx, service worker, manifeste). Le serveur Rust doit donc rendre
le même balisage : mêmes ids, mêmes classes, mêmes attributs `hx-*`.

## État et validation

Le portage a été validé par :

| Vérification | Commande | Portée |
| --- | --- | --- |
| Tests unitaires Rust | `cargo test` | 37 tests : modèle, ordre d'affichage, slugs, OTP, sessions, WebAuthn (COSE, clientData), stockage, routeur, révélations, administration. |
| Parcours WebAuthn logiciel | `node test/manual/passkey-flow.js` | Enrôlement par code, attestation P-256, assertion, CRUD complet, thèmes, archives, reconnexion. |
| Persistance après redémarrage | `node test/manual/relogin.js` | Rechargement du compte, des domaines et de l'outline depuis S3. |
| Navigateur réel | `node test/manual/browser-smoke.js` | Edge + authentificateur WebAuthn virtuel CDP : passkey, renommage, sous-tâche, statut, repli, accueil, thème, aide, archivage/restauration. |
| S3 réel | Silo/MinIO local | Signature SigV4, création du bucket, PUT/GET/LIST/COPY/DELETE, pagination. |

Les captures du parcours navigateur sont dans `test/manual/` après exécution
(`home.png`, `domain.png`).

## Démarrage

Prérequis : Rust 1.85 ou plus récent (`rustup` ; l'image de production épingle
Rust 1.100), et pour le développement le MinIO/Silo et Mailpit de
`../docker-compose.yml`.

```bash
cd rust
cargo run
```

Le binaire lit `../.env` (ou `DOCDOC_ENV_FILE`), comme le serveur Node : une
variable déjà exportée gagne toujours sur le fichier. Le serveur écoute sur
`http://localhost:3000`.

```bash
# stockage et boîte aux lettres locaux
docker compose up -d minio mailpit

# développement sans email : le code s'affiche dans le terminal
EMAIL_PROVIDER=dev cargo run
```

Sans S3 configuré, les données restent en mémoire ; pour un stockage local
persistant (tests, poste sans MinIO) :

```bash
DOCDOC_STORAGE_DIR=../.data-rust cargo run
```

### Variables propres au portage

Toutes les variables du serveur Node sont lues. S'y ajoutent :

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | Adresse d'écoute. `127.0.0.1` pour un poste local. |
| `DOCDOC_STORAGE_DIR` | — | Backend fichier local, utilisé seulement si S3 n'est pas configuré. |
| `DOCDOC_DEV_CODE_FILE` | — | En mode `dev`, ajoute chaque code à ce fichier (`email code`). Pratique pour les tests. |
| `DOCDOC_PUBLIC_DIR` | `../public` | Assets statiques. |
| `DOCDOC_DATA_DIR` | `../data` | Données historiques importées au premier compte. |
| `APP_VERSION` | vide | Version affichée dans l'aide (« développement » si vide). |

## Architecture

| Fichier | Rôle | Équivalent Node |
| --- | --- | --- |
| `src/main.rs` | Démarrage, journaux, écoute HTTP. | `server.js` (`start`) |
| `src/app.rs` | Routeur axum, état, handlers, middleware de session. | `server.js`, `authroutes.js` |
| `src/model.rs` | Domaines, arbre des nœuds, ordre d'affichage, réindentation, déplacement. | `server.js` (modèle) |
| `src/html.rs` | Pages et fragments HTML. | `server.js` (rendu), `authpages.js`, `pwa-head.js` |
| `src/storage.rs` | S3 SigV4, backend mémoire et fichier. | `storage.js` |
| `src/accounts.rs` | Comptes, index email et credential. | `accounts.js` |
| `src/session.rs` | Cookie signé, TTL glissant, cérémonies. | `express-session` + `authroutes.js` |
| `src/otp.rs` | Codes à usage unique, cooldown, limitation de débit. | `otp.js` |
| `src/passkey.rs` | WebAuthn : options, attestation, assertion, COSE. | `passkeys.js` + SimpleWebAuthn |
| `src/mailer.rs` | `dev`, SMTP, Scaleway TEM, Brevo. | `mailer.js` |
| `src/migration.rs` | Adoption unique des données antérieures. | `migration.js` |
| `src/space.rs` | Espace en cache d'un compte. | `spaceFor` / `loadSpace` |
| `src/config.rs` | `.env`, configuration, RP ID. | `env.js` + `server.js` |

### Différences assumées

- **WebAuthn** est vérifié directement en Rust (P-256/ES256, Ed25519, RS256),
  sans `@simplewebauthn/server`. Les clés publiques sont stockées au même format
  que l'original (base64url du COSE), donc les comptes créés par la version Node
  restent lisibles. Seules les attestations `none` sont acceptées, ce qui
  correspond à `attestationType: 'none'`.
- **S3** est appelé via un client SigV4 minimal (`reqwest`) au lieu du SDK AWS.
  Les six opérations utilisées sont couvertes et testées contre Silo/MinIO.
- **Sessions et OTP** restent en mémoire, comme le `MemoryStore` d'Express et
  `otp.js` : le déploiement doit rester à un seul processus (le `main.tf`
  Scaleway fixe déjà `max_scale = 1`).
- `SMTP_ALLOW_SELF_SIGNED` est signalé mais non appliqué par le client lettre
  (vérification TLS stricte) ; préférez un certificat valide ou `EMAIL_PROVIDER`
  HTTP.
- Le serveur Node et le serveur Rust peuvent coexister dans le dépôt ; ils
  partagent `public/`, `data/` et les mêmes objets S3.

## Tests

```bash
cd rust
cargo test                 # unitaires + routeur, sans réseau
cargo fmt --check
cargo clippy --all-targets # facultatif
```

Les tests manuels exigent un serveur lancé avec `EMAIL_PROVIDER=dev` et
`DOCDOC_DEV_CODE_FILE` :

```bash
# terminal 1 — serveur
DOCDOC_DEV_CODE_FILE="$PWD/dev-codes.txt" \
EMAIL_PROVIDER=dev AUTHORIZED_EMAILS=test@example.fr \
S3_ENDPOINT= S3_BUCKET= PORT=3555 cargo run

# terminal 2 — parcours complet (attestation + assertion réelles)
cd test/manual
CODE_FILE=./dev-codes.txt node passkey-flow.js
node relogin.js          # après redémarrage du serveur
node browser-smoke.js    # Edge/Chrome + Playwright
```

`browser-smoke.js` lance Edge avec `--remote-debugging-port` et un
authentificateur WebAuthn virtuel via CDP. Sous Windows, fermer les autres
instances de débogage sur le port 9222. Le script accepte `EDGE_PATH`,
`CHROME_PATH` n'est pas utilisé, et `BASE_URL` (par défaut
`http://localhost:3555`). Utiliser `localhost` et non `127.0.0.1` : WebAuthn
exige une origine sécurisée et un RP ID de type nom d'hôte.

## Déploiement

```bash
# depuis la racine du dépôt : l'image de production est le Dockerfile racine
docker build -t docdoc-rs .
docker run --rm -p 3000:3000 --env-file .env docdoc-rs
```

Le `Dockerfile` racine compile ce serveur Rust et réutilise l'étape `assets`
(courte, Node) qui minifie `public/` et inscrit `APP_VERSION` dans
`CACHE_VERSION`. L'image finale ne contient ni Node ni npm.

En production, `RP_ID` et `RP_ORIGIN` sont obligatoires, `SESSION_SECRET` aussi,
et le cookie de session est marqué `Secure`. La terminaison TLS doit être faite
par le proxy/ingress ; le serveur écoute en HTTP sur `HOST:PORT`.

Le binaire est autonome : seuls `public/` (assets) et, si l'on veut l'import
historique, `data/` sont nécessaires à côté de lui. Sans S3, les données sont
perdues au redémarrage ; c'est le comportement de l'original.

## Basculer la production sur Rust

Le portage lit et écrit **le même format** que la version Node : mêmes clés S3
(`users/{userId}/domains/*.json`, `archive/`, `themes.json`, `account.json`),
mêmes index d'email et de credential, même `publicKey` base64url du COSE. Les
comptes, passkeys et domaines existants sont donc repris sans migration de
données.

1. construire et publier l'image Rust à la place de l'image Node (même
   `APP_VERSION`, mêmes variables d'environnement, `HOST=0.0.0.0`) ;
2. conserver `RP_ID` / `RP_ORIGIN` : les passkeys sont liées à ces valeurs ;
3. prévoir une coupure courte : les sessions et les codes OTP vivent en mémoire
   et sont perdus au changement de binaire (il suffit de redemander un code) ;
4. ne pas incrémenter `CACHE_VERSION` du service worker : `public/` est
   inchangé.

Retour arrière : republier l'image Node. Les écritures faites par Rust sont
relues par Node (mêmes clés, mêmes champs) ; seules les sessions en cours sont
perdues.
