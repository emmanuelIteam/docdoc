# Tasks

## 1. Selection toggle in public/app.js

- [x] 1.1 In the delegated `.bullet` single-click handler, add the third branch to the three-stage cycle: when the clicked line is the current head (`isHead`) and no sub-line is selected (`hadSubtreeSelected` is false), re-select the whole subtree — add `.selected` to every `.line` of the line's `.node` and re-add `.selected-head` to the head line (instead of leaving the selection cleared).
- [x] 1.2 Confirm that after the re-select the line is back in the "group selected" state, so the next click on the same head line again hits the narrowing branch — closing a clean two-state toggle (group ↔ head only). (Done by inspecting the new `else` branch: it re-adds `.selected` to every `.line` of the `.node` and `.selected-head` to the head, so the next click sees `hadSubtreeSelected === true` and narrows again.)
- [x] 1.3 Confirm the single-active-selection invariant still holds: clicking a different line clears the previous selection (`.selected`/`.selected-head`) before applying the new one. (Confirmed: the global clear loop at the top of the handler runs before every branch.)

## 2. Manual verification

- [x] 2.1 Click a task line that has children three times and confirm the cycle is group → head only → group (no "deselect all" via the bullet).
- [x] 2.2 With the group re-selected, choose a status action (todo / in progress / done) and confirm it cascades to every sub-line.
- [x] 2.3 Narrow to the head line only, choose a status action, and confirm only that head line changes (sub-lines unaffected).
- [x] 2.4 Move the pointer off the selected head line (and off its menu) and confirm the selection clears and the context menu closes.
- [x] 2.5 Confirm a leaf line (no children) still toggles only itself on each click, and that double-clicking the bullet still collapses/expands a line with children.
- [x] 2.6 Run `openspec validate cycle-selection-between-subtree-and-head` and confirm the change is valid.
