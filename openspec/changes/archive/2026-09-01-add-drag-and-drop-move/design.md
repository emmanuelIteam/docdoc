## Context

The outliner renders a hierarchical bullet list where each line (`.line`) is a node (`server.js renderNode`): `<li class="node"> <div class="line" data-id="..."> [hidden scope input][bullet][title][menu] [<ul class="children">…]`. Tree helpers already exist (`findNode`, `createNode`, `deleteNode`, `reindentNode`), and the tree is persisted to `data/projects.json` via `persist()` after every mutation.

Reorganization today is only possible through the menu's indent/outdent actions (`POST /api/nodes/:id/indent|outdent` → `reindentNode`), which nudge a node one level at a time. There is no way to lift an entire branch and reattach it under another node in one gesture.

Selection is a purely client-side UI state. Since the `narrow-selection-to-head-only` change, the `.bullet` single-click cycles three stages (head+subtree → head only → deselect), a hidden `scope` input + `hx-include` drives the status action scope, and a double-click on the `.bullet` collapses/expands. The user wants to additionally drag a task (whole subtree) from its selection button into another task, to reparent it and to reorder it between siblings.

## Goals / Non-Goals

**Goals:**
- Dragging starts only from a line's selection button (`.bullet`); a real drag moves the whole subtree.
- Dropping onto a task makes it the task's last child; dropping in the top/bottom third of a task inserts it as that task's previous/next sibling; dropping on the outline's empty background appends it as a top-level project.
- Every node is movable, including root projects (a project can become a subtask, and a subtask can become a project).
- Valid drop targets are highlighted with a position indicator; drops onto the dragged node or onto one of its descendants are rejected (no cycles).
- After a successful drop the outline re-renders with the node in its new place.
- Keep the tree mutation server-side and persisted; keep the node data model unchanged (`{ id, title, status, collapsed, children }`).

**Non-Goals:**
- No multi-select or batch drag (only the whole subtree of a single dragged node).
- No persistence of selection across re-renders (selection is transient, as today).
- No touch/pen drag support beyond the standard pointer; no keyboard drag or screen-reader DnD (out of scope for now).
- No change to the existing indent/outdent, status, delete, add-child, and rename behavior.
- No drag reordering of individual leaf items without their subtree — the dragged entity is always the whole subtree.

## Decisions

### D1 — Add a server-side `moveNode(id, targetId, position)` helper
Reparenting is a real tree mutation that must be persisted, so it lives on the server (mirroring the other mutation helpers). The client sends a compact descriptor and the server relinks the same node object.

```js
function isDescendantOf(ancestorId, nodeId) {
  const anc = findNode(ancestorId);
  if (!anc) return false;
  function walk(n) {
    for (const c of n.children) {
      if (c.id === nodeId) return true;
      if (walk(c)) return true;
    }
    return false;
  }
  return walk(anc.node);
}

function moveNode(id, targetId, position) {
  const found = findNode(id);
  if (!found) return { error: 'not-found' };

  let target = null;
  if (targetId) {
    target = findNode(targetId);
    if (!target) return { error: 'target-not-found' };
    if (target.node === found.node || isDescendantOf(id, targetId)) {
      return { error: 'cycle' };       // cannot move onto itself or its own descendant
    }
  }

  const pos = ['inside', 'before', 'after'].includes(position) ? position : 'inside';
  if (pos !== 'inside' && !target) return { error: 'target-not-found' }; // before/after need a reference

  const node = found.node;
  const origin = found.parent ? found.parent.children : outline;
  origin.splice(found.index, 1);        // detach, carrying its subtree

  if (pos === 'inside') {
    if (target) target.node.children.push(node);   // last child
    else outline.push(node);                       // top-level project
  } else {
    const sib = target.parent ? target.parent.children : outline;
    const idx = sib.indexOf(target.node);
    sib.splice(pos === 'before' ? idx : idx + 1, 0, node);
  }
  return { ok: true, node };
}
```

