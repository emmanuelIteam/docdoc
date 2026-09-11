## Why

Clicking a line's selection button today selects the head line and its whole subtree, and clicking it again deselects the whole subtree at once. There is no way to act on a parent (head) task without also acting on all of its sub-tasks — e.g. to mark the umbrella task "done" while each sub-task stays open. The user wants a two-stage selection on the head line: the first click selects the head + subtree, and a second click on the already-selected head line narrows the selection to that single head line. Once only the head is selected, the status actions (to-do / in progress / done) apply to that head line alone instead of cascading to the whole subtree.

## What Changes

- **First click (unchanged)**: clicking a line's selection button selects the head line and all of its sub-lines (its whole descendant subtree); the context menu appears on the head line only and each selected sub-line stays highlighted.
- **Second click on the head line (new)**: clicking the selection button of the already-selected head line narrows the selection to that head line only — its sub-lines become deselected, the head line stays selected, and its context menu remains shown.
- **Status scope (new)**: when only the head line is selected, choosing a status action (to-do / in progress / done) changes that head line alone; its sub-lines are not affected.
- **Third click (new)**: clicking the selection button of the head line once more (already narrowed) deselects it entirely.
- **Leaf lines unchanged**: a line with no children still simply selects/deselects itself.
- **No server-side selection persistence**: selection remains a client-side UI state.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `project-outliner`: the "Select a line with its sub-lines" requirement is updated so that clicking the already-selected head line again narrows the selection to the head line only, and a further click deselects it. (Previously, clicking an already-selected line deselected the whole subtree on the second click.)
- `node-status-tracking`: the "Apply a status to a line and its sub-lines" requirement is clarified so that a status action applies recursively to the whole subtree when the head and its sub-lines are selected, but applies to the head line only when its sub-lines are not selected.

## Impact

- **`public/app.js`**: the `.bullet` single-click handler is changed from a per-line toggle of the whole subtree to a three-state cycle (nothing → head + subtree → head only → nothing).
- **`server.js`**: the status endpoint and `setStatus` become scope-aware. Each status button carries its scope as an htmx `js:` expression that reads the live selection at request time: if the head line has a sub-line selected the scope is `subtree` (the status cascades), otherwise it is `head` (the status applies to the head line only).
- **`public/style.css`**: no rule changes are required. `.line.selected` keeps the highlight and `.line.selected-head .menu { display: flex; }` keeps the menu on the head line.
- **No API or data-model changes** beyond the `scope` parameter on the existing status endpoint.
