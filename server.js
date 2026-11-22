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
const { installabilityHead } = require('./pwa-head');

const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, sliding

// Version of the running image: the release tag the pipeline passes as
// `--build-arg APP_VERSION`, which the final Dockerfile stage exposes in the
// environment. Empty when the app runs from the working tree (`npm start`, a
// plain `docker build`): the Help page then reports a development build instead
// of inventing a number.
const APP_VERSION = String(process.env.APP_VERSION || '').trim();

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

// The portable backup document. `version` is bumped whenever the shape changes
// in a way an older importer could misread; the reader accepts exactly the
// version it knows. A whole account is text, so 10 MiB leaves ample headroom
// while keeping a single request bounded.
const BACKUP_FORMAT = 'docdoc-backup';
const BACKUP_VERSION = 1;
const BACKUP_MAX_BYTES = 10 * 1024 * 1024;

const app = express();
app.set('trust proxy', 1);
// The restore body is the backup file itself: raw `application/json`, not a
// multipart form, so no upload dependency is needed. The parser is mounted only
// on that route and before the global `express.json()`, whose 100 kb default
// stays untouched for every other request. The error handler turns the parser's
// own 413 into the plain-text message the restore page displays.
app.use('/api/restore', express.raw({ type: 'application/json', limit: '10mb' }));
app.use('/api/restore', (err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).type('text/plain').send('Sauvegarde trop volumineuse (10 Mo maximum).');
  }
  return next(err);
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Installability files are public and declared before `express.static` so their
// content type is exact and their caching policy is explicit: a manifest or a
// service worker left in the HTTP cache would delay a deployment for hours.
// `cacheControl` is disabled so the `Cache-Control` set here is the one sent.
const PUBLIC_DIR = path.join(__dirname, 'public');

app.get('/manifest.webmanifest', (req, res) => {
  res.type('application/manifest+json');
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(PUBLIC_DIR, 'manifest.webmanifest'), { cacheControl: false });
});

app.get('/sw.js', (req, res) => {
  res.type('text/javascript');
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(PUBLIC_DIR, 'sw.js'), { cacheControl: false });
});

app.use(express.static(PUBLIC_DIR));

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
    // Manual order of the home board, one list of node ids per rubrique. Empty
    // until the user reorders a card: the board then keeps its natural order.
    homeOrder: { in_progress: [], waiting: [] },
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
  await loadHomeOrder(space);
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

