'use strict';

// End-to-end checks of the JSON backup and restore feature (openspec change
// add-json-backup-restore, tasks 6.1 to 6.6).
//
// Same child-server harness as administration.spec.js: its own in-memory store
// and its own accounts, so the fixtures of the other spec cannot leak in. The
// backup API is exercised through the signed-in browser context's request
// object, which shares the session cookie with the page.

const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { test, expect } = require('@playwright/test');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const EMAIL_A = 'backup-e2e@example.test';
const EMAIL_B = 'backup-e2e-b@example.test';

let origin = '';
let dataDir = '';
let logFile = '';
let stateA = '';
let stateB = '';
let child = null;
let logFd = null;

/* ------------------------------------------------------------------ */
/* Child server                                                        */
/* ------------------------------------------------------------------ */

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

function childEnv(port) {
  const env = {
    ...process.env,
    PORT: String(port),
    NODE_ENV: 'development',
    EMAIL_PROVIDER: 'dev',
    AUTHORIZED_EMAILS: `${EMAIL_A},${EMAIL_B}`,
    RP_ID: 'localhost',
    RP_ORIGIN: origin,
    DOCDOC_DATA_DIR: dataDir,
    DOCDOC_ENV_FILE: path.join(dataDir, 'absent.env'),
    SESSION_SECRET: 'backup-e2e-secret',
  };
  for (const key of ['S3_ENDPOINT', 'S3_BUCKET', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']) {
    delete env[key];
  }
  return env;
}

function serverLog() {
  return fs.existsSync(logFile) ? fs.readFileSync(logFile, 'utf8') : '';
}

async function waitForServer() {
  for (let i = 0; i < 200; i++) {
    if (child && child.exitCode !== null) {
      throw new Error(`le serveur s'est arrêté (code ${child.exitCode}) :\n${serverLog()}`);
    }
    try {
      await fetch(`${origin}/`, { redirect: 'manual' });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`le serveur n'a pas démarré :\n${serverLog()}`);
}

async function waitForCode(email) {
  const pattern = new RegExp(`code pour ${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} : (\\d{6})`);
  for (let i = 0; i < 200; i++) {
    const found = pattern.exec(serverLog());
    if (found) return found[1];
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`aucun code reçu pour ${email} :\n${serverLog()}`);
}

/* ------------------------------------------------------------------ */
/* Enrollment                                                          */
/* ------------------------------------------------------------------ */

async function addVirtualAuthenticator(page) {
  const client = await page.context().newCDPSession(page);
  await client.send('WebAuthn.enable');
  await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
}

async function enroll(page, email) {
  await page.goto('/');
  await page.click('a[href="/auth/signup"]');
  await page.fill('#email', email);
  await page.click('form[action="/auth/email"] button[type="submit"]');
  await page.waitForSelector('#code');
  await page.fill('#code', await waitForCode(email));
  await page.click('form[action="/auth/email/verify"] button[type="submit"]');
  await page.waitForSelector('#register-passkey-btn');
  await page.click('#register-passkey-btn');
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 20000 });
  await page.waitForSelector('#sidebar');
}

function signedInBrowser(browser, storageState) {
  return browser.newContext({ baseURL: origin, storageState });
}

test.beforeAll(async ({ browser }) => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docdoc-backup-e2e-'));
  logFile = path.join(dataDir, 'server.log');
  stateA = path.join(dataDir, 'session-a.json');
  stateB = path.join(dataDir, 'session-b.json');
  const port = await freePort();
  origin = `http://localhost:${port}`;

  logFd = fs.openSync(logFile, 'a');
  child = spawn(process.execPath, [path.join(REPO_ROOT, 'server.js')], {
    cwd: REPO_ROOT,
    env: childEnv(port),
    stdio: ['ignore', logFd, logFd],
  });
  await waitForServer();

  for (const [email, target] of [
    [EMAIL_A, stateA],
    [EMAIL_B, stateB],
  ]) {
    const context = await browser.newContext({ baseURL: origin });
    const page = await context.newPage();
    await addVirtualAuthenticator(page);
    await enroll(page, email);
    await context.storageState({ path: target });
    await context.close();
  }
});

test.afterAll(async () => {
  if (child && child.exitCode === null) child.kill();
  if (logFd !== null) fs.closeSync(logFd);
  try {
    fs.rmSync(dataDir, { recursive: true, force: true });
  } catch {
    // A held file handle is not worth failing the run for.
  }
});

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function api(context, route, options = {}) {
  return context.request.fetch(route, { maxRedirects: 0, ...options });
}

