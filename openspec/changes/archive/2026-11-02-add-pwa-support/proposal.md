## Why

docdoc s'utilise aujourd'hui uniquement en ouvrant une URL dans un navigateur : pas d'icône sur l'écran d'accueil ou le bureau, pas de fenêtre dédiée, et une page d'erreur du navigateur dès que la connexion tombe. Le site est désormais servi en HTTPS sur `docdoc.re` avec une authentification par passkey : toutes les briques d'une PWA sont réunies, il ne manque que le manifeste, les icônes et un service worker. Offrir l'installation transforme docdoc en application de bureau/mobile au même titre qu'une application native, sans changer le modèle de données ni ajouter de dépendance.

## What Changes

- **Manifeste et icônes** : nouveau manifeste de web app (`/manifest.webmanifest`) avec nom, nom court, `start_url` `/`, `scope` `/`, `display: standalone`, couleurs et icônes 192 px, 512 px et 512 px « maskable » ; icône Apple 180 px et favicon.
- **Métadonnées des documents** : les deux coquilles HTML (application authentifiée et pages d'accès) déclarent le manifeste, la couleur de thème, le favicon, l'icône Apple et les balises `apple-mobile-web-app-*`, afin que le manifeste soit découvert dès la page d'accès et que l'installation proposée par le navigateur fonctionne avant même la première connexion.
- **Service worker** : `public/sw.js` servi à la racine (portée `/`), précache des seuls actifs statiques et d'une page hors ligne, stratégie « réseau seul » pour les navigations, mise à jour versionnée et nettoyage des anciens caches.
- **Page hors ligne** : `public/offline.html`, page autonome en français expliquant que docdoc a besoin d'une connexion, avec un bouton « Réessayer ».
- **Invitation à installer** : dans la coquille authentifiée, un contrôle discret « Installer l'application » capte `beforeinstallprompt` et déclenche l'invite native ; sur iOS/Safari, il affiche la marche à suivre « Partager → Sur l'écran d'accueil » ; il disparaît lorsque l'application tourne déjà en mode autonome.
- **Mise à jour** : `sw.js` et le manifeste sont servis en `Cache-Control: no-cache`, le nouveau worker prend la main immédiatement, et une notification propose de recharger pour appliquer la nouvelle version.
- **Règle de confidentialité** : aucune réponse personnelle (HTML authentifié, fragments htmx, routes API, `/auth/*`) n'entre dans un cache — seuls les actifs statiques publics et la page hors ligne sont mis en cache.

**Non-objectifs** : pas de notifications push, pas de synchronisation en arrière-plan, pas d'édition hors ligne, pas de mise en cache des données de l'utilisateur, pas de nouvelle dépendance, aucune modification du modèle de données ni des parcours d'authentification.

## Capabilities

### New Capabilities

- `pwa-installation` : décrit l'artefact installable (manifeste, icônes, métadonnées de document) et les parcours d'installation — invite native captée par l'application, consignes iOS, état « déjà installée » — sur les pages d'accès comme dans l'application.
- `offline-shell` : décrit le cycle de vie du service worker (portée, précache, nettoyage), la stratégie de cache par type de requête, la page hors ligne, la propagation des mises à jour et l'interdiction absolue de mettre en cache une réponse personnelle.

### Modified Capabilities

Aucune : le manifeste, le service worker et les métadonnées ajoutés aux coquilles HTML n'altèrent aucune exigence des capacités existantes (outline, domaines, thèmes, stockage, authentification). Les parcours d'accès et de données restent identiques, y compris sans JavaScript.

## Impact

- **`server.js`** : balises `<head>` de `renderShell` (manifeste, `theme-color`, icône Apple, `apple-mobile-web-app-*`) ; routes explicites `GET /manifest.webmanifest` et `GET /sw.js` déclarées **avant** `express.static` pour maîtriser le `Content-Type` et le `Cache-Control: no-cache`.
- **`authpages.js`** : mêmes balises `<head>` dans `authShell`, pour que les pages d'accès soient installables.
- **`Dockerfile`** : `pwa-head.js` ajouté à la liste des fichiers copiés, sans quoi l'image de production ne pourrait pas démarrer.
- **Nouveaux fichiers statiques** : `public/manifest.webmanifest`, `public/sw.js`, `public/pwa.js` (enregistrement et invite d'installation), `public/offline.html`, `public/icons/*` (192, 512, 512 maskable, 180, 32, et la source SVG).
- **Documentation** : section « Installer docdoc » dans `Readme.md` (icône, invite, comportement hors ligne, mise à jour des caches).
- **Tests** : nouveau `test/e2e/pwa.spec.js` (manifeste servi et valide, icônes aux bonnes dimensions, service worker enregistré et actif, page hors ligne servie quand le réseau est coupé, absence de cache pour les réponses authentifiées).
- **Dépendances** : aucune. Express et htmx restent les seules briques ; les icônes sont des fichiers versionnés.
- **Sécurité / vie privée** : la portée du service worker reste l'origine ; il ne lit ni ne stocke le cookie de session et ne met en cache que des URL statiques publiques. L'installation exige HTTPS (ou `localhost`) : la production Scaleway est déjà en HTTPS.
- **Retour arrière** : retirer les balises `<head>` et les routes suffit à ne plus proposer l'installation ; les clients déjà installés continuent de fonctionner en ligne et peuvent être nettoyés en publiant un `sw.js` qui supprime ses caches, sans toucher aux données du bucket.
