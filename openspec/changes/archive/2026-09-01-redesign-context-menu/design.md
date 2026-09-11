## Context

The outliner is a single Node/Express app (`server.js`) that renders the outline server-side via htmx. Each line is produced by `renderNode()`, which emits a `.bullet` selection button, the `.title`, and a `.menu` context menu. The menu is a vertical stack of labelled buttons: three status actions (`À faire`, `En cours`, `Terminé`) and four structural actions (`Indenter`, `Désindenter`, `+ Tâche`, `Supprimer`). The `.menu` is absolutely positioned relative to the `.line` (`position: relative`) and currently renders **below** the line (`top: calc(100% + 2px)`), as a column (`flex-direction: column`) with a `min-width: 9.5rem`.

The change turns this labelled vertical dropdown into a compact, icon-only horizontal toolbar anchored **above** the selected line.

## Goals / Non-Goals

**Goals:**
- Remove the visible text labels from every menu action; keep only icon glyphs.
- Anchor the menu above the selected line (its bottom edge just above the line).
- Lay the menu out horizontally (`flex-direction: row`) as a single toolbar.
- Preserve the human-readable action name via a `title` tooltip on each button (hover/accessibility).
- Preserve the existing htmx attributes, endpoints, and persistence for every action.

**Non-Goals:**
- No behavior change to status, reindent, add-child, delete, rename, or selection.
- No data-model change and no backend/API contract change.
- No change to `public/app.js` (selection, rename, and double-click collapse are unaffected).
- No keyboard/screen-reader navigation overhaul beyond the `title` tooltips.
- No auto-scrolling to keep a top-anchored menu within the viewport when the selected line sits near the page top (documented as a known limitation).

## Decisions

**D1 — Render icon-only menu buttons in `renderNode`.** Replace the labelled `statusBtn(st, mark, label)` helper with an icon-only helper keyed off the status, and emit icon glyphs for the structural actions:
- Status: `○` (à faire), `◐` (en cours), `●` (terminé) — a natural empty → half → full progression, all monochrome text glyphs in the same range.
- Indent `→`, outdent `←` (deeper / shallower level), add-child `+`, delete `🗑` (trash).
- Each button keeps its `class="menu-item"` (plus `active` for the current status, `danger` for delete) and its `hx-*` attributes unchanged; it gains a `title` tooltip carrying the action name.
*Alternatives considered:* keep labels with a hidden span (rejected — adds DOM noise for no benefit); use an icon font/SVG sprite (rejected — adds a dependency to a dependency-free app; Unicode glyphs need no build step).

**D2 — Reposition and re-orient the menu via CSS only.** In `public/style.css`:
- `.menu`: replace `top: calc(100% + 2px)` with `bottom: calc(100% + 2px)` (anchor above the line); switch `flex-direction: column` → `row`; remove `min-width: 9.5rem` and `text-align: left` (no longer needed); add a small `gap`.
- `.menu-item`: become an icon-sized, centred button (`width`/`height ~1.8rem`, `display: inline-flex`, centre-aligned, `padding: 0`, `line-height: 1`) instead of a text label with left padding. Keep `.menu-item:hover`, `.menu-item.active`, `.menu-item.danger`, and `.menu-item.danger:hover`.
*Alternative considered:* re-layout in JS — rejected; CSS is sufficient and keeps behaviour server-rendered/htmx-friendly.

**D3 — Keep `public/app.js` unchanged.** The menu is revealed purely by the existing `.line.selected .menu { display: flex; }` rule; selection toggling is unchanged, and the double-click handler already ignores `.menu`. So the client behaviour needs no edits.

**D4 — Choose `🗑` for delete but allow a monochrome swap.** `🗑` is the most universally understood trash glyph, but it is a colour emoji that can look inconsistent beside the monochrome text glyphs. The CSS is font-agnostic, so switching to a monochrome glyph (e.g. `✕`) is a single char change in `renderNode` if visual consistency becomes a concern.

## Risks / Trade-offs

- **Top-anchored menu may overflow the viewport** → When the selected line is near the top of the page, an above-line menu can be clipped. Mitigation: the existing app scrolls a single page and the menu only appears on selection, so this is a minor, accepted limitation; an auto-flip (fall back to below) is deferred (see Open Questions).
- **Colour emoji (🗑) beside monochrome glyphs can look inconsistent** → Accepted; swap to a monochrome glyph is a one-character change. Status/progress glyphs are purposely monochrome and consistent.
- **Removing text labels lowers discoverability for new users** → Mitigated by the `title` tooltips on each button; this matches the user's explicit request for a compact icon-only toolbar.
- **Multiple stacked menus when a subtree is selected** → Each selected line still shows its own horizontal menu (existing multi-selection behaviour, unchanged); the top-anchored, compact layout makes this less visually noisy than the previous wide vertical menus.
- **Icon glyph choice is aesthetic and reversible** → Any glyphs can be swapped in `renderNode` without structural/CSS change.

## Migration Plan

Single step, no data migration:
1. Update `renderNode()` in `server.js` to emit icon-only, `title`-labelled menu buttons.
2. Update `.menu` / `.menu-item` in `public/style.css` (above-line anchor, horizontal layout, icon-sized items).
3. No changes to `public/app.js`, endpoints, or data.

Rollback: revert `server.js` and `public/style.css`; there is no schema or endpoint change, and existing persisted `status`/`collapsed` values remain valid.

## Open Questions

- **Delete glyph**: keep the colour trash emoji `🗑`, or standardise on a monochrome glyph (`✕`) for visual consistency with the other menu icons? Defaulting to `🗑` unless the user prefers a uniform monochrome set.
- **Viewport overflow**: should the menu auto-flip to below the line when there is no room above (top edge of the page)? Currently out of scope; can be added as a follow-up if it is observed in use.
- **Tooltip vs. visible label**: is a hover `title` sufficient, or should the active status also remain discoverable at rest (e.g. via the line title styling)? The status is already conveyed by the line title (bold/italic), so no extra affordance is planned.
