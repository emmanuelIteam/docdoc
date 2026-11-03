## Why

La barre collante rend les tâches mères de la première ligne visible, mais son rendu a deux défauts :

- **La puce et l'indentation ne sont pas celles de l'outline.** Chaque maillon porte un chevron `›` et un pas d'indentation propre à la chaîne : le libellé épinglé ne s'aligne pas avec les sous-tâches restées visibles sous la barre.
- **La tâche à cheval est soit dupliquée, soit absente.** Tant qu'une ligne est partiellement visible, on ne peut pas à la fois l'afficher dans la liste et dans la barre sans doublon, ni la retirer de la barre sans faire disparaître son titre pendant une hauteur de ligne. La correction précédente avait choisi le doublon (un maillon complet pendant que la ligne est encore visible) ; la croissance de la barre décalait alors la liste d'un coup, d'où la vibration.

## What Changes

- **La puce et l'indentation sont celles de la ligne.** Chaque ligne épinglée reprend l'anatomie exacte d'une ligne de l'outline : même puce `●`, même largeur de puce, même espace, même pas d'indentation (`1.6rem`, `.8rem` sur écran étroit), même typographie. Le libellé épinglé commence exactement à la même abscisse que le libellé de la ligne qu'il représente.
- **Le libellé à cheval est coupé par la barre, pas dupliqué.** Quand une tâche mère dont le titre est partiellement masqué devient la première ligne visible, seul le **fragment masqué** de son titre est épinglé, en bas de la barre. La partie visible du titre reste dans la ligne, juste sous la barre. Les deux fragments se complètent exactement au niveau de la barre de séparation : aucun pixel n'est affiché deux fois, aucun ne manque.
- **La barre de séparation se déplace en douceur.** L'ajout ou le retrait d'une ligne épinglée change la hauteur de la barre d'une ligne ; cette hauteur est animée (160 ms), et la réserve de bas de page suit la même transition. La liste glisse d'une ligne au lieu de sauter.
- **Les lignes épinglées ne clignotent pas.** Elles sont réutilisées par identifiant quand la chaîne change : seuls le fragment et la classe d'état sont mis à jour à chaque frame.
- **Les maillons restent des liens** vers l'ancre de la tâche.
- **Aucun changement de données, de route ni de modèle** : rendu client, style et tests uniquement.

## Capabilities

### New Capabilities

- (aucune)

### Modified Capabilities

- `project-outliner` : l'exigence de la barre collante précise l'anatomie des lignes épinglées (puce et indentation de l'outline), le partage du libellé à cheval par la barre de séparation, et le glissement animé de la liste.

## Impact

- **`public/app.js`** : `chainOf` retourne le fragment masqué du titre de la ligne à cheval ; `renderChain` réutilise les lignes épinglées par id, applique le fragment et la classe `is-partial` ; `sizeBar` anime la hauteur ; `--topbar-height` est publiée depuis la hauteur finale (pas la valeur en cours d'animation), pour qu'une ancre cliquée pendant la transition s'arrête sous la barre finale.
- **`public/style.css`** : anatomies `.ancestry-row` / `.ancestry-bullet` / `.ancestry-label`, transformation du fragment, barre de séparation, transition de hauteur et de `padding-bottom`, `prefers-reduced-motion` ; suppression du chevron et du pas d'indentation propre à la chaîne ; le `padding-bottom` de l'en-tête est retiré pour que le bas de la barre soit exactement le séparateur.
- **`test/e2e/reindent.spec.js`** : section 12 adaptée (alignement, fragment, transition) plus les cas 12.8 (pas de doublon, pas de trou) et 12.9 (transition de hauteur, stabilité de la barre pendant le défilement).
- **`public/sw.js`** : `CACHE_VERSION` déjà en `v12`, qui couvre ces actifs.
- **`openspec/specs/project-outliner/spec.md`** : exigence mise à jour à l'archivage.
- **Aucune migration de données**.