async function createTheme(context, name, color) {
  const response = await api(context, '/api/themes', {
    method: 'POST',
    form: { name, color, returnTo: '/administration' },
  });
  expect(response.status()).toBe(302);
}

async function deleteTheme(context, id) {
  const response = await api(context, `/api/themes/${id}/delete`, {
    method: 'POST',
    form: { returnTo: '/administration' },
  });
  expect(response.status()).toBe(302);
}

async function createDomain(context, name) {
  const response = await api(context, '/api/domains', {
    method: 'POST',
    form: { name, returnTo: '/administration' },
  });
  expect(response.status()).toBe(302);
}

async function archiveDomain(context, id) {
  const response = await api(context, `/api/domains/${id}/archive`, {
    method: 'POST',
    form: { returnTo: '/administration' },
  });
  expect(response.status()).toBe(302);
}

async function attachTheme(context, domainId, themeId) {
  const response = await api(context, `/api/themes/${themeId}/labels`, {
    method: 'POST',
    form: { domainId, action: 'attach', returnTo: '/administration' },
  });
  expect(response.status()).toBe(302);
}

async function renameNode(context, slug, id, title) {
  const response = await api(context, `/domaine/${slug}/api/nodes/${id}`, {
    method: 'PUT',
    form: { title },
  });
  expect(response.status()).toBe(200);
}

async function createChild(context, slug, parentId) {
  const response = await api(context, `/domaine/${slug}/api/nodes`, {
    method: 'POST',
    form: { parentId },
  });
  expect(response.status()).toBe(200);
  return response.headers()['x-new-node-id'];
}

async function createNext(context, slug, id) {
  const response = await api(context, `/domaine/${slug}/api/nodes/${id}/next`, {
    method: 'POST',
    form: {},
  });
  expect(response.status()).toBe(200);
  return response.headers()['x-new-node-id'];
}

async function setStatus(context, slug, id, status) {
  const response = await api(context, `/domaine/${slug}/api/nodes/${id}/status`, {
    method: 'POST',
    form: { status, scope: 'head' },
  });
  expect(response.status()).toBe(200);
}

async function toggleNode(context, slug, id) {
  const response = await api(context, `/domaine/${slug}/api/nodes/${id}/toggle`, {
    method: 'POST',
    form: {},
  });
  expect(response.status()).toBe(200);
}

async function getBackup(context) {
  const response = await context.request.get('/api/backup');
  expect(response.status()).toBe(200);
  return { response, doc: await response.json() };
}

function findDomain(doc, name) {
  const domain = doc.domains.find((entry) => entry.name === name);
  expect(domain, `domaine « ${name} » dans l'export`).toBeTruthy();
  return domain;
}

function flattenNodes(projects, out = []) {
  for (const node of projects) {
    out.push(node);
    flattenNodes(node.children || [], out);
  }
  return out;
}

function snapshot(doc) {
  return JSON.stringify({
    themes: doc.themes,
    domains: doc.domains,
    archives: doc.archives,
    homeOrder: doc.homeOrder,
  });
}

async function seedAccountA(context) {
  await createTheme(context, 'Maison', '#e11d48');
  await createTheme(context, 'Travail', '#2563eb');

  await createDomain(context, 'Alpha');
  let { doc } = await getBackup(context);
  const alpha = findDomain(doc, 'Alpha');
  const rootId = alpha.projects[0].id;
  await renameNode(context, alpha.slug, rootId, 'Projet Alpha');
  const childId = await createChild(context, alpha.slug, rootId);
  await renameNode(context, alpha.slug, childId, 'Tâche enfant');
  const grandChildId = await createChild(context, alpha.slug, childId);
  await renameNode(context, alpha.slug, grandChildId, 'Sous-tâche');
  await setStatus(context, alpha.slug, childId, 'in_progress');
  await toggleNode(context, alpha.slug, childId);
  const siblingId = await createNext(context, alpha.slug, rootId);
  await renameNode(context, alpha.slug, siblingId, 'Tâche sœur');
  await setStatus(context, alpha.slug, siblingId, 'done');
  await attachTheme(context, alpha.id, doc.themes.find((theme) => theme.name === 'Maison').id);

  await createDomain(context, 'Beta');
  ({ doc } = await getBackup(context));
  const beta = findDomain(doc, 'Beta');
  const betaRoot = beta.projects[0].id;
  await renameNode(context, beta.slug, betaRoot, 'Projet Beta');
  const betaChild = await createChild(context, beta.slug, betaRoot);
  await renameNode(context, beta.slug, betaChild, 'Tâche Beta');
  await attachTheme(context, beta.id, doc.themes.find((theme) => theme.name === 'Travail').id);
  await archiveDomain(context, beta.id);

  await createDomain(context, 'Gamma');
  ({ doc } = await getBackup(context));
  const gamma = findDomain(doc, 'Gamma');
  await renameNode(context, gamma.slug, gamma.projects[0].id, 'Projet Gamma');
}

