## Context

Le tag de release traverse aujourd'hui une seule fois la frontière du build : `.github/workflows/release.yml` passe `APP_VERSION=${{ tag }}` à `docker build`, l'étape `assets` l'écrit dans la constante `CACHE_VERSION` de `public/sw.js`, et l'étape finale `node:22-alpine` ne conserve pas l'argument. À l'exécution, `server.js` ne connaît donc pas la version qu'il sert ; seul `/sw.js`, servi avec `Cache-Control: no-cache`, la déclare encore — c'est ce que la pipeline vérifie après déploiement.

La page « Aide » (`GET /aide`, `renderGuidePage`) est rendue côté serveur dans la coquille habituelle, à partir d'aucune donnée de l'espace : c'est du texte statique, disponible avant même le premier domaine. C'est le seul écran « à propos » de l'application, et le seul endroit où une information de version ne dispute pas la place aux tâches.

Contraintes :

- l'image finale n'a ni `.git`, ni `git` : le tag ne peut pas être retrouvé depuis les sources ;
- le conteneur Scaleway n'est pas reconfiguré par cette évolution : tout doit voyager dans l'image ;
- le rendu doit rester du HTML servi, sans JavaScript, comme le reste du manuel ;
- la page est derrière le garde d'accès : elle n'est pas joignable anonymement, donc pas un point de contrôle pour la pipeline (qui continue de lire `/sw.js`).

## Goals / Non-Goals

**Goals :**

- Afficher sur la page « Aide » le tag de la version servie, sous une forme discrète et lisible.
- Faire venir ce tag du build de l'image, sans nouvelle variable à configurer sur le conteneur.
- Distinguer sans ambiguïté une release d'un build local (mention « développement »).
- Rester sans effet sur les autres pages, sur les routes et sur les données.

**Non-Goals :**

- Aucune vérification de version côté pipeline : `/sw.js` reste la preuve publique qu'une release est servie, et la page « Aide » est derrière l'authentification.
- Aucun numéro de version affiché sur les pages de travail, dans le panneau latéral ou dans la boîte de session.
- Aucune lecture de `package.json` : son `version` (`1.0.0`) n'est pas mise à jour à chaque release et ne désignerait pas le tag.
- Aucun endpoint `/version` ni fichier de version servi : la page suffit.
- Aucune migration de données ni changement du stockage.

## Decisions

### 1. `APP_VERSION` devient une variable d'environnement de l'image finale

Le `Dockerfile` déclare `ARG APP_VERSION` dans l'étape finale et l'expose par `ENV APP_VERSION=$APP_VERSION`. Le build de release passe déjà l'argument à toutes les étapes : la même valeur alimente donc `CACHE_VERSION` de `sw.js` (étape `assets`) et l'environnement du conteneur (étape finale), sans second point de vérité. `server.js` la lit au chargement, à côté de `PORT` et `AUTHORIZED_EMAILS`.

*Alternatives écartées :*

- **Lire `public/sw.js` au démarrage** et y extraire `CACHE_VERSION` : aucune modification du `Dockerfile`, mais cela ferait dépendre la page du format d'un fichier de service worker, que rien n'empêche de renommer ou de régénérer, et mélangerait la version de cache PWA et la version de l'application.
- **Écrire un `public/version.json` à l'étape des assets** puis le lire : ajoute un fichier servi, un chargement disque et un second mécanisme pour la même information, alors qu'une variable d'environnement est déjà la façon dont l'application reçoit sa configuration (`PORT`, `SESSION_SECRET`, `S3_*`).
- **Passer `APP_VERSION` dans la configuration du conteneur Scaleway** (`scw container container update … environment-variables.APP_VERSION`) : duplique la valeur hors de l'image, à tenir à jour à chaque déploiement, y compris pour un `tofu apply` manuel (qui ne la connaît pas).
- **Déduire la version de `package.json`** : le champ n'est pas bumpé par la pipeline ; il afficherait `1.0.0` pour toutes les releases.

### 2. Un libellé unique, « Version <tag> », avec « développement » en repli

La ligne est rendue dans le bloc `.guide`, après les sections :

