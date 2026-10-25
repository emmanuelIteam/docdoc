## Context

L'outline est rendu comme une **suite plate** de lignes : chaque `<li class="line">` porte `data-id`, `data-parent`, `data-depth` et une variable inline `--depth`, et la profondeur vient de l'arbre, jamais du DOM. L'indentation est donc une pure affaire de présentation : `margin-left: calc(var(--depth, 0) * 1.6rem)` dans `public/style.css`. Aucune autre règle ne consomme `--depth`, et le client ne lit jamais `--depth` (il lit `data-depth`). La largeur d'une ligne n'entre dans aucun calcul : seule la profondeur et le pas déterminent le retrait.

Le budget horizontal d'un téléphone est serré. À 390 px de large avec le panneau latéral replié (l'état est mémorisé), l'outline dispose de 342 px, dont 29,6 px de coût fixe (paddings de ligne, puce et gaps). Avec un pas de 1,6 rem, le titre d'une ligne de profondeur 3 ne dispose que d'environ 236 px et celui d'une profondeur 5 d'environ 184 px ; avec 0,8 rem, ces valeurs passent à environ 274 px et 248 px. Le panneau latéral ouvert coûte 240 px et reste, à lui seul, le premier consommateur d'espace — il est hors périmètre.

La feuille ne contient aujourd'hui **aucune requête de média** : la sidebar fait 240 px fixes, le contenu 1,5 rem de padding, et le seuil de 640 px devient la première règle responsive de l'application. Les specs `project-outliner` et `outline-display-order` décrivent l'indentation par niveau mais ne fixent aucun pas : seule une exigence visuelle est ajoutée à `project-outliner`.

## Goals / Non-Goals

**Goals:**

- Diviser le pas d'indentation par deux à 640 px de large et en dessous, exactement (1,6 rem → 0,8 rem), sans changer la profondeur, le parent, l'ordre affiché ni la hiérarchie.
- Obtenir la réduction **en CSS seulement**, pour qu'elle suive le redimensionnement et la rotation sans requête, sans re-rendu et sans redémarrage.
- Garder le seuil simple et unique : 640 px de viewport, inclusif.
- Vérifier la bascule et les valeurs dans un vrai navigateur, sans refactorer la suite e2e existante.

**Non-Goals:**

- Pas de `white-space: nowrap`, pas d'ellipse, pas de troncature : le succès est « plus de place pour le titre », pas « une tâche tient sur une seule ligne ».
- Pas de repli automatique du panneau latéral, pas de réduction du padding du contenu, pas de modification de la liste thématique du panneau.
- Pas de support tactile (puce révélée au survol, glisser-déposer HTML5) : chantier distinct.
- Pas de changement de `server.js`, `public/app.js`, du stockage, des routes, du modèle persisté, ni de migration.
- Pas d'extraction d'un harnais e2e partagé : les tests responsive réutilisent le harnais existant de `reindent.spec.js`.

## Decisions

### 1. Une variable CSS locale à l'outline, surchargée sous 640 px

`public/style.css` déclare `--outline-indent: 1.6rem` sur `.outline` (et non sur `:root`, pour ne pas polluer les autres composants), `margin-left: calc(var(--depth, 0) * var(--outline-indent, 1.6rem))` sur `.line`, et une seule requête de média :

```css
@media (max-width: 640px) {
  .outline { --outline-indent: .8rem; }
}
```

*Alternatives écartées :*
- **Container query** (`@container (max-width: …)`) : suit la largeur réellement utile (sidebar ouverte comprise), mais le seuil serait exprimé en largeur de contenu et non en largeur d'écran ; le choix retenu est explicitement « 640 px de viewport ».
- **`clamp()` / `vw`** : pas continu, jamais exactement la moitié, et difficile à asserter.
- **JS `matchMedia` + classe** : duplique ce que CSS fait nativement ; aucun autre comportement mobile n'est orchestré aujourd'hui.
- **Surcharger `:root`** : fonctionne aussi, mais expose la variable à toute la page alors qu'elle ne concerne que l'outline.

### 2. Moitié exacte, puce et gaps inchangés

Le pas passe de 25,6 px à 12,8 px (à 16 px de root). La puce fait 0,7 rem (11,2 px) et le gap 0,35 rem (5,6 px) : le pas reste supérieur à la largeur de la puce, donc **aucune puce ne se chevauche** ; il reste 1,6 px entre la puce d'un niveau et celle du niveau suivant. Conséquence assumée : la puce d'un enfant (décalée de 12,8 px) commence environ 4 px à gauche du début du titre de son parent (décalé de 16,8 px). La hiérarchie reste lisible par le retrait et l'ordre des lignes ; l'alignement « puce sous le texte du parent » est perdu.

*Alternative écartée :* réduire aussi la gouttière de puce sur écran étroit (par exemple puce 0,6 rem + gap 0,25 rem). Cela préserverait l'alignement, mais change la présentation de la puce au-delà de la demande, et la puce doit garder la même largeur au survol et hors survol (elle occupe sa place en permanence pour que le titre ne bouge pas). À reconsidérer après usage réel si la hiérarchie paraît brouillée.

### 3. Pas de contrainte sur le retour à la ligne

Le critère retenu est « plus de place », pas « une ligne garantie ». Aucun `nowrap` ni ellipse : un titre long continue de revenir à la ligne, et le champ d'édition reste inchangé. Cela évite de tronquer des titres et de modifier le comportement d'édition ; le gain de largeur se traduit par des titres qui tiennent sur une ligne plus souvent, sans promesse mesurable.

