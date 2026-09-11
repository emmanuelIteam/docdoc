## Why

The context menu shown on a selected line is a vertical stack of labeled buttons (`À faire`, `En cours`, `Terminé`, `Indenter`, `Désindenter`, `+ Tâche`, `Supprimer`). It is wide (a 9.5rem minimum column), opens *below* the selected line, and its text labels add visual clutter and force the menu to be large relative to the line it annotates. The user wants a compact toolbar: icon-only action buttons, laid out horizontally, and anchored **above** the selected line so it reads as a lightweight annotation of the line rather than a dropdown covering content beneath it.

## What Changes

- **Icon-only menu items**: every context-menu action is rendered as a single icon glyph with no text label. A `title` tooltip on each button preserves the human-readable action name for hover/accessibility.
- **Menu above the selected line**: the menu is anchored so its bottom edge sits just above the selected line, instead of dropping below it.
- **Horizontal layout**: the menu becomes a single horizontal toolbar (`flex-direction: row`) instead of a vertical list (`flex-direction: column`).
- **Status icons**: the three status actions become the glyphs `○` (à faire), `◐` (en cours), `●` (terminé); the currently applied status is highlighted.
- **Reindent / add / delete icons**: indent `→`, outdent `←`, add-child `+`, delete `🗑`.
- **No behavior change**: the underlying actions, htmx endpoints, and persistence are unchanged; only the presentation (label → icon, position, orientation) changes.
- **BREAKING (UI)**: menu item text labels are removed in favour of icons.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `project-outliner`: the "Show a context menu on hover or selection" requirement changes so the menu is rendered as an icon-only, horizontal toolbar positioned above the selected line (instead of a vertical labelled menu below the line).

## Impact

- **`server.js`**: `renderNode` emits each menu action as an icon-only button (with a `title`) — status icons, `→`/`←` reindent, `+` add child, `🗑` delete. The existing htmx attributes and endpoints are unchanged.
- **`public/style.css`**: `.menu` switches to `flex-direction: row`, is anchored above the line (`bottom: calc(100% + 2px)`, `top` removed), and drops `min-width`; `.menu-item` becomes an icon-sized button (square-ish, centred, padded) while keeping the `.active` status highlight and `.danger` delete colour.
- **`public/app.js`**: unchanged — selection, rename, and double-click collapse behaviour are unaffected.
- **No backend or API changes**: the `/status`, `/indent`, `/outdent`, create-node, and delete-node endpoints keep their contracts.
- **No data-model changes**.
