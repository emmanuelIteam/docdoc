'use strict';

// End-to-end checks of the manual order of the GTD home board.
//
// The application is started as a child process (as in home.spec.js) and the
// first account adopts two fixture domains written to a throwaway data
// directory. The board is reset to its natural order before each test that
// depends on positions, through the same `/api/home/order` route the UI uses.
//
// Run with: npx playwright test test/e2e/home-order.spec.js

const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { test, expect } = require('@playwright/test');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const EMAIL_A = 'home-order-e2e-a@example.test';
const EMAIL_B = 'home-order-e2e-b@example.test';

const IN_PROGRESS_NATURAL = ['a1', 'a2', 'a3', 'b1'];
const WAITING_NATURAL = ['a4', 'a5', 'b2'];
const DOMAIN_BY_ID = {
  a1: 'domaine-a',
  a2: 'domaine-a',
  a3: 'domaine-a',
  a4: 'domaine-a',
  a5: 'domaine-a',
  a6: 'domaine-a',
  b1: 'domaine-b',
  b2: 'domaine-b',
};

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
    SESSION_SECRET: 'home-order-e2e-secret',
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

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const DOMAIN_A = {
  id: 'order-dom-a',
  name: 'Domaine A',
  slug: 'domaine-a',
  order: 0,
  labels: [],
  projects: [
    { id: 'a1', title: 'A1 première', status: 'in_progress', collapsed: false, children: [] },
    {
      id: 'a2',
      title: 'A2 deuxième tâche avec un titre assez long pour revenir à la ligne sur un écran étroit',
      status: 'in_progress',
      collapsed: false,
      children: [],
    },
    { id: 'a3', title: 'A3 troisième', status: 'in_progress', collapsed: false, children: [] },
    { id: 'a4', title: 'A4 en attente', status: 'waiting', collapsed: false, children: [] },
    { id: 'a5', title: 'A5 en attente', status: 'waiting', collapsed: false, children: [] },
    { id: 'a6', title: 'A6 en projet', status: 'todo', collapsed: false, children: [] },
  ],
  displayOrder: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
};

const DOMAIN_B = {
  id: 'order-dom-b',
  name: 'Domaine B',
  slug: 'domaine-b',
  order: 1,
  labels: [],
  projects: [
    { id: 'b1', title: 'B1 quatrième', status: 'in_progress', collapsed: false, children: [] },
    { id: 'b2', title: 'B2 en attente', status: 'waiting', collapsed: false, children: [] },
  ],
  displayOrder: ['b1', 'b2'],
};

const FIXTURE_FILES = ['order-dom-a.json', 'order-dom-b.json', 'themes.json'];

function writeFixtures() {
  fs.writeFileSync(path.join(dataDir, 'order-dom-a.json'), JSON.stringify(DOMAIN_A));
  fs.writeFileSync(path.join(dataDir, 'order-dom-b.json'), JSON.stringify(DOMAIN_B));
  fs.writeFileSync(path.join(dataDir, 'themes.json'), JSON.stringify([]));
}

