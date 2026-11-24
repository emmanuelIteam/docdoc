# Design

## Context

Voir `proposal.md` pour la motivation et `specs/` pour les exigences. La page d'accueil est rendue côté serveur, sans JavaScript, à partir de l'espace déjà en mémoire : `render_home_board` dans `rust/src/html.rs` pour la production, `homeBoard` dans `server.js` pour l'implémentation de référence et les tests Playwright. Les deux doivent rester en parité.

Le filtre actuel tient dans une seule fonction, `home_rubrique` / `homeRubrique`, qui reçoit un nœud et renvoie sa rubrique ou `None`/`null`. Elle sert à deux endroits : le regroupement des cartes au rendu, et la validation de la cible de la route `/api/home/order` (déplacement, réordonnancement, changement de rubrique). Le rendu d'une carte (`home_task_card`) est déjà générique : il n'utilise que le nœud, son domaine et la chaîne de ses ancêtres, sans supposer une feuille.

Le menu d'une ligne applique un statut à la tête seule par défaut (`scope=head`) et à tout le sous-arbre seulement si les sous-lignes sont sélectionnées. C'est ce qui produit le cas rapporté : la mère passe « En cours », ses sous-tâches restent « En projet », et la mère est filtrée parce qu'elle a des enfants.

## Goals / Non-Goals

**Goals:**

- Rendre visible une tâche mère active quand aucun de ses descendants n'est actif, sans jamais produire deux cartes pour une même branche.
- Garder une seule définition de la règle, partagée par le rendu et la validation de la route de positionnement.
- Conserver strictement le rendu, l'ordre naturel, l'ordre manuel et le lien profond existants.

**Non-Goals:**

- Ne pas agréger le statut des descendants vers la mère, ni dériver le statut d'une mère de celui de ses enfants.
- Ne pas propager automatiquement un statut aux sous-tâches quand on marque une mère.
- Ne pas changer le menu d'une ligne, la cascade de statut, le glisser-déposer, les styles ou le service worker.
- Ne pas filtrer les mères autrement que par l'absence de descendant actif : pas de seuil de profondeur, pas d'exception pour les projets de niveau 1.

## Decisions

### 1. La règle est « ligne active sans descendant actif »

Une ligne est active si son statut est `in_progress` ou `waiting`. Elle est listée si elle est active **et** qu'aucun descendant, à quelque profondeur, n'est actif. Une branche ne produit donc qu'une carte : sa ligne active la plus profonde. Une ligne mère dont toutes les sous-tâches sont `todo` ou `done` devient une carte ; dès qu'une sous-tâche devient active, la carte de la mère disparaît au profit de celle de la sous-tâche.

- *Alternative écartée* : lister toutes les lignes actives, mères comprises. La mère et ses sous-tâches actives produiraient plusieurs cartes pour la même branche, exactement le bruit que le filtre feuille de `2026-11-03-list-leaf-tasks-with-parent-hierarchy` a supprimé.
- *Alternative écartée* : filtrer la liste des feuilles après coup, en retirant une mère si une feuille de sa descendance est déjà listée. Il faudrait deux parcours et deux définitions de « listée » ; la route de positionnement, qui ne voit qu'un nœud, ne pourrait pas réutiliser le résultat.
- *Alternative écartée* : faire cascader « En cours » aux sous-tâches quand on marque une mère. Cela change la sémantique du menu d'une ligne et le statut réel des sous-tâches, alors que le problème est un problème d'affichage.

### 2. La règle reste portée par `home_rubrique` / `homeRubrique`

La fonction reçoit déjà le nœud complet, donc sa descendance. Elle teste d'abord si un descendant est actif, puis renvoie la rubrique du nœud si celui-ci est actif. Tous les appelants — rendu et route `/api/home/order` — partagent ainsi la même définition, sans risque de divergence entre ce qui est affiché et ce qui est accepté comme cible.

