## Context

La documentation d'utilisation de l'outline est aujourd'hui un **paragraphe unique**, rendu par `renderShell` dans un `<footer class="shell-footer">` pleine largeur sous le panneau latéral et le contenu ([server.js:1042-1044](server.js#L1042-L1044)). Ce pied de page apparaît sur **toutes** les pages rendues par la coquille : page de domaine, page Administration ([server.js:1269-1327](server.js#L1269-L1327)) et état vide ([server.js:1106-1113](server.js#L1106-L1113)).

Le paragraphe a grossi au fil des changes : le change `move-hint-documentation-to-footer` l'a sorti du bandeau d'actions pour le mettre en pied de page, puis `add-inline-task-links` y a ajouté le collage d'un lien de tâche et l'action « Renommer » du menu. Il couvre désormais une dizaine de gestes en un seul bloc : sélection et menu, fermeture au départ du pointeur, repli/dépli, glisser-déposer à la souris et au doigt, renommage, liens de tâche, indentation `Tab`/`MAJ+Tab`, étiquettes de thème et renvoi vers Administration. En bas de page, il est peu lisible et s'affiche même là où il n'a pas de sens (Administration, état vide).

Le pied du panneau latéral est une simple colonne de liens ([server.js:1003-1006](server.js#L1003-L1006)) : `.sidebar-extra` est déjà un `flex-direction: column`, et la page Administration y est marquée active par le drapeau `opts.admin` ([server.js:997-999](server.js#L997-L999), [public/style.css:596-597](public/style.css#L596-L597)).

Les routes authentifiées sont protégées par `auth.guard` + `withSpace` ([server.js:1379](server.js#L1379)) : toute route ajoutée après ce point dispose d'une session et de `req.space`. Enfin, le service worker ne met en cache que des ressources statiques publiques et sert toutes les navigations en réseau seul (`public/sw.js`), et `style.css` figure dans les fichiers précachés : toute modification de la feuille impose d'incrémenter `CACHE_VERSION` (exigence `offline-shell`, règle du `Readme.md`).

## Goals / Non-Goals

**Goals:**

- Une page « Aide » dédiée à `GET /aide`, rendue dans la coquille (panneau, en-tête, boîte de session), qui contient la documentation des interactions.
- Une entrée « Aide » dans le pied du panneau, **immédiatement après** « Administration », sur toutes les pages, active seulement sur `/aide`.
- Supprimer complètement la documentation du bas des pages : un seul endroit à maintenir.
- Conserver **tous** les gestes documentés aujourd'hui, et rendre la page lisible comme un manuel (sections titrées).
- Aucun changement de comportement de l'outline, des données, des API, de l'authentification ni du stockage.

**Non-Goals:**

- Pas de réécriture du contenu au-delà du découpage : aucune fonctionnalité nouvelle n'est documentée, aucun geste existant n'est retiré du texte.
- Pas de sommaire ancré, pas de recherche, pas de rendu Markdown, pas d'onglets : une page serveur statique suffit.
- Pas de copie hors ligne : `/aide` suit la règle « navigation réseau seul » et n'est pas précachée ; l'ancien pied de page n'était pas non plus disponible hors ligne.
- Pas de modification de la page Administration, de `space-administration`, de la page de domaine, du panneau de navigation des domaines ni de la barre d'étiquettes.
- Pas de second point d'entrée (icône « ? » dans le bandeau) : hors demande.

## Decisions

### 1. Une route `GET /aide` et une fonction `renderGuidePage(space)`

La page est rendue côté serveur par une fonction dédiée, à côté de `renderAdminPage`, et suit le modèle existant :

```js
app.get('/aide', (req, res) => {
  res.type('html').send(renderGuidePage(req.space));
});
```

`renderGuidePage` appelle `renderShell(space, contenu, null, { title: 'Aide', help: true })` : `activeSlug` est `null` (aucun domaine surligné), le titre de l'onglet et du bandeau est « Aide », et le drapeau `help` active l'entrée du panneau — exactement comme `admin` le fait pour `/administration`. La page est montée après `auth.guard` et `withSpace`, donc protégée sans code supplémentaire.

*Alternatives écartées :*
- **`public/aide.html` statique** : perdrait la coquille (panneau, session, thèmes) et exigerait d'exempter la page du garde d'authentification puis de l'ajouter au précache du service worker — deux exceptions pour une page de documentation.
- **`/administration/aide` ou une section de la page Administration** : mélangerait une documentation en lecture seule à une page de gestion ; l'URL serait plus longue et l'entrée du panneau moins directe.
- **`/help` (anglais)** : l'interface et les URL existantes sont en français (`/administration`, `/domaine/:slug`).

### 2. L'entrée « Aide » après « Administration » dans `.sidebar-extra`

Le lien est ajouté dans le même `<nav class="sidebar-extra">`, juste après le lien Administration :

```html
<a class="sidebar-link sidebar-help${helpActive ? ' active' : ''}" href="/aide"${helpActive ? ' aria-current="page"' : ''}>Aide</a>
```

`renderSidebar` calcule `const helpActive = Boolean(opts.help)`, parallèlement à `adminActive`. L'ordre « Administration puis Aide » est l'ordre du DOM, et `.sidebar-extra` étant une colonne flex, l'ordre visuel suit. Le style reprend celui de l'entrée Administration (`.sidebar-admin, .sidebar-help { font-weight: 600; }`), et l'état actif réutilise `.sidebar-link.active`.

*Alternatives écartées :*
- **Un menu déroulant ou un bouton** : il n'y a qu'une destination ; une ancre est plus simple, accessible au clavier et fonctionne sans JavaScript.
- **Placer Aide avant Administration** : la demande est explicite (« après le menu Administration »).

### 3. Supprimer le pied de page plutôt que le dupliquer

`renderShell` ne rend plus de `<footer>` : le `</div>` de `.content` est suivi directement de la fermeture de `.shell`. La grille `.shell` revient à une seule rangée (`grid-template-rows` retiré), `min-height: 100vh` conservé. CSS : suppression du bloc `.shell-footer` et des deux réserves `body.has-labels-bar .shell-footer` ; la réserve `body.has-labels-bar main { padding-bottom: 4rem; }` reste, elle suffit à empêcher la barre fixe d'étiquettes de couvrir la dernière ligne. La classe `.hint` reste dans la feuille : `public/offline.html` l'utilise encore.

Garder le pied de page en plus de la page aurait créé deux copies du même texte, déjà divergentes dans l'arbre de travail (le paragraphe du pied de page mentionne les liens de tâche et l'action ✎, alors que la spec `project-outliner` a dû être complétée à la main). Un seul emplacement rend la dérive visible et corrigeable.

### 4. Contenu : sections titrées, informations conservées

La page reprend les informations du paragraphe, découpées en sections `<h2>` avec des listes :

1. **Sélectionner une ligne et ouvrir son menu** — bouton et menu au survol ; bouton visible sans survol sur écran étroit ou appareil sans souris ; clic = ligne + sous-lignes ; second clic sur la tête = tête seule ; fermeture au départ du pointeur.
2. **Replier ou déplier** — double-clic sur le bouton.
3. **Déplacer une ligne** — glisser depuis le bouton ; poignée sur la ligne sélectionnée ; glisser de la poignée au doigt ; la ligne et ses sous-lignes se déplacent.
4. **Renommer une ligne** — clic sur le titre hors lien, ou action ✎ / « Renommer » du menu.
5. **Ajouter une sous-tâche** — action + du menu : ajoute une sous-tâche sous la ligne et ouvre son titre pour la nommer.
6. **Lier des tâches** — copier le lien d'une tâche depuis son menu, le coller dans un titre le transforme en lien nommé ; cliquer sur le lien ouvre la ligne cible.
7. **Indenter et désindenter** — `Tab` / `MAJ+Tab` pendant l'édition d'un titre ou sur une ligne sélectionnée.
8. **Rattacher un thème** — coller une étiquette sur le domaine.
9. **Gérer les thèmes et les domaines** — renvoi vers `/administration` (lien), qui se trouve en pied du panneau.

Le texte reste en français, dans la continuité des libellés de l'interface. Aucune affirmation nouvelle : chaque phrase correspond à un geste réellement implémenté, et la spec `user-guide` liste ces gestes pour qu'un nouveau change pense à mettre la page à jour.

*Alternative écartée :* recopier le paragraphe tel quel. C'est le plus petit diff, mais cela reproduit en page le défaut qui motive la demande (un bloc dense et peu lisible), et la page aurait un seul `<h2>` sans structure.

### 5. Spécification : une nouvelle capacité, une exigence retirée

La documentation change d'emplacement, donc de capacité : `user-guide` porte la route, l'entrée de panneau, l'absence de pied de page, le contenu et la présentation. L'exigence de `project-outliner` « Document line interactions in a page footer » est **retirée** par un delta `REMOVED`, avec le renvoi vers `user-guide` en migration ; ses scénarios sont repris dans la nouvelle capacité (sélection, repli, déplacement, renommage, liens de tâche, indentation, étiquettes, renvoi Administration).

`space-administration` n'est **pas** modifiée : son exigence « Reach the page from the sidebar footer » ne parle que de l'entrée Administration (présence, lien, état actif), qui reste vraie. L'ordre des deux entrées est une propriété de la page Aide, documentée dans `user-guide`.

### 6. Tests : étendre la suite Administration, retarger `task-links`

`test/e2e/administration.spec.js` possède déjà le harnais du panneau (compte, session enregistrée, espace vide au départ) et vérifie le point d'entrée Administration ([test/e2e/administration.spec.js:200-203](test/e2e/administration.spec.js#L200-L203)). Il gagne :

- une section « Aide » placée **avant** la section 6.1, quand l'espace est encore vide : ordre `Administration` puis `Aide` dans `.sidebar-extra`, entrée présente, clic vers `/aide`, titre, état actif, absence de pied de page sur la page d'accueil vide, et présence des sujets documentés (sélection, repli, déplacement, renommage, liens de tâche, `Tab`/`MAJ+Tab`, étiquettes, lien vers `/administration`) ;
- après 6.1 : absence de `footer.shell-footer` sur la page Administration et sur une page de domaine, et entrée Aide inactive quand Administration est active (et inversement).

`test/e2e/task-links.spec.js:439-440` vérifie aujourd'hui le texte du pied de page ; ces deux assertions sont remplacées par une visite de `/aide` et la vérification que la documentation des liens de tâche y figure. Aucun autre test ne référence le pied de page (`grep` sur `test/`).

*Alternative écartée :* un nouveau `help.spec.js`. Il dupliquerait le harnais d'enrôlement et de serveur enfant (une centaine de lignes) pour deux ou trois assertions ; la suite Administration couvre déjà le panneau et l'espace vide.

### 7. Incrémenter `CACHE_VERSION`

`style.css` est précaché par le service worker (`public/sw.js`, `PRECACHE_URLS`) : la règle documentée impose d'incrémenter `CACHE_VERSION` à chaque changement d'un fichier précaché. On passe de `v2` à `v3` ; sans cela, la stratégie *stale-while-revalidate* servirait l'ancienne feuille au premier chargement après déploiement, avec un HTML sans pied de page mais encore des règles `.shell-footer` (sans effet) et des styles de page absents.

## Risks / Trade-offs

- **[Découvrabilité]** Le paragraphe n'est plus sous les yeux de l'utilisateur ; il faut ouvrir « Aide ». *Mitigation* : l'entrée est présente sur toutes les pages, dans le pied du panneau, avec le libellé conventionnel « Aide » et le même poids visuel qu'Administration. Un raccourci dans le bandeau pourra être ajouté plus tard si l'usage le réclame (question ouverte).
- **[Un clic de plus]** Consulter un geste demande désormais une navigation. *Mitigation* : la page est rendue côté serveur en une requête, sans JavaScript ni donnée de domaine ; l'ancien bloc était de toute façon peu lu à cet endroit.
- **[Dérive entre le texte et l'application]** La prose n'est pas générée depuis le code : un nouveau geste peut ne pas être documenté. *Mitigation* : la page est désormais le seul endroit à mettre à jour (au lieu d'un pied de page global), la spec `user-guide` liste les gestes et leurs scénarios, et les tests vérifient la présence de chaque sujet. C'était déjà le risque du pied de page ; il n'augmente pas.
- **[Le pied de page réservait de la place à la barre d'étiquettes]** La barre est `position: fixed` en bas à droite. *Mitigation* : `body.has-labels-bar main { padding-bottom: 4rem; }` est conservé ; le pied de page n'était qu'une seconde réserve sous le contenu. À vérifier sur une page de domaine avec la barre visible.
- **[Cache du CSS]** `CACHE_VERSION` incrémenté ; au pire, l'ancienne feuille est servie une fois par le service worker avant revalidation, et les règles orphelines sont inoffensives.
- **[Page indisponible hors ligne]** `/aide` est une navigation servie par le serveur, comme les autres pages. L'ancien paragraphe disparaissait aussi quand la navigation échouait : aucune régression. Une copie statique hors ligne serait un change séparé.
- **[Page longue sur mobile]** Les huit sections s'empilent et la page défile ; le panneau reste accessible par le bouton ☰ existant. *Mitigation* : texte court par section, pas de tableau ni d'image.

## Migration Plan

1. Déployer `server.js` (route, page, lien, suppression du pied de page), `public/style.css` et `public/sw.js` (`CACHE_VERSION` `v3`).
2. Aucune migration de données : la page ne lit ni n'écrit aucun document ; les domaines, thèmes, comptes et archives sont inchangés.
3. Recette : ouvrir `/aide` depuis n'importe quelle page, vérifier l'ordre Administration → Aide, l'état actif, le contenu et l'absence de pied de page sur les pages de domaine, Administration et l'état vide ; vérifier avec un espace sans domaine ; vérifier sur un écran étroit.
4. Retour arrière : restaurer les trois fichiers ; le pied de page revient et `/aide` renvoie 404, sans conséquence sur les données.

## Open Questions

- **Faut-il un raccourci « Aide » dans le bandeau (icône « ? ») en plus du panneau ?** Non retenu pour ne pas multiplier les points d'entrée ; à décider après usage réel, notamment sur mobile où le panneau est replié par défaut.
- **Faut-il rendre l'Aide disponible hors ligne ?** Cela demanderait une page statique séparée ou une stratégie de cache dédiée, alors que la coquille et la session dépendent du serveur — un change à part entière si le besoin se confirme.
- **Faut-il un sommaire ancré en haut de la page ?** Les huit sections sont courtes ; un sommaire pourra être ajouté quand le manuel grandira.
