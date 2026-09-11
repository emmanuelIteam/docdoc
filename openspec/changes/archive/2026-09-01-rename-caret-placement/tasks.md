## 1. Client: place the caret at the click position

- [x] 1.1 In `public/app.js`, add a `caretOffsetAtPoint()` helper that returns the character offset of the click within the title (`document.caretPositionFromPoint`, with `caretRangeFromPoint` fallback).
- [x] 1.2 In `startRename()`, compute the caret offset and set it via `setSelectionRange(offset, offset)` instead of `input.select()`.
- [x] 1.3 Defer the caret placement to `requestAnimationFrame` and guard against the field already being replaced.
- [x] 1.4 Pass `e.clientX`/`e.clientY` from the click handler into `startRename()`.
- [x] 1.5 Confirm the caret opens at the clicked character (start/middle/end) with no text selected.

## 2. Client: align the inline-edit baseline

- [x] 2.1 In `public/style.css` `.title-input`, set `line-height: 1.25` (matching `.title`) so the caret in edit mode sits on the same baseline as the title text.
- [x] 2.2 Confirm the caret sits on the title baseline, not below the click point.

## 3. Spec delta

- [x] 3.1 Add the caret-at-click-position scenario to « Rename a node » in `specs/node-management/spec.md`.

## 4. Verification

- [x] 4.1 Click a title at its start/middle/end and confirm the caret opens exactly there, with no text selected.
- [x] 4.2 Confirm typing edits the title at that point.
- [x] 4.3 Confirm Enter saves, Escape cancels, and clicking elsewhere (blur) commits, as before.
