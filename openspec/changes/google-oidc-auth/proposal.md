## Why

Aujourd'hui l'outlineur personnel (maison, voitures, voyages) est servi sans aucune protection : quiconque atteint l'URL peut lire et modifier les données. Comme les données sont hébergées sur ce site et potentiellement accessibles depuis le réseau, l'accès doit être verrouillé. L'utilisateur veut se connecter avec son compte Google (OpenID Connect) pour n'ouvrir l'application qu'à lui seul — un seul compte autorisé — sans isoler les données par utilisateur.

## What Changes

- Ajoute un portail de connexion Google (OpenID Connect, Authorization Code + PKCE) devant toute l'application.
- `GET /` non authentifié affiche une page de connexion (« Se connecter avec Google ») au lieu de l'outlineur.
- Ajoute `GET /auth/google` (initiation) et `GET /auth/google/callback` (échange du code + vérification de l'ID token).
- Restreint l'accès à un seul compte Google autorisé via `GOOGLE_ALLOWED_EMAIL` ; tout autre compte est rejeté.
- Gère des sessions côté serveur (`express-session`) : la session est créée après un callback réussi, persiste entre les requêtes et expire après inactivité.
- Protège toutes les routes : page (`/`, `/outline-fragment`) → page de connexion ; API (`/api/*`) → `401` JSON quand non authentifié.
- Ajoute `GET /api/me` (état de session) et `POST /logout` (déconnexion).
- Frontend : affiche l'adresse email connectée et un bouton « Déconnexion ; bouton « Se connecter avec Google » sur la page de connexion.

## Capabilities

### New Capabilities
- `google-oidc-auth`: Authentifie l'utilisateur avec un compte Google via OpenID Connect, restreint l'accès aux comptes autorisés, protège les routes de l'application par une session, et gère la durée de vie et la déconnexion de session.

### Modified Capabilities
- (none — l'outlineur, la gestion de nœuds et la persistance ne changent pas ; seul l'accès est verrouillé.)

## Impact

- **Backend (`server.js`)**: middleware de session + `requireAuth`, routes `/auth/google`, `/auth/google/callback`, `/logout`, `/api/me`, verrouillage des routes existantes, et chargement de la configuration depuis l'environnement.
- **Nouvelles dépendances**: `express-session`, `openid-client` (dans `package.json`).
- **Frontend (`public/`)**: template/CSS/JS pour la page de connexion et le bandeau utilisateur (email + déconnexion).
- **Configuration**: variables d'environnement `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `SESSION_SECRET`, `GOOGLE_ALLOWED_EMAIL` (plus un `.env.example`).
- **Google Cloud Console**: création d'un OAuth Client ID (application Web) et ajout de l'URI de redirection autorisé.
- **Runtime**: requiert HTTPS (ou `localhost` en développement) pour l'URI de redirection et le cookie sécurisé.
