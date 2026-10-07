## Context

Le paragraphe d'aide « Survolez une ligne : bouton de sélection et menu. … » est actuellement rendu par `renderDomainActions` dans la zone d'actions (`.toolbar`) de la page de domaine, juste au-dessus de l'outline. Il documente des interactions avec les lignes (sélection, menu, repli/dépliage, glisser, renommage, collage d'étiquette), mais il est visuellement rattaché à la barre d'actions dont il ne fait pas partie. On veut le déplacer dans un pied de page pleine largeur sous le schéma global (panneau latéral + contenu).

## Goals / Non-Goals

**Goals:**
- Sortir le paragraphe de documentation de la zone d'actions de la page de domaine.
- Afficher cette documentation dans un `<footer>` qui s'étend sur toute la largeur, sous le panneau latéral et la colonne de contenu.
- Conserver la grille `.shell` à deux colonnes (sidebar | content) et le comportement actuel de l'outline, sans toucher à `app.js`.

**Non-Goals:**
- Modifier le contenu du texte de documentation ou le traduire.
- Ajouter un framework, une dépendance ou de nouvelles routes/API.
- Changer la logique métier, le modèle de données ou les interactions de l'outline.
- Rendre le footer autre chose qu'une documentation statique (pas de lien, pas d'interactivité).

## Decisions

**Decision 1: Rendre le footer dans `renderShell` (global) plutôt que dans `renderDomainActions`.**
Le footer est du « chrome » de page, partagé par toutes les pages servies par `renderShell`. En le plaçant dans `renderShell`, la documentation apparaît sur la page de domaine **et** sur la page « Aucun domaine », sans duplication et sans avoir à la passer en paramètre.
- *Pourquoi*: cohérent avec la barre latérale et la barre supérieure, déjà rendues globalement par `renderShell` ; évite de répéter le texte dans chaque rendu de page.
- *Alternatives considérées*: footer passé en option à `renderShell` (rejeté : surdimensionné) ; footer rendu par `renderDomainActions` mais repositionné en CSS (rejeté : resterait dans la colonne de contenu, pas pleine largeur).

**Decision 2: Transformer la grille `.shell` en deux rangées pour un footer pleine largeur.**
```css
.shell {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-rows: 1fr auto;
  min-height: 100vh;
}
.shell > footer { grid-column: 1 / -1; }
```
La première rangée (`.1fr`) porte la barre latérale et la colonne de contenu ; la seconde (`.auto`) porte le `footer` qui traverse les deux colonnes via `grid-column: 1 / -1`. Avec `min-height: 100vh`, le footer est poussé en bas du viewport quand le contenu est court.
- *Pourquoi*: le `footer` devient un enfant `.shell` (après `.sidebar` et `.content`) et occupe pleine largeur sans modifier l'agencement interne des deux colonnes ; la sidebar conserve son `flex` vertical et la colonne de contenu son `min-width: 0`.
- *Alternatives considérées*: `<footer>` en enfant de `<body>` hors de `.shell` (rejeté : la grille `min-height: 100vh` laisserait le footer sous la ligne de flottaison, avec un scroll inutile) ; position `fixed`/`sticky` en bas du viewport (rejeté : superpose au contenu et n'est pas un vrai pied de page, option non retenue par l'utilisateur).

**Decision 3: Réutiliser la classe `.hint` pour le texte du footer.**
Le texte de documentation conserve son style actuel (`color: var(--done); font-size: .85rem`) dans une balise sémantique `<footer class="footer-hint">` (ou simplement `<footer class="hint">`), avec un léger `padding` et une bordure haute pour le délimiter.
- *Pourquoi*: aucune régression visuelle du texte, CSS minimal ; la sémantique `<footer>` signale clairement la zone.

**Decision 4: Documenter les interactions réellement prises en charge dans la spec.**
Le delta de spec ajoute une exigence « Documenter les interactions des lignes en pied de page » à la capacité `project-outliner`, avec des scénarios vérifiant la sortie du bandeau d'actions, la pleine largeur sous le schéma et l'affichage même sans domaine.

## Risks / Trade-offs

- **[Footer global]** Comme il est rendu par `renderShell`, le footer apparaît aussi sur la page « Aucun domaine » (état vide). Acceptable : il s'agit de documentation d'utilisation. *Mitigation*: aucune, choix assumé ; on peut conditionner le rendu plus tard si on veut un footer uniquement sur les pages de domaine.
- **[Changement de grille]** Ajouter `grid-template-rows: 1fr auto` change la façon dont `.shell` répartit la hauteur. *Mitigation*: vérifier que `.sidebar` (flex column) et `.content` (padding) se comportent comme avant et que `body.sidebar-collapsed .shell` (0/1fr) reste cohérent.
- **[Texte hétérogène]** La dernière phrase « Collez une étiquette sur le domaine pour le rattacher à un thème » est spécifique au domaine, alors que le footer devient global. *Mitigation*: conserver la phrase telle quelle (elle reste vraie sur la page de domaine) ou la supprimer du footer global si on préfère un texte purement « outline » — à trancher à l'implémentation.
- **[Référencement/accessibilité]** Le footer porte un long paragraphe ; vérifier qu'il ne dégrade pas la lecture sur mobile (le texte passe déjà à la ligne via `flex-wrap`/flow normal).

## Migration Plan

Changement de rendu HTML/CSS uniquement : aucune migration de données, aucun changement de modèle ni de dépendance. Déploiement : re-répondre le HTML via `renderShell` (le footer apparaît) et recharger `style.css`. Rollback : restaurer `renderShell`/`renderDomainActions` (remettre le `<p class="hint">` dans `.toolbar`) et la grille `.shell` d'origine.
