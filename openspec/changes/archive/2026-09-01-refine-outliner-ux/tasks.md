## 1. Fix Bold/Italic Rendering

- [x] 1.1 In `server.js` `renderNode`, apply the status class (`status-in-progress` / `status-done`) to the title `<span>` instead of the `.line` container
- [x] 1.2 Confirm the rendered title span carries the status class and that `.title.status-*` CSS applies bold/italic

## 2. Context Menu on Selection Only

- [x] 2.1 In `public/style.css`, show `.menu` only for `.line.selected` and remove the `:hover` trigger
- [x] 2.2 Keep the bullet button toggling `.selected` so the menu stays open while interacting

## 3. Double-Click to Collapse/Expand

- [x] 3.1 Add a delegated `dblclick` handler on `.line` that issues an htmx toggle to `/api/nodes/:id/toggle` (ignoring clicks on the title, bullet, and inside the menu)
- [x] 3.2 Verify double-click collapses/expands a node that has children, and is a no-op on a leaf

## 4. Compact Line Spacing

- [x] 4.1 Reduce the vertical padding of `.line` (and, if needed, the `.children` indent) in `public/style.css`

## 5. Reliability of "+ Tâche"

- [x] 5.1 Add `type="button"` to the context menu buttons (status, indent, outdent, `+ Tâche`, delete) to prevent implicit submit
- [x] 5.2 Verify the `+ Tâche` action creates and reveals a new child line

## 6. Verification

- [x] 6.1 Restart the server and verify each updated behavior: menu only on selection (not hover), double-click fold/unfold, compact spacing, bold/italic visible, and `+ Tâche` creating a child line
