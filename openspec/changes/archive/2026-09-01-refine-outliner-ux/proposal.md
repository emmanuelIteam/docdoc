## Why

The outliner works end to end but its interactions are clunky and two behaviors are visibly broken: bold/italic formatting never renders on lines, and the "+ Tâche" action is unreliable to click because the context menu opens on hover and vanishes under the cursor. The user also wants a tighter layout and the ability to fold a line by double-clicking. This change refines those interactions and fixes the two bugs.

## What Changes

- **Context menu on selection only**: the menu appears only when a line is selected, no longer on hover — so menu actions are clickable and the screen stays clean.
- **Double-click to fold/unfold**: double-clicking a line toggles its collapse/expand state.
- **Tighter layout**: reduce the vertical spacing between lines.
- **Fix bold/italic rendering**: the status class is applied to the line title so "in progress" (bold) and "done" (italic) are actually visible.
- **Fix "+ Tâche"**: the "add child" action reliably creates and reveals a new child line (selection-based menu keeps it open; buttons are explicit `type="button"`).

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `project-outliner`: Context menu now shows only on selection (not hover); double-click toggles collapse/expand; lines are rendered with reduced vertical spacing.
- `node-status-tracking`: Bold/italic status formatting is applied to the line title text and is actually visible.
- `node-management`: The create-a-child action reliably creates and reveals a new descendant line.

## Impact

- **`server.js`**: `renderNode` applies the status class to the title element instead of the line container.
- **`public/style.css`**: context menu shown only for `.line.selected` (drop `:hover` trigger); reduced `.line` vertical padding; ensure `.title.status-*` styles apply.
- **`public/app.js`**: add a double-click handler on lines to toggle collapse; ensure menu buttons are `type="button"`; no dependency or API changes.
- **Backend/API**: unchanged (existing endpoints already work).
