## Context

La barre collante est remplie par `public/app.js` à partir de l'outline rendu : un `<li class="line" data-id data-parent data-depth>` par ligne affichée. À chaque défilement, le client cherche la **première ligne visible** (première ligne dont le `rect.bottom` dépasse le bas de la barre), remonte ses `data-parent` et affiche cette chaîne d'ancêtres. Le bas de la barre sert de limite : une ligne est « lue » tant qu'il en reste un pixel sous la barre.

Ce critère est correct pour savoir quelle ligne est lue, mais il ne suffit pas à garantir qu'une tâche mère **reste affichée** pendant qu'elle traverse la barre. Considérons une tâche mère `A` et sa sous-tâche `B`, avec `B` juste sous `A` :

1. `A` est entièrement visible : elle est sa propre ligne, la chaîne ne contient que ses ancêtres.
2. `A` commence à passer sous la barre : elle est toujours la première ligne visible (son bas dépasse la barre), mais son titre est déjà partiellement caché. La chaîne ne la contient pas encore puisqu'elle n'est pas son propre ancêtre : **le libellé de `A` disparaît alors que `B` est encore lu**.
3. `A` est entièrement cachée : `B` devient la première ligne visible, la chaîne contient `A` ; le libellé réapparaît dans la barre.

En remontant, le même défaut se produit en sens inverse : dès que le bas de `A` ressort, `A` redevient la première ligne visible et son maillon est retiré, alors que son titre est encore presque entièrement derrière la barre. Le libellé est donc absent des deux endroits pendant environ une hauteur de ligne.

## Goals / Non-Goals

**Goals :**

- Ne jamais montrer une tâche mère épinglée ou désépinglée absente à la fois de l'outline et de la chaîne, même pendant une frame.
- Épingler la tâche mère dès que sa ligne commence à passer sous la barre.
- Ne la désépingler que lorsque sa ligne est entièrement visible sous la barre.
- Conserver la chaîne actuelle pour une ligne sans sous-tâche affichée et pour un projet racine entièrement visible.
- Absorber le retard d'une frame de `requestAnimationFrame` ou d'un défilement compositeur sans clignotement perceptible.

**Non-Goals :**

- Changer le rendu, la hauteur, le style ou la réserve de bas de page de la chaîne.
- Ajouter un maillon pour une ligne sans sous-tâche affichée (une feuille), ni modifier l'ordre de la chaîne.
- Modifier la détection de la première ligne visible, le calcul des ancêtres, les routes, le modèle de données ou les autres pages.
- Faire clignoter ou animer la barre : le changement doit être une simple mise à jour de son contenu.

## Decisions

### 1. Le seuil d'épinglage est le haut de la ligne, et le maillon reste jusqu'à visibilité complète

