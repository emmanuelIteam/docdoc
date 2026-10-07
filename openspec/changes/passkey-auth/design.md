## Context

L'outlineur (`add-projects-outliner`, `add-domains`, `add-themes`, archivés) est aujourd'hui servi **sans aucune authentification** : les routes de page et toutes les routes `/api/*` sont ouvertes. La couche de données vit dans un bucket S3 unique, avec un layout **mono-locataire** : `domains/{id}.json`, `archive/{id}.json` et `themes.json` à la racine du bucket ([server.js:10-16](server.js#L10-L16)), et un état applicatif **au niveau module** — `domains` (Map), `domainList`, `themes` — chargé une seule fois au démarrage ([server.js:42-46](server.js#L42-L46), [server.js:1230-1245](server.js#L1230-L1245)). `storage.js` ne connaît pas la notion d'utilisateur, mais expose déjà des primitives par préfixe ([storage.js:97-113](storage.js#L97-L113)).

Le change dormant `google-oidc-auth` (0/21 tâches, 2026-09-01) visait le même besoin par OpenID Connect, mais posait en **non-goal explicite** l'isolation des données par compte — exactement ce que le scénario validé demande désormais (« un espace est créé pour mon compte »). Il est donc remplacé ; seules ses briques génériques sont reprises.

Contraintes d'exécution :

- **Contexte sécuré obligatoire** pour WebAuthn : HTTPS avec un nom d'hôte, ou `localhost`. Le déploiement Scaleway expose `docdocnamespace572c01fb-docdoc-app.functions.fnc.fr-par.scw.cloud` ([main.tf:122-125](main.tf#L122-L125)) : HTTPS, donc valide, mais **nom généré**.
- **Instance unique**, 128 Mo, `max_scale = 1` ([main.tf:99-104](main.tf#L99-L104)) : pas de coordination distribuée à prévoir.
- **Aucun fournisseur d'email** n'existe dans le projet : `package.json` ne contient que `express`, `htmx.org` et `@aws-sdk/client-s3`.
- **Image épinglée** à `docker.io/emmanuel7044/docdoc:1.1` ([main.tf:22](main.tf#L22)).

## Goals / Non-Goals

**Goals:**
- Verrouiller l'accès à toute l'application (pages, fragments htmx, API) derrière une session authentifiée.
- Authentifier sans mot de passe : passkey WebAuthn comme credential durable, code email comme amorçage unique.
- Isoler réellement les données **par compte** dans le stockage, tout en n'autorisant qu'**une seule adresse email**.
- Rendre le parcours complet : créer un compte, se reconnecter sur un nouvel appareil, ajouter ou révoquer une passkey, récupérer l'accès après perte de tous les appareils.
- Reprendre les données existantes dans le premier espace sans intervention manuelle.

**Non-Goals:**
- Plusieurs comptes autorisés : l'allowlist reste à une adresse. Le layout est prêt, l'ouverture n'est pas faite.
- Rôles, permissions granulaires, partage entre comptes.
- Mot de passe, ou second facteur : la passkey est le seul credential, l'email n'est qu'un amorçage.
- Refonte du frontend ou ajout d'un framework : htmx reste en place.
- Isolation par domaine ou par projet à l'intérieur d'un compte.
- Attestation d'authentificateur, politique d'AAGUID, ou gestion d'appareils de confiance.

## Decisions

**Décision 1 — Le code email est l'amorçage, la passkey est le credential.**
WebAuthn ne transporte aucune identité : il lie une paire de clés à une origine. Une passkey ne peut donc pas, seule, dire *qui* ouvre l'application lors du premier contact. Le code email prouve le contrôle d'une adresse, l'allowlist filtre, et l'enregistrement de la passkey crée le compte.

```
  code email  ──prouve──▶  contrôle de l'adresse
  allowlist   ──filtre──▶  adresse habilitée
  passkey     ──prouve──▶  détention de la clé privée, liée à l'origine
  session     ──porte──▶   identité de la requête
```

*Alternatives considérées* : passkey seule avec compte pré-provisionné à la main (rejeté : aucune création de compte possible, contraire au scénario) ; mot de passe + passkey en second facteur (rejeté : réintroduit le secret partagé que le scénario veut supprimer).

**Décision 2 — Le contrôle d'habilitation précède tout envoi d'email.**
La liste `AUTHORIZED_EMAILS` (valeur par défaut `emmanuel.grandiere@laposte.net`) est vérifiée **dès la soumission de l'adresse**, avant génération et envoi du code ; la comparaison normalise l'adresse (trim + casse). Un visiteur non habilité reçoit immédiatement le message « vous n'êtes pas habilité sur docdoc ».

*Pourquoi* : placer le contrôle après la saisie du code obligerait à envoyer un message à une adresse non habilitée, faisant de docdoc un relais d'envoi (coût, réputation du domaine, énumération d'adresses). Le seul inconvénient — révéler qui est habilité — est nul pour une application personnelle, et c'est précisément l'information que le scénario veut afficher.

*Alternatives considérées* : contrôle après vérification du code (rejeté, cf. ci-dessus) ; adresse en dur dans `server.js` (rejeté : la règle doit rester configurable, et un littéral en code rend l'ouverture à une seconde adresse intrusive).

**Décision 3 — Bibliothèque `@simplewebauthn/server` (+ `@simplewebauthn/browser`).**
Elle gère la génération et la vérification des challenges, la vérification de l'origine et du RP ID, la validation de la signature, la lecture des drapeaux (`UV`, `BE`, `BS`) et la gestion des compteurs. Le code applicatif ne réimplémente aucune primitive cryptographique.

*Alternatives considérées* : `fido2-lib` (rejeté : plus bas niveau, davantage de code de vérification à écrire et à auditer) ; `@passwordless-id/webauthn` (rejeté : écosystème moins établi, moins de documentation sur les passkeys synchronisées) ; implémentation manuelle de CBOR/COSE (rejeté : dangereux et inutile).

**Décision 4 — Layout de clés scopé par compte, avec deux index de résolution.**
Tout objet porte le préfixe `users/{userId}/`, où `userId` est un identifiant opaque et stable, jamais l'adresse email.

```
docdoc-json-storage/
├── users/
│   ├── by-email/{sha256(email normalisé)}.json      ← email → userId
│   ├── by-credential/{credentialId}.json            ← credential → userId
│   └── {userId}/
│       ├── account.json                             ← email, passkeys[], createdAt
│       ├── themes.json
│       ├── domains/{domainId}.json
│       └── archive/{domainId}.json
└── (legacy) domains/, archive/, themes.json         ← vidés à l'adoption
```

*Pourquoi deux index* : `by-email` évite un listage complet du bucket à chaque demande de code ; `by-credential` est **indispensable** à la connexion découvrable (sans email), puisque le serveur ne connaît alors que l'identifiant du credential. Hacher l'email dans la clé évite de laisser une adresse en clair dans un nom d'objet.

*Alternatives considérées* : userId = email haché (rejeté : couplage fort, une adresse qui change casse tout, et l'email fuit dans les chemins) ; balayage de tous les comptes à chaque connexion (rejeté : coût et fragilité, inutile alors que l'index est trivial) ; bucket par compte (rejeté : multiplie la configuration et casse `storage.js`).

**Décision 5 — L'état global devient un cache par compte.**
Les singletons `domains`, `domainList`, `themes` — corrects tant qu'il n'existe qu'un magasin — deviennent un cache indexé par `userId`, résolu à chaque requête à partir de la session. Un rechargement par requête serait correct mais ferait un appel S3 par affichage ; le cache par compte garde le coût actuel tout en supprimant la fuite entre comptes.

*Pourquoi* : c'est le point où une simple « ajout de login » produirait une faille silencieuse — un utilisateur authentifié servi avec les données chargées pour un autre.

*Alternatives considérées* : rechargement intégral à chaque requête (rejeté : coût S3 et latence inutiles) ; conserver les singletons et n'ajouter que l'authentification (rejeté : fuite de données entre comptes).

**Décision 6 — Session d'enrôlement dégradée, distincte de la session pleine.**
Après vérification du code, la session entre dans un état intermédiaire qui n'ouvre **que** les routes `POST /auth/passkey/register/*`, avec une durée de vie courte. Le compte et l'espace ne sont créés qu'après vérification de l'attestation.

*Pourquoi* : sans cet état, vérifier un code reviendrait à ouvrir l'application à quiconque contrôle la boîte email — ce qui annulerait le bénéfice de la passkey. La séparation rend l'élévation de privilège explicite et testable.

*Alternatives considérées* : jeton d'enrôlement signé à usage unique dans un champ caché (rejeté : logique de signature et d'expiration à réimplémenter, pour aucun gain) ; création du compte dès la vérification du code puis enregistrement différé de la passkey (rejeté : laisse exister un compte sans credential).

**Décision 7 — Connexion par passkey découvrable, sans saisie d'email.**
L'enregistrement demande `residentKey: required` et `userVerification: preferred` ; l'assertion est demandée avec une liste de credentials vide, ce qui laisse le navigateur proposer les passkeys disponibles (et permet l'autofill sur le champ email via la *conditional UI*).

*Pourquoi* : c'est le bénéfice d'usage qui justifie les passkeys, et il conditionne le libellé de la page d'accueil : un bouton « Se connecter » qui n'exige rien d'autre qu'un geste biométrique.

*Alternatives considérées* : imposer la saisie de l'email avant l'assertion (rejeté : transforme la passkey en second facteur et dégrade l'expérience) ; supporter les deux en parallèle (retenu : l'assertion par email reste acceptée en repli, la découvrable est le chemin nominal).

**Décision 8 — Passkeys synchronisées acceptées, attestation ignorée, compteur tolérant.**
`attestation: none`, les drapeaux `BE`/`BS` sont acceptés et stockés, et une signature dont le compteur n'a pas augmenté est acceptée (l'observation est enregistrée).

*Pourquoi* : refuser les passkeys synchronisées (iCloud Keychain, Google Password Manager, gestionnaires de mots de passe) reviendrait à imposer un appareil unique — un téléphone perdu fermerait l'accès. Les compteurs ne sont pas fiables sur les credentials synchronisés, et un compteur à 0 est un comportement attendu, pas une attaque.

*Alternatives considérées* : `attestation: direct` (rejeté : charge de vérification et de confidentialité sans bénéfice pour un usage personnel) ; rejet strict sur compteur non croissant (rejeté : verrouillerait l'utilisateur hors de son propre compte).

**Décision 9 — Sessions `express-session` en mémoire, cookie `httpOnly` / `SameSite=Lax` / `secure` en production.**
`app.set('trust proxy', 1)` est requis, le conteneur Scaleway étant derrière un proxy.

*Pourquoi le store en mémoire est acceptable ici* : il est perdu à chaque redéploiement ou extinction du conteneur, mais se reconnecter coûte un geste biométrique, pas la ressaisie d'un mot de passe — les passkeys rendent cette décision beaucoup moins coûteuse qu'elle ne l'était pour `google-oidc-auth`.

*Alternatives considérées* : sessions persistées dans le bucket (rejeté : écriture S3 par requête, complexité de purge) ; `cookie-session` sans état (rejeté : la déconnexion et l'expiration doivent rester révocables côté serveur).

**Décision 10 — Intégration htmx : un `401` ne s'affiche jamais dans une cible de fragment.**
Les réponses non authentifiées portent un en-tête `HX-Redirect` vers l'accueil pour les requêtes htmx, et le client traite `htmx:responseError` en repli.

*Pourquoi* : les fragments (`/domaine/:slug/outline-fragment`, routes `hx-post`) sont injectés dans `#outline` ; sans traitement explicite, une session expirée remplacerait l'outline par la page d'accueil au milieu de l'interface.

*Alternatives considérées* : redirection HTTP classique (rejeté : htmx la suit et injecte le HTML de la page d'accueil dans la cible) ; masquer les erreurs côté client uniquement (rejeté : laisse des réponses 401 non gérées et ne reflète pas l'état serveur).

**Décision 11 — Fournisseur d'email : Scaleway Transactional Email, avec mode développement.**
Même compte et même région (`fr-par`) que le conteneur et le bucket ; repli Brevo si le palier d'essai ne suffit pas. Un mode développement journalise le code au lieu de l'envoyer, et l'envoi est encapsulé derrière une interface unique (`sendCode(email, code)`).

*Pourquoi* : limiter le nombre de fournisseurs à administrer, et permettre de dérouler tout le parcours en local sans dépendance externe.

*Alternatives considérées* : SMTP + `nodemailer` (rejeté : configuration plus lourde, délivrabilité à gérer soi-même) ; API Brevo/Resend directement (repli documenté, pas le choix par défaut).

**Décision 12 — Domaine personnalisé avant diffusion des passkeys.**
Le RP ID est le nom d'hôte servi. Le rattachement d'un domaine personnalisé au conteneur Scaleway est une tâche préalable bloquante ; tant qu'il n'est pas fait, l'endpoint généré est utilisé et le risque de perte globale des passkeys est documenté et assumé.

*Alternatives considérées* : garder l'endpoint généré (rejeté comme cible : une recréation du namespace invaliderait toutes les passkeys) ; figer le nom par un enregistrement CNAME (insuffisant : le RP ID doit être stable côté plateforme).

**Décision 13 — Remplacer `google-oidc-auth` plutôt que le fusionner.**
Le change dormant est retiré ; ses briques utiles (middleware `requireAuth`, session, allowlist email, `/api/me`, `/logout`) sont reprises dans ce change, sans conserver Google comme fournisseur.

*Alternatives considérées* : garder Google comme seconde voie d'accès (écarté par décision explicite ; c'est la seule protection contre la perte simultanée de tous les appareils **et** de la boîte `@laposte.net`, à reconsidérer si ce risque devient inacceptable).

## Risks / Trade-offs

- **[Perte globale des passkeys]** Le RP ID suit le nom d'hôte : recréer le namespace ou le conteneur sur l'endpoint généré invalide toutes les passkeys d'un coup. → Domaine personnalisé en tâche préalable ; à défaut, la récupération par code email reste fonctionnelle et la procédure est documentée.
- **[Dépendance à la boîte email]** Le code est la seule porte de secours ; si l'adresse `@laposte.net` est perdue **et** tous les appareils aussi, l'accès est définitivement perdu. → Risque assumé et documenté ; un second IdP (Google) serait la seule mitigation réelle, écartée par décision.
- **[Envoi d'emails]** Un expéditeur `@laposte.net` sera rejeté (SPF/DKIM) : un domaine d'envoi authentifié est nécessaire. → Domaine d'envoi dédié et vérification de la configuration du fournisseur avant mise en production.
- **[Sessions volatiles]** Store en mémoire : chaque redéploiement déconnecte. → Acceptable, la reconnexion est biométrique ; documenté.
- **[Fuite entre comptes]** Le risque principal du passage au multi-locataire est de servir un cache global à un autre compte. → Cache indexé par `userId`, résolution depuis la session uniquement, refus des identifiants fournis par le client, et scénarios dédiés dans `user-space`.
- **[Adoption des données]** Un déplacement raté ou rejoué pourrait perdre ou dupliquer les domaines existants. → Adoption idempotente (déplacement uniquement si les clés racine existent), vérifiée par scénario, et sauvegarde du bucket avant bascule.
- **[Verrouillage hors de son compte en cours d'implémentation]** Activer le contrôle d'accès avant que l'enrôlement ne fonctionne rendrait l'application inaccessible. → Ordre de livraison strict : stockage scopé, puis comptes, puis protection des routes.
- **[Coût et palier]** Le conteneur tient dans le palier gratuit à 128 Mo / 0,07 vCPU ; les dépendances ajoutées sont légères. → Ne pas augmenter `memory_limit` / `cpu_limit` sans vérifier la consommation du mois.
- **[Mode développement]** Le mode qui journalise le code ne doit jamais être actif en production. → Activation par variable d'environnement explicite, avec avertissement au démarrage si le mode est actif alors que `NODE_ENV=production`.

## Migration Plan

1. **Préalable (bloquant)** : rattacher un domaine personnalisé au conteneur Scaleway et fixer `RP_ID` / `RP_ORIGIN` ; vérifier l'accès HTTPS sur ce domaine.
2. Sauvegarder le bucket (`domains/`, `archive/`, `themes.json`) avant toute bascule.
3. Livrer le socle de stockage scopé par compte et l'adoption, **sans** activer la protection des routes : l'application reste accessible, les clés racine sont migrées, l'accès aux données est inchangé.
4. Ajouter les comptes, l'OTP email, les cérémonies WebAuthn et les sessions ; enrôler le compte autorisé en recette.
5. Activer le middleware de protection de toutes les routes, puis retirer le change `google-oidc-auth`.
6. Publier une nouvelle image Docker (tag `1.2`) et basculer `app_image` dans `main.tf` ; ajouter les variables d'environnement et les secrets au conteneur.
7. **Rollback** : restaurer l'image et `main.tf` précédents, désactiver le middleware de protection via une variable, et, si nécessaire, remettre les objets du bucket sous leurs clés racine depuis la sauvegarde. Les passkeys enregistrées restent valides — le RP ID n'a pas changé — et redeviennent utiles au redéploiement suivant.

## Open Questions

- **Fournisseur d'email** : Scaleway TEM couvre-t-il le palier d'essai nécessaire, et quel domaine d'envoi authentifié sera utilisé ? La valeur par défaut retenue est TEM, le repli Brevo.
- **Domaine personnalisé** : quel nom de domaine, et est-il acquis ? Tant qu'il ne l'est pas, l'endpoint généré sert de RP ID et le risque de perte globale des passkeys est assumé.
- **Durées** : valeurs exactes de la durée de vie du code, du délai de renvoi, du nombre d'essais, de la durée de la session d'enrôlement et de l'expiration de session — à fixer dans la configuration, valeurs par défaut proposées : 10 min, 60 s, 5 essais, 15 min, 30 jours glissants.
- **Second IdP** : Google reste-t-il définitivement écarté, ou deviendra-t-il la voie de secours si la boîte `@laposte.net` est jugée trop fragile comme unique recours ?
- **Sort des clés racine** : après adoption, faut-il supprimer définitivement `domains/`, `archive/` et `themes.json`, ou conserver une copie horodatée sous un préfixe d'archive de migration ?
