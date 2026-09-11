## Context

The outliner (`add-projects-outliner`) is built and archived. The current implementation has two visible defects and three UX refinements to make:
- Bid/italic formatting never renders because the status class goes on the `.line` container while the CSS targets `.title.status-*`.
- The context menu opens on hover and is positioned below the line with a small gap, so `:hover` is lost as the cursor moves down and the menu closes before a menu button (notably "+ Tâche") can be clicked.
- The user wants the menu only when a line is selected, double-click to fold/unfold, and a tighter line spacing.

## Goals / Non-Goals

**Goals:**
- Context menu appears only for a selected line, and stays open to click.
- Double-click a line toggles collapse/expand.
- Reduce vertical spacing between lines.
- Bold/italic status is visibly applied to the line title.
- "+ Tâche" reliably creates and reveals a new child line.

**Non-Goals:**
- No new backend endpoints or data model changes.
- No change to the persistence format or API.
- No keyboard shortcuts, drag-and-drop, or multi-select.

## Decisions

**Decision 1: Move the status class onto the line title element.**
`renderNode` applied `status-*` to the `<div class="line">`, while the CSS target is `.title.status-*`. This mismatch is the root cause of the missing bold/italic. Apply `status-*` to the `<span class="title">` so `.title.status-in-progress` and `.title.status-done` match.
- *Alternatives considered*: also style `.line.status-*` (rejected: duplicates state styling on two elements); a `data-status` attribute with JS (rejected: unnecessary — a class is enough).

**Decision 2: Show the context menu only on selection, driven by a persistent class.**
Show the menu via `.line.selected` and drop the `:hover` trigger. Selection is a class toggled by the bullet button, so the menu stays open while the pointer is elsewhere and is reliably clickable. This also removes the hover-gap that made "+ Tâche" miss.
- *Alternatives considered*: keep `:hover` but bridge the gap (rejected: still flaky and clutters the view); pure CSS `:focus-within` (rejected: focus behavior is inconsistent across elements).

**Decision 3: Double-click toggles collapse via a delegated handler.**
A delegated `dblclick` listener on `.line` (ignoring clicks on the title, bullet, and inside the menu) issues an htmx `POST` to `/api/nodes/:id/toggle` and swaps the outline. The existing collapse control stays.
- *Alternatives considered*: `hx-trigger="dblclick"` on the line (rejected: conflicts with the single-click rename on the title and selection on the bullet); server round-trip on each double-click is fine at this scale.

**Decision 4: Compact spacing via CSS only.**
Reduce `.line` vertical padding and the `.children` indentation in `style.css`. No markup or logic change.
- *Alternatives considered*: use CSS variables for a spacing scale (overkill for one change).

**Decision 5: Menu buttons are explicit `type="button"`.**
Prevent any implicit submit behavior so actions like "+ Tâche" always fire the htmx request.

## Risks / Trade-offs

- **[Menu only on selection]**: selecting is now required to act on a line → a small extra click, but it makes actions predictable and fixes the "+ Tâche" reliability. Mitigation: the bullet (selection) button is present on hover.
- **[Double-click on title]**: double-clicking the title must not conflict with inline rename → handle rename on single click and ignore double-click when the target is the title.
- **[Compact spacing]**: too tight can hurt readability → use a modest padding reduction.
- **[Backward behavior]**: removing the hover menu is a UX behavior change → intended, per the user's request; no data impact.

## Migration Plan

No data migration. Deploy by updating `server.js`, `public/style.css`, and `public/app.js`, then restarting the server (`npm start`). Rollback is reverting the three files.
