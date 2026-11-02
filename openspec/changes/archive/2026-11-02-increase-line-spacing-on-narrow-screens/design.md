## Context

L'outline est rendu comme une suite plate de `<li class="line">`, chacun portant `data-id`, `data-parent`, `data-depth` et une variable inline `--depth`. La hauteur d'une ligne vient uniquement de son contenu et de son `padding` : `padding: .04rem .4rem`, `align-items: center`, titre en `line-height: 1.25`. À 16 px de police racine, cela donne un titre de 20 px, une puce de 16,8 px (`font-size: .7rem`, `line-height` héritée 1.5) et une ligne d'environ **21,3 px** de haut.

Cette hauteur est très inférieure aux 44 px communément retenus pour une cible tactile. Deux lignes voisines se partagent donc une bande de 21,3 px : le doigt qui vise la puce d'une ligne touche facilement la ligne d'au-dessus ou d'en-dessous, et la puce elle-même ne fait que 11,2 px de large. L'application n'a aujourd'hui **aucun support tactile dédié** : la puce n'apparaît qu'au survol (`.line:hover .bullet`), le glisser-déposer est celui du HTML5, et le menu contextuel (items de 28,8 px) ne s'ouvre qu'après une sélection.

Une seule règle responsive existe déjà, introduite par le change `halve-indent-on-narrow-screens` :

```css
@media (max-width: 640px) {
  .outline { --outline-indent: .8rem; }
}
```

Son design acte un seuil unique et inclusif de **640 px** et demande aux futures règles mobiles de le réutiliser. Les specs `project-outliner` fixent déjà une exigence d'espacement vertical compact ; `outline-display-order` décrit la position verticale issue de l'ordre d'affichage, que ce change ne touche pas.

## Goals / Non-Goals

**Goals:**

- Porter chaque ligne de l'outline à **au moins 2,75 rem (44 px à 16 px de police racine)** à 640 px de large et en dessous, pour que la bande de contact d'une ligne soit utilisable au doigt.
- Obtenir cet espacement **en CSS seulement**, pour qu'il suive le redimensionnement et la rotation sans requête, sans re-rendu et sans redémarrage.
- Conserver exactement la présentation compacte actuelle au-dessus du seuil (bureau, tablette paysage, téléphone en paysage).
- Ne jamais tronquer un titre : la ligne grandit si le titre revient sur plusieurs lignes.
- Vérifier les hauteurs et les invariants dans un vrai navigateur, sans refactorer la suite e2e existante.

**Non-Goals:**

- Pas d'élargissement de la cible horizontale de la puce (11,2 px), pas de révélation de la puce au toucher, pas d'adaptation du glisser-déposer HTML5 : chantier tactile distinct.
- Pas d'agrandissement des items du menu contextuel (28,8 px), des liens du panneau latéral, des lignes d'administration ou des lignes de passkeys : la demande vise les lignes de l'outline.
- Pas de repli automatique du panneau latéral, pas de réduction du padding du contenu, pas de modification du pas d'indentation.
- Pas de changement de `server.js`, `public/app.js`, du stockage, des routes, du modèle persisté, ni de migration.
- Pas de préférence utilisateur (interrupteur « compact / confortable ») : hors demande.

## Decisions

### 1. Une hauteur minimale sur `.line`, dans la requête de média existante

`public/style.css` gagne une seule déclaration, ajoutée au bloc `@media (max-width: 640px)` déjà présent :

```css
@media (max-width: 640px) {
  .outline { --outline-indent: .8rem; }
  /* Cible tactile : le pouce vise une ligne entière, pas un titre de 21 px. */
  .line { min-height: 2.75rem; }
}
```

L'ordre dans la feuille est sans importance : la règle de base `.line` ne déclare pas `min-height`, donc aucune cascade ne l'écrase. `align-items: center` (déjà présent) centre le titre et la puce dans la bande de 44 px ; le `padding` vertical de 0,04 rem est conservé, il n'a plus d'effet visible puisque la hauteur minimale domine.

