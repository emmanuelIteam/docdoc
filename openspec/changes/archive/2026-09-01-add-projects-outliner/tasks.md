## 1. Setup & Scaffold

- [x] 1.1 Initialize npm project and add the Express dependency
- [x] 1.2 Create the App structure: `server.js`, `public/`, and `data/`

## 2. Data Model & Storage

- [x] 2.1 Define the node structure (`id`, `title`, `status`, `collapsed`, `children`) and load/save the outline from `data/projects.json`
- [x] 2.2 Implement atomic (temp-file + rename) writes and serialize mutations
- [x] 2.3 Bootstrap seed content in `data/projects.json` on first run when no file exists

## 3. Server: HTTP API

- [x] 3.1 Add `GET /api/outline` to return the current outline
- [x] 3.2 Add endpoint to create a new node (project at level 1, child of an existing line)
- [x] 3.3 Add endpoint to rename a node
- [x] 3.4 Add endpoint to reindent a node (indent / outdent one level)
- [x] 3.5 Add endpoint to delete a node and all its descendants
- [x] 3.6 Add endpoint to set a node's status (`todo` / `in_progress` / `done`)

## 4. Frontend: Outline Rendering & Interaction

- [x] 4.1 Server-render the outline as a nested bullet list (project → tasks → subtasks)
- [x] 4.2 Add collapse/expand toggle per line using an htmx request that returns the updated subtree
- [x] 4.3 Show a selection button on a line on hover (CSS `:hover`)
- [x] 4.4 Show a context menu when a line is hovered or selected, offering formatting actions

## 5. Frontend: Status Formatting

- [x] 5.1 Render `in_progress` lines in bold and `done` lines in italic (default normal)
- [x] 5.2 Context menu actions set/clear status and keep the statuses mutually exclusive

## 6. Frontend: CRUD Interactions

- [x] 6.1 Add UI to create a new project and a child task/subtask
- [x] 6.2 Add inline rename/editing of a node's title
- [x] 6.3 Add indent/outdent controls for a node
- [x] 6.4 Add a delete control for a node

## 7. Integration & Verification

- [x] 7.1 Serve static assets, load htmx, and run the server end-to-end
- [x] 7.2 Manually verify each spec scenario (render, collapse, hover selection, context menu, status formatting, CRUD, persistence across restart)
