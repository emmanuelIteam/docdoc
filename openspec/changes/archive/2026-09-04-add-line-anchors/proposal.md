## Why

Aujourd'hui chaque ligne projet/tâche possède déjà un **id stable et permanent** (un UUID stocké comme `data-id` sur la ligne), mais cet id n'est utilisé qu'en interne. La page n'est adressable qu'au niveau du domaine (`/domaine/:slug`), donc il n'existe aucun moyen de faire un lien vers, mettre en favori, ou partager une ligne précise. L'utilisateur veut que chaque ligne projet/tâche soit une ancre de la page, afin qu'un lien direct puisse pointer vers elle, défiler jusqu'à elle, et la mettre en évidence.

## What Changes

- **Chaque ligne devient une ancre adressable.** Une `id` de `node-<id>` (dérivée de l'id persistant du nœud) est posée sur chaque `.line`, si bien qu'une ligne peut être ciblée comme fragment d'URL (`#node-<id>`).
- **Une ligne liée est révélée même si elle est cachée sous des ancêtres repliés.** Quand la page est ouverte avec un paramètre de requête `reveal` nommant un id de nœud, le serveur rend les lignes ancêtres de ce nœud dépliées (afin que la cible soit visible et présente dans le DOM) sans modifier l'état « replié » persistant. La révélation est transitoire : elle n'écrase pas les préférences de repli sauvegardées.
- **Une ligne liée est scrollée jusqu'à elle et surlignée.** Comme la ligne ciblée porte une `id`, le navigateur défile jusqu'à elle et un style `:target` la met en évidence, visuellement distinct du surlignage de sélection.
- **Le menu contextuel de chaque ligne propose une action « copier le lien ».** L'utilisateur peut copier un lien profond (`/domaine/<slug>?reveal=<id>#node-<id>`) pointant exactement vers cette ligne, pour le partager ou le mettre en favori.
- **La révélation reste active tant que l'utilisateur reste sur la page.** Les re-rendus de l'outline (changement de statut, ajout, déplacement…) gardent les ancêtres de la cible dépliés tant que la révélation est active, afin que la ligne ne disparaisse pas en plein édition. Elle ne se replie que si l'utilisateur la replie lui-même ou quitte la page.

## Capabilities

### New Capabilities
- (aucune)

### Modified Capabilities
- `project-outliner` : ajouter des exigences pour que (1) chaque ligne soit une ancre adressable, (2) une ligne liée cachée sous des ancêtres repliés soit révélée, (3) une ligne liée soit scrollée et surlignée distinctement, et (4) le menu contextuel propose une action « copier le lien ».

## Impact

- **`server.js`** : dans `renderNode`, poser `id="node-<id>"` sur chaque `.line` ; lire `req.query.reveal`, calculer le chemin des ancêtres de la cible, et forcer `collapsed:false` **au moment du rendu** pour ces ancêtres sans muter les objets nœuds persistés ; ajouter une action « copier le lien » au menu contextuel ; faire transiter le paramètre `reveal` à travers les routes qui renvoient l'outline afin qu'une révélation reste active lors des re-rendus.
- **`public/app.js`** : gestionnaire délégué du bouton « copier le lien » qui écrit le lien profond dans le presse-papiers (avec un repli pour contexte non sécurisé) et affiche un retour « Lien copié » ; conserver la cible de révélation active et la renvoyer lors des re-rendus de l'outline.
- **`public/style.css`** : ajouter un surlignage `.line:target` (visuellement distinct de `.selected`) et toute indication « révélé ».
- **Aucune modification d'API, de modèle de données, de schéma ou de dépendance.** L'id de nœud existe déjà ; nous ne faisons que l'exposer comme ancre et ajouter un paramètre de requête `reveal`.
