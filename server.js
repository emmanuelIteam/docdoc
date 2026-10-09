'use strict';

// Loads `.env` when one exists, before any module below reads the environment.
// An exported variable always wins over the file.
require('./env');

const express = require('express');
const session = require('express-session');
const path = require('path');
const crypto = require('crypto');

const storage = require('./storage');
const accounts = require('./accounts');
const migration = require('./migration');
const mailer = require('./mailer');
const passkeys = require('./passkeys');
const { createAuth } = require('./authroutes');

const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, sliding

// The accounts allowed to hold a space. One address by default, but the rule is
// configuration rather than a literal in the code, so opening docdoc to another
// address is a deployment change.
const AUTHORIZED_EMAILS = String(process.env.AUTHORIZED_EMAILS || 'emmanuel.grandiere@laposte.net')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

// A session secret is mandatory in production; in development an ephemeral one
// keeps the app runnable (at the cost of losing sessions on restart).
function sessionSecret() {
  const configured = process.env.SESSION_SECRET;
  if (configured) return configured;
  if (IS_PRODUCTION) {
    console.error('SESSION_SECRET est obligatoire en production.');
    process.exit(1);
  }
  console.warn('\u26a0 SESSION_SECRET absent : un secret éphémère est utilisé pour cette exécution.');
  return crypto.randomBytes(32).toString('hex');
}

// A preset palette used to give a new theme a tasteful default color when the
// caller does not provide one.
const DEFAULT_THEME_COLORS = ['#2563eb', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#10b981'];

const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    name: 'docdoc.sid',
    secret: sessionSecret(),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      // The cookie only travels over HTTPS in production; localhost stays plain.
      secure: IS_PRODUCTION,
      maxAge: SESSION_TTL_MS,
    },
  })
);

/* ------------------------------------------------------------------ */
/* Per-account working set                                             */
/*                                                                     */
/* The application used to serve one anonymous tenant, so its domains,  */
/* domain list and theme palette could live in module-level singletons. */
/* They are now resolved per account: everything a request reads comes  */
/* from the space of the session's account and nothing else.            */
/* ------------------------------------------------------------------ */

function makeSpace(userId) {
  return {
    userId,
    domains: new Map(),
    domainList: [],
    themes: [],
    writeQueue: Promise.resolve(),
  };
}

const spaces = new Map();

// Resolve (and cache) the working set of an account. A failed load is not
// cached, so a transient storage error does not poison the account for the
// lifetime of the process.
function spaceFor(userId) {
  const cached = spaces.get(userId);
  if (cached) return cached;
  const pending = loadSpace(userId).catch((err) => {
    spaces.delete(userId);
    throw err;
  });
  spaces.set(userId, pending);
  return pending;
}

function invalidateSpace(userId) {
  spaces.delete(userId);
}

async function loadSpace(userId) {
  const space = makeSpace(userId);
  await loadThemes(space);
  await loadDomains(space);
  return space;
}

/* --- Theme palette helpers ----------------------------------------- */

function normalizeTheme(raw) {
  return {
    id: String(raw.id),
    name: typeof raw.name === 'string' && raw.name ? raw.name : 'Thème',
    color: typeof raw.color === 'string' && raw.color ? raw.color : DEFAULT_THEME_COLORS[0],
  };
}

function findThemeById(space, id) {
  return space.themes.find((t) => t.id === id) || null;
}

// Rotate through the preset palette based on how many themes exist, so a new
// theme created without an explicit color still gets a distinct, pleasant one.
function nextThemeColor(space) {
  return DEFAULT_THEME_COLORS[space.themes.length % DEFAULT_THEME_COLORS.length];
}

// Respond by returning the user to where they came from (the sidebar and the
// domain page are both server-rendered, so a redirect refreshes both).
function backTo(req) {
  return req.headers.referer || '/';
}

async function loadThemes(space) {
  const parsed = await storage.readJson(storage.themesKey(space.userId));
  if (!Array.isArray(parsed)) {
    space.themes = [];
    return;
  }
  space.themes = parsed.filter((t) => t && typeof t.id === 'string').map(normalizeTheme);
}

function persistThemes(space) {
  space.writeQueue = space.writeQueue
    .then(() => storage.writeJson(storage.themesKey(space.userId), space.themes))
    .catch((err) => {
      console.error('Erreur d\u2019écriture palette:', err);
    });
  return space.writeQueue;
}

/* ------------------------------------------------------------------ */
/* Domain model + persistence                                          */
/* ------------------------------------------------------------------ */

function genId() {
  return crypto.randomUUID();
}

const VALID_STATUSES = ['todo', 'in_progress', 'done'];

function normalizeDomain(themes, raw) {
  // Keep only theme ids that still exist in the palette (prune orphans from
  // manual file edits or a removed theme). Default to [] for files written
  // before the `labels` field existed.
  const labels = Array.isArray(raw.labels)
    ? raw.labels.map(String).filter((id) => themes.some((t) => t.id === id))
    : [];
  const projects = Array.isArray(raw.projects) ? raw.projects : [];
  return {
    id: String(raw.id),
    name: typeof raw.name === 'string' ? raw.name : 'Sans titre',
    slug: typeof raw.slug === 'string' ? raw.slug : '',
    // Sidebar order of the domain (distinct from `displayOrder` below).
    order: typeof raw.order === 'number' ? raw.order : 0,
    projects,
    // Vertical order of the outline's lines: a flat list of node ids, repaired
    // against the tree so that every node is listed exactly once. Documents
    // written before this field existed have no `displayOrder` and fall back to
    // the canonical top-down order.
    displayOrder: ensureDisplayOrder(projects, raw.displayOrder),
    labels,
  };
}

// The JSON payload written for a domain, stored under its own bucket key.
function domainPayload(domain) {
  return {
    id: domain.id,
    name: domain.name,
    slug: domain.slug,
    order: domain.order,
    labels: Array.isArray(domain.labels) ? domain.labels : [],
    projects: domain.projects,
    displayOrder: Array.isArray(domain.displayOrder) ? domain.displayOrder : [],
  };
}