async function seedAccountB(context) {
  await createTheme(context, 'Confidentiel', '#111827');
  await createDomain(context, 'Secret');
  const { doc } = await getBackup(context);
  const secret = findDomain(doc, 'Secret');
  await renameNode(context, secret.slug, secret.projects[0].id, 'Projet secret');
}

/* ------------------------------------------------------------------ */
/* 6.1 Export                                                          */
/* ------------------------------------------------------------------ */

test('6.1 l’export contient tout l’espace et rien d’un autre compte', async ({ browser }) => {
  const contextA = await signedInBrowser(browser, stateA);
  const contextB = await signedInBrowser(browser, stateB);
  await seedAccountA(contextA);
  await seedAccountB(contextB);

  const { response, doc } = await getBackup(contextA);

  expect(response.headers()['content-type']).toContain('application/json');
  expect(response.headers()['content-disposition']).toMatch(
    /^attachment; filename="docdoc-sauvegarde-\d{4}-\d{2}-\d{2}\.json"$/
  );
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(doc.format).toBe('docdoc-backup');
  expect(doc.version).toBe(1);
  expect(typeof doc.exportedAt).toBe('string');
  expect(doc.homeOrder).toEqual({ in_progress: [], waiting: [] });

  expect(doc.themes.map((theme) => theme.name)).toEqual(['Maison', 'Travail']);
  expect(doc.domains.map((domain) => domain.name).sort()).toEqual(['Alpha', 'Gamma']);
  expect(doc.archives.map((domain) => domain.name)).toEqual(['Beta']);

  const alpha = findDomain(doc, 'Alpha');
  const alphaTheme = doc.themes.find((theme) => theme.name === 'Maison');
  expect(alpha.labels).toContain(alphaTheme.id);
  const alphaNodes = flattenNodes(alpha.projects);
  const child = alphaNodes.find((node) => node.title === 'Tâche enfant');
  expect(child.status).toBe('in_progress');
  expect(child.collapsed).toBe(true);
  expect(child.children.map((node) => node.title)).toEqual(['Sous-tâche']);
  expect(alphaNodes.find((node) => node.title === 'Tâche sœur').status).toBe('done');
  const ids = Object.fromEntries(alphaNodes.map((node) => [node.title, node.id]));
  expect(alpha.displayOrder).toEqual([
    ids['Projet Alpha'],
    ids['Tâche sœur'],
    ids['Tâche enfant'],
    ids['Sous-tâche'],
  ]);

  const beta = doc.archives[0];
  expect(flattenNodes(beta.projects).map((node) => node.title)).toEqual([
    'Projet Beta',
    'Tâche Beta',
  ]);
  expect(beta.labels).toContain(doc.themes.find((theme) => theme.name === 'Travail').id);

  // The document describes the space, not the account: no credential, no email
  // and nothing from account B.
  expect(doc).not.toHaveProperty('email');
  expect(doc).not.toHaveProperty('passkeys');
  expect(JSON.stringify(doc)).not.toContain(EMAIL_A);
  expect(JSON.stringify(doc)).not.toContain('Secret');
  expect(JSON.stringify(doc)).not.toContain('Confidentiel');

  const backupB = (await getBackup(contextB)).doc;
  expect(backupB.domains.map((domain) => domain.name)).toEqual(['Secret']);
  expect(backupB.themes.map((theme) => theme.name)).toEqual(['Confidentiel']);

  await contextA.close();
  await contextB.close();
});

/* ------------------------------------------------------------------ */
/* 6.2 Restore                                                         */
/* ------------------------------------------------------------------ */

