# Tâches — tab-indents-line

## 1. Client — faisabilité et restitution du curseur (`public/app.js`)

- [x] 1.1 Ajouter un helper `previousSiblingRow(line)` : en remontant les `.line` précédents de `#outline`, renvoyer la première ligne dont `data-parent` est identique à celui de `line`, ou `null`.
- [x] 1.2 Ajouter `canReindent(line, direction)` : `'indent'` → `previousSiblingRow(line) !== null` ; `'outdent'` → `line.dataset.parent` non vide. Aucune autre condition (le serveur reste l'autorité).
- [x] 1.3 Étendre `startRename(span, clientX, clientY, forceEnd, selectAll, caretAt)` avec un offset de curseur explicite optionnel, appliqué à la place de `forceEnd` dans le `requestAnimationFrame` existant (les appels actuels restent inchangés).

## 2. Client — contexte « édition du titre » (`public/app.js`)

- [x] 2.1 Ajouter un troisième cas à `finish(save, next, reindent)` (valeur `'indent'` ou `'outdent'`), sur le modèle du cas `next` : garde `done` posé avant les requêtes, enregistrement du titre modifié par `PUT /domaine/:slug/api/nodes/:id` **puis** `POST .../indent|outdent` en séquence (`await`).
- [x] 2.2 Après la réponse, remplacer `#outline` par le fragment reçu, retrouver `.line[data-id="<id>"]` et rouvrir le champ sur son `.title` via `startRename(..., caretAt)` avec l'offset capturé avant la requête.
- [x] 2.3 Dans le `keydown` du champ : sur `e.key === 'Tab'` sans `Ctrl`/`Alt`/`Meta`, appeler `e.preventDefault()`, calculer `direction = e.shiftKey ? 'outdent' : 'indent'`, capturer `input.selectionStart`, puis ne rien faire si `!canReindent(line, direction)` et appeler `finish(true, false, direction)` sinon.
- [x] 2.4 Vérifier que `Entrée` (création de ligne sœur) et `Échap` (abandon) gardent leur comportement actuel. *(vérifié par inspection du code ; la recette 6.9 le confirme en navigateur)*

## 3. Client — contexte « ligne sélectionnée » (`public/app.js`)

- [x] 3.1 Ajouter un écouteur `keydown` délégué sur `document` : ne traiter que `e.key === 'Tab'` sans `Ctrl`/`Alt`/`Meta`, et ignorer tout événement dont la cible est un champ (`input`, `textarea`, `select`, `[contenteditable]`) ou n'est pas dans `#outline`.
- [x] 3.2 Résoudre la ligne cible : la `.line.selected-head` de `#outline` (via `e.target.closest('.line')` si elle est la tête sélectionnée, sinon la tête sélectionnée courante) ; sans tête sélectionnée, ne rien faire.
- [x] 3.3 Appliquer `preventDefault()`, tester `canReindent(line, direction)`, puis appeler `POST .../indent|outdent` et remplacer `#outline` par le fragment reçu.
- [x] 3.4 Après le remplacement, restaurer le contexte : reprendre l'état de groupe capturé avant la requête (`subtreeRows(line).some(selected)`) pour réappliquer `selected-head` sur la ligne et `selected` sur `[line, ...subtreeRows(line)]` le cas échéant, puis remettre le focus sur son `.bullet`.

## 4. Serveur — documentation (`server.js`)

- [x] 4.1 Compléter le paragraphe `.hint` de `renderShell` avec l'indentation par `Tab` et la désindentation par `MAJ+Tab`, dans le style des phrases existantes.
- [x] 4.2 Vérifier qu'aucune route ni aucun helper serveur n'est modifié : `POST /domaine/:slug/api/nodes/:id/indent` et `.../outdent`, `reindentNode`, `displayMoveToBlockEnd`/`displayMoveAfter` restent tels quels.

## 5. Tests

- [x] 5.1 Ajouter une vérification HTTP (même montage que `test/passkey-flow.js` : serveur réel, session authentifiée, `fetch`) : `Tab`/`MAJ+Tab` sur un premier enfant et sur une ligne racine laissent l'outline inchangé (no-op serveur) et répondent `200`.
- [x] 5.2 Ajouter la vérification symétrique : indenter une ligne ayant un frère précédent la rend enfant de ce frère (`data-parent`/`data-depth` du fragment re-rendu) ; désindenter une ligne non racine la remonte d'un niveau en frère suivant de son ancien parent.
- [x] 5.3 Vérifier que le titre n'est pas perdu par un réindent (enregistrement `PUT` puis réindent, le fragment re-rendu porte le titre saisi).
- [x] 5.4 Lancer `npm test` et confirmer qu'aucun test existant ne régresse. *(34 vérifications passées)*

## 6. Recette dans un vrai navigateur (`npm run test:e2e`, Playwright + Chrome installé)

- [x] 6.1 Édition du titre d'une ligne ayant un frère précédent : `Tab` indente d'un cran, le champ **reste ouvert** et le **curseur est conservé**.
- [x] 6.2 Même ligne : `MAJ+Tab` désindente d'un cran, sans quitter l'édition.
- [x] 6.3 Saisir un titre modifié sans valider, puis `Tab` : le texte saisi est **conservé et enregistré**, le champ se réouvre dessus.
- [x] 6.4 Enchaîner deux `Tab` sur la même ligne : deux crans d'indentation, contexte toujours actif.
- [x] 6.5 Ligne sélectionnée (clic sur le bouton de sélection), hors édition : `Tab` indente, la ligne **reste sélectionnée** et le raccourci est immédiatement répétable ; `MAJ+Tab` désindente de même.
- [x] 6.6 Premier enfant de son parent + `Tab` : rien ne se passe (aucune requête dans l'onglet réseau), la ligne reste en édition.
- [x] 6.7 Ligne racine + `MAJ+Tab` : rien ne se passe (aucune requête).
- [x] 6.8 `Tab` dans les formulaires du panneau latéral (domaine, thème) et `Ctrl+Tab` : navigation navigateur inchangée, aucune ligne indentée.
- [x] 6.9 Les **menus fonctionnent encore après un re-rendu** (régression constatée en recette, décision 6 du design) : statut appliqué après un `Tab`, et après un `Entrée`.
- [ ] 6.10 Reste à confirmer à la main (non couvert par la suite automatique) : boutons `→` / `←` du menu, sélection et statuts en cascade, repli/dépli (double-clic), glisser-déposer, lien profond `?reveal=<id>#node-<id>`, texte du pied de page affiché.

## 7. Clôture

- [x] 7.1 Lancer `openspec validate tab-indents-line --strict` et corriger les éventuels écarts de format.
- [ ] 7.2 Après recette, archiver le change (`openspec archive tab-indents-line`) pour reporter les deltas dans `openspec/specs/`.
