## Context

The outliner renders a hierarchical bullet list where each line (`.line`) is a node. Selection is currently a purely client-side UI state: clicking the `.bullet` selection button toggles the `selected` class on that single line (`public/app.js` single-click handler). The `selected` class drives two visual effects: a highlight background and the context menu (`.line.selected .menu { display: flex; }`).

The user wants selecting a line to also select all of its sub-lines, so a whole branch can be selected in one click to act on a project and all of its tasks.

The rendered DOM (from `server.js renderNode`) already nests descendants correctly:

```
<li class="node">
  <div class="line" data-id="..."> <button class="bullet"> <span class="title"> <div class="menu">
  <ul class="children"> ... nested <li class="node"> ... </ul>
</li>
```

Selection state is not persisted on the server and is not part of any data model.

## Goals / Non-Goals

**Goals:**
- Selecting a line by its selection button selects that line and all of its descendant lines (the whole subtree).
- Every selected sub-line is fully selected: highlighted and showing its own context menu.
- Clicking the selection button again deselects the whole subtree.
- Leaf lines (no children) keep the existing select/deselect behavior.
- Keep selection a client-side UI state; no server persistence.

**Non-Goals:**
- No batch operations on the selected subtree yet (e.g., bulk status change, delete) — only the selection state changes.
- No distinct visual state for a "partially selected" or "parents-only" selection.
- No server-side or API changes; no data-model changes.
- Not addressing the in-flight `toggle-collapse-on-bullet` double-click collapse behavior beyond noting its interaction (see Risks).

## Decisions

- **Apply subtree selection exclusively in the client.** Selection is already a client-side concern and the DOM already nests descendant `.line` elements, so there is no reason to touch `server.js` or any API. The change is localized to the single-click handler in `public/app.js`.

- **Scope descendants from the clicked line's `li.node`.** The descendants of a line are not children of the `.line` div itself — they live in the sibling `.children` `<ul>` under the same `li.node`. So the handler walks up to the enclosing `.node` and selects all `.line` elements inside it:
  ```js
  const node = line.closest('.node');
  node.querySelectorAll('.line').forEach(l => l.classList.toggle('selected'));
  ```
  `node.querySelectorAll('.line')` returns the clicked line plus every descendant `.line` at every depth, which is exactly the subtree. This cleanly explains why we scope from `.node` rather than from `.line`.

- **Reuse existing `.selected` styling unchanged.** Because a fully-selected descendant is meant to behave exactly like the clicked line, the existing rules (`.line.selected` highlight and `.line.selected .menu { display: flex; }`) already produce the desired result. No new CSS is required.

- **Toggle semantics.** One approach considered was a three-state (unselected / parent-selected-only / fully-selected), but the chosen requirement is a simple per-line toggle applied to the subtree: clicking selects or deselects the whole subtree at once, and each line behaves fully when selected.

## Risks / Trade-offs

- **[Large subtrees open many context menus]** → Selecting a big project opens a menu on every descendant line at once, which can be visually noisy. This is the explicitly chosen behavior ("fully selected, menu opens"), so it is accepted as a deliberate trade-off. *Mitigation:* flagged as a candidate to revisit (e.g., open a menu only on the clicked line, or a slimmed "subtree selected" style) if it proves disruptive.

- **[Single-click select vs double-click collapse interaction]** → The in-flight `toggle-collapse-on-bullet` change makes double-clicking the selection button collapse/expand a node. A double-click also emits two single clicks, which could flip selection twice (on then off) before the collapse runs. *Mitigation:* this risk already exists today for single-line selection and is orthogonal to this change; it should be resolved in that change (e.g., debounce or distinguish click count) and is noted here so implementers coordinate.

- **[Independent subtree toggles]** → Because each line toggles its own subtree, a nested line can be "selected" even if its ancestor is deselected, and so on. This is consistent with the per-line toggle model and acceptable; no hierarchical invariant is enforced.

## Migration Plan

- Purely a client-side behavior change in `public/app.js`. No schema, DB, endpoint, or dependency migration is required.
- Rollback: revert the single-click handler change in `public/app.js`; the previous single-line selecting behavior is restored with no other collateral.

## Open Questions

- (none — resolved in the proposal step) The user confirmed that sub-lines are "fully selected, menu opens", so descendant lines show their own context menu rather than being highlighted without a menu.