test('6.2 la restauration remplace l’espace et restitue l’état exporté', async ({ browser }) => {
  const contextA = await signedInBrowser(browser, stateA);
  const contextB = await signedInBrowser(browser, stateB);
  const original = (await getBackup(contextA)).doc;
  const stateBeforeB = snapshot((await getBackup(contextB)).doc);

  // Drift away from the exported state: archive a domain, delete a theme, add a
  // domain and a theme that are absent from the backup.
  const alpha = findDomain(original, 'Alpha');
  await archiveDomain(contextA, alpha.id);
  await deleteTheme(contextA, original.themes.find((theme) => theme.name === 'Maison').id);
  await createDomain(contextA, 'Delta');
  await createTheme(contextA, 'Nouveau', '#000000');

  const response = await api(contextA, '/api/restore?confirm=replace', {
    method: 'POST',
    data: JSON.stringify(original),
    headers: { 'Content-Type': 'application/json' },
  });
  expect(response.status()).toBe(303);
  expect(response.headers()['location']).toBe('/administration?restaure=ok#admin-backup');

  const restored = (await getBackup(contextA)).doc;
  expect(restored.themes).toEqual(original.themes);
  expect(restored.domains).toEqual(original.domains);
  expect(restored.archives).toEqual(original.archives);

  // Replaying the same document is idempotent.
  const replay = await api(contextA, '/api/restore?confirm=replace', {
    method: 'POST',
    data: JSON.stringify(original),
    headers: { 'Content-Type': 'application/json' },
  });
  expect(replay.status()).toBe(303);
  const replayed = (await getBackup(contextA)).doc;
  expect(replayed.themes).toEqual(original.themes);
  expect(replayed.domains).toEqual(original.domains);
  expect(replayed.archives).toEqual(original.archives);

  const page = await contextA.newPage();
  await page.goto('/administration?restaure=ok');
  await expect(page.locator('.admin-notice')).toContainText('Sauvegarde restaurée');
  await expect(page.locator('#admin-domains-table')).toContainText('Alpha');
  await expect(page.locator('#admin-domains-table')).toContainText('Gamma');
  await expect(page.locator('#admin-domains-table')).not.toContainText('Delta');
  await expect(page.locator('#admin-archives-table')).toContainText('Beta');
  await expect(page.locator('input.theme-name-input[value="Maison"]')).toHaveCount(1);
  await expect(page.locator('input.theme-name-input[value="Nouveau"]')).toHaveCount(0);

  // The session and the credentials survive: the account record is not part of
  // the backup and must not be rewritten by a restore.
  const me = await contextA.request.get('/api/me');
  expect(me.status()).toBe(200);
  expect(await me.json()).toMatchObject({ authenticated: true, email: EMAIL_A });
  await page.goto('/auth/passkeys');
  await expect(page.locator('.passkey-list li')).toHaveCount(1);

  // Restoring A does not touch B.
  expect(snapshot((await getBackup(contextB)).doc)).toBe(stateBeforeB);

  await contextA.close();
  await contextB.close();
});

/* ------------------------------------------------------------------ */
/* 6.2b Legacy someday restore                                         */
/* ------------------------------------------------------------------ */