function removeFixtures() {
  for (const file of FIXTURE_FILES) {
    try {
      fs.unlinkSync(path.join(dataDir, file));
    } catch {
      // Already removed: harmless.
    }
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function signedInPage(browser, storageState) {
  return browser
    .newContext({ baseURL: origin, storageState })
    .then(async (context) => ({ context, page: await context.newPage() }));
}

const col = (page, rubrique) => page.locator(`.gtd-column[data-gtd="${rubrique}"]`);
const cardIn = (page, rubrique, id) => col(page, rubrique).locator(`#gtd-node-${id}`);
const titlesIn = (page, rubrique) => col(page, rubrique).locator('.gtd-card-title');

function findNode(nodes, id) {
  for (const node of nodes || []) {
    if (node.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

async function statusOf(page, slug, id) {
  const response = await page.request.get(`/domaine/${slug}/api/outline`);
  expect(response.ok()).toBeTruthy();
  const outline = await response.json();
  const node = findNode(outline, id);
  expect(node, `nœud ${id} introuvable`).not.toBeNull();
  return node.status;
}

// Put a rubrique in a known order by moving each id to the head in reverse: the
// last id moved ends first, so the final list is exactly `ids`.
async function setOrder(page, rubrique, ids) {
  for (const id of [...ids].reverse()) {
    const response = await page.request.post('/api/home/order', {
      form: {
        domain: DOMAIN_BY_ID[id],
        node: id,
        rubrique,
        index: '0',
      },
    });
    expect(response.ok()).toBeTruthy();
  }
}

async function resetOrders(page) {
  await setOrder(page, 'in_progress', IN_PROGRESS_NATURAL);
  await setOrder(page, 'waiting', WAITING_NATURAL);
}

async function dragCard(page, fromRubrique, id, toRubrique, targetId, targetPosition) {
  await cardIn(page, fromRubrique, id)
    .locator('.gtd-grip')
    .dragTo(cardIn(page, toRubrique, targetId), { targetPosition });
}

async function touchDrag(page, from, to, steps = 12) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: from.x, y: from.y }],
  });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          x: from.x + ((to.x - from.x) * i) / steps,
          y: from.y + ((to.y - from.y) * i) / steps,
        },
      ],
    });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/* ------------------------------------------------------------------ */
/* Server lifecycle                                                    */
/* ------------------------------------------------------------------ */

