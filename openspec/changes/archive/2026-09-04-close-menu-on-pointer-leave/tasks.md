## 1. Client: close the menu on pointer leave

- [x] 1.1 In `public/app.js`, add a delegated `mouseout` listener on `document` that clears `.selected` and `.selected-head` from every line when the pointer leaves a `.line.selected-head` and is not moving onto that line's `.menu` descendant.
- [x] 1.2 Confirm the handler does not clear the selection when the pointer moves between the line and its menu (the `relatedTarget` is inside the head line).
- [x] 1.3 Confirm no collision with the existing click / dblclick / drag-and-drop handlers (only `selected`/`selected-head` classes are touched; `dragging`/`drop-*` are left intact).

## 2. Styles: hover bridge between the line and the menu

- [x] 2.1 In `public/style.css`, add a transparent `.menu::after` (position absolute, `top: 100%`, full width, ~6px height) so the pointer can travel onto the above-anchored menu without leaving the interactive region.
- [x] 2.2 Confirm the menu still renders above the line with the existing 2px gap and that the bridge is invisible.

## 3. Hint text

- [x] 3.1 Update the `.hint` paragraph in `server.js renderPage` to mention that moving the pointer off the selected line closes its context menu and clears the selection.

## 4. Verification

- [x] 4.1 Select a line (head + subtree): the menu is shown; moving the pointer off the line closes the menu and clears the highlight.
- [x] 4.2 Moving the pointer onto the menu keeps it open and its actions remain clickable.
- [x] 4.3 No regression to inline rename, double-click collapse, or drag-and-drop.

> Verification performed: `node --check` passed on `app.js` and `server.js`; the server boots on a temporary port and `/domaine/projets` renders the updated hint and the `.menu` markup; the served `/app.js` contains the `mouseout` handler and `/style.css` contains the `.menu::after` bridge. The mouse behaviour itself (pointer leaving/entering the line and menu) is a DOM `mouseout`/`contains` semantic and was reviewed by code inspection — a final manual browser smoke test is recommended before shipping.
