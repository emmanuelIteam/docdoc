## Context

docdoc est une application Express 4 entièrement rendue côté serveur : chaque navigation renvoie un document HTML construit à partir de la session, et htmx remplace des fragments. Deux coquilles produisent ces documents — `renderShell` dans `server.js` (application authentifiée) et `authShell` dans `authpages.js` (pages d'accès) — et elles partagent `public/style.css`. `express.static('public')` est monté avant la session : les fichiers de `public/` sont publics, sans cookie ni contrôle d'accès. En production, l'application tourne dans un conteneur Scaleway derrière HTTPS (`docdoc.re`), servi par Let's Encrypt ; en local elle écoute sur `http://localhost:3000`, qui est aussi un contexte sécurisé pour les service workers.

Le cookie `docdoc.sid` est `httpOnly`, `sameSite=lax` et `secure` en production. Les documents HTML contiennent les domaines, thèmes et outlines de l'utilisateur : ils ne doivent jamais entrer dans un cache partagé. L'application n'a aujourd'hui ni manifeste, ni icône, ni service worker, ni favicon : l'installation n'est pas proposée et une coupure réseau affiche l'erreur du navigateur.

Contraintes : aucune étape de build (les fichiers de `public/` sont servis tels quels), aucune nouvelle dépendance souhaitée, et l'application doit rester utilisable sans JavaScript (formulaires POST classiques).

## Goals / Non-Goals

**Goals**

- Rendre docdoc installable sur desktop et mobile via un manifeste conforme (nom, icônes 192/512/maskable, `start_url`, `scope`, `standalone`).
- Proposer l'installation depuis l'interface, avec l'invite native quand elle existe et les consignes Safari/iOS sinon, sans bouton mort sur les navigateurs qui ne savent pas installer.
- Fournir un service worker à portée racine qui accélère les actifs statiques et affiche une page hors ligne honnête, sans jamais mettre en cache une réponse personnelle.
- Propager les mises à jour de l'application sans recharger une page en cours d'édition.
- Ne rien changer aux parcours d'authentification, aux routes de données ni au modèle de données.

**Non-Goals**

- Pas de notifications push, de synchronisation en arrière-plan, ni d'édition hors ligne.
- Pas de cache des outlines, domaines, thèmes, pages HTML ou réponses API.
- Pas de génération d'icônes au démarrage ni de dépendance de traitement d'image au runtime.
- Pas de page d'installation dédiée ni de bannière persistante : l'invitation reste discrète et contextuelle.
- Pas de refonte de `renderShell` / `authShell` au-delà de leur `<head>` et du pied de panneau.

## Decisions

### D1 — Manifeste statique servi par une route explicite

Le manifeste est un fichier `public/manifest.webmanifest` versionné, servi par une route dédiée `GET /manifest.webmanifest` déclarée avant `express.static`. La route fixe `Content-Type: application/manifest+json` et `Cache-Control: no-cache`.

- *Pourquoi* : le manifeste ne dépend d'aucune donnée de session ; un fichier est relisible en revue et testable tel quel. La route explicite évite de dépendre du mapping MIME de `mime`/`send` pour l'extension `.webmanifest`, et garantit la revalidation.
- *Alternative rejetée* : générer le manifeste depuis `server.js` — cela dupliquerait des constantes (couleurs, tailles) sans valeur ajoutée.
- *Alternative rejetée* : laisser `express.static` servir le fichier — le `Content-Type` et le `Cache-Control` dépendraient de la version des dépendances.

### D2 — Icônes PNG versionnées, dérivées d'une source SVG unique

La source est `public/icons/icon.svg` (monogramme « d » sur fond `#2563eb`, coins arrondis). Les PNG `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon-180.png` et `favicon-32.png` sont produits une fois hors runtime et commités.

- *Pourquoi* : le manifeste Chromium attend des icônes raster de 192 et 512 px ; un SVG seul n'est pas accepté partout pour l'installation. Commiter les PNG évite toute dépendance de build et garantit un rendu identique.
- *Détail maskable* : le glyphe du `icon-maskable-512.png` reste dans les 80 % centraux ; le fond plein bord à bord sert de zone de rognage.
- *Alternative rejetée* : générer les icônes avec `sharp`/`canvas` — nouvelle dépendance lourde pour cinq fichiers figés.
- *Alternative rejetée* : SVG uniquement avec `sizes: any` — support inégal selon les plateformes, installation non garantie.

### D3 — Métadonnées d'installabilité partagées par un module serveur

Un petit module `pwa-head.js` exporte la chaîne `<head>` commune (`manifest`, `theme-color`, icône Apple, `mobile-web-app-capable`, `apple-mobile-web-app-*`). `server.js` et `authpages.js` l'appellent dans leur coquille respective.

- *Pourquoi* : deux coquilles distinctes, une seule définition : une balise ajoutée ou corrigée ne peut pas être oubliée dans l'une des deux.
- *Alternative rejetée* : dupliquer les balises dans les deux fichiers — divergence garantie à la première évolution.
- Le module ne rend que des balises statiques : aucune donnée de session, aucun échappement nécessaire.

### D4 — Service worker à la racine (`/sw.js`)

Le worker vit dans `public/sw.js` et est enregistré sur `/sw.js`, donc avec la portée `/` sans en-tête `Service-Worker-Allowed`.

- *Pourquoi* : une portée racine est nécessaire pour couvrir `/`, `/administration` et `/domaine/*`. Servir le fichier à la racine évite un en-tête supplémentaire et un chemin imbriqué.
- *Alternative rejetée* : `/pwa/sw.js` + `Service-Worker-Allowed: /` — plus de pièces mobiles pour le même résultat.
- `GET /sw.js` est servi par une route explicite (comme le manifeste) avec un type JavaScript et `Cache-Control: no-cache`, pour que le navigateur détecte une nouvelle version au prochain chargement.

### D5 — Politique de cache : actifs publics uniquement, navigations en réseau seul

Le worker ne répond que pour une liste blanche stricte de `GET` same-origin (`/style.css`, `/app.js`, `/pwa.js`, `/auth.js`, `/simplewebauthn.js`, `/htmx.min.js`, `/manifest.webmanifest`, `/offline.html`, `/icons/*`) en stale-while-revalidate, et pour les navigations `GET` en réseau d'abord avec repli sur `/offline.html`. Tout le reste — `POST`, `/auth/*`, `/api/*`, fragments htmx, toute autre URL — n'est pas intercepté (`respondWith` n'est pas appelé).

- *Pourquoi* : les documents sont personnalisés et construits à partir de la session. Les mettre en cache ferait fuiter l'espace d'un compte vers le navigateur d'un autre sur un poste partagé, et servirait un HTML périmé incompatible avec l'état serveur et htmx.
- *Conséquence assumée* : l'application n'a aucune donnée hors ligne ; la page hors ligne le dit explicitement. C'est le comportement correct pour un outliner multi-utilisateur.
- *Alternative rejetée* : network-first pour les documents avec repli cache — gain marginal, fuite de données personnelles et états incohérents.
- *Alternative rejetée* : cache de toutes les requêtes `GET` — inacceptable pour la confidentialité.

### D6 — Page hors ligne servie en 200

Le repli de navigation renvoie le document `/offline.html` mis en cache avec le statut 200 et `text/html`. Si même cette page manque, le worker renvoie un HTML minimal en 503.

- *Pourquoi* : un 200 rend le comportement identique dans tous les navigateurs et évite les pages d'erreur natives qui masquent le message. Le statut 503 reste réservé au cas dégradé où le cache n'a pas la page.
- *Contenu* : document autonome (styles inline), en français, sans donnée de compte, avec le nom « docdoc », un message « une connexion est nécessaire » et un bouton `Réessayer` qui appelle `location.reload()`.

### D7 — Version de cache explicite, nettoyage à l'activation

Le worker définit `const CACHE_VERSION = 'v1'` et `const CACHE_NAME = 'docdoc-static-' + CACHE_VERSION`. À l'activation, il supprime les caches préfixés `docdoc-` autres que le courant, appelle `self.skipWaiting()` à l'installation et `clients.claim()` à l'activation.

- *Pourquoi* : sans étape de build, il n'y a pas d'empreinte de contenu ; une constante explicite est simple à relire et à faire évoluer. Le nettoyage évite l'accumulation de caches après chaque déploiement.
- *Discipline* : toute modification d'un actif précaché exige d'incrémenter `CACHE_VERSION`, documenté dans `Readme.md` et vérifiable en revue.
- *Alternative rejetée* : noms de cache dérivés d'un hash calculé au build — il n'y a pas de build.
- *Alternative rejetée* : ne jamais supprimer les anciens caches — croissance illimitée sur les postes.

### D8 — Invitation à installer : native, sinon iOS, sinon rien

`public/pwa.js` est chargé par les deux coquilles. Il enregistre le service worker dans un contexte sécurisé, écoute `beforeinstallprompt` et `appinstalled`, et pilote un bouton rendu masqué (`hidden`) dans le pied du panneau de la coquille authentifiée :

- dès `beforeinstallprompt`, le bouton devient visible ; un clic appelle `prompt()` une seule fois puis attend `userChoice` ; `accepted` ou `appinstalled` masquent le bouton, `dismissed` le laisse disponible ;
- sans `beforeinstallprompt`, sur iOS/iPadOS Safari hors mode autonome, le bouton devient visible et révèle un texte « Partager → Sur l'écran d'accueil » ;
- si le mode autonome est déjà actif (`display-mode: standalone` ou `navigator.standalone`), ou si le navigateur n'offre aucune des deux voies, le bouton reste masqué.

- *Pourquoi* : `beforeinstallprompt` n'existe que sur les navigateurs Chromium ; Safari iOS impose ses propres consignes. Masquer le contrôle quand il ne peut rien faire évite un bouton mort.
- *Alternative rejetée* : créer le bouton en JavaScript — le rendu serveur garde le libellé traduit, le style existant et un HTML sans JavaScript inchangé.
- *Alternative rejetée* : bannière d'installation globale — intrusive, et sans effet sur les navigateurs non compatibles.

### D9 — Mise à jour signalée, jamais imposée

`pwa.js` mémorise si la page était déjà contrôlée au chargement. À `controllerchange`, il n'affiche le bandeau « Nouvelle version disponible » avec un bouton `Recharger` que dans ce cas ; le rechargement n'a lieu que sur action de l'utilisateur.

- *Pourquoi* : `skipWaiting` + `clients.claim` font prendre la main au nouveau worker immédiatement ; recharger d'office ferait perdre un titre en cours de frappe ou un formulaire.
- *Alternative rejetée* : rechargement automatique — perte de saisie.
- *Alternative rejetée* : attendre la fermeture de tous les onglets — les utilisateurs resteraient sur d'anciens actifs pendant des jours.

### D10 — Vérification par tests Playwright

`test/e2e/pwa.spec.js` réutilise le harnais existant (Chrome installé, port fixe, répertoire de données jetable) et vérifie : manifeste et en-têtes, dimensions réelles des PNG, balises `<head>` sur une page d'accès et une page authentifiée, enregistrement et portée du worker, contenu de Cache Storage limité à la liste blanche (aucun email ni nom de domaine), navigation hors ligne servie par `/offline.html`, et bandeau de mise à jour. `beforeinstallprompt` est simulé par un événement synthétique portant `prompt()` et `userChoice` ; le mode autonome est simulé via CDP (`Emulation.setEmulatedMedia` avec la fonctionnalité `display-mode`).

- *Pourquoi* : ces exigences sont observables dans le navigateur ; un test qui inspecte Cache Storage est la seule preuve directe de l'absence de fuite.
- *Alternative rejetée* : tests unitaires du worker — le comportement réel (portée, cache, offline) ne se teste qu'en contexte navigateur.

## Risks / Trade-offs

- **Fuite de données par cache** → liste blanche de chemins statiques, navigations jamais stockées, et test qui inspecte les clés et les corps de Cache Storage ; l'application reste sans données hors ligne.
- **Actifs périmés après déploiement** → `CACHE_VERSION` à incrémenter documenté dans `Readme.md`, `sw.js` servi en `no-cache`, nettoyage des anciens caches, bandeau de mise à jour.
- **`beforeinstallprompt` non standard, absent de Firefox et Safari** → dégradation progressive : consignes iOS, sinon contrôle masqué ; aucune fonctionnalité de l'application n'en dépend.
- **Service worker actif sur les pages d'authentification** → le worker ne touche ni `/auth/*` ni les `POST` ; les parcours passkey (WebAuthn) restent hors de son périmètre. Les tests passkey existants servent de garde-fou.
- **Mise à jour inter-onglets** → `clients.claim()` contrôle les onglets ouverts, chacun affiche son propre bandeau ; le rechargement reste manuel.
- **Rollback** → après retrait des routes, `/sw.js` renvoie 404 : les navigateurs déjà équipés conservent le dernier worker (actifs statiques + page hors ligne), mais les navigations restent en réseau, donc l'application fonctionne. Pour un retrait complet, publier un `sw.js` qui supprime ses caches et s'enregistre comme obsolète (`skipWaiting`, `caches.delete`, `registration.unregister()`), ou incrémenter la version avec un cache vide.
- **Cohérence des deux coquilles** → un seul module `pwa-head.js` et un test qui inspecte les deux types de page.

## Migration Plan

1. Ajouter les fichiers statiques (manifeste, icônes, `pwa.js`, `sw.js`, `offline.html`), le module `pwa-head.js`, les routes `/manifest.webmanifest` et `/sw.js`, puis les balises de `<head>` et le bouton du panneau.
2. Vérifier en local (`pnpm start`, `http://localhost:3000`, contexte sécurisé) : manifeste, enregistrement du worker, installation proposée sur Chrome, page hors ligne via l'onglet Réseau → Hors ligne.
3. Exécuter `pnpm test:e2e` (dont le nouveau `pwa.spec.js`) et `pnpm test` pour vérifier l'absence de régression sur les passkeys et l'outline.
4. Déployer : reconstruire et pousser l'image Docker, puis `tofu apply` — aucune variable, aucun secret et aucune donnée ne changent. Les clients reçoivent le nouveau worker au chargement suivant.
5. Retour arrière : retirer les balises et les routes, redéployer ; aucun cache de données n'est à nettoyer. Pour effacer les caches et désenregistrer le worker côté clients, déployer le `sw.js` de retrait décrit ci-dessus.

## Open Questions

Aucune : les décisions ci-dessus couvrent les points ouverts du manifeste, des icônes, de la portée du worker, de la politique de cache et du parcours d'installation.