test.beforeAll(async ({ browser }) => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docdoc-home-order-e2e-'));
  logFile = path.join(dataDir, 'server.log');
  stateA = path.join(dataDir, 'session-a.json');
  stateB = path.join(dataDir, 'session-b.json');
  const port = await freePort();
  origin = `http://localhost:${port}`;
  writeFixtures();

  logFd = fs.openSync(logFile, 'a');
  child = spawn(process.execPath, [path.join(REPO_ROOT, 'server.js')], {
    cwd: REPO_ROOT,
    env: childEnv(port),
    stdio: ['ignore', logFd, logFd],
  });
  await waitForServer();

  const contextA = await browser.newContext({ baseURL: origin });
  const pageA = await contextA.newPage();
  await addVirtualAuthenticator(pageA);
  await enroll(pageA, EMAIL_A);
  await contextA.storageState({ path: stateA });
  await contextA.close();

  // Account B must start empty, so the legacy fixtures are removed first.
  removeFixtures();
  const contextB = await browser.newContext({ baseURL: origin });
  const pageB = await contextB.newPage();
  await addVirtualAuthenticator(pageB);
  await enroll(pageB, EMAIL_B);
  await contextB.storageState({ path: stateB });
  await contextB.close();
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
/* 1.1 Natural order until something is moved                          */
/* ------------------------------------------------------------------ */

test('1.1 sans ordre manuel, chaque rubrique suit les domaines puis l’outline', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, stateA);
  await page.goto('/');

  await expect(titlesIn(page, 'in_progress')).toHaveText([
    'A1 première',
    'A2 deuxième tâche avec un titre assez long pour revenir à la ligne sur un écran étroit',
    'A3 troisième',
    'B1 quatrième',
  ]);
  await expect(titlesIn(page, 'waiting')).toHaveText([
    'A4 en attente',
    'A5 en attente',
    'B2 en attente',
  ]);

  // Two controls per card, named after the task and its direction.
  await expect(cardIn(page, 'in_progress', 'a1').locator('.gtd-order-btn')).toHaveCount(2);
  await expect(cardIn(page, 'in_progress', 'a1').locator('.gtd-order-btn[data-dir="up"]')).toHaveAttribute(
    'aria-label',
    'Monter « A1 première »'
  );
  await expect(cardIn(page, 'in_progress', 'a1').locator('.gtd-order-btn[data-dir="down"]')).toHaveAttribute(
    'aria-label',
    'Descendre « A1 première »'
  );

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.2 Arrows: one step, boundaries, focus and announcement            */
/* ------------------------------------------------------------------ */

test('1.2 les flèches déplacent d’un cran, s’arrêtent aux bornes et gardent le focus', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, stateA);
  await page.goto('/');
  await resetOrders(page);
  await page.reload();

  // First and last cards cannot leave their end.
  await expect(cardIn(page, 'in_progress', 'a1').locator('.gtd-order-btn[data-dir="up"]')).toBeDisabled();
  await expect(cardIn(page, 'in_progress', 'a1').locator('.gtd-order-btn[data-dir="down"]')).toBeEnabled();
  await expect(cardIn(page, 'in_progress', 'b1').locator('.gtd-order-btn[data-dir="down"]')).toBeDisabled();
  await expect(cardIn(page, 'in_progress', 'b1').locator('.gtd-order-btn[data-dir="up"]')).toBeEnabled();

  // Down one position: focus stays on the same arrow and the position is announced.
  await cardIn(page, 'in_progress', 'a1').locator('.gtd-order-btn[data-dir="down"]').click();
  await expect(titlesIn(page, 'in_progress')).toHaveText([
    'A2 deuxième tâche avec un titre assez long pour revenir à la ligne sur un écran étroit',
    'A1 première',
    'A3 troisième',
    'B1 quatrième',
  ]);
  await expect(cardIn(page, 'in_progress', 'a1').locator('.gtd-order-btn[data-dir="down"]')).toBeFocused();
  await expect(page.locator('#gtd-announcer')).toContainText('A1 première');
  await expect(page.locator('#gtd-announcer')).toContainText('position 2 sur 4');
  expect(await statusOf(page, 'domaine-a', 'a1')).toBe('in_progress');

  // Up one position: the up arrow is disabled again at the head, so the focus
  // hands over to the down arrow.
  await cardIn(page, 'in_progress', 'a1').locator('.gtd-order-btn[data-dir="up"]').click();
  await expect(titlesIn(page, 'in_progress')).toHaveText([
    'A1 première',
    'A2 deuxième tâche avec un titre assez long pour revenir à la ligne sur un écran étroit',
    'A3 troisième',
    'B1 quatrième',
  ]);
  await expect(cardIn(page, 'in_progress', 'a1').locator('.gtd-order-btn[data-dir="down"]')).toBeFocused();
  await expect(page.locator('#gtd-announcer')).toContainText('position 1 sur 4');

  // The order survives a reload.
  await page.reload();
  await expect(titlesIn(page, 'in_progress')).toHaveText([
    'A1 première',
    'A2 deuxième tâche avec un titre assez long pour revenir à la ligne sur un écran étroit',
    'A3 troisième',
    'B1 quatrième',
  ]);

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.3 Drag inside a rubrique                                          */
/* ------------------------------------------------------------------ */

test('1.3 le glisser réordonne dans la rubrique, sans changer le statut', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, stateA);
  await page.goto('/');
  await resetOrders(page);
  await page.reload();

  // A3 above A1.
  await dragCard(page, 'in_progress', 'a3', 'in_progress', 'a1', { x: 20, y: 3 });
  await expect(titlesIn(page, 'in_progress')).toHaveText([
    'A3 troisième',
    'A1 première',
    'A2 deuxième tâche avec un titre assez long pour revenir à la ligne sur un écran étroit',
    'B1 quatrième',
  ]);
  expect(await statusOf(page, 'domaine-a', 'a3')).toBe('in_progress');

  // A3 under B1 (bottom half of the last card).
  const lastBox = await cardIn(page, 'in_progress', 'b1').boundingBox();
  await dragCard(page, 'in_progress', 'a3', 'in_progress', 'b1', {
    x: 20,
    y: Math.max(2, lastBox.height - 3),
  });
  await expect(titlesIn(page, 'in_progress')).toHaveText([
    'A1 première',
    'A2 deuxième tâche avec un titre assez long pour revenir à la ligne sur un écran étroit',
    'B1 quatrième',
    'A3 troisième',
  ]);

  // A drop at the current position sends no request at all.
  const orderRequests = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/home/order') orderRequests.push(request.url());
  });
  await dragCard(page, 'in_progress', 'a2', 'in_progress', 'a2', { x: 20, y: 2 });
  await page.waitForTimeout(200);
  expect(orderRequests).toEqual([]);

  // The new order survives a reload.
  await page.reload();
  await expect(titlesIn(page, 'in_progress')).toHaveText([
    'A1 première',
    'A2 deuxième tâche avec un titre assez long pour revenir à la ligne sur un écran étroit',
    'B1 quatrième',
    'A3 troisième',
  ]);

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.4 Drop between rubriques and the rubrique menu                    */
/* ------------------------------------------------------------------ */

