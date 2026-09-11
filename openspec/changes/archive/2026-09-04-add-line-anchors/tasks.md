## 1. Serveur : rendre chaque ligne comme ancre

- [x] 1.1 Dans `server.js` `renderNode`, ajouter `id="node-${node.id}"` à l'élément `.line` (dérivé du `data-id` du nœud).
- [x] 1.2 Confirmer que l'id d'ancre est préservé lors des renommages, déplacements et re-rendus htmx (il se re-dérive de l'id de nœud persistant à chaque rendu).

## 2. Serveur : révéler une ligne liée cachée à la demande

- [x] 2.1 Ajouter un helper qui, étant donnés les `projects` d'un domaine et un id cible, calcule l'ensemble des ids d'ancêtres (en remontant les liens `parent`/`grandParent` de `findNode` jusqu'à la racine).
- [x] 2.2 Dans `renderNode`/`renderOutline`, accepter un ensemble « à déplier » pour qu'un ancêtre de l'ensemble soit rendu déplié quelle que soit sa valeur `collapsed` persistée, sans muter l'objet nœud.
- [x] 2.3 Dans la route de page `/domaine/:slug`, lire `req.query.reveal` et rendre l'outline avec l'ensemble d'ancêtres de la cible. Un id inconnu (pas un nœud du domaine) est ignoré et l'outline est rendue normalement.
- [x] 2.4 Faire transiter `req.query.reveal` à travers chaque route qui renvoie l'outline (`/outline-fragment` et les routes de mutation de nœuds qui renvoient une outline) afin qu'une révélation reste active lors des re-rendus.
- [x] 2.5 Confirmer que la révélation est transitoire : rouvrir la même page sans `?reveal` montre les ancêtres dans leur état replié sauvegardé.

## 3. Serveur : action « copier le lien » dans le menu contextuel

- [x] 3.1 Dans le markup du menu de `renderNode`, ajouter un `.menu-item` icône seule `copy-link` (ex. `🔗`) avec `title="Copier le lien"`, positionné avec les éléments de menu existants et n'utilisant pas d'attribut htmx.
- [x] 3.2 Confirmer que le bouton « copier le lien » respecte la disposition horizontale icône seule du menu et les conventions d'infobulle `title`.

## 4. Client : copier un lien profond et garder la révélation active

- [x] 4.1 Dans `public/app.js`, ajouter un gestionnaire de clic délégué pour `.menu-item.copy-link` qui construit le lien profond (`origin` + le chemin de domaine actif + `?reveal=<id>#node-<id>`) et l'écrit dans le presse-papiers.
- [x] 4.2 Implémenter l'écriture presse-papiers : `navigator.clipboard.writeText` quand disponible, avec un repli textarea temporaire + `document.execCommand('copy')` pour les contextes non sécurisés ; donner un retour transitoire « Lien copié » (infobulle/toast).
- [x] 4.3 Conserver la cible de révélation active depuis l'URL (`?reveal=<id>`) au chargement, et ajouter un écouteur `htmx:configRequest` qui ajoute `reveal=<id>` aux requêtes liées à l'outline tant qu'une révélation est active.
- [x] 4.4 Confirmer que la cible de révélation n'est plus envoyée dès que l'utilisateur navigue vers une URL sans `?reveal` (l'outline revient à l'état sauvegardé).

## 5. Styles : surlignage lié

- [x] 5.1 Dans `public/style.css`, ajouter une règle `.line:target` (fond/anneau accent) visuellement distincte de `.line.selected` afin qu'une ligne liée ne soit pas confondue avec une ligne sélectionnée.
- [x] 5.2 Confirmer que le surlignage `:target` est libéré automatiquement quand le fragment change ou est retiré.

## 6. Vérification

- [x] 6.1 Ouvrir `/domaine/<slug>?reveal=<id>#node-<id>` pour une ligne cachée sous un ancêtre replié : l'ancêtre est déplié, la page défile jusqu'à la ligne et la ligne est surlignée.
- [x] 6.2 Ouvrir le même domaine sans `?reveal` : l'ancêtre montre son état replié sauvegardé (la révélation n'a pas persisté).
- [x] 6.3 Ouvrir `/domaine/<slug>?reveal=<inconnu>` : l'outline est rendue normalement sans révélation.
- [x] 6.4 Sélectionner une ligne et cliquer sur « copier le lien » : le lien profond est copié ; le coller et l'ouvrir révèle/surligne la bonne ligne.
- [x] 6.5 Pendant qu'une révélation est active, changer le statut d'une ligne : la ligne cible reste visible (les ancêtres restent dépliés).
- [x] 6.6 Aucune régression du renommage en ligne, du repli/dépli, du glisser-déposer, de la sélection ou du comportement de fermeture du menu au départ du pointeur.

> Vérification effectuée : `node --check` passe sur `server.js` et `public/app.js`. Le serveur a été démarré sur un port temporaire (3111) et les vérifications suivantes ont été faites par requêtes HTTP : l'ancre `id="node-<id>"` est bien rendue sur chaque ligne ; le `.menu-item.copy-link` et son `title="Copier le lien"` sont présents ; `GET /domaine/projets?reveal=<id>` révèle une ligne cachée sous un ancêtre replié (la ligne cible est rendue et porte son id d'ancre) ; ce reveal n'est pas persisté (re-ouvrir sans `?reveal` rend l'état replié sauvegardé) ; un `?reveal=<inconnu>` est ignoré (rendu normal) ; un re-rendu (changement de statut) qui reçoit `reveal=` garde la ligne cible visible, et sans `reveal=` la re-cache. L'écriture presse-papiers et les interactions souris (renommage en ligne, glisser-déposer, fermeture du menu au départ du pointeur) sont des comportements navigateur : un dernier test manuel dans un navigateur est recommandé avant mise en production.
