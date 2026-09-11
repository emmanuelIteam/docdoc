## Context

The outliner is a single Node/Express app (`server.js`) that renders the outline server-side via htmx. Each line is produced by `renderNode()` and currently emits four things: a `.collapse` button (`▸`/`▾` for nodes with children, or a `.collapse-spacer` for leaves), a `.bullet` selection button, the `.title`, and a `.menu` context menu. On the client, `app.js` toggles the `selected` class on a single click of `.bullet` and collapses/expands on a double-click of the line (excluding `.title`, `.bullet`, and `.menu`). Collapse state lives on each node's `collapsed` boolean and is persisted to `data/projects.json`; the backend trigger is `POST /api/nodes/:id/toggle`.

The change removes the dedicated fold control and makes the selection button double-click the collapse/expand trigger, folding two overlapping controls into one.

## Goals / Non-Goals

**Goals:**
- Remove the dedicated `▸`/`▾` fold button from every rendered line.
- Make double-clicking the selection button (`.bullet`) collapse/expand a node that has children.
- Preserve single-click-on-bullet selection and all existing collapse/expand persistence and child-hiding behavior.
- Preserve the leaf no-op behavior when double-clicking a node with no children.

**Non-Goals:**
- No change to the data model (the per-node `collapsed` flag) or persistence.
- No change to the `POST /api/nodes/:id/toggle` endpoint contract.
- No change to the context menu, status, indent/outdent, add/delete, or rename features.
- No keyboard/screen-reader alternative for collapse/expand (out of scope).

## Decisions

**D1 — Remove the fold button at the render layer.** In `server.js` `renderNode()`, emit neither `.collapse` nor `.collapse-spacer`; the line becomes just `[bullet][title][menu]`. *Alternative considered:* hide it with CSS (e.g. `display:none`) — rejected because the control should not exist in the DOM or semantics, and CSS would still reserve/intercept the slot.

**D2 — Change the double-click trigger target.** In `app.js`, drop the `if (e.target.closest('.bullet')) return;` guard so a double-click on `.bullet` falls through to the existing collapse/expand `htmx.ajax` POST to `/toggle`. The `dblclick` handler still ignores `.title`, `.title-input`, `input`, and `.menu`. *Alternative considered:* add a separate `dblclick` listener on `.bullet` that performs the same POST — rejected as duplicative; the existing handler already ignores only specific elements and removing the bullet guard is the minimal change.

**D3 — Keep single-click = select.** The `click` handler that toggles `.selected` on `.bullet` stays unchanged. A double-click naturally fires two single `click`s (net selection unchanged) followed by one `dblclick` (collapse toggle), matching the requested interaction.

**D4 — Clean up the now-unused CSS.** Remove the `.collapse` and `.collapse-spacer` rules from `style.css` and re-baseline the line so the title starts after the bullet without a reserved 1.3rem collapse slot. *Alternative considered:* leave the dead CSS — rejected as it retains misleading styles.

**Leaf handling note:** double-clicking a leaf's bullet still POSTs `/toggle`, but since the render only collapses when `hasKids && collapsed` and a leaf has no children, nothing visibly changes — satisfying the leaf no-op scenario. This is the existing backend behavior, unchanged.

## Risks / Trade-offs

- **Double-click also fires two single-click selection toggles** → The two `click`s are idempotent (toggle → toggle) so the net `selected` state is unchanged; a brief `selected`/context-menu flicker during the double-click is typical of this interaction and acceptable.
- **Losing the visible `▸`/`▾` affordance may hide that a node is collapsible** → Trade-off accepted per the request in exchange for a cleaner, less cluttered line.
- **Double-click on a leaf writes a meaningless `collapsed` toggle to storage** → Pre-existing behavior with no visible effect; accepted to keep the delta minimal (could be hardened later by short-circuiting leaves in `toggleCollapse`, out of scope).

## Migration Plan

Single step, no data migration: update `renderNode`, update the `dblclick` handler, and clean the CSS. Existing `collapsed` values remain valid. Rollback is reverting the three files; there is no schema or endpoint change.

## Open Questions

- Should double-clicking a leaf's selection button be guarded client-side (e.g. only fire `/toggle` when the node has children) rather than relying on the server no-op? The requested scope treats it as "does nothing" and the server already does nothing visible — no client guard is added, but this can be confirmed.