La première ligne visible reste déterminée par `rect.bottom > bas de la barre` (c'est la ligne en cours de lecture, inchangée). En plus de ses ancêtres, la chaîne reçoit cette ligne **elle-même** lorsqu'elle est une tâche mère et que son `rect.top` est passé sous le bas de la barre. Elle est donc ajoutée dès que son haut commence à être masqué (`rect.top < barBottom`) et retirée seulement quand son haut repasse sous la barre (`rect.top >= barBottom`), c'est-à-dire quand la ligne est entièrement visible.

*Alternatives écartées :*

- **Chercher la première ligne dont le `top` est sous la barre.** Cela déplace le problème : quand la ligne lue est la dernière feuille d'une branche, la ligne entièrement visible suivante appartient à une autre branche et la chaîne perd la tâche mère alors que sa sous-tâche est encore lue. Le critère `bottom` reste celui de la ligne lue.
- **Garder la chaîne précédente tant qu'un maillon n'est pas visible.** Deux états à réconcilier, un risque de maillon périmé après un re-rendu htmx, et la chaîne ne décrirait plus la ligne lue.
- **Un seuil de quelques pixels plutôt que le haut de la ligne.** Ne supprime pas la fenêtre : le titre fait toute la hauteur de la ligne, il faut attendre sa visibilité complète.

### 2. Seules les tâches mères s'ajoutent, pas les feuilles

Une ligne sans sous-tâche affichée n'est pas le contexte de la ligne suivante : son libellé n'a pas besoin d'être épinglé, et la chaîne doit rester vide sur un projet racine entièrement visible. L'ajout est donc conditionné à la présence d'une sous-tâche **affichée** (un enfant dans `data-parent`).

*Alternatives écartées :*

- **Ajouter toute première ligne visible partiellement masquée.** Change la chaîne pour les feuilles, duplique inutilement leur libellé et contredit l'exigence « chaîne vide sur un projet racine » au premier pixel de défilement.
- **Détecter les enfants dans le modèle serveur.** Le client ne l'a pas ; `data-parent` des lignes affichées donne exactement la même information, et un enfant replié n'est pas affiché.

### 3. L'ensemble des tâches mères est calculé avec l'index de l'outline

`refreshIndex()` construit déjà `lines`, `byId` et invalide la signature quand `#outline` change d'identité. Il y ajoute un `Set` des `data-parent` non vides : l'appartenance est ensuite testée en O(1) à chaque frame, sans parcours supplémentaire ni requête.

*Alternatives écartées :*

- **Lire `nextElementSibling` à chaque frame.** Fonctionne mais dépend de la forme du DOM et refait une lecture de layout ; le `Set` est calculé une fois par rendu.
- **Un `MutationObserver`.** Coûteux pour une information déjà portée par le DOM rendu et déjà invalidée par htmx.

### 4. Aucun changement de la réserve de hauteur

La chaîne la plus haute possible reste `maxDepth` maillons : une tâche mère ajoutée à la profondeur `d` a une sous-tâche affichée à la profondeur `d + 1`, donc `d + 1 <= maxDepth`. La sonde de `refreshReserve()` mesure déjà `maxDepth` maillons et couvre le maillon supplémentaire ; la hauteur du document reste constante quand la chaîne grandit ou rétrécit.

*Alternatives écartées :*

- **Majorer la réserve d'un maillon.** Ajouterait une ligne de blanc inutile en bas de page et ne changerait pas la stabilité, déjà garantie.

### 5. L'hystérésis d'une hauteur de ligne absorbe le décalage de frame

La tâche mère est épinglée pendant que sa ligne est partiellement masquée, soit une fenêtre d'environ une hauteur de ligne. Le maillon apparaît donc **avant** que le titre ne soit caché et ne disparaît qu'**après** que le titre est redevenu lisible : un `requestAnimationFrame` en retard, ou une frame peinte par le compositeur avant le calcul client, ne peut pas produire de trou visuel. C'est cette marge, et non la seule exactitude du calcul, qui répond au « même temporairement ».

## Risks / Trade-offs

- **Le libellé est affiché deux fois pendant une hauteur de ligne** (maillon et ligne partiellement visible) → c'est le prix de la continuité ; la duplication est brève et le maillon est le repère qui reste quand la ligne finit de passer.
- **La chaîne grandit un peu plus tôt** (dès le début du passage sous la barre, et non à la fin) → le contenu se décale d'une ligne au même moment, comme lors de tout changement de chaîne.
- **Une tâche mère repliée n'est pas ajoutée** (aucune sous-tâche affichée) → elle n'est le contexte d'aucune ligne suivante, et sort de l'écran comme une ligne ordinaire.
- **Sans JavaScript** → la barre affiche seulement le nom du domaine, comme avant ; le correctif est purement client.
- **Re-rendu htmx pendant le défilement** → `refreshIndex()` reconstruit le `Set` et la chaîne est recalculée à l'événement suivant, sans état conservé entre deux outlines.

## Migration Plan

Aucune migration de données. Déploiement d'actifs avec un incrément de `CACHE_VERSION` (`app.js` est précaché). Retour arrière : retirer l'ajout du maillon dans `chainOf` et le `Set` des tâches mères ; la chaîne redevient celle des seuls ancêtres, sans autre effet.

## Open Questions

Aucune question bloquante.
