## Context

La page d'accueil est rendue côté serveur par `renderHomePage(space)` dans `server.js`. `homeTasks(space)` parcourt les domaines dans l'ordre du panneau latéral, répare l'ordre d'affichage avec `ensureDisplayOrder`, indexe l'arbre avec `indexOutline` (qui fournit pour chaque nœud son parent et sa profondeur) et retient aujourd'hui **toutes** les lignes dont `status === 'in_progress'`. `homeTaskEntry(domain, node)` rend ensuite, dans un unique `<a class="home-task">`, le titre puis un badge `.home-task-domain` ; la feuille de style les place côte à côte sur un écran large et empilés sous 640 px.

Le modèle de données n'a pas besoin de changer : la hiérarchie est l'arbre `children` des nœuds, l'ordre vertical est `displayOrder`, et l'état replié est un état de vue. L'outline d'un domaine affiche déjà les lignes comme une suite plate.

## Goals / Non-Goals

**Goals**

- Ne lister que les lignes sans enfant, à toute profondeur, sans toucher à l'ordre ni au lien profond.
- Rendre chaque entrée à deux lignes : le titre, puis le domaine et la chaîne des tâches mères.
- Garder le rendu 100 % serveur, sans donnée ni route nouvelle, et sans JavaScript.

**Non-Goals**

- Ne pas calculer de statut agrégé ni faire remonter le statut des enfants vers les parents.
- Ne pas rendre les tâches mères cliquables individuellement dans l'entrée (l'entrée reste un seul lien vers la feuille).
- Ne pas changer la page d'un domaine, la barre de hiérarchie épinglée ni le panneau latéral.
- Ne pas filtrer les tâches mères autrement que par l'absence d'enfant (pas de « seulement les tâches », pas de profondeur minimale).

## Decisions

### 1. Le caractère feuille se lit dans l'arbre, pas dans l'état d'affichage

`homeTasks` retient une ligne si `status === 'in_progress'` **et** `!(node.children && node.children.length)`. Un projet de niveau 1 sans sous-ligne est donc une feuille et reste listé ; une ligne repliée qui a des enfants ne l'est pas.

- *Alternative écartée* : filtrer sur la profondeur maximale ou sur l'absence de descendance dans `displayOrder`. L'ordre d'affichage peut être incomplet (il est réparé à la volée) et un parent replié reste un parent. `children` est la seule source de vérité de la hiérarchie.

### 2. La chaîne des parents est dérivée de `indexOutline`

Pour chaque feuille retenue, remonter les pointeurs `parent` de l'index jusqu'à la racine, puis inverser la liste : on obtient le projet de niveau 1 →…→ parent immédiat, dans l'ordre de lecture. `homeTasks` retourne `{ domain, node, ancestors }` et `homeTaskEntry` n'a plus qu'à rendre.

- *Alternative écartée* : `ancestorIds`, qui renvoie un `Set` non ordonné et ne sert qu'à forcer le dépliage.
- *Alternative écartée* : un parcours récursif qui accumule le chemin au fil de la descente ; il faudrait quand même un index pour réparer l'ordre, et deux parcours coûteraient plus cher que la remontée de pointeurs.

### 3. L'entrée devient empilée à toutes les largeurs

`.home-task` passe en `flex-direction: column` à toutes les largeurs, et le couple domaine + chaîne vit dans un conteneur `.home-task-context` qui passe à la ligne. Une seule ligne de contexte, quel que soit l'écran : la promesse « seconde ligne » ne dépend pas d'un point de rupture. Le badge de domaine reste le premier élément du contexte ; il ne rétrécit pas, la chaîne s'enroule à sa droite.

- *Alternative écartée* : garder le badge à droite du titre sur un écran large et n'empiler qu'en dessous de 640 px. C'est le comportement actuel, mais il contredit la seconde ligne demandée et rend la lecture du chemin instable d'une largeur à l'autre.

### 4. Un seul lien, des titres de parents en texte