test('1.4 un dépôt dans l’autre rubrique prend la position déposée, le menu place en fin', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, stateA);
  await page.goto('/');
  await resetOrders(page);
  await page.reload();

  // Drop A1 between A4 and A5: bottom half of A4.
  const a4Box = await cardIn(page, 'waiting', 'a4').boundingBox();
  await dragCard(page, 'in_progress', 'a1', 'waiting', 'a4', {
    x: 20,
    y: Math.max(2, a4Box.height - 3),
  });
  await expect(titlesIn(page, 'waiting')).toHaveText([
    'A4 en attente',
    'A1 première',
    'A5 en attente',
    'B2 en attente',
  ]);
  expect(await statusOf(page, 'domaine-a', 'a1')).toBe('waiting');

  // The menu appends to the target rubrique.
  const b2 = cardIn(page, 'waiting', 'b2');
  await b2.locator('.gtd-move-summary').click();
  await b2.locator('.gtd-move-item', { hasText: 'À faire' }).click();
  await expect(titlesIn(page, 'in_progress')).toHaveText([
    'A2 deuxième tâche avec un titre assez long pour revenir à la ligne sur un écran étroit',
    'A3 troisième',
    'B1 quatrième',
    'B2 en attente',
  ]);
  expect(await statusOf(page, 'domaine-b', 'b2')).toBe('in_progress');

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.5 Per-rubrique order, new card at the end                         */
/* ------------------------------------------------------------------ */

test('1.5 chaque rubrique a son ordre et une nouvelle carte rejoint la fin', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, stateA);
  await page.goto('/');
  await resetOrders(page);
  await page.reload();

  await setOrder(page, 'in_progress', ['b1', 'a1', 'a2', 'a3']);
  await page.reload();
  await expect(titlesIn(page, 'in_progress')).toHaveText([
    'B1 quatrième',
    'A1 première',
    'A2 deuxième tâche avec un titre assez long pour revenir à la ligne sur un écran étroit',
    'A3 troisième',
  ]);
  await expect(titlesIn(page, 'waiting')).toHaveText([
    'A4 en attente',
    'A5 en attente',
    'B2 en attente',
  ]);

  // A new in-progress leaf has no recorded position: it is appended at the end.
  const created = await page.request.post('/domaine/domaine-a/api/nodes', { form: {} });
  expect(created.ok()).toBeTruthy();
  expect(created.headers()['x-new-node-id']).toBeTruthy();
  const newId = created.headers()['x-new-node-id'];
  const status = await page.request.post(`/domaine/domaine-a/api/nodes/${newId}/status`, {
    form: { status: 'in_progress', scope: 'head' },
  });
  expect(status.ok()).toBeTruthy();
  await page.reload();
  await expect(titlesIn(page, 'in_progress').last()).toHaveText('Nouveau projet');

  // Clean up so the following tests keep their fixtures.
  const removed = await page.request.delete(`/domaine/domaine-a/api/nodes/${newId}`);
  expect(removed.ok()).toBeTruthy();
  await resetOrders(page);

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.6 Touch drag reorders from the grip                               */
/* ------------------------------------------------------------------ */