test('6.2b une sauvegarde héritée avec someday est restaurée en En projet', async ({ browser }) => {
  const context = await signedInBrowser(browser, stateA);
  const doc = JSON.parse(JSON.stringify((await getBackup(context)).doc));
  const alpha = findDomain(doc, 'Alpha');
  const node = flattenNodes(alpha.projects).find((entry) => entry.title === 'Tâche sœur');
  expect(node).toBeTruthy();
  node.status = 'someday';

  const response = await api(context, '/api/restore?confirm=replace', {
    method: 'POST',
    data: JSON.stringify(doc),
    headers: { 'Content-Type': 'application/json' },
  });
  expect(response.status()).toBe(303);

  const restored = (await getBackup(context)).doc;
  const restoredNode = flattenNodes(findDomain(restored, 'Alpha').projects).find(
    (entry) => entry.title === 'Tâche sœur'
  );
  expect(restoredNode.status).toBe('todo');
  expect(restoredNode.id).toBe(node.id);
  expect(restoredNode.collapsed).toBe(node.collapsed);
  expect(restoredNode.children).toEqual(node.children);

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 6.3 Refusals                                                        */
/* ------------------------------------------------------------------ */

test('6.3 une sauvegarde invalide est refusée sans rien modifier', async ({ browser }) => {
  const context = await signedInBrowser(browser, stateA);
  const baseline = snapshot((await getBackup(context)).doc);
  const original = (await getBackup(context)).doc;
  const clone = () => JSON.parse(JSON.stringify(original));

  const reject = async (doc, status) => {
    const response = await api(context, '/api/restore?confirm=replace', {
      method: 'POST',
      data: JSON.stringify(doc),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(status);
    expect(snapshot((await getBackup(context)).doc)).toBe(baseline);
  };

  // Confirmation and transport.
  let response = await api(context, '/api/restore', {
    method: 'POST',
    data: JSON.stringify(original),
    headers: { 'Content-Type': 'application/json' },
  });
  expect(response.status()).toBe(422);

  response = await api(context, '/api/restore?confirm=replace', {
    method: 'POST',
    form: { backup: 'x' },
  });
  expect(response.status()).toBe(415);

  response = await api(context, '/api/restore?confirm=replace', {
    method: 'POST',
    data: Buffer.from('{'),
    headers: { 'Content-Type': 'application/json' },
  });
  expect(response.status()).toBe(400);

  response = await api(context, '/api/restore?confirm=replace', {
    method: 'POST',
    data: Buffer.alloc(0),
    headers: { 'Content-Type': 'application/json' },
  });
  expect(response.status()).toBe(400);

  let doc = clone();
  doc.format = 'autre-format';
  await reject(doc, 422);

  doc = clone();
  doc.version = 2;
  await reject(doc, 422);

  doc = clone();
  doc.domains.push({ ...doc.domains[0], slug: 'copie-id' });
  await reject(doc, 422);

  doc = clone();
  doc.domains.push({ ...doc.domains[0], id: 'copie-slug', name: 'Copie' });
  await reject(doc, 422);

  doc = clone();
  doc.domains[0].labels = ['theme-absent'];
  await reject(doc, 422);

  doc = clone();
  doc.domains[0].projects[0].status = 'blocked';
  await reject(doc, 422);

  doc = clone();
  doc.domains[0].projects[0].id = '';
  await reject(doc, 422);

  doc = clone();
  doc.homeOrder = 'x';
  await reject(doc, 422);

  doc = clone();
  doc.homeOrder.in_progress = [42];
  await reject(doc, 422);

  // The body limit is enforced before the document is parsed.
  const oversized = 'x'.repeat(10 * 1024 * 1024 + 1);
  response = await api(context, '/api/restore?confirm=replace', {
    method: 'POST',
    data: oversized,
    headers: { 'Content-Type': 'application/json' },
  });
  expect(response.status()).toBe(413);
  expect(snapshot((await getBackup(context)).doc)).toBe(baseline);

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 6.4 Interface                                                       */
/* ------------------------------------------------------------------ */

test('6.4 la page Administration exporte, restaure et se dégrade sans JavaScript', async ({ browser }) => {
  const context = await signedInBrowser(browser, stateA);
  const page = await context.newPage();
  await page.goto('/administration');

  await expect(page.locator('#admin-archives + #admin-backup')).toHaveCount(1);
  await expect(page.locator('#admin-backup a[href="/api/backup"]')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#admin-backup a[href="/api/backup"]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^docdoc-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/);
  const exportPath = path.join(dataDir, 'ui-export.json');
  await download.saveAs(exportPath);
  const exported = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
  expect(exported.format).toBe('docdoc-backup');

  // A domain created after the export must disappear when the export is
  // restored through the page.
  await createDomain(context, 'UI-Delta');
  await page.reload();
  await expect(page.locator('#admin-domains-table')).toContainText('UI-Delta');

  await page.locator('#admin-backup summary').click();
  await page.locator('#restore-file').setInputFiles(exportPath);
  await page.locator('#restore-confirm').check();
  await Promise.all([
    page.waitForURL(/\/administration\?restaure=ok/),
    page.locator('#restore-form button[type="submit"]').click(),
  ]);
  await expect(page.locator('.admin-notice')).toContainText('Sauvegarde restaurée');
  await expect(page.locator('#admin-domains-table')).not.toContainText('UI-Delta');

  // A rejected file leaves the data in place and reports the server message.
  const invalidPath = path.join(dataDir, 'invalid.json');
  fs.writeFileSync(invalidPath, '{}');
  await page.locator('#admin-backup summary').click();
  await page.locator('#restore-file').setInputFiles(invalidPath);
  await page.locator('#restore-confirm').check();
  await page.locator('#restore-form button[type="submit"]').click();
  await expect(page.locator('#restore-status')).toContainText("pas une sauvegarde");
  await expect(page.locator('#admin-domains-table')).toContainText('Alpha');

  // Without JavaScript the export stays a plain link and the restore form is
  // explicitly unavailable. The HTML is what the browser receives.
  const html = await (await context.request.get('/administration')).text();
  expect(html).toContain('id="admin-backup"');
  expect(html).toContain('href="/api/backup"');
  expect(html).toContain('La restauration nécessite JavaScript');
  expect(html).toMatch(/id="restore-form"[\s\S]*?<button type="submit" class="btn danger" disabled>/);

  const exportResponse = await context.request.get('/api/backup');
  expect(exportResponse.status()).toBe(200);
  expect(exportResponse.headers()['content-disposition']).toMatch(/^attachment;/);

  // Narrow screens: the section and its export link remain visible. (The
  // administration tables already scroll horizontally on their own; the
  // backup section adds no new overflow of its own.)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/administration');
  await expect(page.locator('#admin-backup')).toBeVisible();
  await expect(page.locator('#admin-backup a[href="/api/backup"]')).toBeVisible();

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 6.5 Manual order of the home board                                  */
/* ------------------------------------------------------------------ */

test('6.5 l’ordre manuel des rubriques est exporté, restauré et vidé sans homeOrder', async ({ browser }) => {
  const context = await signedInBrowser(browser, stateA);
  const page = await context.newPage();

  const { doc: start } = await getBackup(context);
  const alpha = findDomain(start, 'Alpha');
  const gamma = findDomain(start, 'Gamma');
  const alphaLeaf = flattenNodes(alpha.projects).find((node) => node.title === 'Sous-tâche');
  expect(alphaLeaf).toBeTruthy();
  const gammaRoot = gamma.projects[0];
  await setStatus(context, alpha.slug, alphaLeaf.id, 'in_progress');
  await setStatus(context, gamma.slug, gammaRoot.id, 'in_progress');

  const moveChild = async (index) => {
    const response = await api(context, '/api/home/order', {
      method: 'POST',
      form: {
        domain: alpha.slug,
        node: alphaLeaf.id,
        rubrique: 'in_progress',
        index: String(index),
      },
    });
    expect(response.status()).toBe(200);
  };

  // Natural order is Alpha then Gamma: move Alpha's leaf after Gamma's root.
  await moveChild(1);
  const ordered = (await getBackup(context)).doc;
  expect(ordered.homeOrder.in_progress).toEqual([gammaRoot.id, alphaLeaf.id]);

  // Drift, then restore the ordered document.
  await moveChild(0);
  expect((await getBackup(context)).doc.homeOrder.in_progress).toEqual([
    alphaLeaf.id,
    gammaRoot.id,
  ]);
  let response = await api(context, '/api/restore?confirm=replace', {
    method: 'POST',
    data: JSON.stringify(ordered),
    headers: { 'Content-Type': 'application/json' },
  });
  expect(response.status()).toBe(303);

  const cards = page.locator('.gtd-column[data-gtd="in_progress"] .gtd-card-title');
  await page.goto('/');
  await expect(cards).toHaveText(['Projet Gamma', 'Sous-tâche']);

  // A document without homeOrder restores an empty order, i.e. the natural one.
  const legacy = JSON.parse(JSON.stringify(ordered));
  delete legacy.homeOrder;
  response = await api(context, '/api/restore?confirm=replace', {
    method: 'POST',
    data: JSON.stringify(legacy),
    headers: { 'Content-Type': 'application/json' },
  });
  expect(response.status()).toBe(303);
  await page.goto('/');
  await expect(cards).toHaveText(['Sous-tâche', 'Projet Gamma']);

  // A malformed order is refused without touching the space.
  const malformed = JSON.parse(JSON.stringify(ordered));
  malformed.homeOrder = 'nope';
  const before = snapshot((await getBackup(context)).doc);
  response = await api(context, '/api/restore?confirm=replace', {
    method: 'POST',
    data: JSON.stringify(malformed),
    headers: { 'Content-Type': 'application/json' },
  });
  expect(response.status()).toBe(422);
  expect(snapshot((await getBackup(context)).doc)).toBe(before);

  await context.close();
});
