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

// Add (attach) or remove (detach) a theme id on a domain, without duplicating
// it. Returns false when an attach targets a theme that is not in the palette,
// so the caller can answer not found instead of silently ignoring the request.
// Shared by the domain page's label picker and the administration matrix.
function setDomainLabel(space, domain, themeId, action) {
  if (action === 'attach') {
    if (!findThemeById(space, themeId)) return false;
    if (!domain.labels.includes(themeId)) domain.labels.push(themeId);
    return true;
  }
  domain.labels = domain.labels.filter((id) => id !== themeId);
  return true;
}

// Move a theme one position up or down. The palette array *is* the order (see
// design D3): no `order` field to keep in sync.
function moveTheme(space, theme, direction) {
  const index = space.themes.indexOf(theme);
  if (index < 0) return false;
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= space.themes.length) return false;
  const [moved] = space.themes.splice(index, 1);
  space.themes.splice(target, 0, moved);
  persistThemes(space);
  return true;
}


// Respond by returning the user to where they came from (the sidebar and the
// domain page are both server-rendered, so a redirect refreshes both).
function backTo(req) {
  return req.headers.referer || '/';
}

// Where a mutation should land. A form can carry an explicit `returnTo`, but
// only the administration page is accepted — the value is compared to a single
// literal, never concatenated into a URL, so it cannot become an open redirect.
function redirectAfter(req, res, defaultPath) {
  const returnTo = req.body && typeof req.body.returnTo === 'string' ? req.body.returnTo : '';
  res.redirect(302, returnTo === '/administration' ? '/administration' : defaultPath);
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

// Move a domain one position up or down in the displayed order, by exchanging
// its `order` with its displayed neighbour. Legacy or restored files can share
// the same `order`; a plain swap would then be a no-op, so equal orders are
// first collapsed into a distinct 0..n-1 sequence following the display order.
// Every domain whose order changed is persisted, so the move survives a reload.
function moveDomain(space, domain, direction) {
  const changed = new Set();
  rebuildDomainList(space);
  let list = space.domainList;
  let index = list.findIndex((entry) => entry.id === domain.id);
  if (index < 0) return false;
  let target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= list.length) return false;

  let neighbour = space.domains.get(list[target].id);
  if (!neighbour) return false;

  if (domain.order === neighbour.order) {
    list.forEach((entry, position) => {
      const d = space.domains.get(entry.id);
      if (!d) return;
      d.order = position;
      changed.add(d);
    });
    rebuildDomainList(space);
    list = space.domainList;
    index = list.findIndex((entry) => entry.id === domain.id);
    target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= list.length) return false;
    neighbour = space.domains.get(list[target].id);
    if (!neighbour) return false;
  }

  const previousOrder = domain.order;
  domain.order = neighbour.order;
  neighbour.order = previousOrder;
  changed.add(domain);
  changed.add(neighbour);
  rebuildDomainList(space);
  for (const d of changed) persistDomain(space, d);
  return true;
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

