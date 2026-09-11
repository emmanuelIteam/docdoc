## Why

Marking a project or task with many nested sub-tasks as "done", "in progress", or "todo" is tedious: the user must change the status line by line. Because a line and all of its sub-lines can now be selected in one click, the natural next step is to let a single status action from the context menu apply to the task AND all of its selected sub-tasks at once.

## What Changes

- **Status actions apply to the selected subtree.** When a task line and its sub-lines are selected and its context menu is shown, clicking one of the status actions (todo / in progress / done) now sets that status on the clicked line **and** recursively on every descendant sub-task in its subtree.
- **Unselected tasks unchanged.** A status action on a line that is not selected (or a line with no selected children) still changes only that line's status, exactly as today — so a lone line behaves as before.
- **All three statuses cascade.** The same behavior applies whether the chosen action is "todo", "in progress", or "done".
- **One server round-trip.** The whole subtree update is computed and persisted on the server in a single request; no per-node request is made.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `node-status-tracking`: a new requirement "Apply a status to a line and its sub-lines" is added. When a line and its sub-lines are selected and its context menu is shown, picking a status action applies that status to the line and to every descendant sub-task at every depth.

## Impact

- **`server.js`**: `setStatus(id, status)` must set the status on the target node **and** recursively on all of its descendants, and the re-rendered outline must reflect the new status on every affected line. `VALID_STATUSES` validation is unchanged.
- **`public/app.js`**: unchanged. The context menu already posts to `/api/nodes/:id/status` and re-renders the whole outline, so a single click on the head line's status button already reaches the endpoint. No new client logic is required.
- **`public/style.css`**: unchanged. The existing `.status-in-progress` / `.status-done` title styles already render the new status on each affected line once the server returns the updated outline.
- **No API shape change**: the endpoint and request/response contract stay identical (same path, same `status` body field, same HTML fragment response).