// A return target is trusted only as a same-origin absolute path: one leading
// slash, no protocol-relative `//`, no backslash and no control character. The
// sidebar's move forms render the current page path, but the POST body is
// user-controlled, so the value is still validated before a redirect.
function localPath(value) {
  if (typeof value !== 'string' || value[0] !== '/' || value.startsWith('//')) return null;
  if (value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return null;
  return value;
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

// The four persisted line statuses. `todo` is the unstarted state ("En projet"
// on a domain page), `in_progress` is the active state ("En cours" there, and
// the "À faire" sub-state on the home board), `waiting` is the other sub-state
// ("En attente"), and `done` is "Terminé". Applying any status clears the
// previous one.
const VALID_STATUSES = ['todo', 'in_progress', 'waiting', 'done'];

// The three status actions offered by a line's context menu. `waiting` is
// deliberately absent: it is a sub-state of `in_progress` chosen from the home
// page, not a planning state of the domain page. Each action keeps a distinct
// glyph so the menu stays icon-only.
const MENU_STATUSES = [
  { id: 'todo', label: 'En projet', icon: '○' },
  { id: 'in_progress', label: 'En cours', icon: '◐' },
  { id: 'done', label: 'Terminé', icon: '●' },
];

// The two GTD rubriques of the home board. Each rubrique maps one-to-one to the
// status written when a card is dropped or moved from the rubrique menu; both
// are sub-states of "En cours" and are shown under that heading.
const GTD_RUBRIQUES = [
  { id: 'in_progress', label: 'À faire' },
  { id: 'waiting', label: 'En attente' },
];

/* --- Manual order of the home board -------------------------------- */

// The order is a per-account document with one list of node ids per rubrique.
// Unknown keys, non-string values and duplicates are dropped, and a missing or
// malformed document means "no manual order": the board keeps its natural
// domain-then-outline order.
function normalizeHomeOrder(raw) {
  const order = { in_progress: [], waiting: [] };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return order;
  for (const rubrique of GTD_RUBRIQUES) {
    const list = raw[rubrique.id];
    if (!Array.isArray(list)) continue;
    const seen = new Set();
    for (const value of list) {
      if (typeof value !== 'string' || !value || seen.has(value)) continue;
      seen.add(value);
      order[rubrique.id].push(value);
    }
  }
  return order;
}

async function loadHomeOrder(space) {
  const parsed = await storage.readJson(storage.homeOrderKey(space.userId));
  space.homeOrder = normalizeHomeOrder(parsed);
}

function persistHomeOrder(space) {
  // Copy the arrays so a later reorder cannot mutate the document while it is
  // queued behind another write.
  const payload = {
    in_progress: [...space.homeOrder.in_progress],
    waiting: [...space.homeOrder.waiting],
  };
  space.writeQueue = space.writeQueue
    .then(() => storage.writeJson(storage.homeOrderKey(space.userId), payload))
    .catch((err) => {
      console.error('Erreur d\u2019\u00e9criture de l\u2019ordre de l\u2019accueil:', err);
    });
  return space.writeQueue;
}

// Apply the recorded order to one rubrique's natural entries: ids that are
// still listed keep their recorded position, then every other entry follows in
// its natural order. A missing document therefore yields the natural order,
// and a newly listed task is appended at the end.
function orderHomeEntries(space, rubrique, entries) {
  const remaining = new Map();
  for (const entry of entries) remaining.set(entry.node.id, entry);
  const ordered = [];
  for (const id of space.homeOrder[rubrique] || []) {
    const entry = remaining.get(id);
    if (!entry) continue;
    remaining.delete(id);
    ordered.push(entry);
  }
  for (const entry of entries) {
    if (!remaining.has(entry.node.id)) continue;
    remaining.delete(entry.node.id);
    ordered.push(entry);
  }
  return ordered;
}

// Legacy `someday` values (and any unknown value read from disk) fall back to
// `todo` ("En projet"). It is applied when a domain is loaded, so no migration
// script is needed: the normalized value is persisted on the next write.
function normalizeStatus(status) {
  return VALID_STATUSES.includes(status) ? status : 'todo';
}

function normalizeNodes(nodes) {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((node) => ({
    ...node,
    status: normalizeStatus(node.status),
    children: normalizeNodes(node.children || []),
  }));
}

function statusClass(status) {
  return status === 'in_progress'
    ? 'status-in-progress'
    : status === 'done'
      ? 'status-done'
      : status === 'waiting'
        ? 'status-waiting'
        : '';
}

function normalizeDomain(themes, raw) {
  // Keep only theme ids that still exist in the palette (prune orphans from
  // manual file edits or a removed theme). Default to [] for files written
  // before the `labels` field existed.
  const labels = Array.isArray(raw.labels)
    ? raw.labels.map(String).filter((id) => themes.some((t) => t.id === id))
    : [];
  const projects = normalizeNodes(raw.projects);
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

// Full archived domains, for the backup document. The administration list only
// needs a summary; the backup must carry the outline, labels and display order
// so a restore can bring an archive back intact.
async function readArchivedDomains(space) {
  const keys = await storage.listArchiveKeys(space.userId);
  const archives = [];
  for (const key of keys) {
    const parsed = await storage.readJson(key);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
    if (typeof parsed.id !== 'string' || !Array.isArray(parsed.projects)) continue;
    const domain = normalizeDomain(space.themes, parsed);
    domain.displayOrder = ensureDisplayOrder(domain.projects, domain.displayOrder);
    archives.push(domain);
  }
  archives.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return archives;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

class BackupValidationError extends Error {}

function rejectBackup(message) {
  throw new BackupValidationError(message);
}

// Validate the manual order of the home board. A document written before this
// field existed simply has no `homeOrder`: it then restores an empty order,
// which is the intended "replace everything" behavior. Duplicates are dropped
// and unknown keys are ignored; anything else than a string id is refused.
function validateBackupHomeOrder(raw) {
  const order = { in_progress: [], waiting: [] };
  if (raw === undefined) return order;
  if (!isPlainObject(raw)) {
    rejectBackup("L'ordre manuel de la page d'accueil n'est pas un objet.");
  }
  for (const rubrique of GTD_RUBRIQUES) {
    const list = raw[rubrique.id];
    if (list === undefined) continue;
    if (!Array.isArray(list)) {
      rejectBackup(`L'ordre de la rubrique « ${rubrique.label} » n'est pas une liste.`);
    }
    const seen = new Set();
    for (const value of list) {
      if (typeof value !== 'string' || !value) {
        rejectBackup(
          `Un identifiant de l'ordre de la rubrique « ${rubrique.label} » n'est pas textuel.`
        );
      }
      if (seen.has(value)) continue;
      seen.add(value);
      order[rubrique.id].push(value);
    }
  }
  return order;
}

// Validate the task tree and return it with the same defaults the application
// applies when it loads a domain: a missing title is empty, a missing status is
// "todo", a missing collapsed flag is false. Unknown fields are preserved.
function validateBackupNodes(nodes, domainName, seen) {
  if (!Array.isArray(nodes)) {
    rejectBackup(`Le domaine « ${domainName} » contient une liste de tâches invalide.`);
  }
  return nodes.map((raw) => {
    if (!isPlainObject(raw)) {
      rejectBackup(`Une tâche du domaine « ${domainName} » n'est pas un objet.`);
    }
    if (typeof raw.id !== 'string' || !raw.id) {
      rejectBackup(`Une tâche du domaine « ${domainName} » n'a pas d'identifiant.`);
    }
    if (seen.has(raw.id)) {
      rejectBackup(`L'identifiant de tâche « ${raw.id} » est dupliqué dans le domaine « ${domainName} ».`);
    }
    seen.add(raw.id);
    if (raw.title !== undefined && typeof raw.title !== 'string') {
      rejectBackup(`Le titre de la tâche « ${raw.id} » du domaine « ${domainName} » n'est pas textuel.`);
    }
    // `someday` is a legacy value: backups exported before the reduction to
    // three project states still contain it and must remain restorable.
    const legacyStatus = raw.status === 'someday';
    if (raw.status !== undefined && !VALID_STATUSES.includes(raw.status) && !legacyStatus) {
      rejectBackup(`Statut inconnu pour la tâche « ${raw.id} » du domaine « ${domainName} ».`);
    }
    if (raw.collapsed !== undefined && typeof raw.collapsed !== 'boolean') {
      rejectBackup(`L'état de repli de la tâche « ${raw.id} » du domaine « ${domainName} » est invalide.`);
    }
    if (raw.children !== undefined && !Array.isArray(raw.children)) {
      rejectBackup(`Les sous-tâches de « ${raw.id} » du domaine « ${domainName} » ne sont pas une liste.`);
    }
    return {
      ...raw,
      title: typeof raw.title === 'string' ? raw.title : '',
      status: normalizeStatus(raw.status),
      collapsed: typeof raw.collapsed === 'boolean' ? raw.collapsed : false,
      children: validateBackupNodes(raw.children || [], domainName, seen),
    };
  });
}

function validateBackupDomain(raw, kind, themeIds, ids, activeSlugs) {
  const label = kind === 'archive' ? 'archive' : 'domaine';
  if (!isPlainObject(raw)) {
    rejectBackup(`Un ${label} de la sauvegarde n'est pas un objet.`);
  }
  if (typeof raw.id !== 'string' || !raw.id) {
    rejectBackup(`Un ${label} de la sauvegarde n'a pas d'identifiant.`);
  }
  if (ids.has(raw.id)) {
    rejectBackup(`Identifiant de ${label} dupliqué dans la sauvegarde : « ${raw.id} ».`);
  }
  ids.add(raw.id);
  if (typeof raw.name !== 'string') {
    rejectBackup(`Le nom du ${label} « ${raw.id} » n'est pas textuel.`);
  }
  if (typeof raw.slug !== 'string') {
    rejectBackup(`Le slug du ${label} « ${raw.name} » n'est pas textuel.`);
  }
  if (typeof raw.order !== 'number' || !Number.isFinite(raw.order)) {
    rejectBackup(`L'ordre du ${label} « ${raw.name} » n'est pas un nombre.`);
  }
  if (!Array.isArray(raw.labels)) {
    rejectBackup(`Les libellés du ${label} « ${raw.name} » ne sont pas une liste.`);
  }
  for (const labelId of raw.labels) {
    if (typeof labelId !== 'string' || !themeIds.has(labelId)) {
      rejectBackup(`Le libellé « ${labelId} » du ${label} « ${raw.name} » ne correspond à aucun thème.`);
    }
  }
  if (raw.displayOrder !== undefined) {
    if (!Array.isArray(raw.displayOrder) || raw.displayOrder.some((id) => typeof id !== 'string')) {
      rejectBackup(`L'ordre d'affichage du ${label} « ${raw.name} » est invalide.`);
    }
  }
  if (!Array.isArray(raw.projects)) {
    rejectBackup(`Le ${label} « ${raw.name} » n'a pas de liste de projets.`);
  }
  const projects = validateBackupNodes(raw.projects, raw.name || raw.id, new Set());
  if (kind === 'domain') {
    if (activeSlugs.has(raw.slug)) {
      rejectBackup(`Deux domaines actifs partagent le slug « ${raw.slug} ».`);
    }
    activeSlugs.add(raw.slug);
  }
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    order: raw.order,
    labels: [...raw.labels],
    projects,
    displayOrder: ensureDisplayOrder(projects, Array.isArray(raw.displayOrder) ? raw.displayOrder : []),
  };
}

// Validate the whole document before the first write (design D4). The returned
// value is the document normalized for storage: repaired display orders, node
// defaults, themes reduced to id/name/color. Nothing is written here.
function validateBackup(doc) {
  try {
    if (!isPlainObject(doc)) rejectBackup("Le document n'est pas un objet JSON.");
    if (doc.format !== BACKUP_FORMAT) rejectBackup("Ce fichier n'est pas une sauvegarde docdoc.");
    if (doc.version !== BACKUP_VERSION) {
      rejectBackup(`Version de sauvegarde non prise en charge : ${String(doc.version)}.`);
    }
    if (typeof doc.exportedAt !== 'string') rejectBackup("La date d'export de la sauvegarde est absente.");
    if (!Array.isArray(doc.themes) || !Array.isArray(doc.domains) || !Array.isArray(doc.archives)) {
      rejectBackup('La sauvegarde doit contenir les listes themes, domains et archives.');
    }

    const themes = [];
    const themeIds = new Set();
    for (const raw of doc.themes) {
      if (!isPlainObject(raw)) rejectBackup("Un thème de la sauvegarde n'est pas un objet.");
      if (typeof raw.id !== 'string' || !raw.id) rejectBackup("Un thème de la sauvegarde n'a pas d'identifiant.");
      if (themeIds.has(raw.id)) rejectBackup(`Identifiant de thème dupliqué dans la sauvegarde : « ${raw.id} ».`);
      if (typeof raw.name !== 'string' || !raw.name) rejectBackup(`Le thème « ${raw.id} » n'a pas de nom.`);
      if (typeof raw.color !== 'string' || !raw.color) {
        rejectBackup(`Le thème « ${raw.name} » n'a pas de couleur.`);
      }
      themeIds.add(raw.id);
      themes.push({ id: raw.id, name: raw.name, color: raw.color });
    }

    const ids = new Set();
    const activeSlugs = new Set();
    const domains = doc.domains.map((raw) => validateBackupDomain(raw, 'domain', themeIds, ids, activeSlugs));
    const archives = doc.archives.map((raw) => validateBackupDomain(raw, 'archive', themeIds, ids, activeSlugs));
    const homeOrder = validateBackupHomeOrder(doc.homeOrder);
    return { ok: true, value: { themes, domains, archives, homeOrder } };
  } catch (err) {
    if (err instanceof BackupValidationError) return { ok: false, message: err.message };
    throw err;
  }
}

async function exportBackup(space) {
  await space.writeQueue;
  const themes = space.themes.map(({ id, name, color }) => ({ id, name, color }));
  const domains = [...space.domains.values()]
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    .map((domain) => {
      domain.displayOrder = ensureDisplayOrder(domain.projects, domain.displayOrder);
      return domainPayload(domain);
    });
  const archives = (await readArchivedDomains(space)).map((domain) => domainPayload(domain));
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    themes,
    domains,
    archives,
    homeOrder: {
      in_progress: [...space.homeOrder.in_progress],
      waiting: [...space.homeOrder.waiting],
    },
  };
}

// Whole-space replacement (design D3). New objects are written before the
// objects absent from the file are deleted, so an interruption never removes
// data that has no copy in the backup; re-running the same file finishes the job
// (design D5). Only the account's data families are addressed here: account.json,
// passkeys and the lookup indexes are never touched.
async function restoreBackup(space, backup) {
  const userId = space.userId;
  await space.writeQueue;
  const currentDomainKeys = await storage.listDomainKeys(userId);
  const currentArchiveKeys = await storage.listArchiveKeys(userId);
  const targetDomainKeys = new Set(backup.domains.map((domain) => storage.domainKey(userId, domain.id)));
  const targetArchiveKeys = new Set(backup.archives.map((archive) => storage.archiveKey(userId, archive.id)));

  await storage.writeJson(storage.themesKey(userId), backup.themes);
  await storage.writeJson(storage.homeOrderKey(userId), backup.homeOrder);
  for (const domain of backup.domains) {
    await storage.writeJson(storage.domainKey(userId, domain.id), domain);
  }
  for (const archive of backup.archives) {
    await storage.writeJson(storage.archiveKey(userId, archive.id), archive);
  }
  for (const key of currentDomainKeys) {
    if (!targetDomainKeys.has(key)) await storage.deleteObject(key);
  }
  for (const key of currentArchiveKeys) {
    if (!targetArchiveKeys.has(key)) await storage.deleteObject(key);
  }
  return { themes: backup.themes.length, domains: backup.domains.length, archives: backup.archives.length };
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

// A project created from the domain page goes to the head of the outline: before
// every other line, including the sub-lines of the former first project. The
// display order is normalized first, so a stale or partial order (legacy data,
// restore) cannot leave the new id behind lines that `ensureDisplayOrder`
// appends afterwards — the new line must really be first.
function createProjectAtHead(domain) {
  const node = { id: genId(), title: defaultTitle(null), status: 'todo', collapsed: false, children: [] };
  const order = ensureDisplayOrder(domain.projects, domain.displayOrder);
  domain.projects.unshift(node);
  order.unshift(node.id);
  domain.displayOrder = order;
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

// Inline task links inside a title: `[label](/domaine/<slug>?reveal=<id>#node-<id>)`.
// Only internal deep links are recognized, and `reveal` must carry the same id
// as the fragment. Keep this source in sync with `TASK_LINK_SOURCE` in
// public/app.js: the client uses the same grammar to edit and paste titles.
const TASK_LINK_SOURCE =
  '\\[([^\\[\\]\\n]+)\\]\\(/domaine/([a-z0-9-]+)\\?reveal=([A-Za-z0-9-]+)#node-\\3\\)';

function taskLinkRegex() {
  return new RegExp(TASK_LINK_SOURCE, 'g');
}

// Render a title as escaped text plus one anchor per valid inline task link.
// The title itself remains the source string; only its rendering is enriched.
function renderTitleHtml(title) {
  const text = String(title);
  let html = '';
  let last = 0;
  const re = taskLinkRegex();
  let match;
  while ((match = re.exec(text)) !== null) {
    html += escapeHtml(text.slice(last, match.index));
    const href = `/domaine/${match[2]}?reveal=${match[3]}#node-${match[3]}`;
    html += `<a class="title-link" href="${escapeHtml(href)}" draggable="false">${escapeHtml(match[1])}</a>`;
    last = match.index + match[0].length;
  }
  return html + escapeHtml(text.slice(last));
}

// The visible text of a title: each valid inline task link is replaced by its
// label, keeping the text around it. Used where the title must stay plain text,
// e.g. inside the single anchor of a homepage entry, where an inner anchor
// would be invalid HTML and an ambiguous click target.
function titleLabel(title) {
  return String(title).replace(taskLinkRegex(), '$1');
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
function renderLine(entry, slug, collapsed) {
  const node = entry.node;
  const statusCls = statusClass(node.status);

  // The scope is read from the live selection at request time: if the head line
  // has one of its sub-lines selected ('subtree'), the status cascades to the
  // whole displayed subtree; otherwise the selection is narrowed to the head
  // line only ('head') and the status applies to that single line. The subtree
  // is resolved by depth on the client (see `outlineSubtreeHasSelected` in
  // public/app.js), not by DOM nesting.
  const scopeExpr = (st) =>
    `js:{status:"${st}", scope:window.outlineSubtreeHasSelected && window.outlineSubtreeHasSelected(this) ? "subtree" : "head"}`;
  // "En cours" covers both sub-states of the active work: a `waiting` line is
  // shown with the in-progress action active, and choosing it brings the line
  // back to "À faire" (`in_progress`).
  const statusBtn = (action) => {
    const active =
      node.status === action.id ||
      (action.id === 'in_progress' && node.status === 'waiting');
    return `<button type="button" class="menu-item${active ? ' active' : ''}" hx-post="/domaine/${slug}/api/nodes/${node.id}/status" hx-vals='${scopeExpr(action.id)}' hx-target="#outline" hx-swap="outerHTML" title="${action.label}">${action.icon}</button>`;
  };

  // The add-child action (+) is handled client-side (like copy-link and
  // rename), but it needs a server round-trip: the client reads the new node's
  // id from the X-New-Node-Id response header to open its title in edit mode.
  const menu =
    '<div class="menu">' +
    MENU_STATUSES.map(statusBtn).join('') +
    `<button type="button" class="menu-item copy-link" title="Copier le lien">🔗</button>` +
    `<button type="button" class="menu-item rename" title="Renommer">✎</button>` +
    `<button type="button" class="menu-item" hx-post="/domaine/${slug}/api/nodes/${node.id}/indent" hx-target="#outline" hx-swap="outerHTML" title="Indenter">→</button>` +
    `<button type="button" class="menu-item" hx-post="/domaine/${slug}/api/nodes/${node.id}/outdent" hx-target="#outline" hx-swap="outerHTML" title="Désindenter">←</button>` +
    `<button type="button" class="menu-item add-child" title="Ajouter une tâche">+</button>` +
    `<button type="button" class="menu-item danger" hx-delete="/domaine/${slug}/api/nodes/${node.id}" hx-target="#outline" hx-swap="outerHTML" title="Supprimer">🗑</button>` +
    '</div>';

  // A collapsed line hides its sub-lines, so its bullet becomes the only clue
  // that the line is composed of sub-tasks: it stays visible without hover and
  // carries a ring (`.bullet-subtasks`), drawn by CSS over the existing slot.
  const ariaLabel = collapsed
    ? 'Sélectionner la ligne — repliée, contient des sous-tâches masquées'
    : 'Sélectionner la ligne';
  const subtasksMark = collapsed
    ? '<span class="bullet-subtasks" aria-hidden="true"></span>'
    : '';

  return (
    `<li class="line${collapsed ? ' collapsed' : ''}" id="node-${node.id}" data-id="${node.id}" data-parent="${entry.parent ? entry.parent.id : ''}" data-depth="${entry.depth}" style="--depth:${entry.depth}">` +
    // One button, two glyphs: the dot is the selection control, the grip tells
    // the user the selected head line can be grabbed to move it. CSS switches
    // them on `.line.selected-head`, so no client code keeps them in sync and
    // the title never shifts (both share the same slot).
    `<button class="bullet" type="button" title="Sélectionner — glisser pour déplacer" aria-label="${ariaLabel}" draggable="true">` +
    '<span class="bullet-dot" aria-hidden="true">●</span>' +
    '<span class="bullet-grip" aria-hidden="true">⠿</span>' +
    subtasksMark +
    '</button>' +
    `<span class="title ${statusCls}" data-id="${node.id}" data-title="${escapeHtml(node.title)}">${renderTitleHtml(node.title)}</span>` +
    menu +
    '</li>'
  );
}

// A line is displayed collapsed when it has children and its persisted
// `collapsed` flag is set — unless `?reveal` force-expanded one of its
// descendants, in which case the line is shown expanded and must not be
// presented as collapsed.
function isDisplayedCollapsed(node, expandIds) {
  return (
    node.children.length > 0 &&
    Boolean(node.collapsed) &&
    !(expandIds && expandIds.has(node.id))
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
      const collapsed = isDisplayedCollapsed(node, expandIds);
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
    lines.push(renderLine(entry, slug, isDisplayedCollapsed(entry.node, expandIds)));
  }
  return `<ul id="outline" class="outline">${lines.join('')}</ul>`;
}

// One row of the domain list: the navigation link plus its two reorder
// controls. The controls are ordinary POST forms, so the list works without
// JavaScript and both entry points write the same `order` as the administration
// page. They are disabled at the ends rather than sending a no-op request.
function sidebarMoveForm(domain, direction, enabled, returnTo) {
  const label = direction === 'up' ? 'Monter' : 'Descendre';
  const named = `${label} « ${escapeHtml(domain.name)} »`;
  return (
    `<form method="post" action="/api/domains/${domain.id}/move" class="sidebar-move">` +
    `<input type="hidden" name="dir" value="${direction}">` +
    `<input type="hidden" name="returnTo" value="${escapeHtml(returnTo)}">` +
    `<button type="submit" class="btn-mini sidebar-move-btn" title="${named}" aria-label="${named}"${enabled ? '' : ' disabled'}>${direction === 'up' ? '↑' : '↓'}</button>` +
    '</form>'
  );
}

function sidebarDomainRow(domain, activeSlug, returnTo, index, total) {
  const active = domain.slug === activeSlug;
  const link =
    `<a class="sidebar-link${active ? ' active' : ''}" href="/domaine/${domain.slug}">` +
    `${escapeHtml(domain.name)}</a>`;
  return (
    '<div class="sidebar-domain">' +
    link +
    '<span class="sidebar-order">' +
    sidebarMoveForm(domain, 'up', index > 0, returnTo) +
    sidebarMoveForm(domain, 'down', index < total - 1, returnTo) +
    '</span>' +
    '</div>'
  );
}

function renderSidebarNav(space, activeSlug, returnTo) {
  // A single-level navigation list: one entry per active domain, in the manual
  // order carried by `space.domainList`. Themes are labels managed on the domain
  // page and in the administration; they no longer group the panel, so a domain
  // carrying several themes appears exactly once. The two move controls of a
  // row are the only mutation the panel offers.
  const rows = space.domainList
    .map((d, index) => sidebarDomainRow(d, activeSlug, returnTo, index, space.domainList.length))
    .join('');
  return rows || '<p class="sidebar-empty">Aucun domaine</p>';
}

function renderSidebar(space, activeSlug, opts = {}) {
  const homeActive = Boolean(opts.home);
  const adminActive = Boolean(opts.admin);
  const helpActive = Boolean(opts.help);

  // The reorder forms return to the page they were submitted from, so a move
  // never navigates away from what the user is reading.
  const currentPath = homeActive
    ? '/'
    : adminActive
      ? '/administration'
      : helpActive
        ? '/aide'
        : activeSlug
          ? `/domaine/${activeSlug}`
          : '/';

  return `<aside class="sidebar" id="sidebar">
      <div class="sidebar-top" id="sidebar-top">
        <a class="sidebar-link sidebar-home${homeActive ? ' active' : ''}" href="/"${homeActive ? ' aria-current="page"' : ''}>Accueil</a>
      </div>
      <div class="sidebar-header">Domaines</div>
      <nav class="sidebar-nav" id="sidebar-nav">${renderSidebarNav(space, activeSlug, currentPath)}</nav>
      <div class="sidebar-footer">
        <nav class="sidebar-extra">
          <a class="sidebar-link sidebar-admin${adminActive ? ' active' : ''}" href="/administration"${adminActive ? ' aria-current="page"' : ''}>Administration</a>
          <a class="sidebar-link sidebar-help${helpActive ? ' active' : ''}" href="/aide"${helpActive ? ' aria-current="page"' : ''}>Aide</a>
        </nav>
        <div class="install-box" id="install-box">
          <button type="button" class="btn-mini install-btn" id="install-btn" hidden>Installer l'application</button>
          <p class="install-hint" id="install-hint" hidden>Partager → « Sur l'écran d'accueil »</p>
        </div>
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
  ${installabilityHead()}
  <link rel="stylesheet" href="/style.css">
</head>
<body class="${opts.labelsBar ? 'has-labels-bar' : ''}" data-domain-slug="${escapeHtml(activeSlug || '')}">
  <div class="shell">
    ${renderSidebar(space, activeSlug, opts)}
    <div class="content">
      <header class="topbar${opts.ancestry ? ' topbar-sticky' : ''}" id="topbar">
        <button type="button" class="btn sidebar-toggle" id="sidebar-toggle" title="Afficher/masquer le panneau">☰</button>
        <h1>${escapeHtml(opts.title || 'Mes projets')}</h1>
        ${
          opts.addProject
            ? '<button type="button" class="btn-mini topbar-add" id="add-project" title="Ajouter un projet" aria-label="Ajouter un projet">+</button>'
            : ''
        }
        ${
          opts.ancestry
            ? '<nav class="ancestry" id="ancestry" aria-label="Hiérarchie des tâches mères"></nav>'
            : ''
        }
      </header>
      <main>${content}</main>
    </div>
  </div>
  <script src="/htmx.min.js"></script>
  <script src="/app.js"></script>
  <script src="/pwa.js"></script>
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
    { title: domain.name, labelsBar: true, ancestry: true, addProject: true }
  );
}

// The parent chain of a line, top-down: the level-1 project first, the immediate
// parent last. Read from the outline index (parent pointers), so it follows the
// tree no matter how the lines are displayed.
function ancestorChain(index, id) {
  const chain = [];
  let entry = index.get(id);
  while (entry && entry.parent) {
    chain.unshift(entry.parent);
    entry = index.get(entry.parent.id);
  }
  return chain;
}

// The GTD rubrique of a leaf line, or null when the line is not listed on the
// home board. Only the two sub-states of "En cours" are listed: `in_progress`
// ("À faire") and `waiting` ("En attente"). `todo` ("En projet"), `done`,
// legacy `someday` (normalized to `todo` on load) and lines with children never
// appear. The board only reads the in-memory space: a GET must not create the
// default project of an empty domain nor persist anything.
function homeRubrique(node) {
  if (!node || (node.children && node.children.length)) return null;
  if (node.status === 'in_progress' || node.status === 'waiting') {
    return node.status;
  }
  return null;
}

// Group every listed leaf into the two rubriques in the natural order — sidebar
// domain order, then the outline's display order — then apply the account's
// manual order. The natural order is what a rubrique shows until a card is
// moved; the recorded order then takes precedence, and any card without a
// recorded position is appended at the end. The route `/api/home/order` is the
// only writer of that order.
function homeBoard(space) {
  const buckets = { in_progress: [], waiting: [] };
  for (const summary of space.domainList) {
    const domain = space.domains.get(summary.id);
    if (!domain) continue;
    const index = indexOutline(domain.projects);
    for (const id of ensureDisplayOrder(domain.projects, domain.displayOrder)) {
      const entry = index.get(id);
      if (!entry) continue;
      const rubrique = homeRubrique(entry.node);
      if (!rubrique) continue;
      buckets[rubrique].push({
        domain,
        node: entry.node,
        ancestors: ancestorChain(index, entry.node.id),
      });
    }
  }
  for (const rubrique of GTD_RUBRIQUES) {
    buckets[rubrique.id] = orderHomeEntries(space, rubrique.id, buckets[rubrique.id]);
  }
  return buckets;
}

// One card of the home board. The title is the existing deep link (the only
// clickable text); the grip, the up/down arrows and the rubrique menu are
// separate controls so a drag never follows the link. The arrows request a
// position one step away and are disabled at the ends; the menu appends to the
// target rubrique (no `index`). The title is plain text because an inline task
// link would nest an anchor inside the card's anchor.
function homeTaskCard(domain, node, ancestors, rubrique, position, total) {
  const href = `/domaine/${domain.slug}?reveal=${node.id}#node-${node.id}`;
  const title = escapeHtml(titleLabel(node.title));
  const chain = ancestors
    .map(
      (ancestor) =>
        `<span class="home-task-hop">` +
        `<span class="home-task-sep" aria-hidden="true">›</span>` +
        `<span class="home-task-parent">${escapeHtml(titleLabel(ancestor.title))}</span>` +
        `</span>`
    )
    .join('');
  const positionVals = (index) =>
    escapeHtml(
      JSON.stringify({
        domain: domain.slug,
        node: node.id,
        rubrique,
        index,
      })
    );
  const orderButton = (direction, index, disabled, label, glyph) =>
    `<button type="button" class="gtd-order-btn" data-dir="${direction}"` +
    ` aria-label="${label}" title="${label}"` +
    ` hx-post="/api/home/order" hx-vals='${positionVals(index)}'` +
    ` hx-target="#home-board" hx-swap="outerHTML"${disabled ? ' disabled' : ''}>${glyph}</button>`;
  const moveChoice = (target) => {
    if (target.id === rubrique) {
      return `<button type="button" class="gtd-move-item current" disabled aria-current="true">${target.label}</button>`;
    }
    const vals = escapeHtml(
      JSON.stringify({
        domain: domain.slug,
        node: node.id,
        rubrique: target.id,
      })
    );
    return (
      `<button type="button" class="gtd-move-item" hx-post="/api/home/order"` +
      ` hx-vals='${vals}' hx-target="#home-board" hx-swap="outerHTML">${target.label}</button>`
    );
  };
  return (
    `<li class="gtd-card" id="gtd-node-${escapeHtml(node.id)}" draggable="true"` +
    ` data-domain="${escapeHtml(domain.slug)}" data-node="${escapeHtml(node.id)}" data-rubrique="${rubrique}">` +
    `<button class="gtd-grip" type="button" draggable="true" title="Déplacer la tâche" aria-label="Déplacer « ${title} »">⠿</button>` +
    `<div class="gtd-card-body">` +
    `<a class="gtd-card-title" href="${escapeHtml(href)}" draggable="false">${title}</a>` +
    `<span class="home-task-context gtd-card-context">` +
    `<span class="home-task-domain">${escapeHtml(domain.name)}</span>` +
    `${chain}` +
    `</span>` +
    `</div>` +
    `<div class="gtd-order">` +
    orderButton('up', position - 1, position <= 0, `Monter « ${title} »`, '↑') +
    orderButton('down', position + 1, position >= total - 1, `Descendre « ${title} »`, '↓') +
    `</div>` +
    `<details class="gtd-move">` +
    `<summary class="gtd-move-summary" title="Changer de rubrique" aria-label="Changer la rubrique de « ${title} »">⋯</summary>` +
    `<div class="gtd-move-menu">` +
    `<span class="gtd-move-label">Changer de rubrique</span>` +
    GTD_RUBRIQUES.map(moveChoice).join('') +
    `</div>` +
    `</details>` +
    `</li>`
  );
}

// The board fragment is the response of `/api/home/order` (and of the
// `vue=accueil` status mutation kept for existing callers), so htmx replaces it
// in one piece. The two rubriques are grouped under the visible "En cours"
// heading; an empty one shows a message instead of a list.
function renderHomeBoard(space) {
  const buckets = homeBoard(space);
  const columns = GTD_RUBRIQUES.map((rubrique) => {
    const entries = buckets[rubrique.id];
    const cards = entries
      .map(({ domain, node, ancestors }, position) =>
        homeTaskCard(domain, node, ancestors, rubrique.id, position, entries.length)
      )
      .join('');
    const body = cards
      ? `<ul class="gtd-list">${cards}</ul>`
      : '<p class="gtd-empty">Aucune tâche</p>';
    return (
      `<section class="gtd-column" data-gtd="${rubrique.id}" aria-labelledby="gtd-${rubrique.id}-heading">` +
      `<header class="gtd-column-head"><h3 id="gtd-${rubrique.id}-heading">${rubrique.label}` +
      ` <span class="gtd-count">${entries.length}</span></h3></header>` +
      body +
      `</section>`
    );
  }).join('');
  return (
    `<div id="home-board" class="gtd-board-wrap" aria-label="Tâches en cours">` +
    `<h2 class="gtd-group-title">En cours</h2>` +
    `<div class="gtd-board">${columns}</div>` +
    `</div>`
  );
}

function renderHomePage(space) {
  let content;
  if (!space.domainList.length) {
    content =
      '<div class="empty-state"><h2>Aucun domaine</h2><p>Créez un domaine depuis la page <a href="/administration">Administration</a> pour regrouper vos projets.</p></div>';
  } else {
    // The announcer lives outside the board so it survives each htmx swap.
    content =
      renderHomeBoard(space) +
      '<p id="gtd-announcer" class="sr-only" aria-live="polite"></p>';
  }
  return renderShell(space, content, null, { title: 'Tableau de bord', home: true });
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

async function renderAdminPage(space, opts = {}) {
  const archives = await listArchivedDomains(space);
  const restored = Boolean(opts.restored);

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

  const backupSection = `<section class="admin-section" id="admin-backup">
    <h2>Sauvegarde</h2>
    ${
      restored
        ? '<p class="admin-notice" role="status">Sauvegarde restaurée. Vos thèmes, domaines et archives ont été remplacés par le contenu du fichier.</p>'
        : ''
    }
    <p class="admin-hint">Le fichier JSON contient vos thèmes, vos domaines actifs et vos archives. Il ne contient ni votre adresse email ni vos passkeys.</p>
    <p class="admin-backup-export"><a class="btn" href="/api/backup" download>Exporter mes données</a></p>
    <noscript><p class="admin-empty">La restauration nécessite JavaScript ; l'export reste disponible sans JavaScript.</p></noscript>
    <details class="admin-restore">
      <summary>Restaurer une sauvegarde</summary>
      <form id="restore-form" method="post" action="/api/restore?confirm=replace">
        <label for="restore-file">Fichier de sauvegarde (.json)</label>
        <input type="file" id="restore-file" name="backup" accept=".json,application/json" required>
        <label class="restore-confirm"><input type="checkbox" id="restore-confirm" required> Je comprends que mes thèmes, domaines et archives actuels seront remplacés par le contenu du fichier.</label>
        <button type="submit" class="btn danger" disabled>Remplacer mes données</button>
        <p id="restore-status" role="status"></p>
      </form>
    </details>
  </section>`;

  return renderShell(
    space,
    `<div class="admin">${themesSection}${domainsSection}${archivesSection}${backupSection}</div>`,
    null,
    { title: 'Administration', admin: true }
  );
}

/* ------------------------------------------------------------------ */
/* User guide page                                                     */
/*                                                                     */
/* The manual lives on its own page instead of a footer rendered on    */
/* every page. It is static prose inside the regular shell: no domain  */
/* document is read, so it works before the first domain exists.       */
/* ------------------------------------------------------------------ */

function renderGuidePage(space) {
  // The Help page is the application's "about" screen, so the version of the
  // running image belongs at the end of the manual. The tag comes from the
  // release build (`APP_VERSION`, exposed to the runtime by the Dockerfile);
  // a build started from the working tree reports itself as a development
  // build instead of showing a number that would mean nothing. `escapeHtml`
  // keeps a hand-set APP_VERSION from injecting markup into the page.
  const version = APP_VERSION || 'développement';

  const content = `<div class="guide">
    <p class="guide-intro">Cette page rassemble les gestes disponibles dans l'outline, du plus courant au plus spécifique.</p>

    <section class="guide-section">
      <h2>Changer l'état d'une tâche</h2>
      <p>Le menu d'une ligne propose trois états : « En projet » pour une tâche non commencée, « En cours » pour une tâche engagée, et « Terminé » pour une tâche achevée. « En cours » se décline en deux sous-états — « À faire » et « En attente » — qui se choisissent depuis la page d'accueil, pas depuis le menu de la ligne. Une tâche « En attente » apparaît donc avec « En cours » actif dans le menu ; la choisir la ramène à « À faire ».</p>
    </section>

    <section class="guide-section">
      <h2>Classer les tâches par rubrique GTD</h2>
      <p>La page d'accueil, à la racine, présente les deux sous-états d'« En cours » : « À faire » pour les tâches actionnables et « En attente » pour celles qui dépendent d'un tiers. Seules les tâches feuilles « À faire » ou « En attente » y figurent : une tâche « En projet » n'apparaît qu'après avoir été passée à « En cours » depuis son domaine, et les tâches terminées comme les lignes mères ne sont pas listées. Une tâche héritée « Un jour peut-être » est lue comme « En projet » et n'est donc pas listée.</p>
      <p>Glissez une carte d'une rubrique à l'autre, à la souris ou avec la poignée sur un écran tactile. Le menu « Changer de rubrique » de chaque carte fait la même chose au clavier. Cliquez sur le titre d'une carte pour ouvrir la tâche dans son domaine, avec ses tâches mères dépliées et la ligne mise en évidence.</p>
    </section>

    <section class="guide-section">
      <h2>Ordonner les tâches de l'accueil</h2>
      <p>Dans chaque rubrique de la page d'accueil, glissez une carte au-dessus ou en dessous d'une autre pour la placer à cet endroit, à la souris comme avec la poignée sur un écran tactile. Les flèches ↑ et ↓ de chaque carte la déplacent d'un cran ; elles sont désactivées en première et en dernière position. Un dépôt dans l'autre rubrique place la carte à l'endroit déposé, tandis que le menu « Changer de rubrique » la place en fin de liste. L'ordre est mémorisé pour votre compte et conservé d'une visite à l'autre ; une nouvelle tâche rejoint la fin de sa rubrique.</p>
    </section>

    <section class="guide-section">
      <h2>Garder le fil de la hiérarchie</h2>
      <p>En défilant, l'en-tête reste collé en haut de l'écran : il affiche le nom du domaine puis, sur les lignes suivantes, la chaîne des tâches mères de la première ligne visible. Cliquez sur une tâche de la chaîne pour y revenir.</p>
    </section>

    <section class="guide-section">
      <h2>Sélectionner une ligne et ouvrir son menu</h2>
      <p>Survolez une ligne pour faire apparaître son bouton de sélection et son menu. Sur un écran étroit ou sur un appareil sans souris, le bouton de sélection reste visible sans survol.</p>
      <ul>
        <li>Un clic sélectionne la ligne et ses sous-lignes ; un second clic sur la tête ne sélectionne que celle-ci.</li>
        <li>Le menu et la sélection se ferment dès que le pointeur quitte la ligne.</li>
      </ul>
    </section>

    <section class="guide-section">
      <h2>Replier ou déplier une ligne</h2>
      <p>Double-cliquez sur le bouton de sélection pour replier ou déplier la ligne et ses sous-lignes.</p>
    </section>

    <section class="guide-section">
      <h2>Déplacer une ligne</h2>
      <ul>
        <li>Glissez depuis le bouton de sélection pour déplacer la ligne et ses sous-lignes.</li>
        <li>La ligne sélectionnée affiche une poignée à six points : faites-la glisser au doigt pour déplacer la ligne et ses sous-lignes.</li>
      </ul>
    </section>

    <section class="guide-section">
      <h2>Renommer une ligne</h2>
      <p>Cliquez sur un titre hors lien pour ouvrir son édition, ou utilisez l'action ✎ (« Renommer ») du menu.</p>
    </section>

    <section class="guide-section">
      <h2>Ajouter un projet</h2>
      <p>Le bouton + de l'en-tête d'une page de domaine ajoute un projet : la nouvelle ligne est insérée en tête de la liste, avant tous les autres projets et leurs sous-tâches, et son titre s'ouvre en édition avec « Nouveau projet » sélectionné pour le nommer directement. Le bouton reste dans l'en-tête pendant le défilement de la page.</p>
    </section>

    <section class="guide-section">
      <h2>Ajouter une sous-tâche</h2>
      <p>L'action + du menu ajoute une sous-tâche sous la ligne et ouvre son titre pour la nommer.</p>
    </section>

    <section class="guide-section">
      <h2>Lier des tâches</h2>
      <p>Copiez le lien d'une tâche depuis son menu (action 🔗), puis collez-le dans le titre d'une autre ligne : il devient un lien nommé. Cliquez sur ce lien pour ouvrir la ligne cible.</p>
    </section>

    <section class="guide-section">
      <h2>Indenter et désindenter une ligne</h2>
      <p>Pendant l'édition d'un titre ou sur une ligne sélectionnée, <kbd>Tab</kbd> indente la ligne et <kbd>MAJ+Tab</kbd> la désindente.</p>
    </section>

    <section class="guide-section">
      <h2>Rattacher un thème</h2>
      <p>Collez une étiquette sur le domaine pour le rattacher à un thème.</p>
    </section>

    <section class="guide-section">
      <h2>Classer les domaines</h2>
      <p>Chaque domaine du panneau porte deux flèches ↑ et ↓ : elles le déplacent d'un cran dans la liste. Cet ordre est le même que celui de la page Administration et que celui des tâches en cours sur la page d'accueil.</p>
      <p>Les thèmes restent des étiquettes : ils ne regroupent plus les domaines du panneau.</p>
    </section>

    <section class="guide-section">
      <h2>Gérer les thèmes et les domaines</h2>
      <p>Les thèmes et les domaines se gèrent depuis la page <a href="/administration">Administration</a>, en pied du panneau.</p>
    </section>

    <section class="guide-section">
      <h2>Sauvegarder et restaurer ses données</h2>
      <p>La section « Sauvegarde » de la page <a href="/administration">Administration</a> permet de télécharger un fichier JSON contenant vos thèmes, vos domaines actifs et vos archives. Il ne contient ni votre adresse email ni vos passkeys : votre connexion n'est pas concernée.</p>
      <p>La restauration remplace l'intégralité de vos thèmes, de vos domaines et de vos archives par le contenu du fichier ; les objets absents du fichier sont supprimés. Exportez d'abord vos données actuelles si vous n'êtes pas sûr du fichier à restaurer.</p>
    </section>

    <p class="guide-version">Version ${escapeHtml(version)}</p>
  </div>`;

  return renderShell(space, content, null, { title: 'Aide', help: true });
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

// The root is the homepage: every in-progress task of the account, across its
// domains. It is a plain read — no default project is created and nothing is
// persisted, so opening `/` never writes to the account.
app.get('/', (req, res) => {
  res.type('html').send(renderHomePage(req.space));
});

// Place a card on the home board: `rubrique` is the target column, `node` the
// task, `domain` its slug, and `index` the requested final position (absent
// means "append"). A cross-rubrique placement also sets the task's status, in
// the same request, so the card can never land in a column without its state.
// The route always answers with the board fragment, like the status route does
// for `vue=accueil`. It is the only writer of the manual order.
app.post('/api/home/order', (req, res) => {
  const rubrique = typeof req.body.rubrique === 'string' ? req.body.rubrique : '';
  if (!GTD_RUBRIQUES.some((entry) => entry.id === rubrique)) {
    return res.status(400).type('text/plain').send('Rubrique invalide.');
  }
  let index = null;
  if (req.body.index !== undefined && String(req.body.index) !== '') {
    const parsed = Number(String(req.body.index));
    if (!Number.isInteger(parsed)) {
      return res.status(400).type('text/plain').send('Position invalide.');
    }
    index = parsed;
  }
  const domain = findDomainBySlug(
    req.space,
    typeof req.body.domain === 'string' ? req.body.domain : ''
  );
  if (!domain) return res.status(404).type('text/plain').send('Domaine introuvable');
  const found = findNode(
    domain.projects,
    typeof req.body.node === 'string' ? req.body.node : ''
  );
  if (!found) return res.status(404).type('text/plain').send('Noeud introuvable');
  const current = homeRubrique(found.node);
  if (!current) {
    return res.status(400).type('text/plain').send('Tâche non listée sur le tableau.');
  }
  if (current !== rubrique) {
    if (!setStatus(domain.projects, found.node.id, rubrique, 'head')) {
      return res.status(400).type('text/plain').send('Statut invalide');
    }
    persistDomain(req.space, domain);
  }
  // The displayed list after the mutation, minus the task itself, is the list
  // the requested index refers to: the client counts the other cards only.
  const entries = homeBoard(req.space)[rubrique];
  const ids = entries.map((entry) => entry.node.id).filter((id) => id !== found.node.id);
  const position = index === null ? ids.length : Math.max(0, Math.min(ids.length, index));
  ids.splice(position, 0, found.node.id);
  req.space.homeOrder[rubrique] = ids;
  persistHomeOrder(req.space);
  res.type('html').send(renderHomeBoard(req.space));
});

// The administration page works even with an empty space, so it is reachable
// before the first domain exists, as is the homepage (which then shows its
// "no domain" empty state instead of listing tasks).
app.get('/administration', async (req, res) => {
  try {
    res
      .type('html')
      .send(await renderAdminPage(req.space, { restored: req.query.restaure === 'ok' }));
  } catch (err) {
    console.error('[docdoc] page d\u2019administration :', err.message);
    res.status(500).send('Administration indisponible');
  }
});

// Download the whole space as a portable JSON document. The response is the
// backup itself, so it is never cached and carries an attachment filename.
app.get('/api/backup', async (req, res) => {
  try {
    const backup = await exportBackup(req.space);
    const date = new Date().toISOString().slice(0, 10);
    res.set('Content-Type', 'application/json; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="docdoc-sauvegarde-${date}.json"`);
    res.set('Cache-Control', 'no-store');
    res.send(JSON.stringify(backup, null, 2) + '\n');
  } catch (err) {
    console.error('[docdoc] export de sauvegarde :', err.message);
    res.status(500).type('text/plain').send("L'export de la sauvegarde a échoué.");
  }
});

// Restore replaces the whole space (themes, active domains, archives) from a
// backup document. The confirmation is required both in the UI and here, so an
// accidental POST cannot wipe an account. The body is parsed as raw JSON by the
// dedicated parser mounted above; an invalid document is rejected before any
// write.
app.post('/api/restore', async (req, res) => {
  if (req.query.confirm !== 'replace') {
    return res.status(422).type('text/plain').send('Confirmation de restauration requise.');
  }
  if (!req.is('application/json')) {
    return res.status(415).type('text/plain').send('La restauration exige un corps application/json.');
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).type('text/plain').send('Le fichier de sauvegarde est vide ou illisible.');
  }
  if (req.body.length > BACKUP_MAX_BYTES) {
    return res.status(413).type('text/plain').send('Sauvegarde trop volumineuse (10 Mo maximum).');
  }

  let doc;
  try {
    doc = JSON.parse(req.body.toString('utf8').replace(/^\uFEFF/, ''));
  } catch {
    return res.status(400).type('text/plain').send("Le fichier de sauvegarde n'est pas du JSON valide.");
  }

  const validation = validateBackup(doc);
  if (!validation.ok) return res.status(422).type('text/plain').send(validation.message);

  try {
    await restoreBackup(req.space, validation.value);
  } catch (err) {
    console.error('[docdoc] restauration de sauvegarde :', err.message);
    return res.status(500).type('text/plain').send('La restauration a échoué. Réessayez avec le même fichier.');
  } finally {
    // Even a failed multi-object write can have changed storage: the next
    // request must reload the space instead of serving the previous cache.
    invalidateSpace(req.session.userId);
  }
  return res.redirect(303, '/administration?restaure=ok#admin-backup');
});

// The user guide is static prose rendered from the shell. Like the
// administration page and the homepage, it works with an empty space.
app.get('/aide', (req, res) => {
  try {
    res.type('html').send(renderGuidePage(req.space));
  } catch (err) {
    console.error('[docdoc] page d\u2019aide :', err.message);
    res.status(500).send('Aide indisponible');
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

// Read one node of the account's domain. Used by the client to name a pasted
// task link when the target line is not in the current DOM (another domain, or
// a line hidden under a collapsed ancestor). The account is resolved from the
// session by `withSpace`; another account's domain is therefore a 404.
app.get('/domaine/:slug/api/nodes/:id', (req, res) => {
  const domain = findDomainBySlug(req.space, req.params.slug);
  if (!domain) return res.status(404).json({ error: 'Domaine introuvable' });
  const found = findNode(domain.projects, req.params.id);
  if (!found) return res.status(404).json({ error: 'Noeud introuvable' });
  res.json({ id: found.node.id, title: found.node.title });
});

function domainFromReq(req, res) {
  const domain = findDomainBySlug(req.space, req.params.slug);
  if (!domain) {
    res.status(404).send('Domaine introuvable');
    return null;
  }
  return domain;
}

// Create a node. With a parent (the "+" action), the parent is expanded so the
// new child is visible, and the new node's id is echoed in the X-New-Node-Id
// header so the client can open its title for naming.
app.post('/domaine/:slug/api/nodes', (req, res) => {
  const domain = domainFromReq(req, res);
  if (!domain) return;
  const parentId = req.body.parentId || null;
  // `parentId` wins: a child is always appended under its parent. Without a
  // parent, `position: "head"` inserts the project at the head of the outline;
  // any other request keeps appending the project to the end of the list.
  const node =
    !parentId && req.body.position === 'head'
      ? createProjectAtHead(domain)
      : createNode(domain, parentId);
  if (!node) return res.status(404).send('Parent introuvable');
  if (parentId) {
    const parent = findNode(domain.projects, parentId);
    if (parent) parent.node.collapsed = false;
  }
  persistDomain(req.space, domain);
  res.set('X-New-Node-Id', node.id);
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
  // A move on the home board asks for the board fragment instead of the outline:
  // same mutation, same persistence, only the rendered response differs.
  if (req.body.vue === 'accueil' || req.query.vue === 'accueil') {
    return res.type('html').send(renderHomeBoard(req.space));
  }
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
  // The sidebar's forms carry the page they were submitted from, so a move
  // leaves the user there; the administration's forms keep `/administration`.
  // Anything but a local path falls back to the administration page.
  redirectAfter(req, res, localPath(req.body.returnTo) || '/administration');
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
    // The sidebar is a flat domain list: a label no longer changes it, so only
    // the bar needs swapping.
    return res.type('html').send(renderLabelsBar(req.space, domain));
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
