## 1. Préalables et configuration

- [ ] 1.1 Rattacher un domaine personnalisé au conteneur Scaleway et vérifier l'accès HTTPS sur ce domaine — *action manuelle : console Scaleway + DNS ; le risque est documenté et la récupération par email reste possible*
- [x] 1.2 Relever l'origine HTTPS finale et en déduire `RP_ID` (nom d'hôte, sans schéma ni port) et `RP_ORIGIN` (origine complète)
- [ ] 1.3 Sauvegarder le bucket (clés racine `domains/`, `archive/`, `themes.json`) avant toute bascule — *action manuelle : accès au bucket ; la procédure est décrite dans le Readme*
- [x] 1.4 Ajouter les dépendances `@simplewebauthn/server`, `@simplewebauthn/browser`, `express-session` et la bibliothèque du fournisseur d'email
- [x] 1.5 Créer un `.env.example` documentant `SESSION_SECRET`, `AUTHORIZED_EMAILS`, `RP_ID`, `RP_ORIGIN`, les identifiants du fournisseur d'email et le mode développement
- [x] 1.6 Propager au conteneur Scaleway (`main.tf`) les nouvelles variables d'environnement publiques et les secrets correspondants
- [x] 1.7 Vérifier que `.env` reste ignoré par git et qu'aucun secret n'est commité

## 2. Socle de stockage scopé par compte

- [x] 2.1 Paramétrer les opérations de `storage.js` (lecture, écriture, énumération, déplacement) par un préfixe explicite
- [x] 2.2 Introduire les constructeurs de clés scopées : `users/{userId}/domains/{id}.json`, `users/{userId}/archive/{id}.json`, `users/{userId}/themes.json`
- [x] 2.3 Remplacer les singletons `domains`, `domainList` et `themes` par un cache indexé par `userId`
- [x] 2.4 Résoudre les données d'une requête à partir du compte de la session, sans repli sur un autre compte
- [x] 2.5 Faire suivre `userId` dans toutes les routes existantes (pages, fragments, nœuds, statuts, indentation, déplacement, domaines, thèmes, étiquettes)
- [x] 2.6 Pré-créer hors ligne l'enregistrement de compte de l'adresse autorisée et y adopter les clés racine, afin que l'application reste fonctionnelle avant l'activation de l'authentification
- [x] 2.7 Implémenter l'adoption idempotente des clés racine vers l'espace du premier compte
- [x] 2.8 Supprimer le seed automatique d'un domaine « Projets » : un espace neuf reste vide
- [ ] 2.9 Vérifier que l'application reste pleinement fonctionnelle à cette étape, sans authentification active — *non applicable : le socle et la protection ont été livrés dans la même passe, il n'existe donc pas d'état intermédiaire « stockage scopé, accès encore ouvert » à vérifier. Le script `npm run bootstrap` couvre le besoin opérationnel (compte et données en place avant bascule).*

## 3. Comptes et index de résolution

- [x] 3.1 Définir le format du document `account.json` (userId, email, createdAt, passkeys[])
- [x] 3.2 Écrire l'index `by-email/{sha256(email normalisé)}.json`
- [x] 3.3 Écrire l'index `by-credential/{credentialId}.json`
- [x] 3.4 Implémenter la résolution d'un compte par adresse et par identifiant de credential, sans balayage complet
- [x] 3.5 Réutiliser un compte existant pour une adresse déjà enregistrée, sans en créer un second

## 4. Code à usage unique par email

- [x] 4.1 Générer un code à six chiffres lié à l'adresse, avec expiration et usage unique
- [x] 4.2 Stocker le code sous une forme non lisible (haché), jamais en clair
- [x] 4.3 Implémenter l'interface d'envoi `sendCode(email, code)` avec le fournisseur retenu
- [x] 4.4 Ajouter le mode développement qui journalise le code sans envoyer d'email, avec avertissement au démarrage si ce mode est actif avec `NODE_ENV=production`
- [x] 4.5 Implémenter la vérification : code correct, faux, expiré, déjà utilisé, ou émis pour une autre adresse
- [x] 4.6 Implémenter le renvoi, avec invalidation du code précédent et délai de garde
- [x] 4.7 Limiter le nombre d'essais par code et le débit des demandes par adresse et par client
- [x] 4.8 Traiter un échec du fournisseur d'email sans arrêter le serveur

## 5. Cérémonies WebAuthn

- [x] 5.1 Générer les options d'enregistrement : challenge serveur, RP ID, user handle opaque et stable de 64 octets au plus, `excludeCredentials`
- [x] 5.2 Vérifier l'attestation et stocker le credential (identifiant, clé publique, compteur, transports, libellé, date)
- [x] 5.3 Refuser une attestation invalide sans créer de compte ni stocker de credential
- [x] 5.4 Générer les options d'assertion, y compris sans adresse email (credentials découvrables)
- [x] 5.5 Vérifier l'assertion (challenge, origine, RP ID, signature, drapeaux) et refuser un challenge inconnu, expiré ou rejoué
- [x] 5.6 Refuser une assertion dont l'origine ou le RP ID ne correspond pas, ou dont le credential est inconnu
- [x] 5.7 Résoudre le compte depuis le credential et ouvrir la session pleine
- [x] 5.8 Configurer `attestation: none`, `userVerification: preferred`, `residentKey: required`, et accepter les passkeys synchronisées (`BE`/`BS`)
- [x] 5.9 Accepter une assertion dont le compteur n'a pas augmenté, en enregistrant l'observation
- [x] 5.10 Stocker les challenges côté serveur avec expiration et usage unique