Key points:
- **Detach first, then re-insert.** This makes the `before`/`after` index computation correct even when the node was originally in the same sibling list: `sib.indexOf(target.node)` is recomputed *after* removal, so the removal shift is absorbed.
- **Cycle guard is `target` vs the dragged subtree** (`target.node === found.node`, or `isDescendantOf(id, targetId)`). This is checked before any mutation so an invalid move leaves the tree untouched.
- **`before`/`after` with no reference is an error** (the client only sends `before`/`after` when hovering a real line; the root drop always uses `inside`).

### D2 — Add route `POST /api/nodes/:id/move`
Mirrors the indent/outdent routes: parse `{ targetId, position }`, call `moveNode`, `persist()`, and return `renderOutline()`.

```js
app.post('/api/nodes/:id/move', (req, res) => {
  const targetId = req.body.targetId || null;
  const position = req.body.position || 'inside';
  const result = moveNode(req.params.id, targetId, position);
  if (result.error) {
    const code = (result.error === 'not-found' || result.error === 'target-not-found') ? 404 : 400;
    return res.status(code).send(result.error);
  }
  persist();
  res.type('html').send(renderOutline());
});
```

### D3 — Client drag-and-drop with HTML5 DnD, delegated on `document`
Because htmx swaps the whole `#outline` on nearly every server interaction, the drag handlers are delegated on `document` (consistent with the existing `click`/`dblclick` delegation) so they work on freshly rendered `.line` nodes without re-attaching.

- **Drag source.** In `server.js renderNode`, add `draggable="true"` to the `.bullet` button. The bullet is the only draggable element, so a drag can only start from it (the title renames on click; other areas are not draggable).
- **`dragstart`** (on the bullet): find `bullet.closest('.line')`, record `dragSource = line.dataset.id` and `dragSourceNode = line.closest('.node')`, set `dataTransfer.effectAllowed = 'move'`, `dataTransfer.setData('text/plain', id)`, and `setDragImage(dragSourceNode, 0, 0)` so the whole line/subtree (not just the bullet) is the visual ghost. Add a `.dragging` class to the source line.
- **`dragover`**: resolve the drop target and position, then `preventDefault()` (to allow the drop) and set `dropEffect='move'` only for valid targets; for invalid targets set `dropEffect='none'` and do *not* `preventDefault()` (so the browser shows a forbidden drop). Apply the highlight/indicator classes.

