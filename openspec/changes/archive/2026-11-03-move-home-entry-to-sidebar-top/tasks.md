## 1. Balisage du panneau

- [x] 1.1 Dans `renderSidebar`, rendre un bloc `<div class="sidebar-top" id="sidebar-top">` avant `<div class="sidebar-header">Domaines</div>`, contenant l'ancre Accueil (`class="sidebar-link sidebar-home"`, `href="/"`, classe `active` et `aria-current="page"` fournies par `opts.home`).
- [x] 1.2 Retirer l'ancre Accueil de `nav.sidebar-extra` : le pied ne garde qu'Administration et Aide, dans cet ordre, sans autre changement de structure.

## 2. Style et cache

- [x] 2.1 Ajouter dans `public/style.css` les styles de `.sidebar-top` (marge et filet de séparation avant « Domaines ») et de `.sidebar-home` (graisse et cible tactile cohérentes avec les autres entrées), en conservant les états `hover` et `active` de `.sidebar-link`.
- [x] 2.2 Incrémenter `CACHE_VERSION` dans `public/sw.js` (seule `style.css` change parmi les fichiers précachés).

## 3. Spécifications

- [x] 3.1 Delta `home-dashboard` : l'exigence d'accès à l'accueil depuis le panneau devient une rubrique en tête, sans doublon, avec le scénario du panneau qui reste ouvert au clic sur un écran étroit.
- [x] 3.2 Delta `domain-navigation` : l'exigence de repli du panneau énumère Accueil avec Administration et Aide parmi les entrées qui ne referment pas le panneau.

## 4. Tests

- [x] 4.1 Mettre à jour `test/e2e/administration.spec.js` : le pied du panneau compte deux entrées (Administration, Aide), l'entrée Aide passe à l'index 1, le clic vers l'aide et les assertions d'état actif restent inchangés.
- [x] 4.2 Mettre à jour `test/e2e/home.spec.js` : l'entrée « Accueil » précède `.sidebar-header` et `#sidebar-nav` dans le panneau, aucune entrée Accueil ne subsiste dans `.sidebar-extra`, et les assertions d'état actif/inactif et de navigation restent vertes.
- [x] 4.3 Étendre le test 1.4 de `test/e2e/sidebar.spec.js` : sur un écran étroit, activer l'entrée Accueil laisse le panneau ouvert, comme Administration et Aide.

## 5. Vérifications

- [x] 5.1 Lancer `node --check server.js`.
- [x] 5.2 Lancer `npm test` et `npm run test:e2e`.
  - `npm test` : 39/39. `npm run test:e2e` : 89/89 (dont `reindent.spec.js` 49/49).
- [x] 5.3 Vérifier à l'écran le panneau en 1280 px et en 390 px (rubrique en tête, séparation, état actif), puis `openspec validate move-home-entry-to-sidebar-top --strict`.