*Alternative écartée :* `white-space: nowrap; text-overflow: ellipsis`. Cela rendrait le scénario « une tâche sur une ligne » directement observable, mais cacherait une partie du texte, changerait la largeur du champ d'édition et sortait du périmètre demandé.

### 4. Aucun changement serveur, client ou persisté

Le retrait ne dépend que de `--depth` et du pas : il est indépendant de la largeur du contenu, donc la bascule est native au redimensionnement. Aucune route, aucun état, aucune donnée : `data-depth` et `data-parent` restent la source de vérité pour le client (sélection, réindent, glisser-déposer), et l'ordre affiché persisté n'est pas concerné.

### 5. Seuil unique de 640 px, inclusif

640 px est le premier palier où le contenu devient franchement étroit (avec la sidebar, 352 px d'outline). Le seuil est inclusif : `max-width: 640px` → moitié, 641 px → pas plein. Un téléphone en paysage (844×390) garde le pas plein, ce qui est cohérent : la largeur y est abondante. Un bureau redimensionné autour de 640 px bascule d'un cran de 12,8 px par niveau ; c'est le comportement attendu d'une media query et cela reste réversible.

### 6. Vérification dans `test/e2e/reindent.spec.js`

Le harnais existant (serveur, compte, authentificateur virtuel, `storageState`) est réutilisé : ajouter un spec séparé dupliquerait environ 200 lignes d'enrôlement et un second serveur pour trois assertions. Le fichier est déjà la suite e2e de l'outline (réindent, sélection, menu après re-rendu) ; son en-tête est élargi à l'indentation au sens large.

Les tests :

- une fixture dédiée de profondeurs 0, 1 et 2 (`a` → `b` → `c`), indépendante des fixtures existantes ;
- `page.setViewportSize` (aucun changement du fixture `page` ni de la config Playwright) : 1280×720 → marges calculées 0 / 25,6 / 51,2 px ; 390×844 → 0 / 12,8 / 25,6 px ;
- bornes : 640 px → 25,6 px pour la profondeur 2, 641 px → 51,2 px ;
- bascule live : marqueur `window.__marker` posé avant le redimensionnement, toujours présent après (aucun rechargement), marges mises à jour dans les deux sens ;
- invariants : `data-depth`, `data-parent` et l'ordre des lignes identiques avant/après la bascule ;
- la suite desktop existante reste verte sans modification (le pas plein est le défaut).

## Risks / Trade-offs

- **[Le panneau latéral ouvert garde 240 px sur un téléphone]** — à 390 px, il coûte six fois le gain de l'indentation à profondeur 3 ; l'exigence est satisfaite mais l'effet visé ne l'est que panneau replié (état mémorisé dans `localStorage`). *Mitigation* : hors périmètre et documenté ; un change dédié pourra replier automatiquement le panneau ou le passer en surcouche.
- **[À 320 px, les lignes profondes reviennent encore à la ligne]** — profondeur 5 : environ 178 px, soit ~24 caractères. *Mitigation* : c'est le critère retenu (« plus de place ») ; une garantie « une ligne » demanderait `nowrap`/ellipse ou un pas encore plus petit, hors périmètre.
- **[La hiérarchie perd l'alignement puce ↔ texte du parent]** — 12,8 px de pas contre 16,8 px de coût puce + gap. *Mitigation* : les puces ne se chevauchent pas (12,8 > 11,2) et le retrait reste régulier ; la gouttière pourra être réduite plus tard sans changer l'exigence.
- **[Le menu contextuel déborde sur les lignes très profondes]** — il mesure environ 255 px ; en pas plein il déborde au-delà d'environ 5 niveaux sur 390 px, en moitié au-delà d'environ 9. Effet de bord favorable, pas un objectif ; aucun changement demandé.
- **[Première media query de l'application]** — aucun précédent de seuil ou de convention responsive. *Mitigation* : un seul seuil, documenté (640 px) ; les futures règles mobiles devront le réutiliser pour rester cohérentes.
- **[`rem` dépend de la taille de police racine]** — zoom et préférences utilisateur font varier les deux pas proportionnellement (16 px → 25,6/12,8 ; 20 px → 32/16). Le rapport de moitié est préservé ; les valeurs en px des tests ne valent que pour le Chrome e2e à 16 px.
- **[Bascule d'un pixel autour du seuil]** — redimensionner une fenêtre de bureau autour de 640 px change le pas d'un cran de 12,8 px par niveau. *Mitigation* : comportement standard et réversible, aucune animation.

## Migration Plan

1. Déployer `public/style.css` (fichier statique, aucune donnée ni configuration).
2. Aucune migration : les domaines, l'ordre affiché, les thèmes et les comptes sont inchangés.
3. Recette : à 390 px (panneau replié), vérifier qu'une ligne de profondeur 3 gagne environ 38 px de titre ; redimensionner autour de 640 px et vérifier la bascule ; rotation paysage → pas plein.
4. Rollback : redéployer la version précédente de `public/style.css`. Aucune donnée transformée, aucun effet de bord.

## Open Questions

- **Faut-il replier automatiquement le panneau latéral sur écran étroit ?** C'est le levier de 240 px, bien supérieur au gain de l'indentation ; il touche la navigation et mérite son propre change.
- **Faut-il réduire aussi la gouttière de puce si la hiérarchie se lit mal sur un vrai téléphone ?** Décision à prendre après usage, sans changer l'exigence (le pas resterait la moitié).
- **Faut-il plafonner le retrait total pour les profondeurs extrêmes ?** Non retenu : cela rendrait deux profondeurs différentes visuellement identiques ; le retour à la ligne reste préférable.
