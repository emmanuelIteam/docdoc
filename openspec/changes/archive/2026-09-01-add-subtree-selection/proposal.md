## Why

Selecting a line in the outliner today only selects that single line, which is tedious when a project has many nested tasks. Users want to select a whole branch at once so they can act on a project and all of its tasks/sub-tasks in one click instead of line by line.

## What Changes

- **Clicking a line's selection button now selects the line AND all of its sub-lines** (its entire descendant subtree). This is the desired behavior in the story: "la ligne et les sous-lignes sont également sélectionnées".
- **Fully-selected behavior**: every selected sub-line behaves exactly like the clicked line — each is highlighted as selected and shows its own context menu. No sub-line is treated differently from the line that was directly clicked.
- **Toggle off**: clicking the selection button of an already-selected line deselects the line and all of its sub-lines, returning them to the unselected state.
- **Leaf lines unchanged**: a line with no children still simply selects/deselects itself.
- **No server-side selection persistence**: selection stays a client-side UI state (the `.selected` class), as it is today; this change only propagates that state to descendants.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `project-outliner`: a new requirement "Select a line with its sub-lines" is added. Selecting a line by its selection button now also selects every descendant line, and each selected line is fully selected (highlighted and shows its context menu). Clicking again deselects the whole subtree.

## Impact

- **`public/app.js`**: the single-line selection click handler (`.bullet` → toggle `.selected` on the closest `.line`) must also toggle `.selected` on every descendant `.line` element within the node's subtree.
- **`server.js`**: unchanged. The rendered DOM already nests descendant `.line` elements inside `.children` `<ul>`s, so subtree selection is applied client-side by walking descendants; no server or API change is needed.
- **`public/style.css`**: unchanged. `.line.selected` already shows the background highlight and `.line.selected .menu { display: flex; }` already reveals the context menu for any selected line, so fully-selected descendants inherit the existing styling with no new rules.
- **No API changes**: selection is a client-side state; no endpoint or data-model change is required.
