'use strict';

// One-time adoption of the data written before accounts existed.
//
// Two sources, in order:
//   1. the bucket-root keys (`domains/`, `archive/`, `themes.json`) left by the
//      single-tenant layout;
//   2. the historical local `data/*.json` files, still mounted read-only in the
//      container, used only when the account has no domain of its own.
//
// Both steps are idempotent: they move (never copy) what is still at the root,
// so running them twice — or running them for a second account — finds nothing
// left to do and cannot duplicate or lose a domain.

const path = require('path');
const fs = require('fs/promises');

const storage = require('./storage');

// Where the historical filesystem data lives. Overridable so a test (or a
// deployment that mounts the volume elsewhere) does not depend on the repo's
// own `data/` directory.
const DATA_DIR = process.env.DOCDOC_DATA_DIR || path.join(__dirname, 'data');
const LEGACY_FILE = path.join(DATA_DIR, 'projects.json');
const THEMES_FILE = path.join(DATA_DIR, 'themes.json');

async function readLocalJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

// Move every object still sitting under a bucket-root prefix into the account's
// space. The object's name under the prefix is preserved.
async function movePrefix(rootPrefix, userId, subPrefix) {
  if (!storage.isConfigured()) return 0;
  const keys = await storage.listKeys(rootPrefix);
  let moved = 0;
  for (const key of keys) {
    const name = key.slice(rootPrefix.length);
    if (!name) continue;
    await storage.moveObject(key, storage.userKey(userId, subPrefix + name));
    moved += 1;
  }
  return moved;
}

async function adoptRootKeys(userId) {
  const domains = await movePrefix(storage.LEGACY_KEYS.domainsPrefix, userId, 'domains/');
  const archive = await movePrefix(storage.LEGACY_KEYS.archivePrefix, userId, 'archive/');

  let themes = false;
  if (storage.isConfigured()) {
    const rootThemes = await storage.readJson(storage.LEGACY_KEYS.themesKey);
    if (rootThemes !== null) {
      await storage.writeJson(storage.themesKey(userId), rootThemes);
      await storage.deleteObject(storage.LEGACY_KEYS.themesKey);
      themes = true;
    }
  }
  return { domains, archive, themes };
}

// Import the filesystem data into the account's space, for a bucket that was
// created after the local files were written.
async function importLocalData(userId) {
  let imported = 0;
  let files = [];
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    files = (await fs.readdir(DATA_DIR)).filter(
      (f) => f.endsWith('.json') && f !== 'projects.json' && f !== 'projects.json.bak' && f !== 'themes.json'
    );
  } catch {
    return { imported: 0, themes: false };
  }

  for (const file of files) {
    const parsed = await readLocalJson(path.join(DATA_DIR, file));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
    if (typeof parsed.id !== 'string' || !Array.isArray(parsed.projects)) continue;
    await storage.writeJson(storage.domainKey(userId, parsed.id), parsed);
    imported += 1;
  }

  const localThemes = await readLocalJson(THEMES_FILE);
  let themes = false;
  if (Array.isArray(localThemes)) {
    await storage.writeJson(storage.themesKey(userId), localThemes);
    themes = true;
  }

  // The historical single-file outline is preserved once, under a name that
  // makes it clear it is no longer read.
  const legacy = await readLocalJson(LEGACY_FILE);
  if (Array.isArray(legacy)) {
    try {
      await fs.rename(LEGACY_FILE, path.join(DATA_DIR, 'projects.json.bak'));
    } catch {
      /* already renamed, or not writable: harmless */
    }
  }

  return { imported, themes };
}

// Adopt everything this account can inherit. Safe to call on every account
// creation and on every sign-in.
async function adoptLegacyData(userId) {
  const moved = await adoptRootKeys(userId);

  // The local files are only a fallback: they are read when the account still
  // has no domain of its own.
  let own = [];
  if (storage.isConfigured()) own = await storage.listDomainKeys(userId);
  let imported = { imported: 0, themes: false };
  if (own.length === 0) imported = await importLocalData(userId);

  return { ...moved, imported: imported.imported, importedThemes: imported.themes };
}

module.exports = { adoptLegacyData, adoptRootKeys, importLocalData };
