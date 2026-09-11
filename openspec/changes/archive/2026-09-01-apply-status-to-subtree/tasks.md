## 1. Server-side subtree status cascade

- [x] 1.1 In `server.js`, add a `setSubtreeStatus(node, status)` helper that sets `node.status` and recurses over `node.children`.
- [x] 1.2 Update `setStatus(id, status)` so it validates `status` once, finds the node, then applies the status to that node and its whole subtree via the helper (instead of setting only the matched node).
- [x] 1.3 Confirm the `POST /api/nodes/:id/status` route still calls `persist()` once after the subtree update and re-renders the whole outline, so every affected line reflects the new status.

## 2. Verification

- [x] 2.1 Confirm that selecting a task line with sub-tasks and clicking a status action updates that line and all of its sub-lines.
- [x] 2.2 Confirm the status cascades to descendants nested at more than one depth.
- [x] 2.3 Confirm all three statuses (todo, in progress, done) cascade to the sub-lines.
- [x] 2.4 Confirm a selected line without selected sub-lines (e.g., a leaf) changes only itself.
- [x] 2.5 Confirm invalid statuses are still rejected (400) without partially updating the subtree.
- [x] 2.6 Confirm `server.js` has no other behavioral change and the other context-menu actions (indent, outdent, add, delete) still work.
