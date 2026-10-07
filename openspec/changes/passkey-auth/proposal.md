## Why

Aujourd'hui l'outlineur est servi sans aucune authentification : quiconque atteint l'URL lit et modifie les domaines, projets et thèmes. L'accès doit être verrouillé par une authentification résistante au phishing, sans mot de passe à gérer : des passkeys FIDO2/WebAuthn, amorcées une seule fois par un code envoyé par email. Le scénario validé ajoute une seconde exigence : les données doivent appartenir à *un espace de compte*, et non plus à un magasin unique et anonyme — ce que le change dormant `google-oidc-auth` (0/21 tâches) excluait explicitement. Ce change le remplace.

## What Changes

- **Portail d'accueil non connecté** : `GET /` sans session affiche une page d'accueil (et non l'outlineur) proposant **deux portes** — « Créer un compte » et « Se connecter ». Le serveur ne peut pas affirmer « vous n'avez pas d'espace » avant identification : il ne connaît que l'absence de session.
- **Enrôlement en quatre étapes** : saisie de l'email → contrôle d'habilitation → code à usage unique envoyé par email (avec renvoi) → enregistrement d'une passkey → création du compte et de l'espace.
- **Contrôle d'habilitation avant tout envoi** : un email hors allowlist est refusé immédiatement, sans qu'aucun message ne soit expédié, afin que docdoc ne puisse pas servir de relais d'envoi.
- **Connexion par passkey** : assertion WebAuthn, y compris avec passkey découvrable (aucune saisie d'email).
- **Gestion des passkeys** : ajouter une passkey sur un autre appareil, la renommer, la révoquer ; et **secours permanent par code email** en cas de perte de tous les appareils.
- **Sessions côté serveur** et protection de toutes les routes : pages → page d'accueil, routes API et fragments htmx → refus explicite sans exposer de données.
- **BREAKING** — **Stockage scopé par utilisateur** : le layout passe de `domains/{id}.json` + `themes.json` à la racine du bucket vers `users/{userId}/domains/{id}.json` et `users/{userId}/themes.json`. Les données existantes sont adoptées une seule fois dans l'espace de l'email habilité.
- **BREAKING** — **L'état applicatif global devient un cache par utilisateur** : les singletons `domains`, `domainList` et `themes` chargés une fois au démarrage laissent place à des données résolues par compte.
- Suppression du change `google-oidc-auth`, remplacé ; ses briques utiles (middleware `requireAuth`, session, allowlist email, `/api/me`, `/logout`) sont reprises ici.

## Capabilities

### New Capabilities
- `account-enrollment`: Page d'accueil non connectée, demande d'enrôlement par email, contrôle de la liste d'habilitation avant tout envoi, création de l'espace de compte et adoption des données existantes.
- `email-otp`: Émission, envoi, expiration, usage unique et vérification des codes à usage unique, y compris renvoi, limitation des tentatives et limitation de débit.
- `passkey-auth`: Cérémonies WebAuthn d'enregistrement et d'assertion, cycle de vie des passkeys (ajout, renommage, révocation), et paramètres de confiance (RP ID, origine, vérification utilisateur, passkeys synchronisées).
- `user-space`: Isolation des domaines, projets, thèmes et archives par compte, résolution du compte à partir de la session, et cloisonnement des données entre espaces.

### Modified Capabilities
- `s3-storage`: Les clés ne sont plus des chemins globaux mais des chemins préfixés par l'utilisateur ; l'énumération et le déplacement d'objets s'opèrent sous le préfixe du compte courant.
- `domain-storage`: Les domaines sont persistés sous `users/{userId}/domains/{id}.json` et énumérés sous le préfixe du compte courant ; la migration de démarrage vise le premier compte.
- `project-storage`: L'outline d'un domaine est persisté sous la clé scopée par utilisateur, et rechargé par compte plutôt qu'une seule fois au démarrage.
- `theme-storage`: La palette n'est plus un objet global unique : chaque compte possède sa propre palette sous `users/{userId}/themes.json`.

## Impact

- **`server.js`**: passage d'un état mono-locataire à un état résolu par utilisateur (`domains`, `domainList`, `themes`), clés de stockage scopées, et ajout du portail d'accueil, des routes d'authentification et du middleware de protection.
- **`storage.js`**: opérations de lecture, écriture, énumération et déplacement paramétrées par un préfixe utilisateur.
- **Nouveau module d'envoi d'email**: aucun fournisseur n'existe aujourd'hui dans le projet (Scaleway Transactional Email pressenti, avec repli Brevo) ; un mode développement journalise le code au lieu de l'envoyer.
- **`public/`**: pages et scripts d'accueil, de saisie d'email, de saisie de code, d'enregistrement de passkey et de gestion des passkeys ; gestion du `401` dans les échanges htmx (`HX-Redirect` ou `htmx:responseError`) pour qu'une session expirée ne s'affiche pas dans une cible de fragment.
- **Dépendances**: `@simplewebauthn/server`, `@simplewebauthn/browser`, `express-session`, et la bibliothèque du fournisseur d'email retenu.
- **Configuration**: nouvelles variables d'environnement `SESSION_SECRET`, `AUTHORIZED_EMAILS`, `RP_ID`, `RP_ORIGIN` et les identifiants du fournisseur d'email ; un `.env.example` les documente ; `main.tf` doit les propager au conteneur.
- **Déploiement**: le RP ID d'une passkey est le nom d'hôte servi. L'endpoint actuel du conteneur est un nom généré (`docdocnamespace572c01fb-docdoc-app.functions.fnc.fr-par.scw.cloud`) : le rattachement d'un domaine personnalisé au conteneur conditionne la pérennité des passkeys. Un contexte sécuré (HTTPS avec nom d'hôte, ou `localhost`) est obligatoire — une IP nue ne fonctionne pas.
- **Livraison**: l'image Docker est épinglée à `docdoc:1.1` dans `main.tf`; cette évolution exige un nouveau tag et une bascule.
