## Why

Clicking the head (parent) line's selection button currently selects the whole subtree AND shows a context menu on every selected sub-line. For a task made of many sub-tasks this produces a stack of identical menus — one per sub-line — which is visually noisy and hard to use. The user wants the sub-lines to stay highlighted (selected) but the context menu to appear only on the head line that was clicked.

## What Changes

- **Menu on the head line only**: clicking a line's selection button still highlights that line and all of its sub-lines (unchanged), but the context menu is shown only on the clicked (head) line. Sub-lines are highlighted and no longer show their own menu.
- **New `selected-head` marker**: the clicked line is flagged as the selection head; the context menu is rendered only for the selected head line.
- **Deselection unchanged**: clicking an already-selected line still deselects the whole subtree, and no menu is shown.
- **No change to actions, endpoints, or data**: only the client-side selection/menu-display rule changes.
- **BREAKING (UI)**: previously every selected sub-line showed its own context menu; now only the head line does. Sub-lines remain highlighted.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `project-outliner`: the "Select a line with its sub-lines" requirement changes so that sub-lines are still highlighted when the head is selected, but only the head line shows its context menu (sub-lines no longer show their own menus).

## Impact

- **`public/app.js`**: in the bullet click handler, after toggling `.selected` on the subtree, add a `selected-head` class to the clicked line (and clear it from its sub-lines) when it is selected, and remove it when the line is deselected.
- **`public/style.css`**: change the menu-reveal rule from `.line.selected .menu { display: flex; }` to `.line.selected-head .menu { display: flex; }`. The `.line.selected { background: ... }` highlight rule is unchanged so sub-lines stay highlighted.
- **`server.js`**, **backend/API**, **data**: unchanged.
- **No dependency changes**.