*Alternatives écartées :*
- **`padding-block: .75rem`** : donnerait aussi 44 px (20 px de contenu + 24 px de padding), mais la hauteur dépendrait alors du contenu : un titre sur trois lignes ferait 20 + 60 + 24 = 84 px au lieu de 64 px, avec beaucoup d'air ajouté autour d'un texte déjà haut. `min-height` exprime directement l'intention (« la ligne fait au moins 44 px ») et laisse le titre dicter la hauteur au-delà.
- **`row-gap` sur `.outline`** : il faudrait passer l'`ul` en `display: flex; flex-direction: column`, et la gouttière ne serait **pas cliquable** : on obtiendrait un air plus grand mais des bandes de contact toujours séparées de 21 px. À l'inverse de l'objectif.
- **`height: 2.75rem`** : tronquerait ou ferait déborder les titres sur plusieurs lignes et le champ d'édition.
- **Une seconde requête de média après `.line`** : même seuil, mais deux blocs de 640 px à maintenir ; le bloc existant reste la seule adresse du seuil.

### 2. 44 px, hauteur minimale de référence pour un doigt

La valeur retenue est **2,75 rem = 44 px** à 16 px de police racine. C'est la cible de la WCAG 2.5.5 (AAA) et des *Human Interface Guidelines* d'Apple (44 × 44 pt) ; Material Design recommande 48 dp. 48 px (3 rem) réduirait encore le nombre de lignes visibles pour un gain marginal sur une liste pleine largeur, où seule la hauteur est contrainte ; 44 px est le plus petit dénominateur commun qui soit réellement « au doigt ».

Le seuil de la WCAG 2.2 AA (2.5.8, 24 × 24 px) n'est pas suffisant ici : il vise la précision du pointeur, pas un pouce qui masque la cible. La ligne actuelle (21,3 px) est même en dessous.

*Alternative écartée :* agrandir aussi la police (`1.05rem`) pour grossir le contenu. Cela changerait la typographie de l'application, la densité de l'outline et l'alignement du curseur dans le champ d'édition (`line-height: 1.25` partagé entre `.title` et `.title-input`), bien au-delà de la demande.

### 3. `min-height`, pas `height` : la ligne grandit avec son titre

Le titre peut revenir sur plusieurs lignes (aucun `nowrap`, aucune ellipse). Avec `min-height`, une ligne de 2 ou 3 lignes de texte dépasse simplement 44 px sans être tronquée ni déborder. Le champ d'édition (`.title-input`, `line-height: 1.25`) reste aligné sur le titre, et le caret ne bouge pas horizontalement.

*Alternative écartée :* `nowrap` + ellipse pour garantir une hauteur fixe. Cela cacherait du texte et changerait le comportement d'édition.

### 4. Aucun changement serveur, client ou persisté

L'espacement ne dépend que de la largeur de la fenêtre et du CSS statique : il est natif au redimensionnement, sans `matchMedia`, sans classe posée en JS, sans re-rendu htmx. Les attributs `data-depth` et `data-parent`, l'ordre affiché persisté et la hiérarchie ne sont pas concernés. Le menu contextuel, positionné en absolu par rapport à la ligne (`bottom: calc(100% + 2px)`), suit la nouvelle hauteur sans réglage.

### 5. Réutiliser le seuil de 640 px, inclusif

Le seuil `max-width: 640px` est celui du pas d'indentation : un seul palier, un seul comportement mobile à documenter et à tester. Il est inclusif : 640 px → hauteur tactile, 641 px → hauteur compacte.

