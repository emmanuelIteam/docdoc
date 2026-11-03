## Why

Le menu contextuel d'une ligne propose l'action « + » pour ajouter une sous-tâche. La ligne est bien créée avec le titre par défaut « Nouvelle tâche », mais elle est seulement affichée : l'utilisateur doit la retrouver, cliquer sur son titre et effacer le texte par défaut avant de pouvoir la nommer. L'ajout d'une tâche doit se poursuivre naturellement par la saisie de son nom.

## What Changes

- **Création puis édition immédiate.** Cliquer sur « + » crée la sous-tâche, révèle la ligne et ouvre son titre dans le champ d'édition avec tout le texte par défaut sélectionné. La première frappe remplace « Nouvelle tâche » ; aucune frappe ne s'ajoute au texte existant.
- **Le parent replié est déplié.** Une sous-tâche créée sous une ligne repliée serait invisible ; la création déplie le parent avant de rendre l'outline.
- **Création pilotée par le client.** L'action « + » n'est plus une requête htmx : le client envoie le POST de création et lit l'id du nouveau nœud dans l'en-tête `X-New-Node-Id`, comme le fait déjà la création par Entrée (`/next`). Cela permet de cibler la nouvelle ligne après le re-rendu.
- **Aucun changement de données.** Le titre par défaut reste `Nouvelle tâche` ; le champ édite la chaîne existante et l'enregistre par le PUT habituel.
- **Documentation.** La page Aide (capacité `user-guide`) documente l'action « + » et le fait qu'elle ouvre le titre de la nouvelle sous-tâche pour la nommer.

## Capabilities

### Modified Capabilities

- `node-management` : la création d'une sous-tâche depuis le menu contextuel ouvre son titre en édition avec le texte par défaut sélectionné, et déplie un parent replié.

## Impact

- **`server.js`** : le bouton « + » n'est plus un bouton htmx ; la route `POST /domaine/:slug/api/nodes` déplie le parent et renvoie `X-New-Node-Id` ; la section « Ajouter une sous-tâche » de la page Aide reprend la mention de l'action (le pied de page a été remplacé par cette page).
- **`public/app.js`** : gestionnaire délégué sur `.menu-item.add-child`, POST, remplacement de l'outline par `swapOutlineHtml`, puis `startRename(..., selectAll)` sur le titre de la nouvelle ligne ; le paramètre `reveal` actif est conservé.
- **`public/sw.js`** : incrément de `CACHE_VERSION` (`app.js` est précaché).
- **Données / API** : aucun changement de modèle ; la route existante gagne un en-tête de réponse.
- **Tests** : deux cas e2e (création avec sélection et remplacement du titre, parent replié déplié).
- **Retour arrière** : remettre les attributs htmx sur le bouton et retirer l'en-tête et le gestionnaire client.
