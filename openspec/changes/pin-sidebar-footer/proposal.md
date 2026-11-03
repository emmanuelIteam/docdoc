## Why

Le bloc bas du panneau latéral — Administration, Aide, installation de l'application et session (identité, passkeys, déconnexion) — n'est visible qu'à la fin du panneau. Or le panneau n'a aucune limite de hauteur : il grandit avec le nombre de domaines. Dès que la liste dépasse la hauteur de la fenêtre, le bloc bas passe sous la ligne de flottaison, parfois plusieurs écrans plus bas, et n'est atteignable qu'en faisant défiler toute la page — alors que la déconnexion et la gestion du compte sont précisément les commandes dont on a besoin sans chercher. La règle `overflow-y: auto` déjà posée sur la liste reste sans effet : faute de hauteur bornée, la liste s'étire au lieu de défiler, et c'est la page entière qui défile.

## What Changes

- **Le panneau fait exactement une hauteur d'écran et reste épinglé en haut de la fenêtre** pendant que la page défile : sa position ne dépend plus de la longueur de la page ni de celle de la liste.
- **Seule la liste des domaines défile**, à l'intérieur du panneau, quand elle dépasse la hauteur disponible.
- **Le bloc bas reste affiché au bas de l'écran**, sous la liste, quelle que soit la longueur de la liste. Avec une liste courte, il repose au bas de la fenêtre comme aujourd'hui : le rendu du cas courant ne change pas.
- **Le bloc bas ne se comprime jamais** : c'est la liste qui cède la place ; les entrées Administration, Aide, installation et session gardent leur hauteur et leur ordre.
- **Repli inchangé** : le bouton ☰, la classe `sidebar-collapsed`, la persistance et la largeur nulle du panneau replié restent identiques ; replié, le panneau ne montre ni liste ni bloc bas.
- **Aucun changement de rendu serveur, de route, de données ni de JavaScript** : seuls la feuille de style, un test et la version de cache du service worker changent.

## Capabilities

### New Capabilities

- (aucune)

### Modified Capabilities

- `domain-navigation` : nouvelle exigence « Garder le bloc bas du panneau visible au bas de l'écran » (panneau d'une hauteur d'écran épinglé en haut de la fenêtre, liste des domaines seule à défiler, bloc bas toujours affiché au bas de l'écran). Les exigences existantes de groupement par thème, de surbrillance, de lecture seule et de repli restent inchangées.

## Impact

- **`public/style.css`** : `.sidebar` passe à une hauteur d'écran (`100dvh`, repli `100vh`), `position: sticky`, `top: 0` et `align-self: start` ; `.sidebar-nav` reçoit `min-height: 0` ; `.sidebar-top`, `.sidebar-header` et `.sidebar-footer` sont figés en hauteur (`flex: 0 0 auto`).
- **`test/e2e/sidebar.spec.js`** : deux cas de géométrie, l'un sur liste courte (bloc au bas de l'écran, liste qui ne défile pas), l'autre sur liste longue (liste qui défile, bloc au bas de l'écran, y compris après défilement d'une page plus haute que la fenêtre et sur un écran étroit de téléphone).
- **`public/sw.js`** : incrément de `CACHE_VERSION`, `style.css` étant précaché.
- **Aucune migration de données** : le changement est purement visuel, côté feuille de style.
