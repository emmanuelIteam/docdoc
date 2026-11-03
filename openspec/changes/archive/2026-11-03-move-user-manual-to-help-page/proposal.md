## Why

Le manuel d'utilisation de l'outline est aujourd'hui un paragraphe unique rendu dans un pied de page pleine largeur, sous le panneau latéral et le contenu (`renderShell`, `server.js`). Il apparaît sur toutes les pages — page de domaine, page Administration, état vide — et il s'est densifié au fil des changes : sélection, menu, repli, glisser-déposer à la souris et au doigt, renommage, liens de tâche, indentation et étiquettes y tiennent en un seul bloc de texte. En bas de page, ce bloc est peu lisible, ressemble à une note technique, allonge chaque page et pousse le contenu vers le haut sans être consulté au bon moment. L'utilisateur demande d'en faire une page dédiée, accessible depuis un menu « Aide » placé après Administration.

## What Changes

- **Page dédiée `GET /aide`**, intitulée « Aide », rendue par la coquille habituelle (panneau latéral, en-tête, boîte de session), dont le contenu ne rend aucune ligne d'outline, aucun formulaire et aucune barre d'étiquettes.
- **Entrée « Aide » dans le pied du panneau latéral, immédiatement après « Administration »** : présente sur toutes les pages, elle pointe vers `/aide` et n'est active que sur cette page.
- **Suppression du pied de page de documentation** de `renderShell` : plus de `<footer class="shell-footer">` ni de paragraphe `.hint` en bas des pages de domaine, de la page Administration ni de l'état vide. La documentation n'existe plus qu'à un seul endroit.
- **Contenu déplacé et découpé en sections titrées** : sélectionner et menu, replier/déplier, déplacer, renommer, ajouter une sous-tâche, liens de tâche, indenter/désindenter, rattacher un thème, gérer les thèmes et les domaines. Tous les gestes documentés aujourd'hui sont conservés ; seul le découpage change, pour qu'on puisse lire la page comme un manuel.
- **Aucune nouvelle donnée, route d'API, migration ni JavaScript** : la page est un simple GET rendu par le serveur, le lien est une ancre classique, et `/aide` suit la règle des pages HTML personnelles (elle n'est pas mise en cache par le service worker).
- **BREAKING** pour l'habitude de lecture : le paragraphe n'est plus visible en bas des pages, il faut désormais ouvrir « Aide ». C'est le but de la demande, mais les utilisateurs qui s'y référaient au passage doivent être prévenus.

## Capabilities

### New Capabilities

- `user-guide` : la page « Aide » d'un espace — route, entrée du pied du panneau après Administration, absence de documentation en pied de page, contenu documentant toutes les interactions de l'outline et présentation lisible en sections.

### Modified Capabilities

- `project-outliner` : suppression de l'exigence **« Document line interactions in a page footer »** ; son contenu et tous ses scénarios migrent dans `user-guide`, où la documentation est rendue sur la page « Aide » et non en pied de page.
- `space-administration` : **non modifiée**. L'entrée Administration reste au même endroit, avec son état actif et ses scénarios ; ce change ajoute seulement une entrée voisine, dont l'ordre et l'état sont spécifiés par `user-guide`.

## Impact

- **`server.js`** : `renderSidebar` ajoute le lien « Aide » après le lien Administration dans `.sidebar-extra` ; `renderShell` perd son `<footer>` ; un drapeau `opts.help`, parallèle à `opts.admin`, active le lien ; nouvelle fonction `renderGuidePage(space)` et route `GET /aide` derrière le garde d'authentification existant.
- **`public/style.css`** : suppression des règles `.shell-footer` et des réserves `body.has-labels-bar .shell-footer` ; `.shell` revient à une seule rangée (`grid-template-rows` retiré) ; la réserve `body.has-labels-bar main` reste ; ajout des styles de la page (`.guide`, introduction, sections, listes) et du poids visuel de l'entrée Aide.
- **`public/sw.js`** : `CACHE_VERSION` passe de `v2` à `v3`, car `style.css` est précaché (règle du `Readme.md` et de `offline-shell`).
- **Tests** : `test/e2e/administration.spec.js` gagne une section « Aide » (ordre Administration → Aide, état actif, contenu documenté, page accessible avec un espace vide, absence de pied de page sur toutes les pages) ; `test/e2e/task-links.spec.js` vérifie la documentation des liens de tâche sur `/aide` au lieu du pied de page.
- **Aucun impact** sur le stockage, le modèle de données, les routes d'API, l'authentification, les thèmes, les domaines ni les autres capacités.
