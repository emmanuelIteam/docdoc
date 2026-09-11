# Tasks

## 1. Sortir la documentation du bandeau d'actions

- [x] 1.1 Retirer le `<p class="hint">Survolez une ligne : …</p>` de `renderDomainActions` dans `server.js`.

## 2. Déplacer la documentation dans un footer pleine largeur

- [x] 2.1 Ajouter un `<footer>` dans `renderShell`, en 3e enfant de la grille `.shell`, contenant le texte de documentation.
- [x] 2.2 S'assurer que le texte n'apparaît plus dans la zone d'actions et reste affiché tel quel (même formulation qu'auparavant).

## 3. Adapter la grille `.shell`

- [x] 3.1 Passer `.shell` à `grid-template-columns: auto 1fr; grid-template-rows: 1fr auto` dans `public/style.css`.
- [x] 3.2 Appliquer `grid-column: 1 / -1` au `footer` pour qu'il s'étende sur toute la largeur sous le panneau latéral et le contenu.

## 4. Styliser le pied de page

- [x] 4.1 Styliser le footer (couleur `var(--done)`, `font-size: .85rem`, `padding`, éventuelle bordure haute) en réutilisant la classe `.hint` ou une nouvelle classe `.footer-hint`.

## 5. Validation

- [x] 5.1 Vérifier que la documentation n'apparaît plus dans le bandeau d'actions au-dessus de l'outline.
- [x] 5.2 Vérifier que le footer s'affiche en bas de page, pleine largeur, sous le panneau latéral et la colonne de contenu (y compris quand le contenu est court, grâce à `min-height: 100vh`).
- [x] 5.3 Vérifier l'affichage de la page « Aucun domaine » (footer présent) et qu'aucun script ne casse (aucune référence à `.hint` dans `app.js`).
- [ ] 5.4 Vérifier le repli de la barre latérale (`body.sidebar-collapsed`) et que l'outline reste fonctionnel (sélection, menu, glisser-déposer).
