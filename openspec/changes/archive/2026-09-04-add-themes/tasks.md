## 1. Theme palette storage (backend)

- [x] 1.1 Add in-memory `themes` state (array keyed by insertion order) and a `THEMES_FILE` constant pointing to `data/themes.json`.
- [x] 1.2 Add `normalizeTheme(raw)` returning `{ id, name, color }` with sensible defaults.
- [x] 1.3 Add `loadThemes()` that reads `data/themes.json` and treats an absent or unparseable file as an empty palette; call it during startup (before `loadDomains`).
- [x] 1.4 Add `persistThemes()` that writes the palette atomically (reuse `atomicWrite`) and serializes writes through the existing `writeQueue`.
- [x] 1.5 In `loadDomains` (and any domain enumeration), exclude `data/themes.json` so it is never listed as a domain.

## 2. Domain model `labels`

- [x] 2.1 In `normalizeDomain`, add `labels` normalized to an array of theme ids known in the palette (unknown ids filtered out), defaulting to `[]` when the field is absent.
- [x] 2.2 In `persistDomain`, include the `labels` array in the written payload.
- [x] 2.3 Expose each domain's `labels` in `rebuildDomainList` so the sidebar can group domains by theme.

## 3. Theme lifecycle API

- [x] 3.1 Add `POST /api/themes` to create a theme from a name and a color, reject a duplicate name, append it to the palette, and persist it.
- [x] 3.2 Add `POST /api/themes/:id/rename` to change the name and color in place (same id), and persist the palette.
- [x] 3.3 Add `POST /api/themes/:id/delete` to remove the theme from the palette and prune its id from every domain's `labels` (persisting each affected domain), then persist the palette.
- [x] 3.4 Add a default-color helper (`nextThemeColor`, a rotating preset palette) used when a new theme is created without an explicit color.

## 4. Attach/detach a theme label on a domain

- [x] 4.1 Add `POST /domaine/:slug/api/labels` accepting an action (`attach`/`detach`) and a `themeId`, validating the theme exists, and adding/removing it (without duplication) from the domain's `labels`.
- [x] 4.2 Have the endpoint validate the domain and theme (404/400 on error) and refresh the page so the updated chips and sidebar grouping both re-render. Note: because the sidebar and the domain toolbar are both server-rendered, the endpoint returns a 302 redirect to the domain page rather than an htmx fragment — an equivalent, simpler refresh.

## 5. Sidebar grouping by theme

- [x] 5.1 Update `renderSidebar` to render theme groups (header with a color dot + name, with inline rename and a delete control) and to list each domain under each of its themes; render a "Sans thème" group for domains with no labels; keep the active-domain highlight.
- [x] 5.2 Add a "+ Nouveau thème" control with an inline create form (name + color) to the sidebar footer area.

## 6. Domain page "Étiquettes" chips zone

- [x] 6.1 Render an "Étiquettes" zone in the domain toolbar showing the domain's current theme chips (colored, each removable) and a "+" control.
- [x] 6.2 Wire the "+" to a picker (a select of the palette's themes + "Attacher") for attaching, and support detaching from each chip. New themes are created from the sidebar's "+ Nouveau thème" form, then attached here.

## 7. Frontend styles and JS

- [x] 7.1 Add CSS (`public/style.css`) for theme-group headers, color dots, and tag chips, keeping the two-level sidebar readable and ensuring themes are conveyed by label text as well as color.
- [x] 7.2 Update `public/app.js` for the create-theme form and the label-picker toggles, consistent with the existing delegated handlers.

## 8. Migration and seed

- [x] 8.1 Existing domain files load with `labels: []` and a missing `data/themes.json` yields an empty palette without breaking startup (verified against the restored data).
- [x] 8.2 Decision: do NOT auto-seed example themes — the palette starts empty and existing domains appear under "Sans thème" (keeps user data free of demo content).

## 9. Verification

- [x] 9.1 Start the app and confirm existing domains appear under "Sans thème" and their projects still render.
- [x] 9.2 Create, rename, and delete a theme and attach/detach it on a domain; confirm the sidebar grouping and the domain chips update, and that deleting a theme prunes it from the domains.
- [x] 9.3 Restart the server and confirm themes persist in `data/themes.json` and that the per-domain files still load.
