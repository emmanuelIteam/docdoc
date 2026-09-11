## Context

The outliner renders a hierarchical bullet list where each line (`.line`) is a node and the outline is re-rendered server-side by htmx after every mutation. Selection is a purely client-side UI state in `public/app.js`: clicking the `.bullet` selection button adds `selected` to the clicked line and its whole subtree, and adds `selected-head` to the clicked (head) line. The context menu (`.menu`) is revealed purely by CSS — `.line.selected-head .menu { display: flex; }` — so once a line is selected the menu (and the selection) stay on screen indefinitely, independent of the pointer.

The menu is a DOM child of `.line` and is anchored **above** it (`position: absolute; bottom: calc(100% + 2px)`), i.e. 2px above the line's top. The `node-status-tracking` status menu and the structural actions live in that menu and are clicked by moving the pointer onto it.

The user wants: given a line is selected and its context menu is shown, when the pointer leaves the line the menu is no longer displayed. Per the clarification, leaving the line also clears the selection (the highlight goes away), keeping the invariant that a selected line always shows its menu.

## Goals / Non-Goals

**Goals:**
- When the pointer leaves the selected head line, the context menu closes and the whole selection (`.selected` + `.selected-head`) is cleared.
- While the pointer is on the selected head line or on its menu, the selection and menu stay put, so the menu's actions remain usable.
- Keep the menu clickable across the 2px gap between the line and its above-anchored menu.

**Non-Goals:**
- No change to how selection is established (click the bullet) or to the narrow-to-head-only cycle.
- No change to the menu actions, endpoints, or data model.
- No server persistence of selection (selection stays transient, as today).
- No change to hover/selection highlighting rules beyond deselect-on-leave.

## Decisions

- **Detect "leaving the line" with a delegated `mouseout`, not per-element `mouseleave`.** htmx re-renders the whole outline after every mutation, so a listener attached to a specific `.line` element would be destroyed by the next render and need re-attaching. `mouseout` bubbles, so a single listener on `document` survives every re-render. The handler runs only when the event's target is (contained in) a `.line.selected-head`; it then inspects `relatedTarget`:
  - if `relatedTarget` is still inside the head line (moving between the line and its `.menu` child, or across the hover-bridge), the pointer has not left the line → do nothing;
  - otherwise (moving onto a sub-line, a neighbouring line, or off the outline) the pointer has left the head line → clear the whole selection.
- **Clear the whole selection on leave.** The handler removes `selected` and `selected-head` from every `.line` in the document. This hides the menu (no `.selected-head`) and clears the highlight (no `.selected`), matching the user's confirmed choice.
  - *Alternative considered:* only removing `selected-head` to hide the menu while keeping the highlight — rejected because it leaves a "selected but menu-less" line, contradicting the "selected ⇒ menu" invariant and the explicit confirmation to clear the selection.
- **Bridge the 2px dead zone with a transparent `::after` on the menu.** The menu sits 2px above the line, so moving from the line up to the menu crosses a strip that belongs to neither element, where the pointer would briefly be "outside" the line and could close the menu before reaching it. Adding `.menu::after { content: ''; position: absolute; top: 100%; left: 0; right: 0; height: 6px; }` keeps a contiguous hover region between the line and the menu; the strip is part of the menu (a DOM child of the line), so the pointer stays within the head line subtree the whole way up.
  - *Alternative considered:* removing the visual gap (`bottom: calc(100%)`) so the menu abuts the line — rejected because it changes the menu's current look, whereas a transparent bridge preserves the design and only affects hit-testing.
- **Deselect is purely client-side and does not re-render.** Clearing the classes is immediate and local, so it does not trigger a server round-trip. Any subsequent menu action or re-render re-creates a fresh, selection-free outline.

## Risks / Trade-offs

- **[`mouseout` fires when moving between children of the line]** → filtered by the `relatedTarget` containment check, so intra-line moves (including onto the menu) never clear the selection.
- **[The gap between the line and the above menu could close the menu on the way up]** → mitigated by the transparent `::after` hover-bridge, which extends the menu's hit area so the pointer never leaves the line subtree while travelling to it.
- **[Moving onto a selected sub-line counts as leaving the head line]** → intended: the selection clears as soon as the pointer leaves the head line, even onto a highlighted sub-line. This is the behaviour the user confirmed (full deselection).
- **[A menu action re-renders the outline and drops all selection classes]** → correct by design; the re-render also removes the `mouseout`-attached state, so no stale `selected-head` or listener survives. The next selection starts fresh.
- **[`relatedTarget` may be null (pointer leaves the window)]** → `head.contains(null)` is `false`, so leaving the window clears the selection. Acceptable — the pointer is genuinely gone.

## Migration Plan

- Client-only change: add the `mouseout` handler in `public/app.js`, the hover-bridge in `public/style.css`, and update the `.hint` text in `server.js`. No schema, DB, or dependency migration.
- Rollback: revert the `mouseout` handler and the `.menu::after` rule; the menu returns to being shown purely by the persistent `.selected-head` class.
