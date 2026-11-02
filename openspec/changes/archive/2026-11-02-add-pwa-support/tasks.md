## 1. Icônes et manifeste

- [x] 1.1 Créer la source SVG `public/icons/icon.svg` : monogramme « d » blanc sur fond `#2563eb`, coins arrondis, lisible à 32 px.
- [x] 1.2 Rasteriser la source en `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon-180.png` et `favicon-32.png` (outil local ponctuel, hors runtime), puis commiter les PNG.
- [x] 1.3 Vérifier les dimensions réelles des cinq PNG (en-tête PNG) et que le glyphe du maskable tient dans les 80 % centraux.
- [x] 1.4 Créer `public/manifest.webmanifest` avec `id`, `name`, `short_name`, `description`, `lang`, `start_url`, `scope`, `display`, `theme_color`, `background_color` et les icônes 192/512 `any` + 512 `maskable` pointant vers `/icons/`.
- [x] 1.5 Déclarer `GET /manifest.webmanifest` **avant** `express.static` dans `server.js`, avec `Content-Type: application/manifest+json`, `Cache-Control: no-cache` et le fichier de `public/` ; vérifier les en-têtes avec `curl`.

## 2. Métadonnées d'installabilité dans les documents

- [x] 2.1 Créer le module serveur `pwa-head.js` exportant `installabilityHead()` : manifeste, `theme-color`, favicon, icône Apple, `mobile-web-app-capable`, `apple-mobile-web-app-capable` et `apple-mobile-web-app-title`.
- [x] 2.2 Appeler `installabilityHead()` dans `renderShell` (`server.js`) et dans `authShell` (`authpages.js`), une seule fois par `<head>`.
- [x] 2.3 Vérifier sur `/` (sans session) et sur une page authentifiée que chaque balise apparaît exactement une fois et que le manifeste n'est pas dupliqué.

## 3. Page hors ligne et coquilles statiques

- [x] 3.1 Créer `public/offline.html` : document autonome en français, styles inline, nom « docdoc », message « une connexion est nécessaire », bouton `Réessayer` appelant `location.reload()`, aucune donnée de compte.
- [x] 3.2 Ajouter dans `public/style.css` le style du contrôle d'installation (bouton discret du pied de panneau, aide iOS) et du bandeau de mise à jour, cohérent avec les variables existantes.

## 4. Service worker

- [x] 4.1 Créer `public/sw.js` avec `CACHE_VERSION`, `CACHE_NAME = 'docdoc-static-' + CACHE_VERSION`, et la liste blanche des actifs statiques.
- [x] 4.2 Écrire le handler `install` : mettre en cache `/offline.html` puis les actifs de la liste blanche de façon résiliente (un actif manquant n'empêche pas l'installation), puis `skipWaiting()`.
- [x] 4.3 Écrire le handler `activate` : supprimer les caches `docdoc-*` autres que `CACHE_NAME`, conserver les caches étrangers, puis `clients.claim()`.
- [x] 4.4 Écrire le handler `fetch` : navigations `GET` en réseau seul avec repli `/offline.html` (200), liste blanche en stale-while-revalidate, tout le reste laissé au navigateur (`/auth/*`, `/api/*`, `/domaine/*`, `/administration`, `POST`, fragments htmx).
- [x] 4.5 Vérifier qu'aucune réponse de navigation, d'authentification ou d'API n'entre dans Cache Storage et que la page hors ligne fonctionne avec le réseau coupé.
- [x] 4.6 Servir `GET /sw.js` **avant** `express.static` avec un type JavaScript, `Cache-Control: no-cache` et le fichier `public/sw.js` ; vérifier les en-têtes avec `curl`.

## 5. Enregistrement et invitation à installer

