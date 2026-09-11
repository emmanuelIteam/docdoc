## 1. Client: mark the clicked line as the menu head

- [x] 1.1 In `public/app.js` bullet click handler, after toggling `.selected` on the subtree, add the `selected-head` class to the clicked line when it is selected.
- [x] 1.2 Clear `selected-head` from every other line in the clicked line's subtree (so sub-lines are highlighted only), and remove `selected-head` from the clicked line when it is deselected.

## 2. Styles: reveal menu only on the head line

- [x] 2.1 In `public/style.css`, change `.line.selected .menu { display: flex; }` to `.line.selected-head .menu { display: flex; }`.
- [x] 2.2 Confirm `.line.selected { background: #eef2ff; }` is unchanged so sub-lines remain highlighted.

## 3. Verification

- [x] 3.1 Select a head line with sub-tasks: confirm the head line and all sub-lines are highlighted, but the context menu appears only on the head line.
- [x] 3.2 Confirm sub-lines show no context menu while highlighted.
- [x] 3.3 Confirm clicking the head line again deselects the whole subtree and hides the menu.
- [x] 3.4 Confirm a leaf line (no children) still shows its menu and selects only itself.
- [x] 3.5 Confirm no regression to inline rename, double-click collapse, or the menu actions.
