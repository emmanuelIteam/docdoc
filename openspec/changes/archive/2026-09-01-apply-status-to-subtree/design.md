## Context

The outliner is an htmx + Express server (`server.js`). Nodes are persisted as a nested `children` tree in `data/projects.json`. The context menu on a selected line renders status buttons that POST to `/api/nodes/:id/status` with a `status` body field; the server calls `setStatus(id, status)` and re-renders the whole outline as an HTML fragment (`renderOutline()`).

Today `setStatus(id, status)` only sets `node.status` on the matched node:
```js
function setStatus(id, status) {
  if (!VALID_STATUSES.includes(status)) return null;
  const found = findNode(id);
  if (!found) return null;
  found.node.status = status;
  return found.node;
}
```

Selection is a client-side concept: the line and its whole subtree are highlighted (`.selected`), and the context menu is shown on the head line (`.selected-head`). The rendered DOM nests descendant `.line` elements in `.children` `<ul>`s, so a status change must affect the subtree on the server side, not in the DOM.

## Goals / Non-Goals

**Goals:**
- Apply a status action chosen in the context menu to the clicked task line AND recursively to every descendant sub-task at every depth.
- Cascade for all three statuses (todo, in progress, done).
- Keep the change server-side and localized to the status handling path; no client or CSS change.
- Keep the existing behavior for a line with no selected sub-lines (only that line changes).
- Persist the whole subtree update in a single `persist()` call.

**Non-Goals:**
- No change to the other context-menu actions (indent, outdent, add task, delete) — only status cascades.
- No new endpoint or change to the request/response contract.
- No change to selection semantics (client-side) or to the `project-outliner` capability.
- No change to how a lone/leaf line's status is set.

## Decisions

- **Cascade in `setStatus`, not in the route or client.** `setStatus(id, status)` already owns "set one node's status". Extending it to walk the node's `children` recursively keeps the route (`POST /api/nodes/:id/status`), validation, and re-render untouched. Because the status menu button lives on the head line and the whole outline re-renders, the client already sends exactly one request with the right `id` and `status`.

- **Use a recursive helper to apply status to the subtree.** A small `setSubtreeStatus(node, status)` mutates `node.status` and then recurses over `node.children`. The public entry point validates the status once, finds the target, then calls the helper on that node. This makes the cascade explicit and testable and avoids duplicated recursion inside `setStatus`.

- **Validate once, then recurse freely.** `VALID_STATUSES.includes(status)` is checked before any mutation, so an invalid value never partially updates the subtree. The recursion itself does not re-validate.

- **Compute and persist in one call.** `setStatus` mutates every affected node in memory, then the existing route calls `persist()` once. The re-rendered `renderOutline()` returns the outline with every affected line carrying the new status, so no extra round-trip or client logic is needed.

- **Leaf / no-children behavior falls out naturally.** A node with no children recurses zero times; a node selected alone still only changes itself. No special-casing is required, which keeps the helper simple and matches the "selected line without selected sub-lines" scenario.

## Risks / Trade-offs

- **[Large subtrees change many statuses at once]** → Deselecting is required to scope a change to a single line; otherwise the whole branch is updated. This is the explicitly requested behavior (from the scenario), so it is accepted. *Mitigation:* only the currently selected head line (with its selected subtree) triggers the cascade, and a user can deselect first to target one line.

- **[Potential for very deep/wide recursion]** → A deeply nested or very wide subtree means a recursive walk over all descendants. For a personal-project outliner this is trivially small, so no stack/performance concern. *Mitigation:* none needed; if it ever matters, the recursion can be flattened, but it is out of scope.

- **[Status menu shows only on the head line]** → Only the head line carries the status buttons, so the cascade is always unambiguous (one subtree per action). This matches the current selection design and the scenario wording ("son menu contextuel est affiché").

## Migration Plan

- Purely a server-side behavior change in `server.js` (`setStatus` and a new `setSubtreeStatus` helper). No schema, DB, endpoint, dependency, or client change is required.
- Rollback: revert `setStatus` to set only the matched node's status and remove the helper; the previous single-line status behavior is restored with no other collateral.

## Open Questions

- (none — resolved) The user confirmed the cascade applies to **status actions only**, not to the other context-menu actions (indentation, suppression, ajout).
