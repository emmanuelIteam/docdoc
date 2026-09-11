## Context

In `public/app.js`, the bullet click handler toggles the `selected` class on the clicked `.line` and on every descendant `.line` (its whole subtree). The CSS rule `.line.selected .menu { display: flex; }` then reveals a context menu on every selected line, so selecting a head line shows an identical menu on each of its sub-lines — a stack of menus that is visually noisy.

## Goals / Non-Goals

**Goals:**
- Keep sub-lines highlighted (selected) when the head line is clicked (per the user's choice).
- Show the context menu only on the clicked head line, not on its sub-lines.
- Make the smallest possible change to the client.

**Non-Goals:**
- No change to selection granularity (the whole subtree is still selected).
- No change to the menu's actions, endpoints, persistence, or the rename/double-click/collapse behavior.
- No change to `server.js` or the data model.

## Decisions

**D1 — Add a `selected-head` marker on the clicked line.** In the bullet click handler, after toggling `.selected` on the subtree as today, set `selected-head` on the clicked line when it is selected and clear `selected-head` from all other lines in that subtree; remove `selected-head` from the clicked line when it is deselected.
*Alternative considered:* `:has()`/data-attribute selectors — rejected as less explicit and less widely supported; a dedicated class tied to the exact clicked line is the clearest contract.

**D2 — Reveal the menu only for the head line.** Change the menu-reveal rule from `.line.selected .menu { display: flex; }` to `.line.selected-head .menu { display: flex; }`. The `.line.selected { background: #eef2ff; }` highlight rule is untouched, so sub-lines stay highlighted.
*Alternative considered:* `.line.selected:not(.selected-head) .menu { display: none; }` — rejected as more convoluted than a single positive rule.

**D3 — Keep the existing toggle semantics.** Clicking an already-selected head still toggles the whole subtree off; because the head also loses `selected-head`, the menu disappears with it.

**Edge note — nested heads:** clicking a new head adds `selected-head` only to that line within its own subtree, and the new head's sub-lines are stripped of any `selected-head` so they never show a menu while their ancestor is the head. A previously selected head in a different branch keeps its marker, which is the existing multi-branch selection behavior and is out of scope here.

## Risks / Trade-offs

- **Menus disappear from sub-lines** → Intended, per the request. Sub-lines remain highlighted so the selection is still visible.
- **A head selected in another branch keeps its menu** → Pre-existing multi-selection behavior, unchanged by this request (which concerns one head line and its sub-lines).
- **`selected-head` could linger after a re-render** → That cannot happen in practice: htmx swaps the whole `#outline`, discarding all classes; each selection starts fresh.

## Migration Plan

Single step, no data migration:
1. Update the bullet click handler in `public/app.js` to set/clear `selected-head` on the clicked line.
2. Update the one CSS reveal rule in `public/style.css`.
Rollback: revert those two edits. No schema or endpoint change.

## Open Questions

- None material.
