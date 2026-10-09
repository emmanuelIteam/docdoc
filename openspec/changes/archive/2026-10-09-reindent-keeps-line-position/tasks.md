# Tâches — reindent-keeps-line-position

## 1. Reproduire le défaut

- [x] 1.1 Écrire la topologie du scénario dans un test jetable (ou l'exécuter à la main sur un domaine de démonstration) : `A` en ligne 1, `B1` en ligne 2 enfant de `A`, `B2` en ligne 3 enfant de `A`.
- [x] 1.2 Constater le défaut : `MAJ+Tab` (ou `POST .../outdent`) sur `B2` produit l'ordre affiché `A, B2, B1` — la tâche remonte au-dessus de `B1` ; noter que `Tab` la ramène ensuite en ligne 3.

## 2. Serveur — désindenter sans réordonner (`server.js`)

- [x] 2.1 Dans la branche `outdent` de `reindentNode`, supprimer l'appel `displayMoveAfter(domain.displayOrder, index, id, parentId)` : la branche ne mute plus que l'arbre (retrait des enfants de l'ancien parent, insertion comme frère suivant de celui-ci) et laisse `displayOrder` intact.
- [x] 2.2 Mettre à jour le commentaire de la branche (et, si nécessaire, celui de l'en-tête de `reindentNode`) : une désindentation change la profondeur, pas la position affichée.
- [x] 2.3 Vérifier que rien d'autre n'est modifié : routes `indent` / `outdent`, branche `indent`, `displayMoveToBlockEnd`, `displayMoveAfter` / `displayMoveBefore` (encore utilisés par `moveNode`), `extractBlock`, `blockEnd`, `ensureDisplayOrder`, `renderOutline`.
- [x] 2.4 `node --check server.js` (ou `npm start` sur un domaine de démonstration) pour valider la syntaxe et le démarrage.

## 3. Contrôles HTTP (`test/passkey-flow.js`)

- [x] 3.1 Ajouter le contrôle du cas rapporté : parent `A` avec `B1` (ligne 2) et `B2` (ligne 3) ; `POST .../outdent` sur `B2` → le fragment renvoyé présente l'ordre `A, B1, B2`, `data-depth` de `B2` = 0 et `data-parent` vide.
- [x] 3.2 Ajouter le contrôle symétrique : `POST .../indent` sur `B2` (devenue racine) → `B2` redevient enfant de `A` (dernier enfant), l'ordre du fragment reste `A, B1, B2` et `data-depth` repasse à 1.
- [x] 3.3 Ajouter le contrôle du **premier** enfant : `POST .../outdent` sur `B1` → l'ordre du fragment reste `A, B1, B2` (la ligne ne descend pas sous `B2`) alors qu'elle devient racine.
- [x] 3.4 Ajouter le contrôle du sous-arbre : désindenter une ligne qui a une sous-ligne laisse la ligne et sa sous-ligne à leurs positions relatives (l'ordre du fragment ne bouge pas pour les autres lignes).
- [x] 3.5 Lancer `npm test` et confirmer qu'aucun contrôle existant ne régresse.

## 4. Recette navigateur (`npm run test:e2e`, Playwright + Chrome installé)

- [x] 4.1 Fixture `A` / `B1` / `B2` (les deux enfants de `A`) : ouvrir l'édition du titre de `B2`, presser `MAJ+Tab` → l'ordre des lignes reste `A, B1, B2`, `data-depth` de `B2` passe de 1 à 0, le champ reste ouvert et le curseur est conservé.
- [x] 4.2 Enchaîner `Tab` → l'ordre reste `A, B1, B2`, `data-depth` de `B2` repasse à 1 et `data-parent` vaut l'id de `A` ; le champ est toujours ouvert.
- [x] 4.3 Rejouer le même scénario sur une ligne **sélectionnée** (hors édition) : `MAJ+Tab` puis `Tab` conservent l'ordre affiché et la sélection.
- [x] 4.4 Vérifier le bouton `←` du menu contextuel : même résultat que `MAJ+Tab` (ordre inchangé, `data-depth` diminué).
- [x] 4.5 Confirmer la non-régression des scénarios existants (6.1 à 6.9 : curseur, texte saisi, sélection, no-op sans requête, menus fonctionnels après re-rendu, `Entrée`).
- [x] 4.6 Test de mutation (une fois, à la main) : rétablir `displayMoveAfter` dans la branche `outdent` et vérifier que 4.1 et 3.1 échouent — les nouvelles assertions ont donc des dents.

## 5. Documentation et clôture

- [x] 5.1 Vérifier que le paragraphe `.hint` du pied de page (`renderShell`) reste exact : il décrit `Tab` / `MAJ+Tab` sans promettre de position — aucun changement attendu.
- [x] 5.2 `openspec validate reindent-keeps-line-position --strict` et corriger les éventuels écarts de format.
- [ ] 5.3 Recette à la main sur un domaine de démonstration : glisser-déposer (« sous », « au-dessus », « dans »), repli / dépli, lien profond `?reveal=<id>#node-<id>`, boutons `→` / `←`.
- [ ] 5.4 Après recette, archiver le change (`openspec archive reindent-keeps-line-position`) pour reporter les deltas dans `openspec/specs/`.