```js
function resolveTarget(el) {
  const line = el.closest('.line');
  if (line) return { kind: 'line', line };
  if (el.closest('#outline')) return { kind: 'root', outline: el.closest('#outline') };
  return null;
}
function positionAt(e, line) {
  const r = line.getBoundingClientRect();
  const t = (e.clientY - r.top) / r.height;
  return t < 0.25 ? 'before' : t > 0.75 ? 'after' : 'inside';
}
function isInvalid(target, sourceId) {
  if (target.kind === 'root') return false;
  if (target.line.dataset.id === sourceId) return true;
  return !!(dragSourceNode && dragSourceNode.contains(target.line));
}
```
- **`drop`**: `preventDefault()`, resolve the target + position, skip invalid, and `POST /api/nodes/:id/move` with `{ targetId, position }` (targetId = the line's `data-id`, or `null` for a root drop). On success call the existing `reloadOutline()` (htmx `/outline-fragment`), since drag-and-drop is a bespoke interaction (like rename) rather than an `hx-*` attribute.
- **`dragend`**: clear `dragSource`, `dragSourceNode`, the `.dragging` class, and all drop-indicator classes.

### D4 — Drop-target visual model (CSS classes)
- `.line.drop-target` — base highlight for a live (valid) target.
- `.line.drop-before { box-shadow: inset 0 2px 0 0 var(--accent); }` — insert above.
- `.line.drop-after  { box-shadow: inset 0 -2px 0 0 var(--accent); }` — insert below.
- `.line.drop-inside { box-shadow: inset 0 0 0 2px var(--accent); }` — become last child.
- `.line.drop-invalid { background: #fef2f2; box-shadow: inset 0 0 0 2px #dc2626; }` — rejected.
- `.line.dragging { opacity: .55; }` — the source is dimmed while dragging.
- `#outline.drop-root { box-shadow: inset 0 0 0 2px var(--accent); }` — an active root drop target.

The `drop-before`/`drop-after`/`drop-inside` classes are exclusive; `markTarget()` clears them before applying the current one. The indicator uses the line's own border box (via inset `box-shadow`), so it never shifts the title or neighbors — consistent with the outliner's no-shift constraint.

### D5 — Coordination with `narrow-selection-to-head-only`
The `.bullet` is now simultaneously: single-click = 3-stage selection, double-click = collapse/expand, drag = move. These coexist because `dragstart` fires only after real pointer movement:
- a click (no move) → `click` handler (selection cycle);
- a double-click without movement → `dblclick` handler (collapse);
- a press-and-move → `dragstart` (move).

No guard changes are needed in the existing `click`/`dblclick` handlers. The dragged entity is always the whole subtree and is independent of whether the selection was narrowed to the head line only, so drag-and-drop does not read or depend on the transient `scope` input. The new classes (`dragging`, `drop-*`) do not collide with `selected`/`selected-head`/`status-*`.

## Risks / Trade-offs

- **[Root-drop via empty background may over-match]** → "Not over a `.line`" is treated as a root move; empty space inside a *nested* `children` `<ul>` also resolves to the root target because it is inside `#outline`. This is a deliberate simplification: precise control is given by dropping on a specific line (before/after/inside), and root-level append is a secondary convenience. *Mitigation:* call this out in the hint text; revisit with a per-container root target if it proves surprising.
- **[`setDragImage` on a subtree that re-renders mid-drag]** → If an `hx-*` action fires during a drag (e.g. a stray hover-triggered request), the ghost element may detach. Interlocks: the outline only re-renders on explicit user actions (status/indent/etc.) which are not triggered while dragging, so this is unlikely. *Mitigation:* keep `dragSourceNode` references only for the duration of the drag (cleared in `dragend`) so a stale DOM node is never dereferenced afterwards.
- **[HTML5 DnD quirks on the small `.bullet`]** → The bullet is tiny (`.7rem`) and hidden unless hovered/selected, which could make grabbing it fiddly and can conflict with the click/dblclick on the same element. *Mitigation:* the drag threshold + `dblclick` detection means clicks still work; we increase the effective hit area by letting `dragstart` use the whole line as the ghost; if too fiddly, a dedicated drag handle affordance (e.g. a grip on hover) is a follow-up.
- **[Drop-into-a-collapsed-node keeps children hidden]** → Dropping "inside" a collapsed node hides the moved subtree until the node is expanded, which can look like the drop failed. *Mitigation:* the drop-inside indicator + a re-render keeps the moved node as a child; expanding reveals it. Acceptable (the existing add-child behavior has the same property).

## Migration Plan

- **Server**: add `moveNode` + `isDescendantOf` helpers and the `POST /api/nodes/:id/move` route in `server.js`; add `draggable="true"` to the rendered `.bullet`. Update the `.hint` paragraph to mention drag-to-move from the selection button.
- **Client**: add the delegated drag handlers in `public/app.js`.
- **CSS**: add the `dragging`/`drop-*`/`drop-root` rules in `public/style.css`.
- No schema, DB, dependency, or data changes. Rollback: revert the new route/helpers, the `draggable` attribute, and the drag handlers/classes; the previous behavior is restored with no other collateral.

## Open Questions

- Should dragging a **root project** onto a task use the same rules (it does — any node can become any parent/sibling)? Confirmed yes by the proposed scope ("all nodes are movable").
- **Preserve selection after a move?** The outline re-renders after a move and selection is transient (as for status/indent today), so the moved node is not left selected. If the user wants the moved node to remain selected after the drop, that is a follow-up that would carry a `selected`/`selected-head` re-application in `reloadOutline`.