*Alternatives écartées :*
- **`@media (pointer: coarse)`** : viserait tous les appareils tactiles, y compris une tablette de 1024 px (où l'espacement serait bienvenu) mais aussi un ordinateur portable à écran tactile (où il serait imposé). Cela ajoute un second axe de décision, invisible dans les tests de largeur existants, alors que la convention du projet est un seuil de largeur unique. À reconsidérer si les tablettes se plaignent.
- **Requête de conteneur** : suivrait la largeur utile (panneau latéral compris), mais le seuil serait exprimé en largeur de contenu, pas en largeur d'écran, et aucun autre composant n'utilise de container query.

### 6. Vérification dans `test/e2e/reindent.spec.js`

Le harnais existant (serveur, compte, authentificateur virtuel, `storageState`) est réutilisé : un spec séparé dupliquerait l'enrôlement et un second serveur. Le fichier est déjà la suite e2e de l'outline (réindent, sélection, indentation responsive).

Les tests (section 8) :

- un helper `lineHeights` lit `getBoundingClientRect().height` de chaque ligne, comme `lineMargins` lit les marges ;
- 1280 × 720 : hauteur compacte, environ 21,3 px (tolérance d'un demi-pixel) ;
- 390 × 844 : chaque ligne ≥ 44 px, et une ligne d'un seul tenant vaut 44 px (pas 45 ni 88) ;
- bornes : 640 px → 44 px, 641 px → hauteur compacte ;
- bascule live : marqueur `window.__noReload` conservé, hauteurs mises à jour dans les deux sens, `data-depth` / `data-parent` / ordre identiques ;
- un fixture dédié avec un titre long à 390 px : la ligne dépasse 44 px, le titre s'affiche sur plusieurs lignes (`getClientRects().length > 1`) et la ligne n'a ni débordement ni troncature (`scrollHeight === clientHeight`).

La suite desktop existante reste verte sans modification (la hauteur compacte est le défaut).

## Risks / Trade-offs

- **[Moins de lignes visibles sur un téléphone]** — à 390 × 844, environ 13 lignes au lieu d'environ 28. *Mitigation* : c'est le prix explicite d'une cible tactile ; le défilement (page et geste) n'est pas modifié, et la demande est précisément d'aérer. Aucun changement de pagination ni de repli automatique.
- **[Le bouton de sélection reste étroit (11,2 px)]** — l'espacement vertical ne corrige pas la précision horizontale, et sur un appareil tactile la puce n'apparaît toujours pas sans survol (elle n'est visible que si la ligne est sélectionnée). *Mitigation* : hors périmètre, documenté ; c'est le levier suivant (cible de la puce au toucher), à traiter dans un change dédié. L'espacement rend au moins chaque bande verticale non ambiguë.
- **[Le menu contextuel recouvre davantage la ligne précédente]** — le menu (~39 px de haut avec ses items de 1,8 rem) s'ouvre au-dessus de la ligne sélectionnée ; avec des lignes de 44 px, il masque presque toute la ligne précédente au lieu de la déborder. *Mitigation* : comportement déjà présent (il masquait 39 px d'une ligne de 21 px), le menu se ferme dès que le pointeur quitte la ligne, et la sélection reste highlightée. Aucun changement demandé.
- **[Les zones de dépôt du glisser-déposer changent de taille]** — `positionAt` calcule `before` / `inside` / `after` au prorata de la hauteur (25 % / 50 % / 25 %). À 44 px, `before` et `after` passent d'environ 5,3 px à 11 px et `inside` de 10,6 px à 22 px : le dépôt « à l'intérieur » devient plus facile à viser. Effet de bord favorable ; le glisser-déposer HTML5 reste inutilisable au doigt, hors périmètre.
- **[Le panneau latéral, le menu et les autres listes restent compacts]** — l'utilisateur peut devoir encore viser finement la puce ou les items du menu. *Mitigation* : la demande porte sur les lignes de l'outline ; les autres leviers sont listés en non-goals et en questions ouvertes.
- **[Un bureau redimensionné à 640 px devient aéré]** — comportement standard d'une media query, réversible au pixel près (641 px), sans animation. *Mitigation* : seuil documenté et partagé avec l'indentation.
- **[`rem` dépend de la taille de police racine]** — 2,75 rem vaut 44 px à 16 px, 55 px à 20 px. L'exigence « au moins 44 px » reste tenue ; les valeurs en px des tests ne valent que pour le Chrome e2e à 16 px.
- **[Cache du CSS]** — `express.static` sert `style.css` avec un ETag et une revalidation, donc un rechargement normal récupère la nouvelle feuille ; aucun `max-age` long à contourner.

## Migration Plan

1. Déployer `public/style.css` (fichier statique, aucune donnée ni configuration).
2. Aucune migration : domaines, ordre affiché, thèmes et comptes sont inchangés.
3. Recette : à 390 px de large, vérifier que chaque ligne fait au moins 44 px et qu'un titre long revient à la ligne sans être coupé ; redimensionner autour de 640 px et vérifier la bascule ; en paysage (844 × 390), la hauteur reste compacte.
4. Rollback : redéployer la version précédente de `public/style.css`. Aucune donnée transformée, aucun effet de bord.

## Open Questions

- **Faut-il élargir la cible de la puce (et la révéler au toucher) ?** C'est le complément naturel de cet espacement : une bande de 44 px ne sert à rien si la seule commande fait 11,2 px de large. Cela touche la sélection, le menu et la documentation du pied de page — un change dédié.
- **Faut-il aussi aérer sur les appareils tactiles larges (`pointer: coarse`) ?** Une tablette de 1024 px garde aujourd'hui des lignes de 21 px. À décider après usage réel, en acceptant un second axe de média.
- **Faut-il une préférence « compact / confortable » ?** Non retenu pour l'instant : un réglage utilisateur supplémentaire pour un seul seuil, alors que la largeur suffit à décider.
