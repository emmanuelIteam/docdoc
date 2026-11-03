## 1. Serveur

- [x] 1.1 Dans `renderLine`, retirer les attributs htmx du bouton « + » et lui donner la classe `.menu-item.add-child`, en documentant que l'action est pilotée par le client.
- [x] 1.2 Dans `POST /domaine/:slug/api/nodes`, déplier le parent quand un `parentId` est fourni, puis renvoyer l'id du nouveau nœud dans l'en-tête `X-New-Node-Id`.
- [x] 1.3 Vérifier que la création d'un projet racine (sans `parentId`) reste inchangée et que la route répond toujours 404 pour un parent inconnu.

## 2. Client

- [x] 2.1 Ajouter un gestionnaire délégué sur `.menu-item.add-child` qui envoie le POST de création avec le `parentId` de la ligne et conserve le paramètre `reveal` actif.
- [x] 2.2 Après le swap de l'outline, retrouver la nouvelle ligne par `X-New-Node-Id` et appeler `startRename(..., forceEnd: true, selectAll: true)` sur son titre.
- [x] 2.3 En cas d'échec, journaliser et re-rendre l'outline (`reloadOutline`).

## 3. Documentation et cache

- [x] 3.1 Ajouter la mention de l'action « + » à la documentation des interactions — d'abord dans le pied de page, reprise depuis dans la section « Ajouter une sous-tâche » de la page Aide.
- [x] 3.2 Incrémenter `CACHE_VERSION` dans `public/sw.js`.

## 4. Spécifications et tests

- [x] 4.1 Mettre à jour `openspec/specs/node-management/spec.md` (exigence « Create a node » : édition immédiate, texte sélectionné, parent replié déplié).
- [x] 4.2 Retirer le delta `project-outliner` : l'exigence « Document line interactions in a page footer » a été supprimée par le change `move-user-manual-to-help-page` ; la documentation de l'action « + » est désormais couverte par la capacité `user-guide`.
- [x] 4.3 Ajouter à `test/e2e/reindent.spec.js` les cas « + crée une sous-tâche et sélectionne son titre » et « + déplie un parent replié ».
- [x] 4.4 Lancer `node --check` sur les fichiers modifiés et la suite `npm run test:e2e`.