- [x] 5.1 Créer `public/pwa.js` : enregistrement de `/sw.js` uniquement si `navigator.serviceWorker` existe et contexte sécurisé, avec erreurs capturées et aucune alerte bloquante.
- [x] 5.2 Ajouter au pied du panneau de `renderShell` un bouton `Installer l'application` rendu `hidden` et la zone d'aide iOS, sans bouton visible pour les utilisateurs sans JavaScript.
- [x] 5.3 Implémenter la captation de `beforeinstallprompt` : révéler le bouton, appeler `prompt()` une seule fois, masquer sur `accepted` ou `appinstalled`, conserver sur `dismissed`.
- [x] 5.4 Implémenter la détection iOS/iPadOS Safari hors mode autonome (aide « Partager → Sur l'écran d'accueil ») et masquer le contrôle si ni l'invite native ni iOS ne sont disponibles.
- [x] 5.5 Détecter le mode autonome (`display-mode: standalone`, `navigator.standalone`) et ne jamais afficher le contrôle dans ce cas.
- [x] 5.6 Charger `pwa.js` depuis les deux coquilles, après `app.js`, sans bloquer le rendu en cas d'échec.

## 6. Mise à jour de l'application

- [x] 6.1 Mémoriser dans `pwa.js` si la page était déjà contrôlée au chargement et, sur `controllerchange` uniquement dans ce cas, afficher le bandeau « Nouvelle version disponible » avec un bouton `Recharger`.
- [x] 6.2 Ne jamais recharger automatiquement : le rechargement n'a lieu que sur activation du bouton, et un premier enregistrement n'affiche aucun bandeau.
- [x] 6.3 Documenter dans `sw.js` que toute modification d'un actif précaché impose d'incrémenter `CACHE_VERSION`.

## 7. Tests

- [x] 7.1 Créer `test/e2e/pwa.spec.js` : `/manifest.webmanifest` répond 200 en `application/manifest+json`, sans `max-age`, avec `id`/`start_url`/`scope`/`display` et les icônes 192/512/maskable.
- [x] 7.2 Vérifier dans le test que chaque icône déclarée répond 200 `image/png` avec des dimensions réelles égales à sa taille déclarée, et que `/icons/apple-touch-icon-180.png` fait 180×180.
- [x] 7.3 Vérifier les balises `<head>` (manifeste, `theme-color`, favicon, icône Apple, méta Apple) sur la page d'accès anonyme et sur `/administration`.
- [x] 7.4 Vérifier `/sw.js` (type JavaScript, `no-cache`) et l'enregistrement effectif : `navigator.serviceWorker.ready`, portée `/`, page contrôlée après rechargement.
- [x] 7.5 Vérifier que Cache Storage ne contient que les URL de la liste blanche et `/offline.html`, et aucune occurrence de l'email du compte ni d'un nom de domaine.
- [x] 7.6 Vérifier la navigation hors ligne (`context.setOffline(true)`) : la page demandée affiche le contenu de `/offline.html`, et une requête de fragment n'est pas servie par cette page.
- [x] 7.7 Simuler `beforeinstallprompt` avec un événement synthétique (objet `prompt()` et `userChoice`) pour vérifier l'apparition, l'appel unique et la disparition du bouton ; simuler le mode autonome via CDP `Emulation.setEmulatedMedia` (`display-mode: standalone`) pour vérifier son absence.
- [x] 7.8 Vérifier le bandeau de mise à jour manuellement (deux versions de `CACHE_VERSION`, une page déjà contrôlée) et consigner la procédure dans le test en commentaire.
- [x] 7.9 Lancer `pnpm test:e2e` puis `pnpm test` : aucune régression sur les passkeys, l'outline et les parcours existants.

## 8. Documentation et vérification finale

- [x] 8.1 Ajouter au `Readme.md` une section « Installer docdoc » : icône sur l'écran d'accueil/bureau, invite native, consignes iOS, comportement hors ligne, procédure d'incrément de `CACHE_VERSION` et worker de retrait.
- [ ] 8.2 Vérifier manuellement sur Chrome/Edge : bouton d'installation visible après `beforeinstallprompt`, fenêtre autonome ouverte sur `/`, `/administration` et un domaine fonctionnels dans la fenêtre installée.
- [x] 8.3 Vérifier que `package.json` et les fichiers de verrouillage sont inchangés (aucune dépendance ajoutée) et que les cinq PNG sont bien suivis par git.
- [x] 8.4 Ajouter `pwa-head.js` à la liste des fichiers copiés par le `Dockerfile`, sans quoi l'image de production échouerait au démarrage sur `require('./pwa-head')`.
