## Context

L'outlineur serveur (`add-projects-outliner`) est construit et archivé. Il est aujourd'hui servi sans authentification : `GET /`, `/outline-fragment` et tous les endpoints `/api/*` sont ouverts à quiconque atteint l'URL. Comme les données personnelles (maison, voitures, voyages) sont hébergées sur un site et peuvent être atteintes depuis le réseau, il faut verrouiller l'accès. Le choix retenu est une connexion via le compte Google du propriétaire (OpenID Connect), en limitant l'accès à **un seul utilisateur autorisé** (allowlist par email) et en conservant le fichier de données unique actuel (pas d'isolation par compte).

## Goals / Non-Goals

**Goals:**
- Bloquer l'accès à toute l'application (page + API) tant que l'utilisateur n'est pas connecté avec un compte Google autorisé.
- Implémenter le flux OpenID Connect Authorization Code avec PKCE, `state` et `nonce`, et vérifier l'ID token avant de créer la session.
- Restreindre l'accès à un seul email autorisé (`GOOGLE_ALLOWED_EMAIL`).
- Gérer des sessions côté serveur qui persistent entre les requêtes, expirent après inactivité et sont détruites à la déconnexion.
- Exposer l'état de session (email) à l'interface et un bouton de déconnexion.

**Non-Goals:**
- Multi-utilisateurs avec isolation des données par compte (un seul compte autorisé).
- Inscription libre, gestion de comptes, rôles, ou permissions granulaires.
- Modification du modèle de données ou de l'API de l'outlineur.
- Refonte du frontend ou ajout d'un framework (htmx reste en place).
- Autoriser plusieurs fournisseurs IdP (Google uniquement).

## Decisions

**Decision 1: Client OIDC via `openid-client` + sessions via `express-session`.**
`openid-client` est le client OpenID Connect de référence en Node.js : il gère la découverte du fournisseur (`Issuer.discover`), l'échange du code avec PKCE, la validation du `state`/`nonce` et la vérification de l'ID token (émetteur, audience, signature, expiration). `express-session` fournit une session côté serveur avec cookie `httpOnly`/`SameSite=Lax`.
- *Pourquoi*: la validation d'ID token robuste est fournie par le client plutôt que réimplémentée ; `express-session` est minimal et suffisant pour un processus unique.
- *Alternatives considérées*: `passport` + `passport-google-oauth20` (rejeté : ajoute une couche de stratégie plus lourde, moins de contrôle explicite sur la validation OIDC) ; implémenter le flux OAuth2 à la main avec `fetch` (rejeté : réimplémente la découverte et la validation, risqué).

**Decision 2: `express-session` en mémoire (`MemoryStore`).**
Pour une application personnelle mono-processus, le store en mémoire est suffisant ; il se réinitialise au redémarrage, ce qui oblige simplement à se reconnecter.
- *Pourquoi*: aucune dépendance de persistance supplémentaire ; le coût d'une reconnexion après redémarrage est négligeable.
- *Alternatives considérées*: store fichier ou SQLite (rejeté : surdimensionné) ; `cookie-session` sans état (rejeté : la session doit permettre un `logout` serveur fiable et une expiration côté serveur).

**Decision 3: Contrôle d'accès = allowlist d'un seul email.**
Après vérification de l'ID token, comparer le claim `email` (insensible à la casse) à `GOOGLE_ALLOWED_EMAIL`. Si l'email correspond, créer la session ; sinon détruire la session et renvoyer une erreur (page 403 / 401).
- *Pourquoi*: modèle « un seul utilisateur autorisé » validé par l'utilisateur ; les données restent dans le `projects.json` unique existant.
- *Alternatives considérées*: autoriser par domaine (`GOOGLE_ALLOWED_DOMAIN`) (garde en réserve) ; tout compte Google (rejeté : ouvre l'accès à des tiers).

**Decision 4: Protéger toutes les routes avec un middleware `requireAuth`.**
Un middleware vérifie `req.session.user`. Pour les routes de page (`/`, `/outline-fragment`), renvoyer la page de connexion quand non authentifié ; pour les routes API (`/api/*`), renvoyer `401` JSON sans exposer les données.
- *Pourquoi*: un seul point de contrôle appliqué partout, pas de route oubliée ; la page de connexion n'est pas dépendante de la session pour éviter toute boucle de redirection.
- *Alternatives considérées*: redirection automatique de `/` vers `/auth/google` (rejeté : boucle potentielle et moins explicite qu'un écran de connexion) ; parsing htmx par route (rejeté : morcelé et fragile).

**Decision 5: Configuration via variables d'environnement, jamais en dur.**
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `SESSION_SECRET`, `GOOGLE_ALLOWED_EMAIL` sont lus depuis l'environnement au démarrage ; le serveur refuse de démarrer avec un message clair si une variable obligatoire manque. Un `.env.example` documente les valeurs.
- *Pourquoi*: ne pas versionner de secrets ; faciliter la bascule dev/prod (localhost vs domaine+HTTPS).
- *Alternatives considérées*: constante dans `server.js` (rejeté : secret versionné) ; `.env` commité (rejeté : fuite de secret).

**Decision 6: Cookie de session `httpOnly`, `SameSite=Lax`, `secure` en production.**
En production (derrière un proxy HTTPS) activer `app.set('trust proxy', 1)` et `cookie.secure = true` afin que le cookie ne circule que sur HTTPS. En dev sur `localhost`, `secure` reste désactivé.
- *Pourquoi*: protège la session (non lisible en JS) et limite le CSRF ; cohérent avec un site hébergé en HTTPS.

## Risks / Trade-offs

- **[Hébergement/déploiement]** Google OAuth exige une URI de redirection autorisée, publique et en HTTPS en production. Mitigation : documenter la configuration Google Cloud (OAuth consent screen + Client ID), utiliser `localhost` en dev et un domaine+HTTPS en prod, activer `trust proxy`.
- **[Store de session en mémoire]** Les sessions sont perdues au redémarrage → reconnexion nécessaire. Acceptable pour un utilisateur unique.
- **[Un seul compte / un seul fichier]** Pas d'isolation multi-utilisateurs — choix assumé ; si plusieurs comptes sont requis plus tard, il faudra séparer les données par `sub`.
- **[Secrets en environnement]** Le client secret et le secret de session ne doivent jamais être commités ; `.env` doit être dans `.gitignore`.
- **[Boucles de connexion]** La page de connexion ne doit pas être derrière `requireAuth` ; les routes `/auth/*` et les assets statiques restent publiques.
- **[UX de déconnexion]** Une session doit être détruite côté serveur, pas seulement en supprimant le cookie côté client.

## Migration Plan

Aucune migration de données : le format de `data/projects.json` reste inchangé. Déploiement : ajouter `express-session` et `openid-client`, paramétrer les variables d'environnement (créer un OAuth Client ID Google et ajouter l'URI de redirection), puis redémarrer le serveur. Rollback : restaurer `server.js`, retirer les deux dépendances et les routes d'auth.
