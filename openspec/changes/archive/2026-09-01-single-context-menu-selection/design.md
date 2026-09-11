## Context

The `public/app.js` bullet click handler currently toggles `.selected` on the clicked line and its subtree, then marks only the clicked line as `.selected-head` (the line whose menu is shown). Because `.selected-head` is cleared only within the clicked line's subtree, selecting a head in another branch leaves the previous head's `.selected-head` in place, so several menus can appear simultaneously (the CSS shows a menu for every `.line.selected-head`).

## Goals / Non-Goals

**Goals:**
- Show only one context menu at a time.
- Clicking a new line closes the previous line's menu and opens the new one.
- Deselect the previously selected line entirely (single active selection, per the user's choice).

**Non-Goals:**
- No change to sub-line highlighting within a selection (sub-lines stay highlighted).
- No change to the menu's content, actions, endpoints, or data.
- No change to the double-click collapse or inline-rename behavior.
- No change to the CSS reveal rule.

## Decisions

**D1 — Clear the whole selection before applying the new one.** In the bullet click handler, first remove `.selected` and `.selected-head` from every `.line` in the document (`document.querySelectorAll('.line.selected, .line.selected-head')`), then add `.selected` to the clicked line's subtree and `.selected-head` to the clicked line. This guarantees exactly one head, hence exactly one menu.
*Alternative considered:* only clearing `.selected-head` (leaving the previous line highlighted) — rejected because the user explicitly chose full deselection.

**D2 — Preserve the toggle-off behavior.** If the clicked line is already `.selected-head`, the click clears everything and does not re-select, so the whole subtree deselects and its menu closes.

**D3 — No CSS change.** The existing `.line.selected-head .menu { display: flex; }` rule already shows the single menu, and `.line.selected { background: #eef2ff; }` keeps sub-lines highlighted. With a document-wide single head, only one menu is visible.

## Risks / Trade-offs

- **Double-click toggles selection twice (select then deselect) before collapsing** → Existing interaction quirk; the two single-clicks net to no selection and the double-click collapses as intended.
- **Clicking a sub-line re-selects it as the new head** → This is the intended single-selection model; the previous selection is replaced by the sub-line and its subtree.
- **No multi-selection support** → Accepted; the user requested one selection / one menu at a time.

## Migration Plan

Single step, no data migration: update the bullet click handler in `public/app.js` only. No CSS or backend change. Rollback: revert the `app.js` edit.
