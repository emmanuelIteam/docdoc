## Why

La page d'accueil liste aujourd'hui chaque ligne « En cours » à toute profondeur. Un projet et ses sous-tâches marqués « En cours » y apparaissent donc côte à côte, alors que seules les lignes sans enfant sont réellement actionnables : les lignes mères sont des regroupements, et leur statut, souvent hérité ou oublié, encombre la liste. À l'inverse, une tâche feuille listée seule perd son contexte : deux feuilles de même titre dans deux branches différentes deviennent indiscernables une fois le domaine rappelé.

## What Changes

- **La liste ne retient que les tâches feuilles.** Chaque ligne candidate doit être « En cours » **et** ne posséder aucun enfant (`children` vide ou absent), à toute profondeur : un projet sans sous-ligne reste une feuille et reste listé, une tâche mère n'est jamais listée même si elle est « En cours ». Les exclusions existantes sont conservées : lignes « À faire » et « Terminé », domaines archivés.
- **Chaque entrée devient une entrée à deux lignes.** La première porte le titre de la tâche ; la seconde porte le nom du domaine puis la hiérarchie de ses tâches mères, du projet de niveau 1 jusqu'au parent immédiat, dans l'ordre de lecture de la barre de hiérarchie de la page d'un domaine. Une feuille sans parent n'affiche que son domaine sur la seconde ligne.
- **Aucune troncature du chemin.** Un chemin long revient à la ligne sous le titre, y compris sur un écran étroit ; chaque niveau est séparé visuellement et l'ensemble reste lisible sans survol.
- **Ordre inchangé.** Les domaines suivent l'ordre du panneau latéral et, dans un domaine, les feuilles retenues suivent l'ordre d'affichage de l'outline. Filtrer les mères ne réordonne rien.
- **Lien profond inchangé.** Une entrée reste un lien vers `/domaine/<slug>?reveal=<id>#node-<id>` : la feuille s'ouvre dans son domaine avec ses ancêtres dépliés, ce qui permet aussi de rejoindre une tâche mère depuis le contexte affiché.
- **État vide ajusté.** Un compte peut n'avoir que des tâches mères « En cours » et aucune feuille : la page est alors vide et son message parle de tâche feuille, sans prétendre qu'aucune ligne n'est en cours.
- **Aide mise à jour.** La section « Retrouver les tâches en cours » décrit le filtre feuille et la hiérarchie rappelée.
- **Aucun changement de données.** Ni champ, ni clé de stockage, ni route, ni migration : le filtrage et le chemin sont calculés à partir de l'arbre déjà en mémoire, au rendu serveur. Aucun JavaScript nouveau.

## Capabilities

### New Capabilities

Aucune.

### Modified Capabilities

- `home-dashboard` : la liste de la page d'accueil est restreinte aux tâches feuilles « En cours » (l'exigence de listage est renommée en conséquence) ; le rappel du domaine devient un rappel du domaine **et** de la hiérarchie des tâches mères (exigence renommée) ; l'état vide distingue l'absence de tâche feuille en cours.

## Impact

- **`server.js`** : `homeTasks(space)` ne retient que les nœuds sans enfant et joint à chaque entrée la chaîne de ses parents (résolue par `indexOutline`) ; `homeTaskEntry` rend le titre puis une seconde ligne domaine + chemin, avec `titleLabel` pour chaque titre de parent (pas d'ancre imbriquée) ; libellé de l'état vide et section de l'Aide ajustés. Aucune écriture sur un `GET`.
- **`public/style.css`** : l'entrée devient empilée à toutes les largeurs (titre, puis contexte), le contexte passe à la ligne et le badge de domaine reste lisible sans survol.
- **`public/sw.js`** : incrément de `CACHE_VERSION` (seule `style.css` change parmi les fichiers précachés).
- **`openspec/specs/home-dashboard/spec.md`** : mise à jour par le delta de ce changement (deux exigences remplacées — listage et rappel du domaine — et deux exigences modifiées : libellé d'un titre lié, état vide).
- **Tests** : `test/e2e/home.spec.js` — les attentes de liste ne contiennent plus que les feuilles (`a1-1-1`, `a2-1`, `a3`, `b1`), vérifient l'absence des mères « En cours » (`a1`, `a1-1`) et la seconde ligne (domaine + chemin, y compris une feuille sans parent) ; le reste (lien profond, clavier, états vides, panneau) est inchangé.
- **Retour arrière** : rétablir le filtre « toute ligne en cours » et la seconde ligne limitée au domaine dans `homeTasks`/`homeTaskEntry`, restaurer les styles et les attentes de test ; aucune donnée n'est concernée.