test('1.6 le glisser au doigt réordonne dans la rubrique', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: origin,
    storageState: stateA,
    viewport: { width: 1280, height: 900 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto('/');
  await resetOrders(page);
  await page.reload();

  const grip = await cardIn(page, 'in_progress', 'a3').locator('.gtd-grip').boundingBox();
  const target = await cardIn(page, 'in_progress', 'a1').boundingBox();
  await touchDrag(
    page,
    { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 },
    { x: target.x + target.width / 2, y: target.y + 3 }
  );

  await expect(titlesIn(page, 'in_progress')).toHaveText([
    'A3 troisième',
    'A1 première',
    'A2 deuxième tâche avec un titre assez long pour revenir à la ligne sur un écran étroit',
    'B1 quatrième',
  ]);
  expect(await statusOf(page, 'domaine-a', 'a3')).toBe('in_progress');

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.7 Narrow screen                                                   */
/* ------------------------------------------------------------------ */

test('1.7 en 390 px les flèches restent visibles, sans chevauchement ni débordement', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, stateA);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/');
  await resetOrders(page);
  await page.reload();
  await page.click('#sidebar-toggle');
  await expect(page.locator('#sidebar')).toHaveCSS('width', '0px');

  const card = cardIn(page, 'in_progress', 'a2');
  const arrow = card.locator('.gtd-order-btn[data-dir="down"]');
  await expect(arrow).toBeVisible();
  await expect(arrow).toBeEnabled();

  const layout = await card.evaluate((entry) => {
    const intersects = (a, b) =>
      !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
    const title = entry.querySelector('.gtd-card-title').getBoundingClientRect();
    const context = entry.querySelector('.gtd-card-context').getBoundingClientRect();
    const order = entry.querySelector('.gtd-order').getBoundingClientRect();
    return {
      titleOverlap: intersects(title, order),
      contextOverlap: intersects(context, order),
      viewportWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
  expect(layout.titleOverlap).toBe(false);
  expect(layout.contextOverlap).toBe(false);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth);

  // The control is usable at this width.
  await arrow.click();
  await expect(titlesIn(page, 'in_progress').nth(2)).toHaveText(
    'A2 deuxième tâche avec un titre assez long pour revenir à la ligne sur un écran étroit'
  );

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.8 Invalid requests change nothing                                 */
/* ------------------------------------------------------------------ */

test('1.8 une demande invalide est refusée sans modifier l’ordre ni le statut', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, stateA);
  await page.goto('/');
  await resetOrders(page);
  await page.reload();

  const orderOf = (rubrique) => titlesIn(page, rubrique).allTextContents();
  const beforeInProgress = await orderOf('in_progress');
  const beforeWaiting = await orderOf('waiting');

  const unknown = await page.request.post('/api/home/order', {
    form: { domain: 'domaine-a', node: 'a1', rubrique: 'later', index: '0' },
  });
  expect(unknown.status()).toBe(400);

  const notListed = await page.request.post('/api/home/order', {
    form: { domain: 'domaine-a', node: 'a6', rubrique: 'in_progress', index: '0' },
  });
  expect(notListed.status()).toBe(400);

  const badIndex = await page.request.post('/api/home/order', {
    form: { domain: 'domaine-a', node: 'a1', rubrique: 'in_progress', index: '2.5' },
  });
  expect(badIndex.status()).toBe(400);

  // An out-of-range index is clamped to the end, then to the head.
  await page.request.post('/api/home/order', {
    form: { domain: 'domaine-a', node: 'a1', rubrique: 'in_progress', index: '999' },
  });
  await page.reload();
  await expect(titlesIn(page, 'in_progress').last()).toHaveText('A1 première');
  await page.request.post('/api/home/order', {
    form: { domain: 'domaine-a', node: 'a1', rubrique: 'in_progress', index: '-99' },
  });
  await page.reload();
  await expect(titlesIn(page, 'in_progress').first()).toHaveText('A1 première');

  // The refusals above did not touch the waiting rubrique nor any status.
  await expect(titlesIn(page, 'waiting')).toHaveText(beforeWaiting);
  expect(await statusOf(page, 'domaine-a', 'a1')).toBe('in_progress');
  expect(await statusOf(page, 'domaine-a', 'a6')).toBe('todo');

  // Another account cannot address A's tasks.
  const other = await signedInPage(browser, stateB);
  const foreign = await other.page.request.post('/api/home/order', {
    form: { domain: 'domaine-a', node: 'a1', rubrique: 'waiting', index: '0' },
  });
  expect(foreign.status()).toBe(404);
  await other.context.close();

  await resetOrders(page);
  await page.reload();
  await expect(titlesIn(page, 'in_progress')).toHaveText(beforeInProgress);
  await expect(titlesIn(page, 'waiting')).toHaveText(beforeWaiting);

  await context.close();
});
