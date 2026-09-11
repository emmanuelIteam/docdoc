## 1. Client: single active selection

- [x] 1.1 In `public/app.js` bullet click handler, clear `selected` and `selected-head` from every `.line` in the document before applying the new selection.
- [x] 1.2 Select the clicked line and its whole subtree (add `selected`) and mark only the clicked line as `selected-head`.

## 2. Deselection behavior

- [x] 2.1 Confirm clicking the currently selected head line deselects the whole subtree and closes its menu.

## 3. Verification

- [x] 3.1 Select a head line: confirm its menu is shown. Then click another line's selection button and confirm the first line and its sub-lines are deselected, its menu closes, and the new line's menu opens.
- [x] 3.2 Confirm only one context menu is visible at any time.
- [x] 3.3 Confirm sub-lines of the selected head stay highlighted.
- [x] 3.4 Confirm clicking the selected head line again deselects the subtree and hides the menu.
- [x] 3.5 Confirm no regression to inline rename, double-click collapse, or the menu actions.
