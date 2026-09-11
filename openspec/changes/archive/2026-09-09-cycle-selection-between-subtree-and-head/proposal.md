## Why

Clicking a task line's selection button today cycles through three states: not selected → head + its whole subtree → head only → not selected. A user who has narrowed the selection to the head line (e.g. to mark the umbrella task done without touching its sub-tasks) most often wants to act on the whole group again afterwards, so reaching the head-only state and then selecting a status action is awkward: the very next click silently clears the selection instead of returning to the full group. The user wants the selection on the head line to alternate between the group (the task + all of its sub-tasks) and the head line alone, so a third click re-selects the whole group rather than deselecting it.

## What Changes

- **Third click (changed)**: clicking the selection button of a head line that is selected with no sub-line selected now re-selects the head line and its whole descendant subtree, instead of clearing the selection. The head line keeps its context menu.
- **Selection becomes a two-state toggle on the head line**: repeated clicks alternate between (head + subtree selected) and (head line only selected). There is no longer a "deselect all" state reached by clicking the selection button.
- **First and second clicks unchanged**: the first click selects the head line + its whole subtree; the second click narrows the selection to the head line only.
- **Deselection unchanged**: moving the pointer off the selected head line (and off its menu) still clears the selection and closes the context menu.
- **Leaf lines unchanged**: a line with no children still toggles only itself on each click.
- **Status scope behavior unchanged**: when the group is selected a status action cascades to the whole subtree; when only the head line is selected it applies to the head line alone.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `project-outliner`: the "Select a line with its sub-lines and narrow to the head line" requirement is updated so that clicking the already-narrowed head line re-selects its whole subtree, making the head-line selection a two-state toggle (group ↔ head only) instead of a three-state cycle that ends in deselecting.

## Impact

- **`public/app.js`**: the `.bullet` single-click handler's third stage changes. Currently, after a head-only click the selection is simply cleared; it must re-select the head line's whole subtree instead (re-add `selected` to every `.line` of the `.node` and re-add `selected-head` to the head line).
- **`server.js`**: no change. The status scope is already derived at request time from whether the head line has a selected sub-line (`.children .line.selected`), which continues to distinguish the group-selected and head-only states.
- **`public/style.css`**: no change. `.line.selected` highlighting and `.line.selected-head .menu { display: flex; }` are unchanged.
- **No API or data-model changes.**

Note: this change modifies the same `project-outliner` behavior introduced by the archived change `narrow-selection-to-head-only`; it does not reopen that change but replaces its "third click deselects" scenario.
