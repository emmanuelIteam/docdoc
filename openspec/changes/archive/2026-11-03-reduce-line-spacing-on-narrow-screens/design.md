## Context

La hauteur mobile des lignes vient d'une seule règle, dans la requête média à 640 px de `public/style.css` :

```css
@media (max-width: 640px) {
  .line { min-height: 2.75rem; } /* 44 px */
}
```

Le reste de la feuille ne fixe aucune hauteur de ligne : `padding: .04rem .4rem`, `align-items: center`, titre en `line-height: 1.25`. À 16 px de police racine, une ligne compacte mesure ~21,3 px (20 px de titre + 2 × 0,64 px de padding) et une ligne tactile 44 + 1,28 = 45,28 px de pas vertical. La règle `min-height` (et non `height`) laisse un titre long grandir la ligne.

Le seuil de 640 px est la convention du projet pour toutes les règles mobiles (indentation, espacement, puce, repli du panneau) ; il est inclusif.

## Goals / Non-Goals

**Goals:**

- Réduire de **10 % exactement** la hauteur minimale mobile : 2,75 rem × 0,9 = **2,475 rem = 39,6 px**.
- Garder la ligne entière tapable et préserver la cible 24 × 24 px de la puce (WCAG 2.2 AA 2.5.8).
- Ne toucher ni au seuil, ni au bureau, ni à la structure : un seul nombre et son commentaire changent.
- Garder la bascule native au redimensionnement, sans JavaScript.

**Non-Goals:**

- Pas de réduction du padding vertical (0,04 rem) : il est négligeable et le retirer ne changerait rien de visible.
- Pas de modification de l'indentation (0,8 rem), de la puce (1,5 rem), du menu contextuel ni de la barre d'étiquettes.
- Pas de nouvelle variable CSS : une valeur, un usage.

## Decisions

### 1. 2,475 rem, soit 90 % de 2,75 rem

`2.75rem * 0.9 = 2.475rem`, soit 39,6 px à 16 px. C'est la lecture littérale de la demande (« réduire de 10 % ») et cela reste dans la plage d'une cible tactile confortable (bien au-dessus des 24 px AA).

Le pas vertical entre deux lignes passe de 45,28 px à 40,88 px, soit −4,4 px (−9,7 %) : le padding de 1,28 px n'est pas réduit. L'écart avec −10 % est de 0,13 px, invisible ; réduire le padding aurait ajouté un second levier pour un gain nul.

- *Alternative `2.5rem` (40 px)* : plus ronde, mais −9,1 % seulement ; elle ne répond pas exactement à la demande.
- *Alternative `calc(2.75rem * 0.9)`* : exprime l'intention mais complique la feuille et les tests ; la valeur calculée est stable et lisible.
- *Alternative : réduire `line-height`* : sans effet visible, la hauteur de la ligne étant dominée par `min-height` de 44 px pour un titre sur une ligne.

### 2. `min-height` conservé

La ligne doit toujours grandir avec un titre sur plusieurs lignes. `height: 2.475rem` tronquerait le texte ou ferait déborder la ligne ; `min-height` conserve le comportement actuel.

### 3. Aucun JavaScript, aucun changement de structure

La hauteur ne dépend que de la largeur de la fenêtre et du CSS statique. Le rendu, les attributs `data-depth` / `data-parent`, l'ordre affiché et la hiérarchie ne sont pas concernés. Le menu (positionné en absolu au-dessus de la ligne) et la barre d'étiquettes suivent la nouvelle hauteur sans réglage.

### 4. Le compromis 44 px est explicite

44 px est le minimum WCAG 2.5.5 (AAA). La demande du propriétaire du produit prime : la bande de 39,6 px reste très supérieure au minimum AA de 24 px (2.5.8), que la puce continue de respecter. La spec `project-outliner` est mise à jour pour refléter la nouvelle valeur, afin qu'elle ne contredise pas le code.

## Risks / Trade-offs

- **[Cible tactile un peu plus courte]** — 39,6 px au lieu de 44 px, soit 4,4 px de moins par ligne, en haut et en bas. *Mitigation* : la ligne entière reste tapable, la puce garde 24 × 24 px et le texte reste centré ; le risque de mauvais tap augmente marginalement, sans changer de nature.
- **[Tests e2e dépendants de la hauteur]** — la section 8 de `reindent.spec.js` asserte 44 px, et la section 9 (glisser tactile) utilise une fixture de 30 lignes pour défiler : 30 × 40,88 px ≈ 1 226 px, toujours au-delà des 844 px du viewport (test 9.7 vert). Surtout, avec un minimum de 39,6 px, une ligne dont le titre revient sur deux lignes dépasse le minimum : à 390 px avec le panneau latéral ouvert, le contenu ne fait que ~150 px et « Tâche B » passe sur deux lignes (40 px + 1,28 px = 41,28 px). C'est le comportement voulu de `min-height`. *Mitigation* : la section 8 asserte désormais le minimum pour toutes les lignes et la valeur exacte de 39,6 px sur une ligne dont le titre tient sur une ligne ; 8.5 couvre déjà le titre long. Le test 8.4 (bascule sans rechargement) suit la même règle.
- **[Cache PWA]** — les navigateurs déjà équipés servent l'ancienne feuille jusqu'à revalidation. *Mitigation* : incrémenter `CACHE_VERSION` (`v8` → `v9`), conformément au Readme.