```html
<p class="guide-version">Version 2.0.1</p>
```

Sans `APP_VERSION`, elle devient `Version développement`. Le repli est explicite plutôt qu'omis : la ligne garde la même place et le même style dans les deux cas, et un build local se reconnaît immédiatement au lieu de laisser croire à une version inconnue ou oubliée.

*Alternatives écartées :*

- **Ne rien afficher quand le tag est absent** : la page changerait de hauteur entre développement et production, et rien n'indiquerait qu'une information manque.
- **Afficher « Version inconnue »** : suggère un défaut de l'application là où il s'agit simplement d'un build local.
- **Afficher `v<tag>`** : la pipeline n'accepte que des tags numériques (`1.2`, `1.2.3`) et les publie sans préfixe ; le `v` ajouterait une forme qui n'existe nulle part ailleurs (image, `CACHE_VERSION`).

### 3. Échappement systématique, pas de validation supplémentaire

`build-assets.js` valide déjà `APP_VERSION` (`^[A-Za-z0-9._-]+$`) avant de l'inscrire dans `sw.js`, mais le serveur ne peut pas s'y fier : la variable peut être posée à la main en développement. Le rendu passe donc la valeur par l'`escapeHtml` déjà utilisé pour les titres, les noms de domaine et l'adresse de session. Aucune validation de format côté serveur : une valeur inattendue s'affiche telle quelle, sans casser la page ni créer de balisage.

*Alternatives écartées :*

- **Refuser de démarrer sur un `APP_VERSION` invalide** : la version est une information d'affichage ; elle ne justifie pas de rendre l'application indisponible.
- **Réutiliser la validation de `build-assets.js`** : elle protège un nom de cache, pas un contenu de page ; l'échappement couvre le second besoin.

### 4. Le style reste dans la section « User guide page » du CSS

Une seule règle, `.guide-version`, avec le filet de séparation déjà employé par les blocs de la coquille (`--border`), la couleur discrète `--done` et une taille légèrement réduite. Pas de nouvelle variable, pas de nouvelle police : la ligne doit se lire comme une note de bas de manuel.

### 5. La version n'est pas précachée

`/aide` est une navigation : le service worker la laisse toujours passer par le réseau (aucun document n'est mis en cache, pour ne pas exposer les données d'un compte). La ligne affiche donc la version du serveur qui répond, jamais celle d'un cache local. Seul `style.css`, précaché, exige l'incrément de `CACHE_VERSION`.

## Risks / Trade-offs

- **Le tag n'est pas mis à jour quand on exécute l'image hors pipeline** (`docker run` sans `--build-arg`) → la page annonce « développement » ; c'est exact pour un build local, et la pipeline de release est le seul chemin qui produit une version.
- **Une variable d'environnement peut être écrasée au déploiement** (configuration du conteneur, `docker run -e`) → l'affichage suivrait la valeur écrasée, donc ce que l'instance croit être ; c'est le comportement attendu d'une configuration, et la pipeline n'écrit que l'image.
- **La page « Aide » n'est pas un contrôle automatisable anonymement** → la pipeline continue de vérifier `/sw.js`, qui porte la même valeur ; le test d'intégration couvre l'affichage.
- **La ligne ajoute une information qui peut vieillir** (build local ancien) → le repli « développement » évite justement de faire passer un build local pour une release.
- **Le rendu doit rester échappé** → un `APP_VERSION` contenant du balisage est affiché littéralement ; un scénario de la spécification le verrouille.

## Migration Plan

Aucune migration de données ni de route. Le déploiement est celui d'une release ordinaire : pousser un tag, la pipeline construit l'image (dont `APP_VERSION` et `CACHE_VERSION` portent le tag), met à jour le conteneur et vérifie `/sw.js`. L'incrément de `CACHE_VERSION` dans le dépôt ne concerne que le développement local (`style.css` est précaché) ; l'image de release le remplace de toute façon par son tag.

Retour arrière : redéployer l'image du tag précédent (`scw container container update … image=…:<tag précédent>`) ; la page affiche alors de nouveau l'ancien tag, sans autre action.

## Open Questions

Aucune question bloquante.
