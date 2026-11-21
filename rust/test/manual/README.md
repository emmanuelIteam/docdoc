# Tests manuels du portage Rust

Ces scripts ne sont pas exécutés par `cargo test` : ils pilotent un serveur Rust
réel en HTTP et servent à vérifier les parcours que les tests unitaires ne
couvrent pas (WebAuthn, S3, navigateur).

## Préparation

Lancer le serveur depuis `rust/` avec un code lisible et une adresse autorisée :

```bash
DOCDOC_ENV_FILE=../.env \
DOCDOC_DEV_CODE_FILE="$PWD/dev-codes.txt" \
EMAIL_PROVIDER=dev \
AUTHORIZED_EMAILS=test@example.fr \
HOST=127.0.0.1 PORT=3555 \
cargo run
```

Pour tester S3, renseigner `S3_ENDPOINT`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY` et `S3_REGION` (par exemple un MinIO local sur
`http://127.0.0.1:19000`). Sans S3, ajouter `DOCDOC_STORAGE_DIR=./data-rust`.

Le dossier `public/` est résolu par défaut en `../public` depuis `rust/`.

## Scripts

| Script | Ce qu'il vérifie | Dépendances |
| --- | --- | --- |
| `passkey-flow.js` | Enrôlement par code, attestation ES256, assertion, CRUD de l'outline, statuts, repli, révélation, thèmes, étiquettes, archives, reconnexion. | Node 22+ uniquement |
| `relogin.js` | Après redémarrage, reconnexion avec la clé enregistrée et rechargement depuis S3. | Avoir lancé `passkey-flow.js` avec `PASSKEY_STATE=./passkey-state.json` |
| `browser-smoke.js` | Parcours réel dans Edge/Chrome avec un authentificateur WebAuthn virtuel CDP. | `npm install --ignore-scripts` à la racine, Edge installé |

```bash
cd rust/test/manual
CODE_FILE=./dev-codes.txt node passkey-flow.js
CODE_FILE=./dev-codes.txt BASE_URL=http://localhost:3555 node relogin.js
CODE_FILE=./dev-codes.txt BASE_URL=http://localhost:3555 node browser-smoke.js
```

Variables utiles :

- `BASE_URL` : `http://localhost:3555` par défaut pour `relogin.js` et
  `browser-smoke.js` ; `http://127.0.0.1:3555` pour `passkey-flow.js`.
- `CODE_FILE` : fichier alimenté par `DOCDOC_DEV_CODE_FILE`.
- `PASSKEY_STATE` : état de la clé créée par `passkey-flow.js` (par défaut
  `./passkey-state.json`).
- `EDGE_PATH` : chemin de `msedge.exe` si Edge n'est pas à l'emplacement par
  défaut.
- `CDP_PORT` : port de débogage d'Edge (9222 par défaut).

`browser-smoke.js` lance Edge avec un profil jetable dans `./edge-profile` et
écrit `home.png`, `domain.png` dans le dossier courant. Sous Windows, fermer
toute autre instance utilisant le port CDP.

**Important (WebAuthn)** : utiliser `localhost`, jamais une adresse IP, dans le
navigateur. Un RP ID ne peut pas être une adresse IP ; le navigateur refuse alors
la cérémonie avec une erreur d'origine non sécurisée.
