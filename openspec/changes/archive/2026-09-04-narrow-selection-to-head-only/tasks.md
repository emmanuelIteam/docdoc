## 1. Scope-aware status endpoint (server)

- [x] 1.1 In `server.js`, make `setStatus(id, status, scope)` apply the status to the single node when `scope === 'head'`, otherwise cascade recursively to the subtree.
- [x] 1.2 In `server.js`, update the `POST /api/nodes/:id/status` route to read `req.body.scope` (defaulting to `subtree`) and pass it to `setStatus`.
- [x] 1.3 In `server.js renderNode`, give each status action button an `hx-vals` `js:` expression that computes the scope from the live selection at request time (`this.closest(".node").querySelector(".children .line.selected") ? "subtree" : "head"`).

## 2. Three-stage selection on the head line (client)

- [x] 2.1 In `public/app.js`, replace the `.bullet` single-click handler with a three-state cycle: not selected → select head + whole subtree; selected with sub-lines → narrow to head only; head only → deselect.
- [x] 2.2 Confirm no extra scope state needs to be kept client-side (the status scope is derived from the selection classes at request time on the server's buttons).
- [x] 2.3 Confirm a leaf line (no children) still simply selects/deselects itself on successive clicks.

## 3. Hint text

- [x] 3.1 Update the `.hint` paragraph in `server.js renderPage` to describe the new two-stage selection and that status applies only to the head line when only it is selected.

## 4. Verification

- [x] 4.1 Confirmed: `POST /api/nodes/:id/status` with `scope=subtree` cascades the status to the whole subtree (verified against `data/projects.json`).
- [x] 4.2 Confirmed: `POST /api/nodes/:id/status` with `scope=head` changes only the target line (verified against `data/projects.json`).
- [x] 4.3 Confirmed: the scope `js:` expression returns `subtree` when the head has a selected sub-line and `head` when only the head is selected (verified by evaluating it in Node against both selection states); the rendered `/outline-fragment` now uses `hx-vals='js:...'` only. A browser smoke test of the click cycle is recommended; the data file was restored after testing.