Le test de descendance est un parcours récursif de `children` ; un helper local (`has_active_descendant` / `hasActiveDescendant`) le porte dans chaque implémentation. La route de positionnement n'a pas besoin d'être modifiée : elle appelle déjà `home_rubrique`, qui refuse désormais une mère dont un descendant est actif et accepte une mère listée.

- *Alternative écartée* : précalculer au rendu l'ensemble des nœuds ayant un descendant actif. Plus rapide en théorie, mais la route de positionnement ne dispose pas de cet ensemble et devrait recalculer la règle autrement. Le parcours par nœud reste linéaire en pratique sur des outlines personnels.

### 3. Aucun changement du rendu d'une carte

`home_task_card` reçoit la chaîne `ancestors`, calculée par `ancestor_chain`/`ancestorChain` qui exclut le nœud lui-même : une carte mère affiche donc le domaine puis ses propres parents, sans se répéter. Le titre reste le lien profond `/domaine/<slug>?reveal=<id>#node-<id>`, qui ouvre la mère dans son domaine. Aucun style, aucun libellé, aucun contrôle nouveau.

### 4. L'ordre manuel reste intact et tolère les cartes masquées

L'ordre est enregistré par identifiant de nœud et par rubrique. Une mère qui disparaît du tableau garde sa position enregistrée ; `ordered_ids` ignore simplement les identifiants absents de la liste naturelle. Si elle réapparaît, elle retrouve sa position enregistrée, sinon elle est ajoutée en fin de rubrique selon l'ordre naturel. Aucune migration ni purge de l'ordre n'est nécessaire.

### 5. Parité Node/Rust et aide alignée

La même règle est écrite dans `server.js` (`homeRubrique`) et dans `rust/src/html.rs` (`home_rubrique`). Les deux pages Aide — texte du guide dans les deux implémentations — remplacent la phrase « seules les tâches feuilles » par la règle « une branche, une carte » et le cas d'une mère active sans sous-tâche active. Aucun asset précaché ne change : pas d'incrément de `CACHE_VERSION`.

## Risks / Trade-offs

- **Le statut propre d'une mère devient invisible tant qu'un descendant est actif** → C'est le prix d'une seule carte par branche : la carte du descendant rappelle la mère dans sa chaîne de parents, et la page du domaine reste la référence. L'aide l'explique.
- **Une mère oubliée « En cours » dont toutes les sous-tâches sont terminées réapparaît** → C'est un signal utile (statut à clore), pas une duplication. Le cas est explicitement couvert par les scénarios et par le test qui remplace l'ancien 1.7.
- **Coût quadratique dans le pire cas** (pour chaque nœud, parcours de sa descendance sur une chaîne profonde) → Négligeable sur des outlines personnels ; si un profil montre le contraire, un précalcul en une passe pourra remplacer le parcours par nœud sans changer la spec.
- **Le test e2e 1.7 fixait le comportement inverse** → Il est retourné et non supprimé : il vérifie désormais qu'une mère active sans descendant actif est listée, et un second cas couvre la branche représentée par sa seule ligne la plus profonde.
- **Des positions d'ordre orphelines s'accumulent pour les mères masquées** → Elles sont bornées par le nombre de nœuds et réutilisées à la réapparition ; aucun nettoyage nécessaire.

## Migration Plan

1. Adapter `homeRubrique` et le texte de la page Aide dans `server.js`.
2. Adapter `home_rubrique` et le texte de la page Aide dans `rust/src/html.rs`, avec le helper de descendance active.
3. Mettre à jour les tests unitaires Rust, puis `test/e2e/home.spec.js` (retournement de 1.7 et cas « une branche, une carte »).
4. Vérifier `cargo test`, `node --check server.js` et les tests Playwright ciblés.
5. Aucune migration de données, aucun changement de route ni de stockage. Retour arrière : rétablir le test `children` vide dans `home_rubrique`, restaurer la phrase de l'aide et les tests ; l'ordre manuel et les domaines restent valides dans les deux sens.

## Open Questions

Aucune.
