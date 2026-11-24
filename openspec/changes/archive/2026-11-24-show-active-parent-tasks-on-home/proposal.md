## Why

La page d'accueil ne liste que les lignes sans enfant. Une tâche composée de sous-tâches, passée « En cours » sur sa seule tête, n'y apparaît donc jamais : ses sous-tâches restent « En projet » et la ligne mère est filtrée. L'utilisateur croit que le changement de statut n'a pas été pris en compte.

## What Changes

- **Règle de listage** : une ligne active (`in_progress` ou `waiting`) est listée si aucun de ses descendants n'est actif. Une branche ne produit donc qu'une carte, portée par sa ligne active la plus profonde.
- **Une tâche mère peut être une carte** : lorsqu'aucune de ses sous-tâches n'est active (toutes « En projet » ou « Terminé »), elle apparaît avec le même rendu qu'une feuille — titre, lien profond, seconde ligne domaine puis ses propres ancêtres. Aucun doublon : elle disparaît dès qu'un descendant devient actif.
- **La branche est représentée par son descendant actif** : quand une sous-tâche passe « À faire » ou « En attente », sa carte prend la place de celle de la mère, et sa seconde ligne rappelle la mère et ses ancêtres.
- **Réapparition** : si le descendant redevient « En projet » ou « Terminé » alors que la mère est toujours active, la carte de la mère revient.
- **Déplacement et ordre inchangés** : les cartes mères se glissent, se réordonnent, changent de rubrique et se mémorisent comme les autres ; la route de positionnement accepte une mère listée et refuse une mère dont un descendant est actif.
- **Exclusions inchangées** : lignes `todo` (« En projet »), `done`, statut hérité `someday` lu comme `todo`, domaines archivés.
- **Aide mise à jour** : la section GTD de la page Aide explique la règle « une branche, une carte » et le cas d'une tâche mère active sans sous-tâche active.
- **Aucun changement de données, de route ni d'asset** : la règle est calculée au rendu, sur l'arbre déjà en mémoire ; aucune écriture sur un `GET`.

## Capabilities

### New Capabilities

- (aucune)

### Modified Capabilities

- `home-dashboard` : le classement porte sur les lignes actives sans descendant actif au lieu des seules feuilles ; l'exigence de classement est renommée ; les scénarios des deux rubriques et le refus d'un positionnement invalide sont ajustés (une mère listée est acceptée).
- `user-guide` : la page Aide documente les lignes actives listées, le cas d'une tâche mère sans descendant actif et la représentation d'une branche par son descendant actif.

## Impact

- **`server.js`** : `homeRubrique` (et son commentaire) renvoie la rubrique d'une ligne active sans descendant actif, mère comprise ; texte de la section GTD de la page Aide. La route `/api/home/order` réutilise `homeRubrique`, donc accepte et refuse les bons nœuds sans changement de code.
- **`rust/src/html.rs`** : `home_rubrique` et un helper de détection de descendant actif, commentaires, texte de la page Aide.
- **`rust/src/app.rs`** : aucun changement de route ; tests du routeur de positionnement adaptés au cas d'une carte mère.
- **`openspec/specs/home-dashboard/spec.md`** et **`openspec/specs/user-guide/spec.md`** : mises à jour par les deltas de ce changement.
- **Tests** : `rust/src/html.rs` (test unitaire du tableau renommé et étendu aux mères), `rust/src/app.rs` (route de positionnement d'une mère), `test/e2e/home.spec.js` (le test 1.7 s'inverse : une mère active sans descendant actif est désormais listée ; ajout d'une branche active représentée par sa seule ligne la plus profonde).
- **Aucune dépendance nouvelle, aucun changement du format de stockage, de l'ordre manuel enregistré ni des assets précachés.**
