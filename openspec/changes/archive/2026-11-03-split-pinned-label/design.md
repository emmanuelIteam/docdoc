## Context

La barre collante est remplie par `public/app.js` dans `#ancestry`, un élément de l'en-tête sticky. L'outline est une suite plate de `<li class="line" data-id data-parent data-depth>` ; le client cherche la première ligne dont le bas dépasse le bas de la barre, remonte ses `data-parent` et rend la chaîne des tâches mères. La barre est **dans le flux** : sa hauteur pousse l'outline, qui commence donc sous elle.

Deux contraintes se contredisent avec un rendu séparé de la ligne :

1. Si la tâche à cheval n'est pas dans la barre, son titre est progressivement masqué par la barre ; quand seul un bord de ligne dépasse, le titre est déjà invisible : **le libellé disparaît** pendant presque une hauteur de ligne.
2. Si la tâche à cheval est ajoutée en entier à la barre, son libellé est visible à la fois dans la ligne et dans la barre : **il est dupliqué**, et la barre grandit d'un coup, ce qui décale la liste (la « vibration »).

La correction précédente choisissait le doublon. On choisit ici de **partager** le libellé : le fragment masqué est épinglé, le fragment visible reste dans la ligne, et la barre de séparation est la coupure.

## Goals / Non-Goals

**Goals :**

- Donner aux lignes épinglées la puce, la largeur de puce, le pas d'indentation et la typographie exacts des lignes de l'outline, pour un alignement parfait avec les sous-tâches restées visibles.
- Ne jamais afficher le libellé d'une tâche deux fois, ni le faire disparaître, pendant qu'elle passe sous la barre ou en ressort.
- Faire glisser la liste d'une ligne, en douceur, quand une ligne est épinglée ou désépinglée, au lieu de la faire sauter.
- Garder les lignes épinglées cliquables (ancre vers la tâche) et stables (pas de recréation).
- Aucun changement de données, de route, de modèle ni d'ordre.

**Non-Goals :**

- Déplacer les lignes réelles dans la barre (`position: sticky` sur les lignes de l'outline) : cela overlaye la liste ou demande de déplacer des nœuds du DOM, avec les interactions et les swaps htmx qui vont avec.
- Animer la hauteur de la barre en continu avec la fraction masquée : voir la décision 3 (boucle de rétroaction).
- Changer le plafond de profondeur (40 % de la fenêtre) ni le mécanisme de réserve de bas de page.

## Decisions

### 1. Une ligne épinglée reprend l'anatomie de la ligne

Chaque ligne épinglée est un `<a class="ancestry-item">` qui contient une ligne flex `.ancestry-row` :

- même `margin-left` que la ligne : `profondeur × 1.6rem` (`.8rem` sous 640 px) ;
- même `padding` horizontal (`.4rem`) et même `gap` (`.35rem`) ;
- même puce `●`, dans un emplacement de `.7rem` (1.5rem sous 640 px, comme la puce tactile de la ligne) ;
- même `font-size` (1rem), même `line-height` (1.25), même troncature.

Le libellé épinglé commence donc exactement à l'abscisse du titre de la ligne de même profondeur. Le maillon reste un lien vers `#node-<id>`.

*Alternatives écartées :*

- **Garder le chevron et le pas d'indentation de la chaîne** : c'est le défaut signalé, l'alignement avec les sous-tâches est faux.
- **Réutiliser les lignes réelles comme éléments sticky** : la ligne épinglée recouvrirait la liste (ou il faudrait la déplacer dans le DOM, avec les interactions, les menus et les swaps htmx) ; le périmètre serait bien plus large.

### 2. Le libellé à cheval est coupé par la barre, pas dupliqué

Pour la ligne lue `R` (une tâche mère), on mesure la fraction **masquée** de son titre :

```
f = clamp((bas de la barre − haut du titre de R) / hauteur du titre, 0, 1)
```

Tant que `f > 0`, `R` est ajoutée comme dernière ligne épinglée. Son emplacement a la hauteur d'une ligne (`.ancestry-row` = `1.25rem`), et son contenu est translaté de `(1 − f) × 1.25rem` vers le bas ; l'emplacement (`overflow: hidden`) le coupe au niveau du bas de la barre. Le fragment visible est donc les `f × hauteur` premiers pixels du titre — exactement la partie masquée de la ligne. La ligne, elle, montre la partie complémentaire sous la barre. Les deux fragments se rejoignent au séparateur, sans recouvrement ni trou.

Quand `f` atteint 1, `R` n'est plus la ligne lue (son enfant l'est) mais reste un ancêtre : le même nœud, même id, passe de « fragment » à « ligne pleine » sans être recréé. Quand `f` redescend à 0, `R` est retirée de la chaîne et son titre est entièrement visible dans la ligne.

Pendant la fraction, la puce du fragment est masquée (`is-partial`) : elle serait coupée par le séparateur.

*Alternatives écartées :*

