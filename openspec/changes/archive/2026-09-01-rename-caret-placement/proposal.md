## Why

Clicking a line's title to rename it currently enters edit mode but selects the whole title, and the editing caret (« curseur ») is not placed where the user clicked. The desired behavior is the natural text-editing one: clicking a title should open the edit field with the caret exactly at the click position within the text, so the user can edit precisely where they clicked — not have the whole text selected.

`startRename()` in `public/app.js` currently calls `input.select()` inside the click handler, which selects the entire title regardless of the click point. That is the wrong model for this interaction. Two things must change: (a) stop selecting the whole title, and (b) place the caret at the character offset corresponding to the click. A secondary issue is a vertical misalignment — `.title-input` inherits `line-height: 1.5` (via `font: inherit`) while `.title` uses `1.25`, which in the centered flex line can render the caret slightly below the title text.

We want entering edit mode to place the caret exactly at the clicked character, on the title baseline, with no text selected.

## What Changes

- **Place the caret at the click position instead of selecting the whole title.** In `startRename()`, compute the character offset of the click on the title (`document.caretPositionFromPoint` / `document.caretRangeFromPoint`) and set the input's caret there (`setSelectionRange(offset, offset)`), dropping the `input.select()` select-all call.
- **Defer the caret placement** to the next frame so the browser's own focus/caret handling cannot reset it.
- **Fix the inline-edit vertical alignment.** Align `.title-input`'s `line-height` with `.title` so the caret stays on the title baseline.
- **No data or API changes.**

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `node-management`: the « Rename a node » requirement gains a scenario documenting that, when a line enters rename mode, the caret is placed at the click position in the title (and the title is not selected).

## Impact

- **`public/app.js`**: `startRename()` — compute the click offset on the title and set the caret there via `setSelectionRange` (deferred), removing the select-all call; the click handler passes `e.clientX`/`e.clientY` into `startRename`.
- **`public/style.css`**: `.title-input` — align `line-height` (and vertical alignment) with `.title` so the caret stays on the title baseline.
- **`openspec/specs/node-management/spec.md`**: add a caret-placement scenario to « Rename a node » (delta spec lives in the change folder per the OpenSpec flow).
- **No API, data-model, persistence, or endpoint changes.**

## Open Questions

- (none) — the earlier select-all vs. caret-at-end question is resolved in favor of caret-at-click-position.
