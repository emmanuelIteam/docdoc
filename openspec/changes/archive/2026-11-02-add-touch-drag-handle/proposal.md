## Why

Sur un smartphone il n'y a pas de survol : la puce de sélection d'une ligne reste en `visibility: hidden` — elle n'apparaît qu'au `:hover` ou une fois la ligne déjà sélectionnée — alors que c'est précisément elle qui sert à sélectionner. Le doigt qui vise cette zone atteint donc la ligne elle-même et ouvre l'éditeur de titre, tandis que le déplacement, un glisser-déposer HTML5 amorcé depuis cette même puce, ne reçoit aucun événement au doigt : sur téléphone, une ligne ne peut aujourd'hui être ni clairement prise ni déplacée. L'utilisateur demande qu'une ligne sélectionnée montre en tête une puce portant une poignée, qui signale d'elle-même « attrape-moi pour me déplacer ».

## What Changes

- **Poignée de glisser sur la ligne sélectionnée** : le bouton de tête de la ligne sélectionnée affiche une poignée à six points (`⠿`) à la place du point `●`. Les sous-lignes sélectionnées gardent le point, et le point revient dès que la sélection est levée. La poignée occupe le même emplacement que le point : ni le titre de la ligne ni celui des lignes voisines ne se décalent.
- **Puce atteignable au doigt** : à 640 px de large et en dessous — ou sur un appareil sans survol (`hover: none`) — la puce est visible sans survol et sa cible tactile passe à 24 × 24 px. Sur un écran large doté d'un pointeur, la révélation au survol et la taille actuelles sont conservées.
- **Déplacement au doigt** : presser la poignée et glisser déplace la ligne et son sous-arbre. Le geste n'est reconnu qu'au-delà de 8 px de déplacement ; en dessous, c'est un tap qui sélectionne, comme aujourd'hui. Pendant le glisser : fantôme de la ligne et de son sous-arbre suivant le doigt, cible et position d'insertion indiquées (au-dessus / en dessous / comme dernier enfant), défilement automatique près des bords haut et bas, refus d'un dépôt sur la ligne déplacée ou l'un de ses descendants, annulation sans effet si le geste est interrompu. Le dépôt emprunte le même `POST /domaine/<slug>/api/nodes/<id>/move` et le même re-rendu que le glisser HTML5.
- **Bureau inchangé** : le glisser-déposer HTML5 depuis la puce reste le chemin de la souris, avec les mêmes indicateurs et les mêmes refus. La poignée y apparaît aussi sur la ligne sélectionnée.
- **Pied de page** : la documentation des interactions mentionne la puce visible sans survol, la poignée de la ligne sélectionnée et le glisser au doigt.
- **Hors périmètre** : replier/déplier par double-tap au doigt, agrandir les items du menu contextuel (28,8 px), replier automatiquement le panneau latéral, un glisser au clavier ou pour lecteur d'écran, un retour haptique, et une préférence utilisateur « compact / confortable ».
- **Aucun changement** du modèle persisté, des routes, du stockage, de l'authentification, de la portée de sélection (tête / sous-arbre), de l'indentation ou de l'ordre affiché ; aucune migration de données.

## Capabilities

### New Capabilities

Aucune : la poignée, la puce tactile et le glisser au doigt sont des comportements de l'outline et appartiennent à `project-outliner`.

### Modified Capabilities

- `project-outliner` : quatre exigences sont concernées (trois modifiées, une ajoutée).
  - **Reveal a selection button on hover** devient « révélation au survol, et puce toujours visible sans survol (écran étroit ou appareil sans survol) avec une cible de 24 × 24 px ».
  - **Drag a task to move it into another task** couvre désormais le glisser tactile (seuil de 8 px, fantôme flottant, défilement automatique, annulation) en plus du glisser HTML5.
  - Nouvelle exigence **Show a drag handle on the selected line** : poignée à la place du point sur la tête sélectionnée, même emplacement, disparition avec la sélection.
  - **Document line interactions in a page footer** documente la puce sans survol, la poignée et le glisser au doigt.
  - Les autres exigences de `project-outliner` (sélection tête/sous-arbre, menu, repli, ancres, liens profonds, pas d'indentation) restent inchangées, de même que `outline-display-order` : le glisser tactile réutilise exactement la sémantique du glisser HTML5 (mêmes cibles, mêmes positions, même endpoint) et n'ajoute aucune règle d'ordre.

## Impact

- **`server.js`** : markup du bouton de sélection (deux glyphes, `aria-label`, `title`) et texte du pied de page. C'est le seul endroit qui produit le HTML d'une ligne.
- **`public/style.css`** : visibilité et cible de la puce sans survol, bascule point ↔ poignée, `touch-action: none` sur la puce, variante flottante du fantôme, menu masqué pendant le glisser.
- **`public/app.js`** : glisser tactile aux Pointer Events, extraction d'un `moveLine()` et d'un `positionAtPoint()` partagés avec le chemin HTML5 existant. Aucune dépendance ajoutée.
- **Aucun impact** sur `storage.js`, les routes, l'authentification, S3, les statuts, l'ordre persisté ou les migrations.
- **Tests** : nouvelle section 9 dans `test/e2e/reindent.spec.js`, avec un contexte tactile (`hasTouch`, `isMobile`, 390 × 844) et des gestes envoyés par CDP ; les tests existants ne sont pas modifiés.
- **Vérification** : `npx playwright test`, `npm test`, `openspec validate add-touch-drag-handle --strict`, puis recette sur un téléphone.
- **Coût accepté** : sur écran étroit, la puce élargie à 24 px décale les titres de 12,8 px vers la droite ; en échange, la seule commande de sélection devient réellement atteignable au doigt. Le défilement qui démarrerait sur la puce est neutralisé au profit du glisser ; il reste possible partout ailleurs sur la ligne.
