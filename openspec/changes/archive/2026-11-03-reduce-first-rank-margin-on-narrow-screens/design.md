## Context

La position horizontale d'une ligne vient d'une seule règle de `public/style.css` :

```css
.line { margin-left: calc(var(--depth, 0) * var(--outline-indent, 1.6rem)); }
.outline { --outline-indent: 1.6rem; }
@media (max-width: 640px) { .outline { --outline-indent: .8rem; } }
```

La ligne est une boîte de bloc dans la liste plate `#outline`, elle-même dans `.content` (`padding: 1.5rem`). Une ligne de profondeur 0 commence donc au bord de la boîte de l'outline, à 24 px du bord de la fenêtre, et son titre à 60 px (24 px de gouttière + 6,4 px de padding de ligne + 24 px de puce tactile + 5,6 px d'écart). Mesuré à 390 px, panneau replié : titre d'un projet à 60 px, largeur 299,6 px ; profondeur 1 à 72,8 px / 286,8 px ; profondeur 3 à 98,4 px / 261,2 px.

Deux autres mécanismes dépendent de cette géométrie :

- **la barre de hiérarchie épinglée** (`.ancestry-row`) reprend le pas d'indentation de la ligne qu'elle représente (`--depth` posé en ligne par `public/app.js`) et doit rester alignée au pixel avec elle ;
- **l'anneau de dépôt racine** (`#outline.drop-root`) est un `box-shadow` inset sur la boîte de l'outline : il entoure la liste, pas les lignes.

Le seuil de 640 px est la convention du projet pour toutes les règles mobiles ; il est inclusif.

## Goals / Non-Goals

**Goals:**

- Rendre **1 rem de largeur** (16 px) aux titres des lignes de premier rang sous 640 px, en réduisant leur marge gauche de 1,5 rem à 0,5 rem.
- Garder la marge de bureau, le pas d'indentation, la profondeur, le parent et l'ordre d'affichage strictement inchangés.
- Garder l'alignement exact de la ligne épinglée qui représente un projet et la cohérence de l'indicateur de dépôt racine.
- Garder la bascule native au redimensionnement, sans JavaScript.

**Non-Goals:**