// The account's archived domains, read from its own archive prefix. Objects that
// are missing, unparseable, or not domain-shaped are skipped, exactly as the
// active listing does, so one corrupt archive cannot hide the others.
async function listArchivedDomains(space) {
  const keys = await storage.listArchiveKeys(space.userId);
  const archives = [];
  for (const key of keys) {
    const parsed = await storage.readJson(key);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
    if (typeof parsed.id !== 'string' || typeof parsed.name !== 'string') continue;
    archives.push({
      id: parsed.id,
      name: parsed.name,
      labels: Array.isArray(parsed.labels) ? parsed.labels.map(String) : [],
    });
  }
  archives.sort((a, b) => a.name.localeCompare(b.name));
  return archives;
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

// A domain always shows at least one root line. The outline is the only place a
// line can be created (Enter on an existing line), so an empty outline would be
// a dead end: materialize the default project lazily, the first time it matters.
// Idempotent and synchronous before any async write, so two concurrent requests
// cannot create two default lines.
function ensureDefaultProject(space, domain) {
  if (domain.projects.length > 0) return false;
  const node = createNode(domain, null);
  if (!node) return false;
  persistDomain(space, domain);
  return true;
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

function renderSidebarNav(space, activeSlug) {
  // Group domains by theme, then list domains that carry no theme label under a
  // "Sans thème" section. A domain carrying several theme labels is listed under
  // each corresponding theme group (cross-cutting view). The sidebar is a pure
  // navigation surface: themes and domains are managed on /administration.
  // Rendered on its own so a labels-bar swap can refresh it out-of-band.
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
        `<span class="theme-group-name">${escapeHtml(t.name)}</span>` +
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

  return themeGroups + untaggedGroup || '<p class="sidebar-empty">Aucun domaine</p>';
}

function renderSidebar(space, activeSlug, opts = {}) {
  const adminActive = Boolean(opts.admin);

  return `<aside class="sidebar" id="sidebar">
      <div class="sidebar-header">Domaines</div>
      <nav class="sidebar-nav" id="sidebar-nav">${renderSidebarNav(space, activeSlug)}</nav>
      <div class="sidebar-footer">
        <nav class="sidebar-extra">
          <a class="sidebar-link sidebar-admin${adminActive ? ' active' : ''}" href="/administration"${adminActive ? ' aria-current="page"' : ''}>Administration</a>
        </nav>
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
<body class="${opts.labelsBar ? 'has-labels-bar' : ''}" data-domain-slug="${escapeHtml(activeSlug || '')}">
  <div class="shell">
    ${renderSidebar(space, activeSlug, opts)}
    <div class="content">
      <header class="topbar">
        <button type="button" class="btn sidebar-toggle" id="sidebar-toggle" title="Afficher/masquer le panneau">☰</button>
        <h1>${escapeHtml(opts.title || 'Mes projets')}</h1>
      </header>
      <main>${content}</main>
    </div>
    <footer class="shell-footer">
      <p class="hint">Survolez une ligne : bouton de sélection et menu. Un clic sélectionne la ligne et ses sous-lignes ; un second clic sur la tête ne sélectionne que celle-ci. Le menu et la sélection se ferment dès que la souris quitte la ligne. Double-cliquez sur le bouton pour replier/déplier. Glissez depuis le bouton pour déplacer. Cliquez sur un titre pour le renommer ; pendant l'édition d'un titre ou sur une ligne sélectionnée, Tab indente la ligne et MAJ+Tab la désindente. Collez une étiquette sur le domaine pour le rattacher à un thème. Les thèmes et les domaines se gèrent depuis la page Administration, en pied du panneau.</p>
    </footer>
  </div>
  <script src="/htmx.min.js"></script>
  <script src="/app.js"></script>
</body>
</html>`;
}

function themeChip(domain, theme) {
  return (
    `<form method="post" action="/domaine/${domain.slug}/api/labels" class="label-chip"` +
    ` hx-post="/domaine/${domain.slug}/api/labels" hx-target="#labels-bar" hx-swap="outerHTML">` +
    `<input type="hidden" name="action" value="detach">` +
    `<input type="hidden" name="themeId" value="${theme.id}">` +
    `<span class="label-chip-dot" style="background:${escapeHtml(theme.color)}"></span>` +
    `<span class="label-chip-name">${escapeHtml(theme.name)}</span>` +
    `<button type="submit" class="label-chip-x" title="Retirer l'étiquette">×</button>` +
    `</form>`
  );
}

// The labels bar floats at the bottom right of a domain page, outside the
// outline's flow. Each chip and the picker post to the domain's labels route;
// htmx swaps the bar in place and the server returns the refreshed sidebar nav
// in the same response (out-of-band), so the grouping never contradicts the
// chips. Without JS, the same forms reload the page.
function renderLabelsBar(space, domain) {
  const chips = (domain.labels || [])
    .map((id) => findThemeById(space, id))
    .filter(Boolean)
    .map((t) => themeChip(domain, t))
    .join('');

  const controls = space.themes.length
    ? `<button type="button" class="btn-mini" id="label-add-btn" title="Coller une étiquette" aria-expanded="false">+</button>` +
      `<form method="post" action="/domaine/${domain.slug}/api/labels" class="label-attach-form" id="label-attach-form" hidden` +
      ` hx-post="/domaine/${domain.slug}/api/labels" hx-target="#labels-bar" hx-swap="outerHTML">` +
      `<input type="hidden" name="action" value="attach">` +
      `<select name="themeId" aria-label="Thème à attacher">${space.themes
        .map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`)
        .join('')}</select>` +
      `<button type="submit" class="btn">Attacher</button>` +
      `</form>`
    : `<p class="label-attach-empty">Aucun thème — créez-en un dans <a href="/administration">Administration</a>.</p>`;

  return `<div class="labels-bar" id="labels-bar">
      <span class="labels-bar-icon" title="Étiquettes">🏷</span>
      ${chips}
      ${controls}
    </div>`;
}

function renderPage(space, domain, expandIds) {
  return renderShell(
    space,
    renderOutline(domain, domain.slug, expandIds) + renderLabelsBar(space, domain),
    domain.slug,
    { title: domain.name, labelsBar: true }
  );
}

function renderEmptyPage(space) {
  return renderShell(
    space,
    '<div class="empty-state"><h2>Aucun domaine</h2><p>Créez un domaine depuis la page <a href="/administration">Administration</a> pour regrouper vos projets.</p></div>',
    null,
    { title: 'Mes projets' }
  );
}

/* ------------------------------------------------------------------ */
/* Administration page                                                 */
/*                                                                     */
/* One page, three stacked sections (themes, domains, archives) and a  */
/* theme x domain matrix. Every mutation is a plain POST form that     */
/* redirects back here via `returnTo`: no client state to keep.        */
/* ------------------------------------------------------------------ */

const ADMIN_RETURN = '<input type="hidden" name="returnTo" value="/administration">';

// `onsubmit` returning `confirm(message)` for a message built from user data.
// JSON-encoding then HTML-escaping keeps a domain name from breaking out of the
// attribute or of the JavaScript string.
function confirmSubmit(message) {
  return `onsubmit="return confirm(${escapeHtml(JSON.stringify(message))})"`;
}

// Up/down controls shared by the theme and domain tables. Out-of-range moves
// render a disabled button instead of sending a request that would no-op.
function adminMoveForms(action, canUp, canDown) {
  const form = (dir, label, enabled) =>
    `<form method="post" action="${action}/move" class="inline-form">
       <input type="hidden" name="dir" value="${dir}">
       ${ADMIN_RETURN}
       <button type="submit" class="btn-mini admin-move" title="${label}"${enabled ? '' : ' disabled'}>${dir === 'up' ? '↑' : '↓'}</button>
     </form>`;
  return form('up', 'Monter', canUp) + form('down', 'Descendre', canDown);
}

function themeChips(space, labels) {
  const chips = (labels || [])
    .map((id) => findThemeById(space, id))
    .filter(Boolean)
    .map(
      (t) =>
        '<span class="label-chip">' +
        `<span class="label-chip-dot" style="background:${escapeHtml(t.color)}"></span>` +
        `<span class="label-chip-name">${escapeHtml(t.name)}</span>` +
        '</span>'
    )
    .join('');
  return chips || '<span class="admin-meta">Aucun</span>';
}

function renderThemeRows(space) {
  return space.themes
    .map((theme, index) => {
      const count = space.domainList.filter((d) => d.labels.includes(theme.id)).length;
      return `<li class="admin-row">
        <form method="post" action="/api/themes/${theme.id}/rename" class="admin-inline-form">
          <input name="name" value="${escapeHtml(theme.name)}" class="theme-name-input" aria-label="Nom du thème" required autocomplete="off">
          <input type="color" name="color" value="${escapeHtml(theme.color)}" class="admin-color" aria-label="Couleur du thème" title="Couleur du thème">
          <button type="submit" class="btn-mini" title="Enregistrer le nom et la couleur">✓</button>
          ${ADMIN_RETURN}
        </form>
        <span class="admin-meta">${count} domaine${count > 1 ? 's' : ''}</span>
        <span class="admin-actions">
          ${adminMoveForms(`/api/themes/${theme.id}`, index > 0, index < space.themes.length - 1)}
          <form method="post" action="/api/themes/${theme.id}/delete" class="inline-form" ${confirmSubmit(
            'Supprimer ce thème et le retirer des domaines ?'
          )}>
            <button type="submit" class="btn-mini danger" title="Supprimer">🗑</button>
          </form>
        </span>
      </li>`;
    })
    .join('');
}

function renderDomainRows(space) {
  return space.domainList
    .map((entry, index) => {
      const domain = space.domains.get(entry.id);
      if (!domain) return '';
      return `<tr>
        <td class="admin-name-cell">
          <span class="admin-domain-name">${escapeHtml(domain.name)}</span>
          <details class="admin-rename">
            <summary class="btn-mini" title="Renommer le domaine" aria-label="Renommer le domaine">✎</summary>
            <form method="post" action="/api/domains/${domain.id}/rename" class="admin-inline-form">
              <input name="name" value="${escapeHtml(domain.name)}" class="rename-input" aria-label="Nouveau nom du domaine" required autocomplete="off">
              <button type="submit" class="btn-mini" title="Enregistrer le nom">✓</button>
              ${ADMIN_RETURN}
            </form>
            <p class="admin-hint">L'URL sera régénérée à partir du nouveau nom.</p>
          </details>
        </td>
        <td><a class="admin-url" href="/domaine/${domain.slug}">/domaine/${escapeHtml(domain.slug)}</a></td>
        <td><span class="theme-chips">${themeChips(space, entry.labels)}</span></td>
        <td class="admin-actions-cell">
          ${adminMoveForms(`/api/domains/${domain.id}`, index > 0, index < space.domainList.length - 1)}
          <form method="post" action="/api/domains/${domain.id}/archive" class="inline-form" ${confirmSubmit(
            'Archiver ce domaine et son contenu ?'
          )}>
            <button type="submit" class="btn-mini danger" title="Archiver">🗑</button>
            ${ADMIN_RETURN}
          </form>
        </td>
      </tr>`;
    })
    .join('');
}

function renderMatrix(space) {
  if (!space.themes.length || !space.domainList.length) {
    return '<div class="matrix-scroll"><p class="admin-empty">Aucune répartition à afficher : il faut au moins un thème et un domaine.</p></div>';
  }
  const head = space.domainList.map((d) => `<th scope="col">${escapeHtml(d.name)}</th>`).join('');
  const rows = space.themes
    .map((theme) => {
      const cells = space.domainList
        .map((d) => {
          const attached = d.labels.includes(theme.id);
          const title = `${attached ? 'Retirer' : 'Attacher'} « ${theme.name} » ${attached ? 'de' : 'à'} « ${d.name} »`;
          return `<td><form method="post" action="/api/themes/${theme.id}/labels" class="matrix-form">
            <input type="hidden" name="domainId" value="${d.id}">
            <input type="hidden" name="action" value="${attached ? 'detach' : 'attach'}">
            ${ADMIN_RETURN}
            <button type="submit" class="matrix-toggle${attached ? ' on' : ''}" aria-pressed="${attached}" title="${escapeHtml(title)}">${attached ? '✓' : '○'}</button>
          </form></td>`;
        })
        .join('');
      return `<tr><th scope="row"><span class="theme-dot" style="background:${escapeHtml(theme.color)}"></span> ${escapeHtml(theme.name)}</th>${cells}</tr>`;
    })
    .join('');
  return `<div class="matrix-scroll"><table class="matrix">
    <thead><tr><th scope="col">Thème</th>${head}</tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function renderArchiveRows(space, archives) {
  return archives
    .map(
      (archive) => `<tr>
        <td>${escapeHtml(archive.name)}</td>
        <td><span class="theme-chips">${themeChips(space, archive.labels)}</span></td>
        <td class="admin-actions-cell">
          <form method="post" action="/api/archives/${archive.id}/restore" class="inline-form">
            <button type="submit" class="btn" title="Restaurer ce domaine">Restaurer</button>
            ${ADMIN_RETURN}
          </form>
          <form method="post" action="/api/archives/${archive.id}/purge" class="inline-form" ${confirmSubmit(
            `Purger définitivement « ${archive.name} » ? Cette action est irréversible.`
          )}>
            <button type="submit" class="btn danger" title="Supprimer définitivement">Purger</button>
            ${ADMIN_RETURN}
          </form>
        </td>
      </tr>`
    )
    .join('');
}

async function renderAdminPage(space) {
  const archives = await listArchivedDomains(space);

  const themesSection = `<section class="admin-section" id="admin-themes">
    <h2>Thèmes</h2>
    <form method="post" action="/api/themes" class="admin-create">
      <input name="name" placeholder="Nom du thème" required autocomplete="off" aria-label="Nom du nouveau thème">
      <label class="color-field">Couleur <input type="color" name="color" value="${DEFAULT_THEME_COLORS[0]}"></label>
      <button type="submit" class="btn">Créer</button>
      ${ADMIN_RETURN}
    </form>
    ${
      space.themes.length
        ? `<ul class="admin-list">${renderThemeRows(space)}</ul>`
        : '<p class="admin-empty">Aucun thème — créez-en un ci-dessus.</p>'
    }
    <h3 class="admin-subtitle">Répartition thème × domaine</h3>
    ${renderMatrix(space)}
  </section>`;

  const domainsSection = `<section class="admin-section" id="admin-domains">
    <h2>Domaines</h2>
    <form method="post" action="/api/domains" class="admin-create">
      <input name="name" placeholder="Nom du domaine" required autocomplete="off" aria-label="Nom du nouveau domaine">
      <button type="submit" class="btn">Créer</button>
      ${ADMIN_RETURN}
    </form>
    ${
      space.domainList.length
        ? `<div class="admin-table-scroll"><table class="admin-table" id="admin-domains-table">
            <thead><tr><th scope="col">Nom</th><th scope="col">URL</th><th scope="col">Thèmes</th><th scope="col">Actions</th></tr></thead>
            <tbody>${renderDomainRows(space)}</tbody>
          </table></div>`
        : '<p class="admin-empty">Aucun domaine — créez-en un ci-dessus.</p>'
    }
  </section>`;

  const archivesSection = `<section class="admin-section" id="admin-archives">
    <h2>Archives</h2>
    <details class="admin-archives">
      <summary>Domaines archivés (${archives.length})</summary>
      ${
        archives.length
          ? `<div class="admin-table-scroll"><table class="admin-table" id="admin-archives-table">
              <thead><tr><th scope="col">Domaine</th><th scope="col">Thèmes</th><th scope="col">Actions</th></tr></thead>
              <tbody>${renderArchiveRows(space, archives)}</tbody>
            </table></div>`
          : '<p class="admin-empty">Aucun domaine archivé.</p>'
      }
    </details>
  </section>`;

  return renderShell(
    space,
    `<div class="admin">${themesSection}${domainsSection}${archivesSection}</div>`,
    null,
    { title: 'Administration', admin: true }
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

// The administration page works even with an empty space, so it is reachable
// before the first domain exists (unlike `/`, which has nothing to redirect to).
app.get('/administration', async (req, res) => {
  try {
    res.type('html').send(await renderAdminPage(req.space));
  } catch (err) {
    console.error('[docdoc] page d\u2019administration :', err.message);
    res.status(500).send('Administration indisponible');
  }
});

app.get('/domaine/:slug', (req, res) => {
  const domain = findDomainBySlug(req.space, req.params.slug);
  if (!domain) return res.status(404).send('Domaine introuvable');
  ensureDefaultProject(req.space, domain);
  res.type('html').send(renderPage(req.space, domain, expandIdsFor(domain, req)));
});

app.get('/domaine/:slug/outline-fragment', (req, res) => {
  const domain = findDomainBySlug(req.space, req.params.slug);
  if (!domain) return res.status(404).send('Domaine introuvable');
  ensureDefaultProject(req.space, domain);
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
  // Deleting the last line would leave an outline no gesture can fill: the
  // response already carries the replacement line (design D9). The helper writes
  // the domain; otherwise the deletion itself must be persisted.
  if (!ensureDefaultProject(req.space, domain)) persistDomain(req.space, domain);
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
  // A domain never starts empty: a root line is the only creation point of the
  // outline now that the "+ Nouveau projet" button is gone. The helper writes
  // the domain, so an explicit write is only needed when it did nothing.
  if (!ensureDefaultProject(req.space, domain)) persistDomain(req.space, domain);
  redirectAfter(req, res, '/administration');
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
  redirectAfter(req, res, `/domaine/${domain.slug}`);
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
  redirectAfter(req, res, '/');
});

app.post('/api/domains/:id/move', (req, res) => {
  const domain = findDomainById(req.space, req.params.id);
  if (!domain) return res.status(404).send('Domaine introuvable');
  const direction = req.body.dir === 'up' ? 'up' : req.body.dir === 'down' ? 'down' : null;
  if (!direction) return res.status(400).send('Direction requise');
  moveDomain(req.space, domain, direction);
  redirectAfter(req, res, '/administration');
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
  redirectAfter(req, res, backTo(req));
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
  redirectAfter(req, res, backTo(req));
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
  redirectAfter(req, res, backTo(req));
});

app.post('/api/themes/:id/move', (req, res) => {
  const theme = findThemeById(req.space, req.params.id);
  if (!theme) return res.status(404).send('Thème introuvable');
  const direction = req.body.dir === 'up' ? 'up' : req.body.dir === 'down' ? 'down' : null;
  if (!direction) return res.status(400).send('Direction requise');
  moveTheme(req.space, theme, direction);
  redirectAfter(req, res, '/administration');
});

// The matrix posts one cell at a time; the domain page's label picker uses the
// domain-scoped route below. Both go through setDomainLabel.
app.post('/api/themes/:id/labels', (req, res) => {
  const theme = findThemeById(req.space, req.params.id);
  if (!theme) return res.status(404).send('Thème introuvable');
  const domain = findDomainById(req.space, typeof req.body.domainId === 'string' ? req.body.domainId : '');
  if (!domain) return res.status(404).send('Domaine introuvable');
  const action = req.body.action === 'attach' || req.body.action === 'detach' ? req.body.action : null;
  if (!action) return res.status(400).send('Action requise');
  if (!setDomainLabel(req.space, domain, theme.id, action)) return res.status(404).send('Thème introuvable');
  // The sidebar and the matrix read the domain list's snapshot: a detach
  // replaces the labels array, so the snapshot must be rebuilt to reflect it.
  rebuildDomainList(req.space);
  persistDomain(req.space, domain);
  redirectAfter(req, res, '/administration');
});

app.post('/domaine/:slug/api/labels', (req, res) => {
  const domain = findDomainBySlug(req.space, req.params.slug);
  if (!domain) return res.status(404).send('Domaine introuvable');
  const action = req.body.action === 'attach' || req.body.action === 'detach' ? req.body.action : null;
  const themeId = typeof req.body.themeId === 'string' ? req.body.themeId : '';
  if (!action || !themeId) return res.status(400).send('Action et thème requis');

  if (!setDomainLabel(req.space, domain, themeId, action)) {
    return res.status(404).send('Thème introuvable');
  }
  // Same snapshot concern as the matrix route: a detach replaces `labels`.
  rebuildDomainList(req.space);
  persistDomain(req.space, domain);
  if (req.headers['hx-request']) {
    // Bar + sidebar in the same response: labels are the sidebar's grouping key,
    // so a fresh bar with a stale sidebar would be a visible contradiction.
    const nav = `<nav class="sidebar-nav" id="sidebar-nav" hx-swap-oob="outerHTML">${renderSidebarNav(req.space, domain.slug)}</nav>`;
    return res.type('html').send(renderLabelsBar(req.space, domain) + nav);
  }
  redirectAfter(req, res, `/domaine/${domain.slug}`);
});

/* ------------------------------------------------------------------ */
/* Archived domains (archives section of the administration page)      */
/* ------------------------------------------------------------------ */

app.post('/api/archives/:id/restore', async (req, res) => {
  const id = String(req.params.id);
  const key = storage.archiveKey(req.space.userId, id);
  const parsed = await storage.readJson(key);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return res.status(404).send('Archive introuvable');
  }
  if (parsed.id !== id || !Array.isArray(parsed.projects)) {
    return res.status(404).send('Archive introuvable');
  }
  if (req.space.domains.has(id)) return res.status(409).send('Domaine déjà actif');

  const domain = normalizeDomain(req.space.themes, parsed);
  // The archived slug may belong to an active domain now: regenerate it, and
  // append the restored domain after the existing ones.
  domain.slug = slugify(req.space, domain.name, domain.id);
  domain.order = nextOrder(req.space);
  req.space.domains.set(domain.id, domain);
  rebuildDomainList(req.space);
  persistDomain(req.space, domain);
  // Write the active object *before* deleting the archive: an interruption then
  // leaves a purgeable copy, never a lost domain (design D5).
  await req.space.writeQueue;
  await storage.deleteObject(key);
  redirectAfter(req, res, '/administration');
});

app.post('/api/archives/:id/purge', async (req, res) => {
  const id = String(req.params.id);
  const key = storage.archiveKey(req.space.userId, id);
  const parsed = await storage.readJson(key);
  if (!parsed) return res.status(404).send('Archive introuvable');
  await storage.deleteObject(key);
  redirectAfter(req, res, '/administration');
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