- **Un maillon complet avec un fondu** : le libellé est visible deux fois pendant toute la traversée, et le fondu ne corrige pas la géométrie.
- **Ajouter le maillon seulement quand la ligne est entièrement cachée** : le titre est invisible pendant presque une hauteur de ligne (le défaut d'origine).
- **Décaler le titre épinglé pour le faire coïncider avec la ligne** : impossible, la barre est au-dessus de la ligne ; la seule coïncidence possible est la coupure au séparateur, qui est exactement ce que fait le fragment.

### 3. La hauteur de la barre est discrète par ligne, mais animée

La hauteur de la barre ne peut pas suivre `f` : la barre est dans le flux, donc sa croissance pousse la liste. Si elle grandissait de `f × ligne`, cette poussée compenserait exactement le défilement de la ligne (la ligne resterait figée au haut de la barre) et la fraction augmenterait avec le défilement : la barre mangerait l'écran sans fin. C'est une boucle de rétroaction, déjà évitée par la réserve de bas de page pour les changements discrets.

La hauteur est donc discrète : une ligne épinglée occupe une ligne entière dès qu'elle apparaît. Pour éviter le saut, la hauteur de `#ancestry` est animée (`height .16s ease`) entre l'ancienne et la nouvelle valeur ; la réserve de bas de page (`padding-bottom`) suit la même transition, si bien que la hauteur totale du document reste constante pendant le glissement.

Conséquence assumée : au tout début de la traversée (`f` petit), l'emplacement de la ligne épinglée est réservé mais le fragment n'en occupe que le bas ; la partie haute de l'emplacement est vide et se remplit à mesure que le titre passe sous la barre. C'est une zone de transfert transitoire (au plus une ligne), pas un contenu dupliqué.

*Alternatives écartées :*

- **Hauteur proportionnelle à `f`** : boucle de rétroaction décrite ci-dessus.
- **Aucune animation** : la liste saute d'une ligne à chaque bascule, c'est la vibration à supprimer.
- **Barre en surcouche absolue** : elle ne pousse plus la liste, mais elle recouvre la première ligne de l'outline, qui n'est plus lisible.

### 4. Réconciliation par identifiant, pas reconstruction

`renderChain` conserve un `Map` des lignes épinglées par id. Quand la chaîne change, elle retire les ids absents, insère les nouveaux et réutilise les autres ; les libellés sont mis à jour sur place. À chaque frame, seuls `--pin-fraction` et la classe `is-partial` changent sur la dernière ligne. Un maillon qui reste dans la chaîne n'est donc jamais détaché/recréé (pas de clignotement, pas de perte de focus).

*Alternatives écartées :*

- **Vider et reconstruire `#ancestry`** : chaque changement de branche recréerait tous les liens ; c'est le clignotement que l'on veut éviter.

### 5. La hauteur finale est publiée pour les ancres

`scroll-margin-top` des lignes utilise `--topbar-height`. Pendant la transition de la barre, `topbar.offsetHeight` est une valeur intermédiaire : une ancre cliquée à ce moment atterrirait sous la barre finale. La variable est donc calculée depuis la hauteur **cible** de la barre (`barTarget`) et non depuis la hauteur en cours d'animation. C'est un défaut révélé par le test d'ancrage (12.4).

### 6. Le bas de l'en-tête est le séparateur

Le `padding-bottom` de `.topbar-sticky` est retiré : le bas de la barre (`#ancestry`) coïncide avec le bas de l'en-tête sticky, qui est la vraie limite de découpe. Sans cela, le fragment épinglé s'arrêterait au-dessus du padding et laisserait un trou entre lui et la ligne. Le séparateur est un pseudo-élément `::after` en bas de `#ancestry` ; il disparaît quand la barre est vide.

## Risks / Trade-offs

- **Zone de transfert vide** : au début d'une traversée, l'emplacement réservé est partiellement vide au-dessus du fragment. C'est le prix du partage exact du libellé et du glissement de la liste ; la zone se remplit en une hauteur de ligne de défilement.
- **La liste glisse d'une ligne à l'apparition/disparition** : c'est le comportement demandé ; l'animation de 160 ms évite le saut. `prefers-reduced-motion` la supprime.
- **Le fragment n'est exact que si la hauteur de ligne épinglée égale la hauteur du titre** : les deux valent `1.25rem` ; un changement de typographie doit garder cet accord (couvert par les tests).
- **Le plafond de 40vh** : au-delà, la barre défile intérieurement (comportement existant) ; le fragment reste au bas de la barre visible.
- **La puce du fragment est masquée** tant que la ligne est partielle, pour ne pas montrer une puce coupée ; elle revient quand la ligne est pleine.
- **Le retrait du `padding-bottom` de l'en-tête** change l'espace sous la barre de quelques pixels ; la ligne lue commence juste sous le séparateur.
- **Un contenu plus haut que 40vh** peut faire apparaître une barre de défilement pendant la transition ; le plafond existant n'est pas modifié.

## Migration Plan

Aucune migration de données. Déploiement d'actifs avec `CACHE_VERSION` (`v12`, déjà incrémenté dans l'arbre de travail). Retour arrière : restaurer l'ancien rendu de `#ancestry` (chevrons et maillons), les styles `.ancestry` et la reconstruction complète ; le comportement de la barre redevient celui d'avant.

## Open Questions

Aucune question bloquante pour cette itération. Le déplacement des lignes réelles (sticky) reste une piste si l'on veut supprimer la zone de transfert, au prix d'une refonte des interactions et des swaps htmx.
