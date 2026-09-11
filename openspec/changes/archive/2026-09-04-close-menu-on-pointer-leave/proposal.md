## Why

Today selecting a line reveals a context menu that stays open indefinitely: the menu is shown by the persistent `.selected-head` class, so it (and the selection highlight) remain on screen long after the pointer has moved away. The user wants the menu to disappear as soon as the pointer leaves the selected line, so the outline stays clean and the menu is only present while the user is actually interacting with that line.

## What Changes

- **Context menu closes on pointer leave**: when the pointer moves off the selected head line, the context menu is no longer displayed.
- **Selection is cleared with the menu**: because the app's invariant is "a selected line shows its menu", leaving the line also clears the whole selection (the highlight goes away), so no line is left in a "selected but menu-less" state.
- **The menu stays open while the user interacts with it**: the menu is anchored above the line and is a DOM child of it, so moving the pointer onto the menu keeps it open and its actions stay clickable. A small transparent hover-bridge fills the 2px gap between the line and the menu so the pointer can travel onto the menu without crossing a dead zone that would close it.
- **No change to selection semantics, actions, or data**: choosing a line, narrowing to head-only, and all menu actions behave as today; only the "when the menu disappears" trigger changes.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `project-outliner`: the "Show a context menu on hover or selection" requirement is updated so the context menu is displayed only while the pointer is on the selected line (or its menu) and closes, clearing the selection, when the pointer leaves it.

## Impact

- **`public/app.js`**: add a delegated `mouseout` handler that clears `.selected` / `.selected-head` when the pointer leaves a `.line.selected-head` and is not moving onto that line's `.menu` descendant.
- **`public/style.css`**: add a transparent hover-bridge (`.menu::after`) so the pointer can move between the line and its above-anchored menu without leaving the interactive region.
- **`server.js`**: update the `.hint` text to mention that moving the pointer off the selected line closes its menu and clears the selection.
- **No API, data-model, or dependency changes.**
