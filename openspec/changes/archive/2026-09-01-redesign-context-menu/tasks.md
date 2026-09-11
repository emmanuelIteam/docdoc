## 1. Renderer: icon-only menu buttons

- [x] 1.1 In `server.js` `renderNode()`, replace the labelled `statusBtn(st, mark, label)` helper with an icon-only helper that renders `○`/`◐`/`●` for `todo`/`in_progress`/`done`, keeps the `active` class when the status matches the node, and adds a `title` tooltip (À faire / En cours / Terminé).
- [x] 1.2 Update each menu action button to an icon glyph with a `title` tooltip and the existing hx attributes: `→` indent (title "Indenter"), `←` outdent (title "Désindenter"), `+` add child (title "Ajouter une tâche"), `🗑` delete (title "Supprimer").
- [x] 1.3 Confirm every menu button keeps its `hx-post`/`hx-delete`/`hx-target`/`hx-swap` attributes and its `danger`/`active` classes exactly as before.

## 2. Styles: horizontal menu above the line

- [x] 2.1 In `public/style.css` `.menu`, change the anchor from `top: calc(100% + 2px)` to `bottom: calc(100% + 2px)` so the menu appears above the selected line.
- [x] 2.2 In `.menu`, switch `flex-direction: column` to `flex-direction: row`, remove `min-width: 9.5rem`, and add a small `gap` between items.
- [x] 2.3 Restyle `.menu-item` as an icon-sized, centred button (`width`/`height` ~1.8rem, `display: inline-flex`, centre alignment, `padding: 0`, `line-height: 1`) preserving the `:hover`, `.active`, `.danger`, and `.danger:hover` styles.

## 3. Verification

- [x] 3.1 Start the app (`npm start`) and select a line: confirm the menu shows as a single horizontal row of icons positioned above the selected line, with no visible text labels.
- [x] 3.2 Hover each icon and confirm its `title` tooltip shows the action name (status icons, indent, outdent, add child, delete).
- [x] 3.3 Confirm the current status icon is highlighted (`.active`) and the delete icon is shown in the danger colour.
- [x] 3.4 Confirm each icon still performs its action (set status, indent, outdent, add child, delete) and the outline re-renders correctly.
- [x] 3.5 Confirm no regression to selection toggle, inline rename, or double-click collapse (no changes were made to `public/app.js`).
