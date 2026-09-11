## Why

Each outline line currently exposes two controls that do overlapping jobs: a dedicated fold/unfold button (`▸`/`▾`) and a selection button that appears on hover. This is visually noisy and duplicates an action that a double-click already performs. We want to remove the dedicated fold control and let the single selection button drive both selection (single click) and fold/unfold (double click), producing a cleaner, less cluttered line.

## What Changes

- **Remove** the dedicated fold/unfold (collapse) button `▸`/`▾` from each line, along with the leaf spacer that reserved its slot.
- **Double-clicking the selection button** now collapses/expands a node that has children. This replaces the previous behavior where double-clicking anywhere on the line (except the title, bullet, or context menu) toggled collapse.
- **Single-clicking the selection button still selects/deselects the line**, so selection behavior is unchanged.
- **Leaf behavior unchanged**: double-clicking a selection button on a node with no children does nothing.
- **BREAKING (UI)**: the dedicated fold control and its visual affordance (the `▸`/`▾` glyph) disappear; collapse/expand is now exclusively triggered by double-clicking the selection button.

## Capabilities

### New Capabilities
- (none)

### Modified Capabilities
- `project-outliner`: the "Toggle collapse on double-click" requirement changes so that collapse/expand is triggered by double-clicking the selection button instead of double-clicking anywhere on the line. The dedicated fold control (`▸`/`▾`) is removed from the line rendering as an observable UI change, though no spec requirement described that control.

## Impact

- **`public/app.js`**: the `dblclick` handler currently bails out of `.bullet` hits; it must now treat double-clicks on the selection button as a collapse/expand trigger.
- **`server.js`**: `renderNode` currently emits a `.collapse` button (or `.collapse-spacer` for leaves); this is removed from the rendered line.
- **`public/style.css`**: the `.collapse` and `.collapse-spacer` rules become unused and can be cleaned up; line layout is re-baselined so the title no longer reserves a 1.3rem collapse slot.
- **No API changes**: the existing `POST /api/nodes/:id/toggle` endpoint stays and continues to be the collapse/expand backend; only the client trigger changes.
- **No data-model changes**: the `collapsed` flag on each node is unchanged.
