## Context

The outliner is a single-process Node + Express app. The outline HTML is rendered server-side and swapped in by htmx; the selection is a **client-side-only** UI state (no server persistence). Selection is driven from `public/app.js` by a single delegated `click` handler on `.bullet` (the line's selection button). The selected state is encoded directly on the DOM lines via two classes: `.selected` (the line is part of the current selection) and `.selected-head` (the line whose context menu is shown; only one `.selected-head` exists at a time).

The context menu is shown only when a line has `.selected-head`, and the status scope is **derived at request time on the server** (`server.js`, `renderNode` → `scopeExpr`): if the head line has a selected sub-line (`.children .line.selected`) the status cascades to the whole subtree (`scope: "subtree"`), otherwise it applies to the head line alone (`scope: "head"`). The client therefore keeps no separate scope variable.

Today the `.bullet` click handler runs a three-stage cycle on the head line: (1) not selected → select head + whole subtree; (2) head + subtree selected → narrow to head only; (3) head only selected → clear the selection. The change turns stage (3) from "clear" into "re-select the whole subtree", producing a two-state toggle (group ↔ head only). Deselecting is still available by moving the pointer off the selected head line (the delegated `mouseout` handler clears the selection and hides the menu).

The change is narrow and client-only: one branch in `public/app.js`. No server, data-model, or API change is required because the server's scope derivation already distinguishes the group-selected and head-only states.

## Goals / Non-Goals

**Goals:**
- Make the head line's selection button toggle between the whole group (head + all sub-lines) and the head line alone.
- Keep the single-active-selection invariant (only one `.selected-head`, all other selected lines deselected on a new click).
- Keep the context menu shown on the head line in both states.
- Keep the status scope automatically correct in both states (cascade when the group is selected, head-only otherwise) with no client state to maintain.

**Non-Goals:**
- No new keyboard affordance or alternate way to deselect; pointer-leave remains the deselect gesture.
- No server-side selection persistence or state — selection stays client-side.
- No change to collapse/expand (double-click on the bullet), rename, drag-and-drop, or deep-link behavior.
- No change to leaf-line behavior (a childless line still toggles only itself) or to the status/domain capabilities.

## Decisions

**1. Keep the class-based selection model and add a third branch to the existing cycle.**
The current handler, after clearing every `.selected`/`.selected-head`, branches on `isHead` (the clicked line is the current head) and `hadSubtreeSelected` (a sub-line still has `.selected`). We add one `else` branch for the narrow state (`isHead` true AND `hadSubtreeSelected` false): re-add `selected` to every `.line` of the line's `.node` and re-add `.selected-head` to the head line. This reproduces exactly the stage-(1) state, closing the cycle back to the group.

- *Alternatives considered:*
  - **Maintained cycle index / counter per line** — requires storing per-line state and syncing it across htmx re-renders; rejected as needless complexity since the DOM classes already encode the state.
  - **Persistent `data-selection="subtree|head"` attribute** — more explicit, but would force the server's `scopeExpr` to read a new attribute and adds a state the server does not own; rejected since the existing `.children .line.selected` check already yields the correct scope.
  - **A dedicated "clear" gesture** — out of scope; pointer-leave already covers deselecting.

**2. Keep deriving the status scope from the live DOM selection (no server change).**
Because stage (3) re-selects the whole subtree, `.children .line.selected` becomes truthy again and the server sends `scope: "subtree"`, so a status action after re-selecting cascades correctly. In the head-only state the same check is falsy and yields `scope: "head"`. No change to `server.js` or the status endpoint.

**3. Keep the deselection behavior on `mouseout` unchanged.**
The toggle adds no new way to clear the selection, so the existing pointer-leave handler remains the single deselection path. This keeps the change to exactly one branch and avoids introducing a new (and surprising) state.

## Risks / Trade-offs

- **Cycle could feel "trapped" (no bullet way to fully deselect)** → The two-state toggle means clicking the bullet never fully deselects a head with children; the user may expect a third state. *Mitigation:* pointer-leave still clears the selection and closes the menu, and the proposal explicitly documents that the bullet now only toggles between group and head.
- **Regression on double-click (collapse) while toggling** → A double-click on the bullet still fires two single clicks then the collapse; the sequence now lands one state further along the cycle than before. *Mitigation:* this is pre-existing double-click behavior, unaffected for leaf lines and unchanged for the collapse action itself; verify manually to confirm no interaction feels wrong.
- **Sub-line bullet clicks can conflict with a parent's active selection** → Clicking a sub-line's bullet while a parent group is selected clears the parent selection and selects the sub-line's own subtree. *Mitigation:* unchanged from today (single-active-selection invariant), verified by the existing "selects descendants" scenario.
- **Status scope could be wrong if a sub-line is selected but not under the head** → Not possible in practice: one `.selected-head` at a time and `scopeExpr` reads `.children .line.selected` scoped to that head's `.node`. *Mitigation:* nothing; the invariant already holds.

## Migration Plan

The change is client-only JS with no persisted state. Validation steps:

1. Open a domain page and click a task line that has children: first click selects the task + sub-lines (menu on the task line).
2. Click the same head line again: selection narrows to the head line only (sub-lines deselect), menu stays.
3. Click the head line a third time: the whole group (task + sub-lines) is selected again — the cycle is now a two-state toggle.
4. With the group selected, mark "done": the status cascades to all sub-lines.
5. Click to narrow to the head only, then mark "in progress": only the head line changes.
6. Move the pointer off the selected line to confirm the selection clears and the menu closes.
7. Confirm a leaf line toggles only itself, and that double-click on the bullet still collapses/expands.

Rollback: revert the single `else` branch in `public/app.js`; no data or API impact.
