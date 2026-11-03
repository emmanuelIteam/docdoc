## Why

Le travail en cours est aujourd'hui dispersé : chaque domaine a son outline, et savoir ce qui est réellement en cours impose d'ouvrir chaque domaine puis de parcourir ses lignes. La racine `/` ne fait que rediriger vers le domaine par défaut, elle n'offre aucune vue d'ensemble. Une page d'accueil agrégeant les tâches marquées « En cours », tous domaines et tous projets confondus, donne en un coup d'œil l'état d'avancement du compte et permet d'ouvrir directement la tâche dans son contexte.

## What Changes

- **La racine `/` devient la page d'accueil.** Elle n'est plus une redirection 302 vers le domaine par défaut : elle rend un document qui liste les tâches en cours du compte. Le domaine par défaut reste atteignable par son URL `/domaine/<slug>` et depuis le panneau latéral.
- **Agrégation de toutes les tâches « En cours ».** La page parcourt tous les domaines du compte et retient chaque ligne dont le statut est `in_progress`, à toute profondeur (projets, tâches, sous-tâches), y compris les lignes masquées par un ancêtre replié. Les lignes « À faire » et « Terminé » ne sont pas listées.
- **Ordre stable.** Les domaines suivent l'ordre du panneau latéral (ordre d'affichage) et, dans chaque domaine, les tâches suivent l'ordre d'affichage de l'outline.
- **Nom du domaine rappelé sur chaque tâche.** Chaque entrée affiche le titre de la tâche et le nom de son domaine, lisible sans survol, y compris quand deux domaines portent des titres identiques.
- **Ouverture dans le contexte.** Chaque tâche est un lien vers `/domaine/<slug>?reveal=<id>#node-<id>` : la page du domaine se charge avec les ancêtres de la ligne dépliés, défile jusqu'à elle et la surligne, grâce au mécanisme de lien profond existant. Le clic n'ouvre ni renommage ni sélection.
- **Titre lisible.** Un titre contenant un lien de tâche inline est affiché comme son texte visible (le libellé du lien), sans ancre imbriquée dans le lien de la tâche.
- **Entrée « Accueil » dans le panneau.** Une entrée du pied du panneau latéral, avant Administration, mène à la page d'accueil et y est marquée active. Aucun domaine n'est marqué actif sur cette page.
- **États vides.** Sans domaine, la page invite à en créer un depuis Administration ; avec des domaines mais aucune tâche en cours, elle explique qu'aucune tâche n'est en cours et comment en marquer une.
- **Aucun changement de données.** Ni nouveau champ, ni nouvelle clé de stockage, ni nouvelle route d'API, ni migration : la page est rendue côté serveur à partir de l'espace déjà en mémoire. Aucun JavaScript nouveau n'est nécessaire.

## Capabilities

### New Capabilities

- `home-dashboard` : page d'accueil à la racine, agrégeant les tâches en cours de tous les domaines, avec rappel du nom du domaine et ouverture de la tâche dans son contexte.

### Modified Capabilities

- `domain-navigation` : l'exigence « Redirect the homepage to the default domain » est retirée ; `/` sert désormais la page d'accueil au lieu de rediriger.

## Impact

- **`server.js`** : la route `GET /` rend la page d'accueil (`renderHomePage`) au lieu de rediriger ; nouveaux helpers de collecte des tâches en cours et de libellé affiché d'un titre ; entrée « Accueil » dans `renderSidebar` ; section correspondante dans la page Aide. Aucune écriture sur un `GET`.
- **`public/style.css`** : styles de la liste d'accueil (ligne cliquable, badge de domaine, état vide).
- **`public/sw.js`** : incrément de `CACHE_VERSION` (seule `style.css` change parmi les fichiers précachés).
- **`openspec/specs/domain-navigation/spec.md`** : suppression de l'exigence de redirection de la racine (via le delta de ce changement) ; l'exigence d'état vide de `domain-management` reste satisfaite, la page d'accueil conservant son lien vers Administration.
- **Tests** : l'enrôlement de `test/e2e/reindent.spec.js` n'atterrit plus sur une page de domaine et doit viser `/domaine/<slug>` ; l'assertion de redirection 302 de `test/passkey-flow.js` devient une assertion de contenu ; le nombre d'entrées du pied du panneau et la liste des sections de l'Aide changent.
- **Retour arrière** : rétablir la redirection dans `GET /`, retirer le rendu et les styles de la page d'accueil ainsi que l'entrée « Accueil », restaurer les tests ; aucune donnée n'est concernée.
