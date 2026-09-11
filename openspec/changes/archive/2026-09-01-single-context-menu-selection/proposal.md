## Why

Selecting a head line shows its context menu on that line only, but selecting a line in another branch currently keeps the previously selected line's menu open, so several context menus can be shown at once. The user wants only one context menu visible at a time: clicking a new line closes the previous line's menu and opens the new one, deselecting the previous line entirely.

## What Changes

- **Single active selection**: clicking a line's selection button deselects any previously selected line (and its whole subtree) and selects only the clicked line and its subtree.
- **One context menu at a time**: the previously selected line's menu is closed; the newly selected line shows its context menu (only on the head line).
- **Clicking an already-selected head line** still deselects it, so no menu is shown.
- **No change to sub-line highlighting within a selection**: the sub-lines of the selected head stay highlighted. No change to the menu's actions, endpoints, or data.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `project-outliner`: the "Select a line with its sub-lines" requirement changes so that selecting a line deselects the previously selected line (and its subtree), so only one context menu is shown at a time.

## Impact

- **`public/app.js`**: the bullet click handler clears all `.selected` / `.selected-head` classes document-wide before selecting the clicked line's subtree and marking it as the head; clicking an already-selected head line deselects it.
- **`public/style.css`**, **`server.js`**, **backend/API**, **data**: unchanged (the existing `.line.selected-head .menu { display: flex; }` rule already shows one menu per head).
