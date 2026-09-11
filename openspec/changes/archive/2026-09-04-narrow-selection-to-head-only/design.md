## Context

The outliner renders a hierarchical bullet list where each line (`.line`) is a node. Selection is a purely client-side UI state in `public/app.js`: clicking the `.bullet` selection button toggles `selected` on the clicked line, and (since the `add-subtree-selection` change) on all descendant `.line` elements within the enclosing `li.node`. The `menu-only-on-head-line` change added a `selected-head` class so only the head line shows its context menu (`.line.selected-head .menu { display: flex; }`).

The status action buttons are rendered server-side in `server.js renderNode`. They call `POST /api/nodes/:id/status` with `hx-vals={"status":...}` and the server's `setStatus` always cascades the status recursively to the whole subtree via `setSubtreeStatus`. The `node-status-tracking` spec already anticipates a head-only case ("a selected line without selected sub-lines changes only itself"), but today it is unreachable for a parent line because there is no way to select a parent without its sub-lines.

The user wants a two-stage selection on the head line: first click selects head + subtree; a second click on the already-selected head line narrows the selection to the head line only; a status action then applies to the head line alone.

## Goals / Non-Goals

**Goals:**
- Clicking the selection button of an already-selected head line narrows the selection to the head line only (sub-lines deselect; head stays selected and keeps its menu).
- When only the head line is selected, a status action applies to that head line only and not to its sub-lines.
- A further click on the narrowed head line deselects it.
- Keep selection a client-side UI state; no server persistence.

**Non-Goals:**
- No new batch/aggregate operations beyond the existing status action.
- No change to how the other menu actions (indent, outdent, add child, delete) behave — they already target a single node by id and do not cascade.
- No change to the visual styling of selected/highlighted lines.
- No persistence of the narrowed state across a server re-render (selection is transient, as today).

## Decisions

- **Three-stage cycle on the head line.** The single-click handler on `.bullet` walks to the enclosing `.node`, computes the subtree `.line`s, and transitions by current state:
  - not selected → add `selected` to every subtree line and `selected-head` to the head;
  - selected as head with sub-lines selected → remove `selected` from every sub-line, keep `selected` + `selected-head` on the head;
  - selected as head only → clear all selection.

  The "is a sub-line selected" test is `node.querySelector('.children .line.selected')`, which is true only while the subtree is selected; the head line itself is not inside a `.children` `<ul>`, so it cannot masquerade as a sub-line.

- **Scope is derived at request time, not stored.** The server re-renders the whole outline after every status action, so selection state is intentionally transient and the server cannot infer the scope. Instead of carrying scope through extra state, each status button embeds an htmx `js:` expression in `hx-vals` that reads the live DOM at the moment of the request: `scope: this.closest(".node").querySelector(".children .line.selected") ? "subtree" : "head"`. When the head and its sub-lines are selected this evaluates to `subtree`; when the selection is narrowed to the head line it evaluates to `head`, and the status endpoint then applies the status to that single node.

- **`setStatus` becomes scope-aware.** `setStatus(id, status, scope)` applies to the single node when `scope === 'head'`, otherwise cascades recursively (`setSubtreeStatus`). The route maps any value other than `head` to `subtree` for robustness/back-compat.

- **Node-only status is a direct assignment.** For `scope === 'head'` the function assigns `node.status = status` and returns without recursing — this is exactly the existing `setSubtreeStatus` behaviour restricted to the root node.

## Risks / Trade-offs

- **[Scope is read from the live DOM at request time]** → The `js:` expression reads the selection classes the instant the status action is triggered, so it always reflects the current selection. After a status action the outline is re-rendered and the selection is cleared, so the next interaction starts fresh from `subtree` scope — correct, since a freshly loaded page has no selection.

- **[Double-click collapse interaction]** → A double-click on the bullet emits two single clicks before the collapse toggle; this existed before and is orthogonal. The single-click handler remains idempotent within a double-click (the two clicks cycle selection, but the collapse request re-renders the outline regardless). No new coordination is introduced here.

- **[A narrowed parent has live sub-lines that are not visually highlighted]** → This is the intended "head only selected" state and is visually distinct (only the head is highlighted).

## Migration Plan

- Client behavior in `public/app.js`; server behavior in `server.js` (scope param + the `js:` scope expression on the status buttons). No schema, DB, or dependency migration.
- Rollback: revert the `.bullet` click handler in `app.js` and the scope handling in `server.js`; the previous whole-subtree select/deselect behavior is restored.

## Open Questions

- (none) The three-stage cycle (subtree → head only → deselect) is the chosen default for the "click again" behaviour; the second-click narrowing and the status-scope behaviour are the requirements driving this change. If the user prefers a different third-click outcome (e.g. cycling back to the subtree), it is a one-line change.