function persistDomain(space, domain) {
  // Keep the outline's display order in sync with the tree before every write
  // (a no-op when the order is already valid), so no mutation can leave a line
  // out of the outline's display order.
  domain.displayOrder = ensureDisplayOrder(domain.projects, domain.displayOrder);
  space.writeQueue = space.writeQueue
    .then(() => storage.writeJson(storage.domainKey(space.userId, domain.id), domainPayload(domain)))
    .catch((err) => {
      console.error('Erreur d\u2019écriture:', err);
    });
  return space.writeQueue;
}

function rebuildDomainList(space) {
  space.domainList = [...space.domains.values()]
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      order: d.order,
      labels: Array.isArray(d.labels) ? d.labels : [],
    }));
}

function findDomainBySlug(space, slug) {
  for (const d of space.domains.values()) if (d.slug === slug) return d;
  return null;
}

function findDomainById(space, id) {
  return space.domains.get(id) || null;
}

function nextOrder(space) {
  let max = -1;
  for (const d of space.domainList) if (d.order > max) max = d.order;
  return max + 1;
}

function normalizeSlugBase(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function slugify(space, name, exceptId) {
  const base = normalizeSlugBase(name) || 'domaine';
  let slug = base;
  let n = 2;
  while ([...space.domains.values()].some((d) => d.id !== exceptId && d.slug === slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  return slug;
}

function makeDomain(space, name, projects) {
  const outline = projects || [];
  return {
    id: genId(),
    name,
    slug: slugify(space, name),
    order: nextOrder(space),
    projects: outline,
    displayOrder: canonicalOrder(outline),
    labels: [],
  };
}

// Load the account's domains from its own prefix. A bucket that holds no domain
// for this account yields an empty space: no example outline is invented.
async function loadDomains(space) {
  const keys = await storage.listDomainKeys(space.userId);
  const loaded = [];
  for (const key of keys) {
    const parsed = await storage.readJson(key);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
    if (typeof parsed.id !== 'string' || !Array.isArray(parsed.projects)) continue;
    loaded.push(normalizeDomain(space.themes, parsed));
  }
  for (const d of loaded) space.domains.set(d.id, d);
  rebuildDomainList(space);
}

/* ------------------------------------------------------------------ */
/* Tree helpers (operate on a domain's `projects` array)               */
/* ------------------------------------------------------------------ */

function findNode(projects, id, parent = null, grandParent = null) {
  for (let i = 0; i < projects.length; i++) {
    const node = projects[i];
    if (node.id === id) return { node, parent, grandParent, index: i };
    if (node.children && node.children.length) {
      const found = findNode(node.children, id, node, parent);
      if (found) return found;
    }
  }
  return null;
}

function defaultTitle(parentId) {
  return parentId ? 'Nouvelle tâche' : 'Nouveau projet';
}

/* ------------------------------------------------------------------ */
/* Display order (the outline is displayed as a flat sequence of lines) */
/*                                                                     */
/* The tree above is the source of truth for the hierarchy, but it      */
/* cannot express the order the outliner displays: a line inserted as   */
/* the *next sibling* of a line X must appear right below the line X    */
/* and above X's sub-lines, which is not a traversal of the tree.       */
/* `displayOrder` therefore records the vertical order of the lines as  */
/* a flat list of node ids, while each line's depth (its indentation)   */
/* is still derived from the tree.                                     */
/* ------------------------------------------------------------------ */

// Index every node of the outline by id, with its parent and its depth.
function indexOutline(projects, parent = null, depth = 0, index = new Map()) {
  for (const node of projects) {
    index.set(node.id, { node, parent, depth });
    if (node.children && node.children.length) indexOutline(node.children, node, depth + 1, index);
  }
  return index;
}

// Canonical top-down order: each child right after its parent.
function canonicalOrder(projects, out = []) {
  for (const node of projects) {
    out.push(node.id);
    if (node.children && node.children.length) canonicalOrder(node.children, out);
  }
  return out;
}

// True when `ancestorId` is an ancestor of `id` in the tree.
function isTreeAncestor(index, ancestorId, id) {
  let entry = index.get(id);
  while (entry && entry.parent) {
    if (entry.parent.id === ancestorId) return true;
    entry = index.get(entry.parent.id);
  }
  return false;
}

// Exclusive end of the block owned by `id`: 1 + the index of the last displayed
// descendant of `id`, or start + 1 when it has no displayed descendant. A line
// inserted below `id` is displayed before `id`'s sub-lines, so those sub-lines
// are no longer a contiguous run of deeper rows: they are picked out by tree
// ancestry, inside `id`'s region (the rows between `id`'s line and the next
// line of a strictly smaller depth). Returns -1 when `id` is not displayed.
function blockEnd(order, index, id) {
  const start = order.indexOf(id);
  if (start === -1) return -1;
  const entry = index.get(id);
  if (!entry) return start + 1;
  let end = start + 1;
  for (let i = start + 1; i < order.length; i++) {
    const next = index.get(order[i]);
    // An id that is not part of the tree (pruned by `ensureDisplayOrder`) is
    // ignored rather than ending the region.
    if (!next) continue;
    if (next.depth < entry.depth) break;
    if (isTreeAncestor(index, id, order[i])) end = i + 1;
  }
  return end;
}

// Insert a list of ids at `pos`, clamped to the order's bounds.
function insertBlock(order, pos, block) {
  const at = Math.max(0, Math.min(pos, order.length));
  order.splice(at, 0, ...block);
}

// Pull `id` (with all of its displayed descendants) out of the order, keeping
// the relative order of the extracted rows, so the block can be re-inserted at
// a computed position. Rows displayed between `id` and its descendants (siblings
// inserted below it) are left where they are.
function extractBlock(order, index, id) {
  const start = order.indexOf(id);
  if (start === -1) return null;
  const block = [];
  const kept = [];
  order.forEach((rowId, i) => {
    if (rowId === id || (i > start && isTreeAncestor(index, id, rowId))) block.push(rowId);
    else kept.push(rowId);
  });
  if (block.length === 0) return null;
  order.length = 0;
  order.push(...kept);
  return block;
}

// Repair the display order against the tree: unknown ids (deleted nodes) are
// dropped, duplicates are ignored, and any node missing from the order is
// appended after its parent's block (at the end of the outline for a project).
// A line can therefore never disappear from the outline because of an
// incomplete display order.
function ensureDisplayOrder(projects, displayOrder) {
  const index = indexOutline(projects);
  const kept = [];
  const seen = new Set();
  if (Array.isArray(displayOrder)) {
    for (const rawId of displayOrder) {
      const id = String(rawId);
      if (!index.has(id) || seen.has(id)) continue;
      seen.add(id);
      kept.push(id);
    }
  }
  // Place the missing nodes shallowest-first, so a parent is in the order
  // before its own children are appended to its block.
  const missing = [...index.keys()].filter((id) => !seen.has(id));
  missing.sort((a, b) => index.get(a).depth - index.get(b).depth);
  for (const id of missing) {
    const entry = index.get(id);
    if (!entry.parent) {
      kept.push(id);
      continue;
    }
    const end = blockEnd(kept, index, entry.parent.id);
    insertBlock(kept, end === -1 ? kept.length : end, [id]);
  }
  return kept;
}

// Create/Enter: the new line is displayed right below the anchor's line, i.e.
// before the anchor's sub-lines.
function displayInsertAfter(order, anchorId, id) {
  const at = order.indexOf(anchorId);
  if (at === -1) order.push(id);
  else order.splice(at + 1, 0, id);
}

// Last-child insertion (+ button, drop "inside"): displayed at the end of the
// parent's block, i.e. after the parent's existing sub-lines.
function displayAppendToBlock(order, index, parentId, id) {
  const end = blockEnd(order, index, parentId);
  insertBlock(order, end === -1 ? order.length : end, [id]);
}

// Delete: drop the node and all of its displayed descendants from the order,
// leaving in place the lines displayed in between (siblings inserted below it).
function displayRemoveBlock(order, index, id) {
  const start = order.indexOf(id);
  if (start === -1) return;
  const kept = order.filter(
    (rowId, i) => rowId !== id && !(i > start && isTreeAncestor(index, id, rowId))
  );
  order.length = 0;
  order.push(...kept);
}

// Move a node's displayed block so that it ends up right after `refId`'s line.
function displayMoveAfter(order, index, id, refId) {
  const block = extractBlock(order, index, id);
  if (!block) return;
  const at = order.indexOf(refId);
  insertBlock(order, at === -1 ? order.length : at + 1, block);
}

// Move a node's displayed block so that it ends up right before `refId`'s line.
function displayMoveBefore(order, index, id, refId) {
  const block = extractBlock(order, index, id);
  if (!block) return;
  const at = order.indexOf(refId);
  insertBlock(order, at === -1 ? order.length : at, block);
}

// Move a node's displayed block to the end of another node's block.
function displayMoveToBlockEnd(order, index, id, parentId) {
  const block = extractBlock(order, index, id);
  if (!block) return;
  const end = blockEnd(order, index, parentId);
  insertBlock(order, end === -1 ? order.length : end, block);
}

// Move a node's displayed block to the very end of the outline (root drop).
function displayMoveToEnd(order, index, id) {
  const block = extractBlock(order, index, id);
  if (!block) return;
  insertBlock(order, order.length, block);
}

function createNode(domain, parentId) {
  const { projects } = domain;
  const node = { id: genId(), title: defaultTitle(parentId), status: 'todo', collapsed: false, children: [] };
  if (parentId) {
    const found = findNode(projects, parentId);
    if (!found) return null;
    found.node.children.push(node);
    // A new child is displayed after the parent's existing sub-lines.
    displayAppendToBlock(domain.displayOrder, indexOutline(projects), parentId, node.id);
  } else {
    projects.push(node);
    domain.displayOrder.push(node.id);
  }
  return node;
}

// Create a new node at the same level as `anchorId`, inserted right after it
// (used when pressing Enter while editing a line). It is displayed right below
// the anchor's line, before the anchor's sub-lines, even when the anchor has
// sub-lines. Returns the node, or null if the anchor is not found.
function createNodeAfter(domain, anchorId) {
  const { projects } = domain;
  const anchor = findNode(projects, anchorId);
  if (!anchor) return null;
  const siblings = anchor.parent ? anchor.parent.children : projects;
  const node = {
    id: genId(),
    title: defaultTitle(anchor.parent ? anchor.parent.id : null),
    status: 'todo',
    collapsed: false,
    children: [],
  };
  siblings.splice(anchor.index + 1, 0, node);
  displayInsertAfter(domain.displayOrder, anchorId, node.id);
  return node;
}

function deleteNode(domain, id) {
  const { projects } = domain;
  const found = findNode(projects, id);
  if (!found) return false;
  // Remove the block from the display order first: the tree is still intact, so
  // the node's displayed descendants can be recognised by their depth.
  displayRemoveBlock(domain.displayOrder, indexOutline(projects), id);
  const siblings = found.parent ? found.parent.children : projects;
  siblings.splice(found.index, 1);
  return true;
}

function reindentNode(domain, id, direction) {
  const { projects } = domain;
  const found = findNode(projects, id);
  if (!found) return null;
  const siblings = found.parent ? found.parent.children : projects;
  const node = found.node;

  if (direction === 'indent') {
    if (found.index === 0) return node; // no previous sibling -> can't indent
    const prev = siblings[found.index - 1];
    // Depths are read from the tree before the hierarchy changes; the moved
    // block is out of the display order while the insertion point is computed,
    // so its own (soon to be stale) depth does not matter.
    const index = indexOutline(projects);
    siblings.splice(found.index, 1);
    prev.children.push(node);
    // The node becomes the last child of `prev`: displayed at the end of its
    // block, after its existing sub-lines.
    displayMoveToBlockEnd(domain.displayOrder, index, id, prev.id);
  } else {
    if (!found.parent) return node; // already at root -> can't outdent
    // Outdenting changes the depth only: the node becomes the next sibling of
    // its former parent in the hierarchy, but the display order is left as it
    // is, so the line stays exactly where it was — it is not moved above the
    // lines it followed, right below its former parent's line (see
    // openspec/changes/reindent-keeps-line-position).
    siblings.splice(found.index, 1);
    const grandSiblings = found.grandParent ? found.grandParent.children : projects;
    const pIndex = grandSiblings.indexOf(found.parent);
    grandSiblings.splice(pIndex + 1, 0, node);
  }
  return node;
}

function isDescendantOf(projects, ancestorId, nodeId) {
  const anc = findNode(projects, ancestorId);
  if (!anc) return false;
  function walk(node) {
    for (const child of node.children) {
      if (child.id === nodeId) return true;
      if (walk(child)) return true;
    }
    return false;
  }
  return walk(anc.node);
}

// Move a node (with its whole subtree) to a new parent or sibling position
// within a domain's outline. Returns { error } (without mutating) for a
// not-found node/target or a cyclic move. The node's displayed block follows
// its new place: right below the target line for a "next sibling" position,
// right above it for a "previous sibling" position, and at the end of the
// target's block for a "last child" position.
function moveNode(domain, id, targetId, position) {
  const { projects } = domain;
  const found = findNode(projects, id);
  if (!found) return { error: 'not-found' };

  let target = null;
  if (targetId) {
    target = findNode(projects, targetId);
    if (!target) return { error: 'target-not-found' };
    if (target.node === found.node || isDescendantOf(projects, id, targetId)) {
      return { error: 'cycle' };
    }
  }

  const pos = ['inside', 'before', 'after'].includes(position) ? position : 'inside';
  if (pos !== 'inside' && !target) return { error: 'target-not-found' };

  const node = found.node;
  const index = indexOutline(projects);
  const origin = found.parent ? found.parent.children : projects;
  origin.splice(found.index, 1);

  if (pos === 'inside') {
    if (target) {
      target.node.children.push(node);
      displayMoveToBlockEnd(domain.displayOrder, index, id, targetId);
    } else {
      // Dropped on the outline root: becomes a top-level project, displayed at
      // the end of the outline.
      projects.push(node);
      displayMoveToEnd(domain.displayOrder, index, id);
    }
  } else {
    const siblings = target.parent ? target.parent.children : projects;
    const idx = siblings.indexOf(target.node);
    siblings.splice(pos === 'before' ? idx : idx + 1, 0, node);
    if (pos === 'before') displayMoveBefore(domain.displayOrder, index, id, targetId);
    else displayMoveAfter(domain.displayOrder, index, id, targetId);
  }
  return { ok: true, node };
}

function setSubtreeStatus(node, status) {
  node.status = status;
  for (const child of node.children) {
    setSubtreeStatus(child, status);
  }
  return node;
}

function setStatus(projects, id, status, scope) {
  if (!VALID_STATUSES.includes(status)) return null;
  const found = findNode(projects, id);
  if (!found) return null;
  if (scope === 'head') {
    found.node.status = status;
    return found.node;
  }
  return setSubtreeStatus(found.node, status);
}

function toggleCollapse(projects, id) {
  const found = findNode(projects, id);
  if (!found) return null;
  found.node.collapsed = !found.node.collapsed;
  return found.node;
}

/* ------------------------------------------------------------------ */
/* HTML rendering                                                      */
/* ------------------------------------------------------------------ */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The reveal target is a node id that must be made visible even if one of its
// ancestors is persisted as collapsed. Walking up the tree, collect the ids of
// every ancestor of `id` (the path from the root down to `id`'s parent).
function ancestorIds(projects, id) {
  const ids = new Set();
  let current = id;
  while (current) {
    const found = findNode(projects, current);
    if (!found || !found.parent) break;
    ids.add(found.parent.id);
    current = found.parent.id;
  }
  return ids;
}

// Read a reveal target from a request: a query parameter (GET) or a form field
// (POST issued by htmx with an added `reveal` parameter).
function revealTarget(req) {
  return (req.query && req.query.reveal) || (req.body && req.body.reveal) || null;
}

// The set of ancestor ids to force-expand for a domain request, or null.
function expandIdsFor(domain, req) {
  const reveal = revealTarget(req);
  if (!reveal) return null;
  return ancestorIds(domain.projects, reveal);
}

// Render one outline line. Lines are emitted as a flat sequence (see
// `renderOutline`), so a line carries its own depth and the indentation is
// purely visual: the wrapper `<li class="node">` and the nested
// `<ul class="children">` of the previous rendering are gone.
function renderLine(entry, slug) {
  const node = entry.node;
  const statusCls =
    node.status === 'in_progress' ? 'status-in-progress' : node.status === 'done' ? 'status-done' : '';

  const STATUS_ICONS = { todo: '○', in_progress: '◐', done: '●' };
  const STATUS_LABELS = { todo: 'À faire', in_progress: 'En cours', done: 'Terminé' };
  // The scope is read from the live selection at request time: if the head line
  // has one of its sub-lines selected ('subtree'), the status cascades to the
  // whole displayed subtree; otherwise the selection is narrowed to the head
  // line only ('head') and the status applies to that single line. The subtree
  // is resolved by depth on the client (see `outlineSubtreeHasSelected` in
  // public/app.js), not by DOM nesting.
  const scopeExpr = (st) =>
    `js:{status:"${st}", scope:window.outlineSubtreeHasSelected && window.outlineSubtreeHasSelected(this) ? "subtree" : "head"}`;
  const statusBtn = (st) =>
    `<button type="button" class="menu-item${node.status === st ? ' active' : ''}" hx-post="/domaine/${slug}/api/nodes/${node.id}/status" hx-vals='${scopeExpr(st)}' hx-target="#outline" hx-swap="outerHTML" title="${STATUS_LABELS[st]}">${STATUS_ICONS[st]}</button>`;

  const menu =
    '<div class="menu">' +
    statusBtn('todo') +
    statusBtn('in_progress') +
    statusBtn('done') +
    `<button type="button" class="menu-item copy-link" title="Copier le lien">🔗</button>` +
    `<button type="button" class="menu-item" hx-post="/domaine/${slug}/api/nodes/${node.id}/indent" hx-target="#outline" hx-swap="outerHTML" title="Indenter">→</button>` +
    `<button type="button" class="menu-item" hx-post="/domaine/${slug}/api/nodes/${node.id}/outdent" hx-target="#outline" hx-swap="outerHTML" title="Désindenter">←</button>` +
    `<button type="button" class="menu-item" hx-post="/domaine/${slug}/api/nodes" hx-vals='{"parentId":"${node.id}"}' hx-target="#outline" hx-swap="outerHTML" title="Ajouter une tâche">+</button>` +
    `<button type="button" class="menu-item danger" hx-delete="/domaine/${slug}/api/nodes/${node.id}" hx-target="#outline" hx-swap="outerHTML" title="Supprimer">🗑</button>` +
    '</div>';

  return (
    `<li class="line" id="node-${node.id}" data-id="${node.id}" data-parent="${entry.parent ? entry.parent.id : ''}" data-depth="${entry.depth}" style="--depth:${entry.depth}">` +
    '<button class="bullet" type="button" title="Sélectionner" draggable="true">●</button>' +
    `<span class="title ${statusCls}" data-id="${node.id}">${escapeHtml(node.title)}</span>` +
    menu +
    '</li>'
  );
}

// The ids of the nodes hidden because an ancestor is collapsed (a reveal-forced
// ancestor is not collapsed). Visibility is resolved by ancestry, not by the
// display order: a line inserted below a collapsed line is a sibling and stays
// visible between that line and its hidden descendants.
function hiddenNodeIds(projects, expandIds) {
  const hidden = new Set();
  function walk(nodes, ancestorCollapsed) {
    for (const node of nodes) {
      const hasKids = node.children.length > 0;
      const collapsed = hasKids && node.collapsed && !(expandIds && expandIds.has(node.id));
      if (ancestorCollapsed) hidden.add(node.id);
      if (hasKids) walk(node.children, ancestorCollapsed || collapsed);
    }
  }
  walk(projects, false);
  return hidden;
}

// Render the outline as a flat sequence of lines driven by the domain's display
// order: each line's vertical position comes from `displayOrder` and its
// indentation from its depth in the tree. Descendants of a collapsed line are
// not emitted at all (a line inserted below a collapsed line is a sibling, so
// it stays visible right under it). The order is repaired against the tree
// first, so every visible node of the outline is always emitted somewhere.
function renderOutline(domain, slug, expandIds) {
  const index = indexOutline(domain.projects);
  const order = ensureDisplayOrder(domain.projects, domain.displayOrder);
  const hidden = hiddenNodeIds(domain.projects, expandIds);
  const lines = [];
  for (const id of order) {
    const entry = index.get(id);
    if (!entry || hidden.has(id)) continue;
    lines.push(renderLine(entry, slug));
  }
  return `<ul id="outline" class="outline">${lines.join('')}</ul>`;
}

function domainLink(d, activeSlug) {
  const cls = d.slug === activeSlug ? 'sidebar-link active' : 'sidebar-link';
  return `<a class="${cls}" href="/domaine/${d.slug}">${escapeHtml(d.name)}</a>`;
}

function renderSidebar(space, activeSlug) {
  // Group domains by theme, then list domains that carry no theme label under a
  // "Sans thème" section. A domain carrying several theme labels is listed under
  // each corresponding theme group (cross-cutting view).
  const themeGroups = space.themes
    .map((t) => {
      const members = space.domainList
        .filter((d) => d.labels.includes(t.id))
        .map((d) => domainLink(d, activeSlug))
        .join('');
      return (
        '<div class="theme-group">' +
        `<div class="theme-group-header">` +
        `<span class="theme-dot" style="background:${escapeHtml(t.color)}"></span>` +
        `<form method="post" action="/api/themes/${t.id}/rename" class="inline-form theme-rename">` +
        `<input name="name" value="${escapeHtml(t.name)}" class="theme-name-input" title="Renommer le thème" aria-label="Nom du thème">` +
        `<button type="submit" class="btn-mini" title="Renommer">✏️</button>` +
        `</form>` +
        `<form method="post" action="/api/themes/${t.id}/delete" class="inline-form" onsubmit="return confirm('Supprimer ce thème et le retirer des domaines ?');">` +
        `<button type="submit" class="btn-mini danger" title="Supprimer">🗑</button>` +
        `</form>` +
        `</div>` +
        `<div class="theme-group-domains">${members || '<span class="sidebar-muted">Aucun domaine</span>'}</div>` +
        '</div>'
      );
    })
    .join('');

  const untagged = space.domainList.filter((d) => d.labels.length === 0);
  const untaggedGroup = untagged.length
    ? `<div class="theme-group">
        <div class="theme-group-header">
          <span class="theme-dot" style="background:#9ca3af"></span>
          <span class="theme-group-name">Sans thème</span>
        </div>
        <div class="theme-group-domains">${untagged.map((d) => domainLink(d, activeSlug)).join('')}</div>
      </div>`
    : '';

  const navBody = themeGroups + untaggedGroup;

  return `<aside class="sidebar" id="sidebar">
      <div class="sidebar-header">Domaines</div>
      <nav class="sidebar-nav">${navBody || '<p class="sidebar-empty">Aucun domaine</p>'}</nav>
      <div class="sidebar-footer">
        <div class="sidebar-actions">
          <button type="button" class="btn" id="new-theme-btn">+ Nouveau thème</button>
          <button type="button" class="btn" id="new-domain-btn">+ Nouveau domaine</button>
        </div>
        <form method="post" action="/api/themes" class="new-theme-form" id="new-theme-form" hidden>
          <input name="name" placeholder="Nom du thème" required autocomplete="off">
          <label class="color-field">Couleur
            <input type="color" name="color" value="${DEFAULT_THEME_COLORS[0]}">
          </label>
          <button type="submit" class="btn">Créer</button>
        </form>
        <form method="post" action="/api/domains" class="new-domain-form" id="new-domain-form" hidden>
          <input name="name" placeholder="Nom du domaine" required autocomplete="off">
          <button type="submit" class="btn">Créer</button>
        </form>
        <div class="session-box">
          <span class="session-email" title="${escapeHtml(space.email || '')}">${escapeHtml(space.email || '')}</span>
          <a class="btn-mini" href="/auth/passkeys" title="Gérer mes passkeys">🔑</a>
          <form method="post" action="/logout" class="inline-form">
            <button type="submit" class="btn-mini" title="Déconnexion">Déconnexion</button>
          </form>
        </div>
      </div>
    </aside>`;
}

function renderShell(space, content, activeSlug, opts = {}) {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(opts.title || 'Mes projets')}</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body data-domain-slug="${escapeHtml(activeSlug || '')}">
  <div class="shell">
    ${renderSidebar(space, activeSlug)}
    <div class="content">
      <header class="topbar">
        <button type="button" class="btn sidebar-toggle" id="sidebar-toggle" title="Afficher/masquer le panneau">☰</button>
        <h1>${escapeHtml(opts.title || 'Mes projets')}</h1>
      </header>
      <main>${content}</main>
    </div>
    <footer class="shell-footer">
      <p class="hint">Survolez une ligne : bouton de sélection et menu. Un clic sélectionne la ligne et ses sous-lignes ; un second clic sur la tête ne sélectionne que celle-ci. Le menu et la sélection se ferment dès que la souris quitte la ligne. Double-cliquez sur le bouton pour replier/déplier. Glissez depuis le bouton pour déplacer. Cliquez sur un titre pour le renommer ; pendant l'édition d'un titre ou sur une ligne sélectionnée, Tab indente la ligne et MAJ+Tab la désindente. Collez une étiquette sur le domaine pour le rattacher à un thème.</p>
    </footer>
  </div>
  <script src="/htmx.min.js"></script>
  <script src="/app.js"></script>
</body>
</html>`;
}

function themeChip(domain, theme) {
  return (
    `<form method="post" action="/domaine/${domain.slug}/api/labels" class="label-chip">` +
    `<input type="hidden" name="action" value="detach">` +
    `<input type="hidden" name="themeId" value="${theme.id}">` +
    `<span class="label-chip-dot" style="background:${escapeHtml(theme.color)}"></span>` +
    `<span class="label-chip-name">${escapeHtml(theme.name)}</span>` +
    `<button type="submit" class="label-chip-x" title="Retirer l'étiquette">×</button>` +
    `</form>`
  );
}

function renderLabelsZone(space, domain) {
  const chips = (domain.labels || [])
    .map((id) => findThemeById(space, id))
    .filter(Boolean)
    .map((t) => themeChip(domain, t))
    .join('');

  const attachOptions = space.themes.length
    ? space.themes
        .map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`)
        .join('')
    : '';
  const attach =
    space.themes.length
      ? `<form method="post" action="/domaine/${domain.slug}/api/labels" class="label-attach-form" id="label-attach-form" hidden>
           <input type="hidden" name="action" value="attach">
           <select name="themeId">${attachOptions}</select>
           <button type="submit" class="btn">Attacher</button>
         </form>`
      : `<p class="label-attach-empty" id="label-attach-form" hidden>Aucun thème — créez-en un dans le panneau de gauche.</p>`;

  return (
    `<div class="labels-zone">` +
    `<span class="labels-label">Étiquettes</span>` +
    chips +
    `<button type="button" class="btn-mini" id="label-add-btn" title="Coller une étiquette">+</button>` +
    attach +
    `</div>`
  );
}

function renderDomainActions(space, domain) {
  return `<div class="toolbar">
    <button class="btn" hx-post="/domaine/${domain.slug}/api/nodes" hx-target="#outline" hx-swap="outerHTML">+ Nouveau projet</button>
    ${renderLabelsZone(space, domain)}
    <form method="post" action="/api/domains/${domain.id}/rename" class="inline-form">
      <input name="name" value="${escapeHtml(domain.name)}" class="rename-input" title="Renommer le domaine" aria-label="Nom du domaine">
      <button type="submit" class="btn" title="Renommer">✏️</button>
    </form>
    <form method="post" action="/api/domains/${domain.id}/archive" class="inline-form" onsubmit="return confirm('Archiver ce domaine et son contenu ?');">
      <button type="submit" class="btn danger" title="Archiver">🗑</button>
    </form>
  </div>`;
}

function renderPage(space, domain, expandIds) {
  return renderShell(
    space,
    renderDomainActions(space, domain) + renderOutline(domain, domain.slug, expandIds),
    domain.slug,
    { title: domain.name }
  );
}

function renderEmptyPage(space) {
  return renderShell(
    space,
    '<div class="empty-state"><h2>Aucun domaine</h2><p>Créez un domaine dans le panneau de gauche pour regrouper vos projets.</p></div>',
    null,
    { title: 'Mes projets' }
  );
}

/* ------------------------------------------------------------------ */
/* Access routes (public) + protection of everything else              */
/* ------------------------------------------------------------------ */

const auth = createAuth({
  authorizedEmails: AUTHORIZED_EMAILS,
  onAccountReady: async (account, created) => {
    if (created) {
      try {
        const summary = await migration.adoptLegacyData(account.userId);
        console.log(
          `[docdoc] espace créé pour ${account.email} : ` +
            `${summary.domains} domaine(s) et ${summary.archive} archive(s) adoptés` +
            `${summary.themes ? ', palette reprise' : ''}` +
            `${summary.imported ? `, ${summary.imported} fichier(s) local(aux) importé(s)` : ''}`
        );
      } catch (err) {
        console.error('[docdoc] adoption des données existantes :', err.message);
      }
    }
    // A fresh session must not be served data cached for another account, or an
    // earlier state of this one.
    invalidateSpace(account.userId);
  },
});

// The access router owns `/`, `/auth/*`, `/api/me` and `/logout`, and answers
// unauthenticated requests itself. Everything mounted after the guard below is
// therefore guaranteed to have an authenticated session and a resolved space.
app.use(auth.router);

// Resolve the session's space once per request, so no route can read another
// account's domains or themes.
async function withSpace(req, res, next) {
  try {
    const space = await spaceFor(req.session.userId);
    space.email = req.session.email || (await accountEmail(req.session.userId));
    req.space = space;
    return next();
  } catch (err) {
    console.error('[docdoc] chargement de l\u2019espace:', err.message);
    return res.status(500).send('Espace indisponible');
  }
}

async function accountEmail(userId) {
  const account = await accounts.getAccount(userId);
  return account ? account.email : '';
}

app.use(auth.guard, withSpace);

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

app.get('/', (req, res) => {
  const def = req.space.domainList[0];
  if (!def) {
    res.type('html').send(renderEmptyPage(req.space));
    return;
  }
  res.redirect(302, `/domaine/${def.slug}`);
});

app.get('/domaine/:slug', (req, res) => {
  const domain = findDomainBySlug(req.space, req.params.slug);
  if (!domain) return res.status(404).send('Domaine introuvable');
  res.type('html').send(renderPage(req.space, domain, expandIdsFor(domain, req)));
});

app.get('/domaine/:slug/outline-fragment', (req, res) => {
  const domain = findDomainBySlug(req.space, req.params.slug);
  if (!domain) return res.status(404).send('Domaine introuvable');
  res.type('html').send(renderOutline(domain, domain.slug, expandIdsFor(domain, req)));
});

app.get('/domaine/:slug/api/outline', (req, res) => {
  const domain = findDomainBySlug(req.space, req.params.slug);
  if (!domain) return res.status(404).json({ error: 'Domaine introuvable' });
  res.json(domain.projects);
});

function domainFromReq(req, res) {
  const domain = findDomainBySlug(req.space, req.params.slug);
  if (!domain) {
    res.status(404).send('Domaine introuvable');
    return null;
  }
  return domain;
}

app.post('/domaine/:slug/api/nodes', (req, res) => {
  const domain = domainFromReq(req, res);
  if (!domain) return;
  const parentId = req.body.parentId || null;
  const node = createNode(domain, parentId);
  if (!node) return res.status(404).send('Parent introuvable');
  persistDomain(req.space, domain);
  res.type('html').send(renderOutline(domain, domain.slug, expandIdsFor(domain, req)));
});

// Create a new line at the same level as the given node, right after it. The
// new node's id is echoed in the X-New-Node-Id header so the client can focus
// the freshly created line after re-rendering.
app.post('/domaine/:slug/api/nodes/:id/next', (req, res) => {
  const domain = domainFromReq(req, res);
  if (!domain) return;
  const node = createNodeAfter(domain, req.params.id);
  if (!node) return res.status(404).send('Noeud introuvable');
  persistDomain(req.space, domain);
  res.set('X-New-Node-Id', node.id);
  res.type('html').send(renderOutline(domain, domain.slug, expandIdsFor(domain, req)));
});

app.put('/domaine/:slug/api/nodes/:id', (req, res) => {
  const domain = domainFromReq(req, res);
  if (!domain) return;
  const found = findNode(domain.projects, req.params.id);
  if (!found) return res.status(404).send('Noeud introuvable');
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  if (title) found.node.title = title;
  persistDomain(req.space, domain);
  res.json({ ok: true });
});

app.delete('/domaine/:slug/api/nodes/:id', (req, res) => {
  const domain = domainFromReq(req, res);
  if (!domain) return;
  if (!deleteNode(domain, req.params.id)) return res.status(404).send('Noeud introuvable');
  persistDomain(req.space, domain);
  res.type('html').send(renderOutline(domain, domain.slug, expandIdsFor(domain, req)));
});

app.post('/domaine/:slug/api/nodes/:id/status', (req, res) => {
  const domain = domainFromReq(req, res);
  if (!domain) return;
  const scope = req.body.scope === 'head' ? 'head' : 'subtree';
  if (!setStatus(domain.projects, req.params.id, req.body.status, scope)) return res.status(400).send('Statut invalide');
  persistDomain(req.space, domain);
  res.type('html').send(renderOutline(domain, domain.slug, expandIdsFor(domain, req)));
});

app.post('/domaine/:slug/api/nodes/:id/toggle', (req, res) => {
  const domain = domainFromReq(req, res);
  if (!domain) return;
  if (!toggleCollapse(domain.projects, req.params.id)) return res.status(404).send('Noeud introuvable');
  persistDomain(req.space, domain);
  res.type('html').send(renderOutline(domain, domain.slug, expandIdsFor(domain, req)));
});

app.post('/domaine/:slug/api/nodes/:id/indent', (req, res) => {
  const domain = domainFromReq(req, res);
  if (!domain) return;
  reindentNode(domain, req.params.id, 'indent');
  persistDomain(req.space, domain);
  res.type('html').send(renderOutline(domain, domain.slug, expandIdsFor(domain, req)));
});

app.post('/domaine/:slug/api/nodes/:id/outdent', (req, res) => {
  const domain = domainFromReq(req, res);
  if (!domain) return;
  reindentNode(domain, req.params.id, 'outdent');
  persistDomain(req.space, domain);
  res.type('html').send(renderOutline(domain, domain.slug, expandIdsFor(domain, req)));
});

app.post('/domaine/:slug/api/nodes/:id/move', (req, res) => {
  const domain = domainFromReq(req, res);
  if (!domain) return;
  const targetId = req.body.targetId || null;
  const position = req.body.position || 'inside';
  const result = moveNode(domain, req.params.id, targetId, position);
  if (result.error) {
    const code = result.error === 'not-found' || result.error === 'target-not-found' ? 404 : 400;
    return res.status(code).send(result.error);
  }
  persistDomain(req.space, domain);
  res.type('html').send(renderOutline(domain, domain.slug, expandIdsFor(domain, req)));
});

/* ------------------------------------------------------------------ */
/* Domain management                                                   */
/* ------------------------------------------------------------------ */

app.post('/api/domains', (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!name) return res.status(400).send('Nom requis');
  const domain = makeDomain(req.space, name, []);
  req.space.domains.set(domain.id, domain);
  rebuildDomainList(req.space);
  persistDomain(req.space, domain);
  res.redirect(302, `/domaine/${domain.slug}`);
});

