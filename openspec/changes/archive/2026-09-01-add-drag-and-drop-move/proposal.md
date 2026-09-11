## Why

Today the only way to reorganize a project is the indent/outdent menu actions, which move a task one level at a time relative to its siblings. There is no way to lift an entire branch and drop it under a different project or task in a single gesture, so restructuring (e.g. moving "Choisir les meubles" under another task) takes several indent clicks and is error-prone. The user wants to select a task (which, with the current selection model, also selects its sub-tasks) and drag it into another task to reparent it — and to reorder it between siblings — in one gesture.

## What Changes

- **Drag starts only from the selection button (•)**: a drag begins only when the pointer is pressed on a line's selection button and then moved beyond a small threshold. Pressing on the title still renames; a plain click still selects/narrows; a double-click still collapses — a real drag is distinguishable from all of them because it only fires `dragstart` once the pointer actually moves.
- **Dragging always carries the whole subtree**: moving a task moves that task together with all of its descendants, unchanged, even when they are collapsed.
- **Drop targets and position**: a task can be dropped onto another task to become its **last child** ("inside"), or just **above**/**below** a task to be inserted as its previous/next sibling ("before"/"after"). Dropping on the outline's empty (root) area appends it as a top-level project.
- **All nodes are movable**: a root project can be dragged into another project (becoming a subtask), and a subtask can be dropped at the root level (becoming a project).
- **Target highlighting + invalid-target rejection**: valid drop targets are highlighted while dragging; dropping on the dragged node itself or on one of its descendants is rejected (marked invalid, the drop is not performed) so the tree can never contain a cycle.
- **New end-to-end move endpoint**: the client sends the move to the server, which detaches the node (with its subtree) from its current parent and reattaches it at the requested position, then persists and re-renders the outline.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `project-outliner`: a new requirement "Drag a task to move it into another task" is added, covering the gesture (drag starts from the selection button), the drop targets/position regions, drop target highlighting, invalid-target rejection, and re-rendering after a successful drop.
- `node-management`: a new requirement "Move a node (with its subtree) to a new parent or sibling position" is added, covering the tree mutation (reparent to a node's last child, insert before/after a sibling, move to the root), that the whole subtree moves, and cycle prevention.

## Impact

- **`server.js`**:
  - Add a `moveNode(id, targetId, position)` tree helper: detach the node from its current parent and reattach it — `position="inside"` → last child of `targetId` (or appended to the root outline when `targetId` is null); `position="before"`/`"after"` → insert as the previous/next sibling of `targetId`. Handle the index shift that happens when the dragged node is removed from the same sibling list before re-insertion.
  - Guard against cycles via `findNode`: reject when `targetId === id`, when `targetId` is a descendant of the dragged node, or when `targetId` does not resolve, leaving the tree unchanged (return an error).
  - Add route `POST /api/nodes/:id/move` (JSON body `{ targetId, position }`) that calls `moveNode`, persists via the existing `persist()`, and returns the re-rendered outline fragment (`renderOutline()`), mirroring the existing indent/outdent routes.
- **`public/app.js`**:
  - Make the `.bullet` selection button `draggable`, and delegate `dragstart` / `dragover` / `drop` / `dragend` on `document` (consistent with the existing click/dblclick delegation), because htmx re-renders the outline and swaps in new `.line` nodes.
  - On `dragstart`: set `effectAllowed='move'`, use `setDragImage(lineEl, ...)` so the whole line (not just the bullet) is the drag ghost, and record the dragged node id.
  - On `dragover`: resolve the drop target (`closest('.line')`, or the `#outline` root for a root drop) and the position region (pointer in the top third → before, middle → inside, bottom third → after), highlight the valid target and mark invalid targets (target is the dragged node or a descendant) with a rejected style.
  - On `drop`: POST `/api/nodes/:id/move` with the resolved `targetId` + `position`; on success reload the outline via htmx `/outline-fragment`.
  - On `dragend`: clear all drag indicators/classes.
- **`public/style.css`**: add rules for the in-progress drag (a `dragging` class on the source), the valid-target highlight, the before/after position indicator (or inside hint), and the invalid-target (rejected) styling.
- **No data-model change**: nodes keep `{ id, title, status, collapsed, children }`; moving merely relinks the same node objects, so persistence and the storage spec are unaffected.

## Coordination with other active changes

- **`narrow-selection-to-head-only` (implemented, active)**: this made the `.bullet` single-click a three-stage cycle (head+subtree → head only → deselect) and added a hidden `scope` input + `hx-include` on the status buttons. Drag-and-drop also begins on the `.bullet`, so the two must coordinate: a drag (pointer moved beyond a threshold) must not be mistaken for a single click (select/narrow) or a double-click (collapse) on the same button. Because a genuine drag only fires `dragstart` after pointer movement, a plain click still selects/narrows and a double-click still collapses; no new conflict is introduced as long as the drag threshold is respected. The dragged entity is always the whole subtree, independent of whether the selection is narrowed to the head line only, so drag-and-drop does not depend on the selection-scope state. This change should be reviewed alongside `narrow-selection-to-head-only` so the `.bullet` handler changes are applied consistently and the CSS classes do not collide.
