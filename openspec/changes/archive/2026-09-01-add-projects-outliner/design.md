## Context

The repo currently holds only OpenSpec setup and a project Readme — there is no application code yet. The user is a personal project manager for household, car, and family-trip projects who wants one local web page where every project and its tasks appear as a collapsible outline. The exploration selected a minimal, self-hosted stack: Node.js + Express backend, htmx on the frontend, and a local JSON data file, accessed only from the user's PC.

## Goals / Non-Goals

**Goals:**
- Render the outline as a nested bullet list (project → tasks → subtasks → …).
- Collapse/expand each line; keep collapsed state across reloads.
- Show a selection button on hover and a context menu on hover/selection.
- Mark a line bold (in progress) or italic (done); mutually exclusive; default normal.
- Full node management: create, rename, reindent (indent/outdent), delete.
- Persist everything to a local `data/projects.json`, with seed content on first run.
- Keep dependencies minimal (Express + htmx only).

**Non-Goals:**
- Multi-user, authentication, or shared access.
- Hosting, remote/phone access, or a public URL (runs locally on the PC).
- Project metadata beyond the outline (budgets, calendars, file attachments, Gantt).
- Realtime multi-tab sync or a full SPA framework.

## Decisions

**Decision 1: htmx + server-rendered outline over a single-page JS app.**
The backend renders the tree as nested `<ul>`/`<li>`, and each interaction (collapse, expand, status change, CRUD) is an htmx request that returns the updated subtree/line to swap in.
- *Why*: matches the chosen htmx stack, keeps the whole tool to a small server + a few templates, no client build step.
- *Alternatives considered*: React/Vue SPA (rejected: heavier build and dependencies for a simple outline); vanilla JS rendering the whole tree client-side (rejected: duplicates state management and persistence logic).

**Decision 2: Node model with a single `status` field.**
Each node is `{ id, title, status, collapsed, children }` where `status ∈ {"todo","in_progress","done"}`. Formatting is derived: `in_progress` → bold, `done` → italic, `todo` → normal; only one status can be active.
- *Why*: a single enum keeps statuses mutually exclusive by construction and keeps the persisted model small and testable.
- *Alternatives considered*: separate boolean `bold`/`italic` flags (rejected: allows contradictory states and complicates toggling); storing display style strings (rejected: conflates state with presentation).

**Decision 3: JSON data file, not Markdown or a database.**
The outline is stored as a JSON tree in `data/projects.json`; Express reads it on startup and writes it on change.
- *Why*: structured tree operations (insert/remove/reindent) are clean on JSON. The user also allowed JSON; Markdown-indented parsing is lossy and harder to reindent; a DB (SQLite) adds a driver and schema for a single-user local tool.
- *Alternatives considered*: Markdown file (rejected: fragile indentation parsing, lossy for node ids/status/collapse), SQLite (rejected: overkill for a single-user local file).

**Decision 4: Local storage access through a minimal HTTP API.**
A small JSON API is exposed for read/write (`GET /api/outline`, plus create/update/delete/reindent/status endpoints). htmx calls these endpoints and swaps in returned HTML fragments.
- *Why*: keeps the outline as the single source of truth on the server and makes every interaction testable; the frontend never mutates data directly.
- *Alternatives considered*: frontend writing the file directly (rejected: browser can't write server files); in-memory only (rejected: not persisted).

**Decision 5: Atomic writes to avoid corruption.**
Writes go to a temp file then rename over `data/projects.json`, and mutations are serialized (one write at a time).
- *Why*: single-user, but a crash mid-write should not wipe the whole outline.
- *Alternatives considered*: direct `writeFile` (rejected: can leave a truncated/corrupt file on crash); an external DB (rejected: overkill).

## Risks / Trade-offs

- **[JSON corruption on crash]** → Atomic temp-file write + rename, and serialized mutation queue.
- **[Accidental data loss if the file is deleted/edited]** → Personal tool, low impact; seed data regenerates only if the file is absent — recommend the user back up the file occasionally.
- **[Very large outline → many DOM nodes]** → Collapse hides descendants so the rendered DOM stays small; acceptable for a personal project count.
- **[No authentication]** → Runs on localhost only, mitigating exposure; no secrets or sensitive accounts involved.
- **[htmx menu/selection styling edge cases]** → Selection button via CSS `:hover`, context menu via a positioned element; simple and local to the template.

## Migration Plan

This is a greenfield addition — no existing data or code to migrate. Deploy by installing Express (`npm install express`) and starting `node server.js`; it bootstraps `data/projects.json` with seed content if absent. Rollback is simply stopping the server and deleting the new files/folder.