app.post('/api/domains/:id/rename', (req, res) => {
  const domain = findDomainById(req.space, req.params.id);
  if (!domain) return res.status(404).send('Domaine introuvable');
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!name) return res.status(400).send('Nom requis');
  domain.name = name;
  domain.slug = slugify(req.space, name, domain.id);
  rebuildDomainList(req.space);
  persistDomain(req.space, domain);
  res.redirect(302, `/domaine/${domain.slug}`);
});

app.post('/api/domains/:id/archive', async (req, res) => {
  const domain = findDomainById(req.space, req.params.id);
  if (!domain) return res.status(404).send('Domaine introuvable');
  await req.space.writeQueue;
  req.space.domains.delete(domain.id);
  rebuildDomainList(req.space);
  await storage.moveObject(
    storage.domainKey(req.space.userId, domain.id),
    storage.archiveKey(req.space.userId, domain.id)
  );
  res.redirect(302, '/');
});

/* ------------------------------------------------------------------ */
/* Theme management (étiquettes)                                       */
/* ------------------------------------------------------------------ */

app.post('/api/themes', (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!name) return res.status(400).send('Nom requis');
  if (req.space.themes.some((t) => t.name === name)) return res.status(400).send('Thème déjà existant');
  const color = typeof req.body.color === 'string' && req.body.color ? req.body.color : nextThemeColor(req.space);
  req.space.themes.push({ id: genId(), name, color });
  persistThemes(req.space);
  res.redirect(302, backTo(req));
});