- Pas de réduction de la gouttière du reste de la page (titre du domaine, bouton du panneau, barre d'étiquettes) : la demande porte sur les lignes de projets.
- Pas de modification du pas d'indentation mobile (0,8 rem), de la marge droite, de la hauteur, de la puce ni du menu.
- Pas de nouvelle structure HTML, pas de nouveau champ persisté.

## Decisions

### 1. Une marge négative de 1 rem, et non un padding ni une transformation

La largeur disponible pour le titre est celle de la boîte de la ligne : seule une marge négative l'augmente. Un `transform: translateX(-1rem)` ou un `position: relative; left: -1rem` déplacerait la ligne **sans** agrandir sa boîte — le titre ne gagnerait rien et se contenterait de déborder. `margin-left` négatif élargit la boîte vers la gauche, le bord droit restant à 24 px du bord de la fenêtre.

1 rem plutôt que 1,5 rem : la gouttière de la page fait 1,5 rem ; en rendre 1 rem laisse **0,5 rem (8 px)** entre le fond de survol / de sélection de la ligne et le bord de l'écran. Rendre la gouttière entière collerait le fond au bord et placerait la puce à 6,4 px du bord, ce qui exposerait la cible tactile aux gestes système de bord et romprait l'air minimum de la page.

- *Alternative 0,5 rem* : gain de 8 px seulement, à la limite du perceptible.
- *Alternative : réduire le `padding` de `.content`* : gagne de la largeur pour toute la page (titre du domaine, barre d'étiquettes compris), ce que la demande ne vise pas, et déplace le bouton du panneau.
- *Alternative : réduire la marge droite aussi* : hors demande ; le bord droit reste la gouttière de la page, ce qui garde la liste lisible.

### 2. Seules les lignes de profondeur 0 sont décalées

La règle cible `.line[data-depth='0']` sous la requête média à 640 px, et non `--outline-indent` : les lignes de profondeur ≥ 1 gardent exactement leur position (12,8 px pour la profondeur 1, 25,6 px pour la profondeur 2 à 390 px). L'écart visuel entre un projet et ses tâches passe de 12,8 px à 28,8 px : c'est voulu, il renforce la lecture « projet / tâche » sans changer la profondeur, donc sans changer le comportement d'indenter / désindenter.

### 3. La variable est définie sur `:root`, pas sur `.outline`

Les lignes épinglées vivent dans `#ancestry`, dans l'en-tête, hors de `.outline`. Pour qu'elles suivent la même valeur, `--outline-first-rank-shift` est définie sur `:root` (0 rem par défaut, 1 rem sous 640 px) et utilisée à la fois par `.line[data-depth='0']` et `.ancestry-row[data-depth='0']`. Le pas d'indentation, lui, reste local à `.outline` : il ne concerne pas la barre (qui a sa propre valeur, inchangée).

### 4. `data-depth` sur la ligne épinglée

`.ancestry-row` ne portait sa profondeur que dans une propriété personnalisée `--depth` (posée en ligne par `crumbFor`). Un sélecteur CSS ne peut pas tester la valeur d'une propriété personnalisée : `crumbFor` pose donc aussi `data-depth` sur la ligne épinglée. Une ligne de code, sans effet sur le rendu, qui permet à la même règle de s'appliquer aux deux surfaces.

### 5. La barre et ses lignes rendent le même 1 rem, sans être rognées

`.ancestry` défile verticalement (`overflow-y: auto`, ce qui force aussi le rognage horizontal) et `.ancestry-item` masque ce qui dépasse pour découper le libellé partagé (`.is-partial`). Une ligne épinglée décalée de 1 rem à gauche dans ces boîtes serait donc rognée : sa puce perdrait ses 9,6 premiers pixels. La barre et chaque ligne épinglée reçoivent donc le même couple marge négative / padding équivalent (et la barre une base flex augmentée d'autant) : chaque boîte commence 1 rem plus tôt, la ligne épinglée arrive exactement sur le bord de son item — donc sur le bord de sa ligne — et le contenu des autres lignes ne bouge pas. La barre conserve la largeur de la page (aucun défilement horizontal), ce que le cas 12.6 vérifie déjà.

Le fantôme de glisser reçoit le même padding : le clone d'une ligne de premier rang est décalé de 1 rem, et le fantôme tactile (`overflow: hidden`) le rognerait sinon. Le padding uniforme préserve la hiérarchie interne du fantôme.

### 6. L'anneau de dépôt racine est dessiné par un pseudo-élément

Avec des lignes de premier rang qui commencent 1 rem à gauche de la boîte de l'outline, un `box-shadow` inset sur cette boîte dessinerait son bord gauche à travers la puce des projets pendant tout un glisser vers la racine. L'anneau passe donc sur `#outline.drop-root::before`, en position absolue, décalé à gauche de `--outline-first-rank-shift` : son bord gauche coïncide avec le bord gauche des lignes de premier rang, son bord droit avec celui de toutes les lignes. La boîte de l'outline reçoit `position: relative` pendant le glisser seulement.

### 7. Aucun JavaScript de mise en page

La marge ne dépend que de la largeur de la fenêtre et du CSS statique. Le rendu, les attributs `data-depth` / `data-parent`, l'ordre affiché et la hiérarchie ne sont pas concernés. Le glisser tactile, le fantôme de glisser (clone de la ligne, qui porte `data-depth`) et les ancres suivent sans réglage.

### 8. Le compromis d'asymétrie est explicite

À 390 px, une ligne de projet commence à 8 px du bord gauche et finit à 24 px du bord droit : la liste est volontairement asymétrique, c'est le gain demandé. Les lignes de tâches, elles, restent à 20,8 px et au-delà. Le fond de survol d'un projet occupe donc presque toute la largeur, comme une ligne de liste mobile.

## Risks / Trade-offs

- **[Écart projet / tâche accru]** — à 390 px, l'écart entre un projet et ses tâches passe de 12,8 px à 28,8 px. *Mitigation* : la profondeur est inchangée, donc l'indentation, la désindentation et l'ordre restent identiques ; l'écart se lit comme un niveau supplémentaire propre au projet, pas comme une indentation supplémentaire.
- **[Ancrage du regard]** — le bord gauche des projets n'est plus aligné sur la gouttière du titre du domaine (24 px). *Mitigation* : la puce reste le repère de niveau ; l'écart de 16 px est volontaire et la ligne garde 8 px d'air.
- **[Ligne épinglée]** — si la marge n'était pas répercutée, la ligne épinglée d'un projet serait décalée de 16 px par rapport à sa ligne ; répercutée sans précaution, elle serait rognée par les `overflow: hidden` de la barre. *Mitigation* : `data-depth` sur la ligne épinglée + règle CSS commune, barre et items élargis et complétés en padding, et un cas e2e à 390 px qui compare les bords gauches et vérifie l'absence de rognage (puce entièrement dans l'item).
- **[Fantôme de glisser]** — le clone d'un projet est rogné de 16 px par le fantôme tactile. *Mitigation* : padding équivalent sur `.drag-ghost`.
- **[Indicateur de dépôt]** — un anneau sur la boîte de l'outline traverserait les puces des projets. *Mitigation* : pseudo-élément décalé, sans changement du comportement de dépôt.
- **[Tests e2e dépendants des marges]** — la section 7 asserte `a: 0` à 390 px. *Mitigation* : la valeur attendue devient `-16`, et le cas à 641 px vérifie le retour à 0.
- **[Cache PWA]** — les navigateurs déjà équipés servent l'ancienne feuille et l'ancien `app.js` jusqu'à revalidation. *Mitigation* : `CACHE_VERSION` incrémenté (`v13` → `v15`, `v14` ayant été pris par le change voisin `pin-sidebar-footer`).
