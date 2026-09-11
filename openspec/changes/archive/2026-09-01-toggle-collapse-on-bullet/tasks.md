## 1. Server: remove the dedicated fold control from rendering

- [x] 1.1 In `server.js` `renderNode()`, remove the `toggle` computation that emits the `.collapse` button (`▸`/`▾`) for nodes with children and the `.collapse-spacer` for leaves.
- [x] 1.2 Remove the `toggle +` fragment from the rendered line markup so the line starts directly with the `.bullet` selection button.
- [x] 1.3 Confirm the `toggleCollapse(id)` helper and the `POST /api/nodes/:id/toggle` endpoint are left unchanged.

## 2. Client: double-click the selection button to collapse/expand

- [x] 2.1 In `app.js`, restrict the `dblclick` handler so the collapse/expand trigger fires only on the selection button (`.bullet`) — the bullet no longer exits the handler early and now acts as the fold control.
- [x] 2.2 Verify the `dblclick` handler still ignores `.title`, `.title-input`, `input`, and `.menu` so renaming and the context menu are unaffected.
- [x] 2.3 Confirm the single-click `click` handler still toggles the `selected` class on `.bullet` (selection behavior unchanged).

## 3. CSS cleanup

- [x] 3.1 Remove the now-unused `.collapse` and `.collapse-spacer` rules from `public/style.css`.
- [x] 3.2 Re-baseline the `.line` layout so the title follows the bullet without a reserved 1.3rem collapse slot, and confirm the hover/selected reveal of `.bullet` still works.

## 4. UI hint text

- [x] 4.1 Update the hint line in `server.js` `renderPage()` so it mentions that double-clicking the selection button folds/unfolds a line.

## 5. Verification

- [x] 5.1 Start the app and confirm the `▸`/`▾` fold button no longer appears on any line.
- [x] 5.2 Manually verify: double-clicking a node with children on its selection button collapses and then expands it.
- [x] 5.3 Manually verify: single-clicking the selection button still selects/deselects the line and shows its context menu.
- [x] 5.4 Manually verify: double-clicking a leaf's selection button leaves the node unchanged.
- [x] 5.5 Manually verify: collapsing a node and reloading the page keeps it collapsed (`collapsed` state persisted).