app.post('/api/themes/:id/rename', (req, res) => {
  const theme = findThemeById(req.space, req.params.id);
  if (!theme) return res.status(404).send('Thème introuvable');
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  if (!name) return res.status(400).send('Nom requis');
  if (req.space.themes.some((t) => t.id !== theme.id && t.name === name)) {
    return res.status(400).send('Thème déjà existant');
  }
  theme.name = name;
  const color = typeof req.body.color === 'string' && req.body.color ? req.body.color : theme.color;
  theme.color = color;
  persistThemes(req.space);
  res.redirect(302, backTo(req));
});

app.post('/api/themes/:id/delete', async (req, res) => {
  const theme = findThemeById(req.space, req.params.id);
  if (!theme) return res.status(404).send('Thème introuvable');
  req.space.themes = req.space.themes.filter((t) => t.id !== theme.id);
  let changed = false;
  for (const d of req.space.domains.values()) {
    if (d.labels.includes(theme.id)) {
      d.labels = d.labels.filter((id) => id !== theme.id);
      changed = true;
      persistDomain(req.space, d);
    }
  }
  if (changed) rebuildDomainList(req.space);
  persistThemes(req.space);
  await req.space.writeQueue;
  res.redirect(302, backTo(req));
});

app.post('/domaine/:slug/api/labels', (req, res) => {
  const domain = findDomainBySlug(req.space, req.params.slug);
  if (!domain) return res.status(404).send('Domaine introuvable');
  const action = req.body.action === 'attach' || req.body.action === 'detach' ? req.body.action : null;
  const themeId = typeof req.body.themeId === 'string' ? req.body.themeId : '';
  if (!action || !themeId) return res.status(400).send('Action et thème requis');

  if (action === 'attach') {
    if (!findThemeById(req.space, themeId)) return res.status(404).send('Thème introuvable');
    if (!domain.labels.includes(themeId)) domain.labels.push(themeId);
  } else {
    domain.labels = domain.labels.filter((id) => id !== themeId);
  }
  persistDomain(req.space, domain);
  res.redirect(302, `/domaine/${domain.slug}`);
});

