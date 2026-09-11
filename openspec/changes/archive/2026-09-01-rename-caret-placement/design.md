## Context

The outliner is a single Node/Express app (`server.js`) that renders the outline server-side with htmx. The rename interaction is entirely client-side: `public/app.js` `startRename()` swaps the clicked `.title` span for a `.title-input` text field and focuses it. The title is committed via `PUT /api/nodes/:id` and the outline re-rendered through `reloadOutline()`.

The user reported that clicking a title to rename it currently selects the whole title (`input.select()`), whereas they want the caret placed at the click position within the text (natural text-editing behavior). A minor `line-height` mismatch (`.title-input` inherits `line-height: 1.5` via `font: inherit` while `.title` uses `1.25`) can also render the caret slightly below the title baseline.

## Goals / Non-Goals

**Goals:**
- When a line enters rename mode, place the edit caret at the character offset of the click on the title.
- Do not select the whole title on entry into edit mode.
- Keep the edit caret on the same baseline as the title text.
- Fully preserve the existing rename lifecycle: Enter saves, Escape cancels, blur commits, and the field width tracks the text.

**Non-Goals:**
- No change to the data model or persistence.
- No change to `PUT /api/nodes/:id` or any other endpoint contract.
- No change to selection, context menu, collapse, indent/outdent, add/delete, or status behaviors.
- No change to when rename is triggered (click on `.title`).

## Decisions

**D1 — Compute the click offset and place the caret there.** In `startRename()`, determine the character offset of the click on the title via `document.caretPositionFromPoint` (falling back to `document.caretRangeFromPoint`), normalize it into the `[0, title.length]` range, then set the input caret with `input.setSelectionRange(offset, offset)`. This reproduces the native click-to-place-caret behavior. *Alternative considered:* relying on the browser's default focus caret placement — rejected because a programmatically focused input places the caret at the end/start, not at the click point.

**D2 — Drop the select-all call.** Remove `input.select()` so the title is not selected on entry (the user's explicit requirement). *Alternative considered:* keep select-all — rejected as non-conforme.

**D3 — Defer the caret placement.** Apply `setSelectionRange` inside a `requestAnimationFrame` so the browser's own focus/caret handling after the click cannot reset it. Guard against the field being replaced before the frame fires (`done` set or `!input.isConnected`). *Alternative considered:* `setTimeout(0)` — equivalent timing; rAF is the conventional choice.

**D4 — Align the inline-edit baseline.** In `public/style.css`, set `line-height: 1.25` on `.title-input` (matching `.title`) so the caret sits on the title baseline. *Alternative considered:* leave the mismatch — rejected since it contributes to the « sous le clic » visual.

**D5 — Keep the click/dblclick document handlers and `sizeInput()` unchanged**, apart from passing `e.clientX`/`e.clientY` into `startRename`.

## Risks / Trade-offs

- **A deferred caret placement adds one frame of visual delay** before the caret appears at the click position — negligible and imperceptible during a click interaction.
- **`caretRangeFromPoint`/`caretPositionFromPoint` availability varies.** The helper falls back gracefully: if neither API exists or the click does not land within the title's text, the caret is placed at the end of the title, which is a safe default.
- **Multi-node titles.** The offset helper accounts for preceding sibling text nodes, so titles rendered from escaped entities map correctly.

## Migration Plan

Single step, no data migration: update `startRename()` and the click handler in `public/app.js`, adjust `.title-input` in `public/style.css`, and add the spec scenario. Rollback is reverting those files; there is no schema or endpoint change.

## Open Questions

- (none) — the select-all vs. caret-at-click question is resolved: caret is placed at the click position.