## 6. Sessions et protection des routes

- [x] 6.1 Mettre en place `express-session` : cookie `httpOnly`, `SameSite=Lax`, `secure` en production, `trust proxy`
- [x] 6.2 Introduire la session d'enrôlement dégradée, limitée aux routes d'enregistrement de passkey et de durée courte
- [x] 6.3 Vérifier qu'une session d'enrôlement ne peut atteindre aucune route de données
- [x] 6.4 Écrire le middleware de protection : pages → page d'accueil, API → réponse non autorisée, sans exposer de données
- [x] 6.5 Exposer `GET /api/me` (état de session) et `POST /logout` (destruction de la session côté serveur)
- [x] 6.6 Traiter les réponses non autorisées des échanges htmx via `HX-Redirect`, avec repli `htmx:responseError`
- [x] 6.7 Activer la protection sur toutes les routes existantes et vérifier qu'aucune n'est oubliée

## 7. Parcours d'accueil et d'enrôlement

- [x] 7.1 Page d'accueil non connectée indiquant qu'aucun espace docdoc n'est associé au navigateur
- [x] 7.2 Deux actions sur cette page : « Créer un compte » et « Se connecter » (sans saisie d'email)
- [x] 7.3 Formulaire de saisie de l'email, avec rejet des adresses vides ou malformées
- [x] 7.4 Contrôle d'habilitation avant tout envoi, avec message explicite pour une adresse non habilitée et aucun email expédié
- [x] 7.5 Formulaire de saisie du code, avec action de renvoi et messages d'erreur distincts (faux, expiré, trop d'essais)
- [x] 7.6 Écran d'enregistrement de la passkey, appelant l'API navigateur et gérant l'annulation et l'échec
- [x] 7.7 Entrée dans l'espace de compte après enregistrement réussi
- [x] 7.8 Affichage de l'état de session et de l'action de déconnexion dans l'interface existante

## 8. Gestion des passkeys

- [x] 8.1 Écran listant les passkeys du compte (libellé, date de création), sans jamais exposer un autre compte
- [x] 8.2 Renommer une passkey
- [x] 8.3 Révoquer une passkey, avec effet immédiat sur les assertions suivantes
- [x] 8.4 Refuser la révocation de la dernière passkey et l'expliquer à l'utilisateur
- [x] 8.5 Permettre d'enregistrer une passkey supplémentaire depuis un compte déjà authentifié (autre appareil)

## 9. Récupération

- [x] 9.1 Garder le parcours par code email accessible en permanence depuis la page d'accueil
- [x] 9.2 Vérifier que la récupération ajoute la passkey au compte existant sans en créer un second
- [x] 9.3 Vérifier qu'une récupération aboutit même sans aucune passkey utilisable

## 10. Retrait de google-oidc-auth

- [x] 10.1 Reprendre dans le nouveau code les briques utiles du change remplacé (middleware, session, allowlist, `/api/me`, `/logout`)
- [x] 10.2 Retirer le change `google-oidc-auth` et ses artefacts
- [x] 10.3 Vérifier qu'aucune spécification de `openspec/specs/` ne présente Google comme fournisseur d'accès

## 11. Vérification

- [x] 11.1 Dérouler le parcours complet en local sur `localhost` (contexte sécuré autorisé pour WebAuthn)
- [ ] 11.2 Vérifier chaque scénario des capacités `account-enrollment`, `email-otp`, `passkey-auth` et `user-space` — *couverture partielle : 25 vérifications automatisées couvrent le parcours et les refus ; restent non exercés l'expiration réelle d'un code dans le temps, l'échec du fournisseur d'email, et la coexistence d'une passkey liée à un appareil et d'une passkey synchronisée sur un même compte*
- [x] 11.3 Vérifier qu'un visiteur non authentifié n'obtient aucune donnée, ni par page, ni par fragment, ni par API
- [x] 11.4 Vérifier qu'aucune donnée d'un compte n'est servie à un autre, avec deux comptes de recette
- [x] 11.5 Vérifier l'adoption des données existantes et sa non-répétition lors d'un second enrôlement
- [ ] 11.6 Vérifier la connexion découvrable sans saisie d'email sur au moins deux navigateurs — *non réalisable ici : aucun navigateur avec authentificateur réel n'est disponible ; le parcours est vérifié avec un authentificateur logiciel*
- [x] 11.7 Vérifier qu'une session expirée n'injecte pas la page d'accueil dans une cible htmx
- [x] 11.8 Vérifier que le mode développement n'est pas actif en production
- [x] 11.9 Exécuter `openspec validate passkey-auth --strict`

## 12. Déploiement et documentation

- [ ] 12.1 Publier une nouvelle image Docker et mettre à jour le tag dans `main.tf` — *action manuelle : accès Docker Hub ; le tag reste volontairement à `1.1` tant que l'image `1.2` n'existe pas*
- [ ] 12.2 Déployer avec la protection active, après enregistrement du compte autorisé en recette — *action manuelle : `tofu apply` et enrôlement réel*
- [x] 12.3 Documenter la procédure de récupération (appareil perdu, toutes les passkeys perdues)
- [x] 12.4 Documenter la configuration du fournisseur d'email, y compris le domaine d'envoi authentifié (SPF/DKIM)
- [x] 12.5 Documenter la procédure de rollback et la restauration éventuelle des clés racine
