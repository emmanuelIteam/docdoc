## Why

As a personal project manager for the household (home, cars, family trips), I need one place to see and update the status of all my projects and their tasks. A paper/napkin list grows unmanageable, and dedicated PM tools are too heavy. A single, fast, collapsible outline running locally solves this without friction.

## What Changes

- Add a self-hosted web app that shows all projects as a hierarchical bullet list (each project = level 1, tasks/subtasks = deeper nesting).
- Each line can be **collapsed / expanded** to show more or less detail.
- Hovering a line reveals a **selection button**; when a line is selected or hovered, a **context menu** appears.
- The context menu lets the user mark a line **bold** (task in progress) or **italic** (task done). A normal (unmarked) line means "not started".
- Add full **node management**: create, rename, reindent (move up/down a level), and delete nodes.
- Persist the outline to a local JSON file so data survives restarts, with a minimal backend.

## Capabilities

### New Capabilities
- `project-outliner`: Render the project outline as a hierarchical, collapsible bullet list with per-line hover selection and a context menu.
- `node-status-tracking`: Mark a line's state via formatting — bold = in progress, italic = done — through the context menu.
- `node-management`: Create, rename, reindent, and delete outline nodes.
- `project-storage`: Persist and reload the project outline from a local JSON file on the backend.

### Modified Capabilities
- (none — this is the initial app, no existing specs to change)

## Impact

- **New backend**: a minimal Node.js + Express server (`server.js`) that loads/saves the outline and serves the page and htmx endpoints.
- **New frontend**: a single-page htmx interface (server-rendered outline, htmx-powered collapse/expand, selection, context menu, and CRUD).
- **New data file**: `data/projects.json` holding the outline (initial seed on first run).
- **New dependencies**: Express (and htmx served locally or via CDN). New `package.json` + `public/` directory.
- **Runtime**: runs locally on the project PC; no external service or auth.
