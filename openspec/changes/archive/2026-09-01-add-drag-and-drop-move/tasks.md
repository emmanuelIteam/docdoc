## 1. Server: move node endpoint

- [x] 1.1 In `server.js`, add an `isDescendantOf(ancestorId, nodeId)` helper that returns true when `nodeId` is a strict descendant of `ancestorId`.
- [x] 1.2 In `server.js`, add `moveNode(id, targetId, position)` that detaches the node (with its subtree) from its parent and reattaches it: `position="inside"` → last child of `targetId` (or appended to the root outline when `targetId` is null); `position="before"`/`"after"` → insert as the previous/next sibling of `targetId`. Guard against errors (node not found, target not found, `target === node`, target is a descendant of node, and `before`/`after` without a reference) by returning an error *before* mutating the tree.
- [x] 1.3 In `server.js`, add route `POST /api/nodes/:id/move` (JSON body `{ targetId, position }`) that reads the body, calls `moveNode`, `persist()` on success, and returns `renderOutline()`; return `404` for a missing node or target and `400` for an invalid/cyclic move.
- [x] 1.4 In `server.js renderNode`, add `draggable="true"` to the `.bullet` selection button so a drag can start only from there.
- [x] 1.5 In `renderPage`, update the `.hint` paragraph to mention drag-to-move from the selection button.

## 2. Client: drag-and-drop interaction

- [x] 2.1 In `public/app.js`, add a delegated `dragstart` handler on `document`: from `closest('.bullet')`, record the dragged line id (`dragSource`) and its enclosing `.node` (`dragSourceNode`), set `dataTransfer.effectAllowed='move'`, `dataTransfer.setData('text/plain', id)`, and `dataTransfer.setDragImage(dragSourceNode, 0, 0)`; add a `.dragging` class to the source line.
- [x] 2.2 Add a `resolveTarget` helper: returns `{ kind: 'line', line }` for `closest('.line')`, `{ kind: 'root', outline }` for `closest('#outline')`, else `null`.
- [x] 2.3 Add a `positionAt` helper: `before` when the pointer is in the top 25% of the line, `after` in the bottom 25%, otherwise `inside`.
- [x] 2.4 Add an `isInvalid(target, sourceId)` helper: invalid when the target is the dragged line (`data-id === sourceId`) or is contained by `dragSourceNode` (a descendant).
- [x] 2.5 Add a delegated `dragover` handler: resolve the target and position; for a valid target call `preventDefault()`, set `dropEffect='move'`, and apply the corresponding `drop-*` class; for an invalid target set `dropEffect='none'`, do not `preventDefault()`, and apply `drop-invalid`.
- [x] 2.6 Add a delegated `drop` handler: `preventDefault()`, resolve the target + position, skip invalid targets, then `POST /api/nodes/:id/move` with `{ targetId, position }` (targetId = the line's `data-id`, or `null` for a root drop); on success call `reloadOutline()`.
- [x] 2.7 Add a delegated `dragend` handler: clear `dragSource`, `dragSourceNode`, the `.dragging` class, and all `drop-target`/`drop-before`/`drop-after`/`drop-inside`/`drop-invalid`/`drop-root` classes.

## 3. CSS: drag and drop indicators

- [x] 3.1 In `public/style.css`, add `.line.dragging { opacity: .55; }` for the source while dragging.
- [x] 3.2 Add `.line.drop-target` (base highlight) and the exclusive inset-`box-shadow` indicators: `.line.drop-before` (top rule), `.line.drop-after` (bottom rule), `.line.drop-inside` (full outline), and the rejected `.line.drop-invalid`.
- [x] 3.3 Add `#outline.drop-root` for the highlighted root drop target.
- [x] 3.4 Confirm the new classes do not collide with `.line.selected`, `.line.selected-head`, or `.title.status-*` (rule names are distinct; verified via grep for class-name clashes).

## 4. Verification

- [x] 4.1 Start the server and confirm `POST /api/nodes/:id/move` with `position="inside"` reparents the node as the target's last child (verified against `data/projects.json`).
- [x] 4.2 Confirm `position="before"`/`"after"` insert the node as the target's previous/next sibling, including when the dragged node was already in the same sibling list.
- [x] 4.3 Confirm moving a node onto itself or onto one of its descendants returns `400`/`404` and leaves the tree unchanged.
- [x] 4.4 Confirm a root project can be moved into another project (becoming a subtask) and a subtask can be moved to the root level.
- [ ] 4.5 Manually confirm in the browser: drag starts only from the bullet; the drag ghost shows the whole subtree; valid targets highlight with the position indicator; dragging onto the dragged node or a descendant is rejected; the outline re-renders after a valid drop. *(Requires a real pointer drag — not performed here.)*
- [ ] 4.6 Confirm a plain click still selects/narrows and a double-click still collapses on the bullet (no regression from `narrow-selection-to-head-only`). *(Requires a browser smoke test.)*
- [ ] 4.7 Confirm selection is transient and clears after a move (matching the status/indent behavior). *(Requires a browser smoke test.)*