/* ------------------------------------------------------------------ */

function start() {
  return storage.ensureBucket().then(() => {
    mailer.warnIfMisconfigured();
    console.log(`Envoi des codes : ${mailer.describe()}`);
    if (!passkeys.isConfigured()) {
      console.warn(
        '\u26a0 RP_ID / RP_ORIGIN non configurés : les passkeys ne peuvent pas être enregistrées ni utilisées.'
      );
    } else if (process.env.RP_ID && process.env.RP_ORIGIN) {
      console.log(`Passkeys : RP ID « ${process.env.RP_ID} », origine « ${process.env.RP_ORIGIN} »`);
    } else {
      console.log(
        'Passkeys : RP ID et origine déduits de l\u2019adresse utilisée (mode développement) — ' +
          'ouvrez l\u2019application toujours par la même adresse.'
      );
    }
    if (storage.isConfigured()) {
      console.log(
        `Données persistées dans le bucket S3 « ${storage.bucket()} » (${storage.config().endpoint}), ` +
          `une arborescence par compte sous users/{userId}/`
      );
    } else {
      console.warn(
        'S3 non configuré : les données et les comptes restent en mémoire (non persistés).'
      );
    }
    console.log(`Comptes autorisés : ${AUTHORIZED_EMAILS.join(', ') || '(aucun)'}`);
    return app.listen(PORT, () => {
      console.log(`Projets outliner lancé sur http://localhost:${PORT}`);
    });
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Erreur au démarrage:', err);
    process.exit(1);
  });
}

module.exports = { app, start, spaceFor, invalidateSpace, AUTHORIZED_EMAILS };