L'entrée reste un unique `<a>` : le titre de la tâche, puis le contexte. Les titres de parents sont rendus par `titleLabel` (texte visible d'un éventuel lien inline), comme le titre de l'entrée, pour ne jamais imbriquer d'ancre. Les séparateurs `›` sont décoratifs (`aria-hidden="true"`) ; les titres de parents restent dans le nom accessible du lien, lus dans l'ordre domaine → racine → parent. Chaque séparateur est groupé avec son parent dans `.home-task-hop`, afin qu'un retour à la ligne ne laisse jamais un `›` orphelin en fin de ligne.

- *Alternative écartée* : un lien par parent. Des ancres imbriquées sont invalides en HTML et multiplieraient les cibles de clic dans une entrée déjà cliquable ; ouvrir un parent reste possible depuis la page du domaine.

### 5. L'état vide parle de tâche feuille

Le message « Aucune tâche en cours » devient un message sur l'absence de tâche feuille en cours, avec la marche à suivre : marquer « En cours » une ligne sans sous-tâche. Il reste rendu dans le même bloc, à la même route, sans redirection.

- *Alternative écartée* : afficher les tâches mères quand aucune feuille n'est en cours. Cela réintroduit exactement le bruit que le filtre supprime, et rendrait la liste incohérente d'un rechargement à l'autre.

### 6. Aucune donnée, aucun JavaScript, aucun changement de route

Le filtrage et la chaîne sont calculés au rendu à partir de l'espace déjà en mémoire. Un `GET /` ne crée ni ne persiste rien (règle existante). Seuls `server.js`, `public/style.css`, `public/sw.js` (version de cache) et les tests changent.

## Risks / Trade-offs

- **Une tâche mère « En cours » dont toutes les sous-lignes sont « À faire » ou « Terminé » disparaît de l'accueil** → C'est le prix du filtre : l'accueil ne montre que le travail actionnable. La page du domaine continue de la montrer, la chaîne des feuilles la rappelle, et l'aide explique que seules les feuilles sont listées. Le statut d'un parent n'est pas un agrégat dans ce modèle.
- **Une feuille peut être un projet sans sous-ligne** → Assumé : la définition est « aucune enfant », pas « profondeur ≥ 1 ». Les tests fixent ce cas pour qu'il ne soit pas « corrigé » par inadvertance.
- **Chaînes longues et titres de parents verbeux** → La seconde ligne s'enroule, sans troncature ni ellipse ; le nombre de niveaux reste celui de l'outline, rarement profond. Le risque est une entrée plus haute, pas une information perdue.
- **Deux branches strictement identiques restent ambiguës** → La chaîne ne les distingue pas, mais le lien profond et la page du domaine restent les arbitres. Cas rare, coût d'une désambiguïsation supplémentaire (ids, chemins complets) non justifié.
- **Tests d'accueil actuels figés sur six entrées** → Ils passent à quatre feuilles, plus des assertions d'absence explicites pour `a1` et `a1-1` : le test échoue si le filtre régresse, au lieu de simplement changer de liste.
- **Un seul `GET /` par chargement, coût négligeable** → La remontée de pointeurs est linéaire en profondeur ; aucune optimisation nécessaire.

## Migration Plan

1. Ajuster `homeTasks` et `homeTaskEntry`, puis le libellé de l'état vide et la section d'aide.
2. Ajuster les styles (entrée empilée, contexte qui s'enroule) et incrémenter `CACHE_VERSION`.
3. Mettre à jour `test/e2e/home.spec.js`, puis `node --check`, `npm test`, `npm run test:e2e`.
4. Aucune migration de données, aucun déploiement particulier. Retour arrière : rétablir le filtre « toutes les lignes en cours » et la seconde ligne limitée au domaine, restaurer les styles et les tests — les données sont intactes dans les deux sens.

## Open Questions

Aucune. Le format de la chaîne (ordre racine → parent, séparateur `›`, domaine en tête) et l'inclusion des projets sans enfant sont tranchés ici et fixés par les scénarios de la spécification.
