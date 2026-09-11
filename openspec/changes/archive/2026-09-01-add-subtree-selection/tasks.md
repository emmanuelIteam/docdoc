## 1. Client-side subtree selection

- [x] 1.1 In `public/app.js`, update the `.bullet` single-click handler so that clicking a line's selection button toggles the `selected` class on the clicked line AND all descendant `.line` elements (walk up to the enclosing `.node` and use `node.querySelectorAll('.line')`).
- [x] 1.2 Verify that clicking the selection button of a leaf line (no children) still only toggles that line's `selected` state.
- [x] 1.3 Confirm `server.js` and `public/style.css` require no changes and leave them untouched.

## 2. Verification

- [x] 2.1 Manually confirm that clicking the selection button of a parent line highlights the line and all of its sub-lines.
- [x] 2.2 Confirm that each selected sub-line is highlighted and shows its own context menu (fully-selected behavior).
- [x] 2.3 Confirm that clicking the selection button of an already-selected line deselects the line and all of its sub-lines.
- [x] 2.4 Confirm that selection propagates to descendants nested at more than one depth.
