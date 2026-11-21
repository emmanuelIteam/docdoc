'use strict';

// End-to-end checks of the GTD home board (openspec change add-gtd-home-board).
//
// The application is started as a *child process* (as in administration.spec.js
// and sidebar.spec.js): its configuration is read once at require time, and the
// child gets its own in-memory store unless a bucket is configured.
//
// Two accounts are authorized. Account A enrolls first and adopts the two
// fixture domains written to the throwaway data directory; the legacy files are
// then removed so account B starts with an empty space. Account B is used for
// the empty states and the archive case.
//
// Run with: npm run test:e2e

const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { test, expect } = require('@playwright/test');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const EMAIL_A = 'home-e2e-a@example.test';
const EMAIL_B = 'home-e2e-b@example.test';

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
    // A developer's local `.env` must not leak into the test.
    DOCDOC_ENV_FILE: path.join(dataDir, 'absent.env'),
    SESSION_SECRET: 'home-e2e-secret',
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

// The development mailer logs one line per code:
//   [docdoc][dev] code pour <email> : 123456 (valable N min)
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
/* Enrollment (same ceremony as administration.spec.js)                */
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

// Domain A: all five statuses, at several depths. a1 and a1-1 are in-progress
// parents and must not be listed; a2 is a todo parent (collapsed) with a waiting
// and a someday leaf. a4 is a done parent with a done child. a1-1-1 and a3 are
// in-progress leaves (À faire + badge). a1-2 and a7 are todo leaves. a5 is a
// waiting leaf and a6 a someday leaf. The display order interleaves the branches
// so the per-rubrique order can be checked.
const DOMAIN_A = {
  id: 'home-dom-a',
  name: 'Domaine A',
  slug: 'domaine-a',
  order: 0,
  labels: [],
  projects: [
    {
      id: 'a1',
      title: 'Projet A1',
      status: 'in_progress',
      collapsed: false,
      children: [
        {
          id: 'a1-1',
          title: 'Tâche A1.1',
          status: 'in_progress',
          collapsed: false,
          children: [
            {
              id: 'a1-1-1',
              title: 'Sous-tâche A1.1.1',
              status: 'in_progress',
              collapsed: false,
              children: [],
            },
          ],
        },
        { id: 'a1-2', title: 'Tâche A1.2', status: 'todo', collapsed: false, children: [] },
      ],
    },
    {
      id: 'a2',
      title: 'Projet A2 replié avec un titre de tâche mère volontairement long',
      status: 'todo',
      collapsed: true,
      children: [
        { id: 'a2-1', title: 'Tâche A2.1 cachée', status: 'waiting', collapsed: false, children: [] },
        { id: 'a2-2', title: 'Tâche A2.2 un jour', status: 'someday', collapsed: false, children: [] },
      ],
    },
    { id: 'a3', title: 'Projet partagé', status: 'in_progress', collapsed: false, children: [] },
    {
      id: 'a4',
      title: 'Projet A4 terminé',
      status: 'done',
      collapsed: false,
      children: [
        { id: 'a4-1', title: 'Tâche A4.1 terminée', status: 'done', collapsed: false, children: [] },
      ],
    },
    { id: 'a5', title: 'Tâche A5 en attente', status: 'waiting', collapsed: false, children: [] },
    { id: 'a6', title: 'Tâche A6 un jour', status: 'someday', collapsed: false, children: [] },
    { id: 'a7', title: 'Tâche A7 à faire', status: 'todo', collapsed: false, children: [] },
  ],
  displayOrder: ['a1', 'a1-1', 'a1-1-1', 'a1-2', 'a2', 'a2-1', 'a2-2', 'a3', 'a4', 'a4-1', 'a5', 'a6', 'a7'],
};

// Domain B: the same leaf title as a3, plus one leaf per rubrique. Listed after
// domain A.
const DOMAIN_B = {
  id: 'home-dom-b',
  name: 'Domaine B',
  slug: 'domaine-b',
  order: 1,
  labels: [],
  projects: [
    { id: 'b1', title: 'Projet partagé', status: 'in_progress', collapsed: false, children: [] },
    { id: 'b2', title: 'Projet B2', status: 'todo', collapsed: false, children: [] },
    { id: 'b3', title: 'Tâche B3 en attente', status: 'waiting', collapsed: false, children: [] },
    { id: 'b4', title: 'Tâche B4 un jour', status: 'someday', collapsed: false, children: [] },
  ],
  displayOrder: ['b1', 'b2', 'b3', 'b4'],
};

const FIXTURE_FILES = ['home-dom-a.json', 'home-dom-b.json', 'themes.json'];

function writeFixtures() {
  fs.writeFileSync(path.join(dataDir, 'home-dom-a.json'), JSON.stringify(DOMAIN_A));
  fs.writeFileSync(path.join(dataDir, 'home-dom-b.json'), JSON.stringify(DOMAIN_B));
  fs.writeFileSync(path.join(dataDir, 'themes.json'), JSON.stringify([]));
}

// The legacy files are imported into the first account created and left on disk,
// so they would be imported again into account B. Removing them after account A
// has enrolled gives B the empty space its empty states need.
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
/* Server lifecycle and signed-in pages                                */
/* ------------------------------------------------------------------ */

function signedInPage(browser, storageState) {
  return browser
    .newContext({ baseURL: origin, storageState })
    .then(async (context) => ({ context, page: await context.newPage() }));
}

const col = (page, rubrique) => page.locator(`.gtd-column[data-gtd="${rubrique}"]`);
const cardIn = (page, rubrique, id) => col(page, rubrique).locator(`#gtd-node-${id}`);
const titlesIn = (page, rubrique) => col(page, rubrique).locator('.gtd-card-title');
const domainsIn = (page, rubrique) => col(page, rubrique).locator('.home-task-domain');

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

test.beforeAll(async ({ browser }) => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docdoc-home-e2e-'));
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

  // Account A adopts both fixture domains at enrollment.
  const contextA = await browser.newContext({ baseURL: origin });
  const pageA = await contextA.newPage();
  await addVirtualAuthenticator(pageA);
  await enroll(pageA, EMAIL_A);
  await contextA.storageState({ path: stateA });
  await contextA.close();

  // Account B must start empty: drop the legacy files before it enrolls.
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
/* 1.1 The three rubriques and their contents                          */
/* ------------------------------------------------------------------ */

test('1.1 l’accueil présente les trois rubriques et classe les feuilles non terminées', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, stateA);

  await page.goto('/');
  await expect(page.locator('.topbar h1')).toHaveText('Tableau de bord');
  await expect(page.locator('.gtd-column')).toHaveCount(3);
  await expect(col(page, 'todo').locator('h2')).toContainText('À faire');
  await expect(col(page, 'waiting').locator('h2')).toContainText('En attente');
  await expect(col(page, 'someday').locator('h2')).toContainText('Un jour peut-être');
  await expect(col(page, 'todo').locator('.gtd-count')).toHaveText('6');
  await expect(col(page, 'waiting').locator('.gtd-count')).toHaveText('3');
  await expect(col(page, 'someday').locator('.gtd-count')).toHaveText('3');

  // Per rubrique, the order is sidebar domain order then outline display order.
  await expect(titlesIn(page, 'todo')).toHaveText([
    'Sous-tâche A1.1.1',
    'Tâche A1.2',
    'Projet partagé',
    'Tâche A7 à faire',
    'Projet partagé',
    'Projet B2',
  ]);
  await expect(titlesIn(page, 'waiting')).toHaveText([
    'Tâche A2.1 cachée',
    'Tâche A5 en attente',
    'Tâche B3 en attente',
  ]);
  await expect(titlesIn(page, 'someday')).toHaveText([
    'Tâche A2.2 un jour',
    'Tâche A6 un jour',
    'Tâche B4 un jour',
  ]);

  // A leaf in progress stays in À faire and carries the badge.
  await expect(cardIn(page, 'todo', 'a1-1-1').locator('.gtd-badge')).toHaveText('En cours');
  await expect(cardIn(page, 'todo', 'a1-2').locator('.gtd-badge')).toHaveCount(0);
  await expect(cardIn(page, 'todo', 'a3').locator('.gtd-badge')).toHaveText('En cours');

  // Parents and done lines are not cards, even when their titles appear in a
  // chain: the absence is checked by id.
  for (const id of ['a1', 'a1-1', 'a2', 'a4', 'a4-1']) {
    await expect(page.locator(`#gtd-node-${id}`)).toHaveCount(0);
  }

  // The second line carries the domain then the parent chain from the top-level
  // project down to the immediate parent.
  const parentsOf = (id) => page.locator(`#gtd-node-${id}`).locator('.home-task-parent');
  const domainOf = (id) => page.locator(`#gtd-node-${id}`).locator('.home-task-domain');
  await expect(domainOf('a1-1-1')).toHaveText('Domaine A');
  await expect(parentsOf('a1-1-1')).toHaveText(['Projet A1', 'Tâche A1.1']);
  await expect(domainOf('a2-1')).toHaveText('Domaine A');
  await expect(parentsOf('a2-1')).toHaveText([
    'Projet A2 replié avec un titre de tâche mère volontairement long',
  ]);
  await expect(domainOf('a3')).toHaveText('Domaine A');
  await expect(parentsOf('a3')).toHaveCount(0);
  await expect(domainOf('b1')).toHaveText('Domaine B');
  await expect(parentsOf('b1')).toHaveCount(0);

  // Every card title is the existing deep link, exactly.
  await expect(cardIn(page, 'waiting', 'a2-1').locator('.gtd-card-title')).toHaveAttribute(
    'href',
    '/domaine/domaine-a?reveal=a2-1#node-a2-1'
  );
  await expect(cardIn(page, 'todo', 'b1').locator('.gtd-card-title')).toHaveAttribute(
    'href',
    '/domaine/domaine-b?reveal=b1#node-b1'
  );

  // A leaf hidden on its domain page by a collapsed ancestor is still listed.
  await page.goto('/domaine/domaine-a');
  await expect(page.locator('#node-a2-1')).toHaveCount(0);
  await page.goto('/');
  await expect(cardIn(page, 'waiting', 'a2-1')).toHaveCount(1);

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.2 Opening a task in its context                                   */
/* ------------------------------------------------------------------ */

test('1.2 ouvrir une tâche sous un ancêtre replié la déplie, la cible et ne change pas son statut', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, stateA);

  await page.goto('/');
  await cardIn(page, 'waiting', 'a2-1').locator('.gtd-card-title').click();

  await expect(page).toHaveURL(/\/domaine\/domaine-a\?reveal=a2-1#node-a2-1$/);
  const target = page.locator('#node-a2-1');
  await expect(target).toBeVisible();
  await expect(page.locator('#node-a2')).not.toHaveClass(/collapsed/);
  expect(await target.evaluate((el) => el.matches(':target'))).toBe(true);
  await expect(page.locator('.title-input')).toHaveCount(0);
  await expect(target.locator('.title')).toHaveClass(/status-waiting/);
  // The line menu offers the two new GTD statuses as well.
  await expect(target.locator('.menu-item[title="En attente"]')).toHaveCount(1);
  await expect(target.locator('.menu-item[title="Un jour peut-être"]')).toHaveCount(1);

  await page.goto('/');
  await expect(cardIn(page, 'waiting', 'a2-1')).toHaveCount(1);

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.3 Keyboard activation                                             */
/* ------------------------------------------------------------------ */

test('1.3 un titre de carte est activable au clavier', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, stateA);

  await page.goto('/');
  await cardIn(page, 'todo', 'a1-1-1').locator('.gtd-card-title').focus();
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/domaine\/domaine-a\?reveal=a1-1-1#node-a1-1-1$/);
  await expect(page.locator('#node-a1-1-1')).toBeVisible();

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.4 The sidebar entry                                               */
/* ------------------------------------------------------------------ */

test("1.4 l'entrée Accueil du panneau mène à la racine et n'est active que là", async ({ browser }) => {
  const { context, page } = await signedInPage(browser, stateA);

  await page.goto('/domaine/domaine-a');
  const home = page.locator('a.sidebar-home');
  await expect(home).toHaveCount(1);
  await expect(home).toHaveText('Accueil');
  await expect(home).toHaveAttribute('href', '/');
  await expect(page.locator('.sidebar-extra a.sidebar-home')).toHaveCount(0);
  const placement = await page.evaluate(() => {
    const top = document.querySelector('.sidebar-top');
    const header = document.querySelector('.sidebar-header');
    const nav = document.querySelector('#sidebar-nav');
    const isBefore = (node, other) =>
      Boolean(node && other && (node.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING));
    return {
      entry: Boolean(top && top.querySelector('a.sidebar-home')),
      beforeHeader: isBefore(top, header),
      beforeNav: isBefore(top, nav),
    };
  });
  expect(placement).toEqual({ entry: true, beforeHeader: true, beforeNav: true });
  await expect(home).not.toHaveClass(/active/);
  await expect(home).not.toHaveAttribute('aria-current', 'page');

  await home.click();
  await expect(page).toHaveURL(/\/(\?.*)?$/);
  await expect(page.locator('a.sidebar-home')).toHaveClass(/active/);
  await expect(page.locator('a.sidebar-home')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#sidebar-nav a.sidebar-link.active')).toHaveCount(0);

  await page.goto('/administration');
  await expect(page.locator('a.sidebar-home')).not.toHaveClass(/active/);

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.5 Empty states (account B)                                        */
/* ------------------------------------------------------------------ */

test('1.5 les états vides : aucun domaine, puis trois rubriques dès qu’un domaine existe', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, stateB);

  // No domain yet: the root stays the homepage and points at Administration.
  await page.goto('/');
  await expect(page.locator('.topbar h1')).toHaveText('Tableau de bord');
  await expect(page.locator('.empty-state h2')).toHaveText('Aucun domaine');
  await expect(page.locator('.empty-state a[href="/administration"]')).toHaveCount(1);
  await expect(page.locator('.gtd-column')).toHaveCount(0);

  // Create one domain: it has a default todo line, so a card appears in À faire.
  await page.goto('/administration');
  const form = page.locator('#admin-domains .admin-create');
  await form.locator('input[name="name"]').fill('Maison');
  await form.locator('button[type="submit"]').click();
  await expect(page.locator('#admin-domains-table tbody tr')).toHaveCount(1);

  await page.goto('/');
  await expect(page.locator('.gtd-column')).toHaveCount(3);
  await expect(titlesIn(page, 'todo')).toHaveText(['Nouveau projet']);
  await expect(titlesIn(page, 'waiting')).toHaveCount(0);
  await expect(titlesIn(page, 'someday')).toHaveCount(0);
  await expect(col(page, 'waiting').locator('.gtd-empty')).toHaveText('Aucune tâche');
  await expect(col(page, 'someday').locator('.gtd-empty')).toHaveText('Aucune tâche');

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.6 Narrow screen: the context line wraps                           */
/* ------------------------------------------------------------------ */

test('1.6 en 390 px la carte revient à la ligne sans troncature ni débordement', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, stateA);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/');
  // A phone opens the panel by default; the board is read with it folded, like
  // the rest of the page, so the card gets the real content width.
  await page.click('#sidebar-toggle');
  await expect(page.locator('#sidebar')).toHaveCSS('width', '0px');

  const layout = await cardIn(page, 'waiting', 'a2-1').evaluate((entry) => {
    const title = entry.querySelector('.gtd-card-title').getBoundingClientRect();
    const contextEl = entry.querySelector('.gtd-card-context');
    const box = contextEl.getBoundingClientRect();
    const style = getComputedStyle(contextEl);
    const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.4;
    const parents = [...entry.querySelectorAll('.home-task-parent')];
    return {
      titleBottom: title.bottom,
      contextTop: box.top,
      contextRight: box.right,
      contextLines: Math.round(box.height / lineHeight),
      parentOverflow: parents.some((el) => el.scrollWidth > el.clientWidth + 1),
      textOverflow: parents.map((el) => getComputedStyle(el).textOverflow),
      viewportWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });

  expect(layout.contextTop).toBeGreaterThanOrEqual(layout.titleBottom - 1);
  expect(layout.contextLines).toBeGreaterThan(1);
  expect(layout.textOverflow.every((value) => value !== 'ellipsis')).toBe(true);
  expect(layout.parentOverflow).toBe(false);
  expect(layout.contextRight).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth);

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.7 Only parent / done lines are absent from the board              */
/* ------------------------------------------------------------------ */

test("1.7 une mère en cours et son enfant terminé ne sont pas listés", async ({ browser }) => {
  const { context, page } = await signedInPage(browser, stateB);

  await page.goto('/administration');
  const form = page.locator('#admin-domains .admin-create');
  await form.locator('input[name="name"]').fill('Parents seulement');
  await form.locator('button[type="submit"]').click();
  const row = page.locator('#admin-domains-table tbody tr', { hasText: 'Parents seulement' });
  await expect(row).toHaveCount(1);
  const href = await row.locator('a.admin-url').getAttribute('href');
  const slug = href.split('/').pop();

  await page.goto(href);
  const outline = await (await page.request.get(`/domaine/${slug}/api/outline`)).json();
  const parentId = outline[0].id;
  const child = await page.request.post(`/domaine/${slug}/api/nodes`, { form: { parentId } });
  expect(child.ok()).toBeTruthy();
  const childOutline = await (await page.request.get(`/domaine/${slug}/api/outline`)).json();
  const childId = findNode(childOutline, parentId).children[0].id;
  await page.request.post(`/domaine/${slug}/api/nodes/${childId}/status`, {
    form: { status: 'done', scope: 'head' },
  });
  await page.request.post(`/domaine/${slug}/api/nodes/${parentId}/status`, {
    form: { status: 'in_progress', scope: 'head' },
  });

  await page.goto('/');
  await expect(page.locator(`#gtd-node-${parentId}`)).toHaveCount(0);
  await expect(page.locator(`#gtd-node-${childId}`)).toHaveCount(0);

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.8 Mouse drag between rubriques                                    */
/* ------------------------------------------------------------------ */

test('1.8 le glisser à la souris classe la carte et persiste le statut', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, stateA);
  await page.goto('/');

  const drag = async (id, rubrique) => {
    await cardIn(page, 'todo', id)
      .or(cardIn(page, 'waiting', id))
      .or(cardIn(page, 'someday', id))
      .locator('.gtd-grip')
      .dragTo(col(page, rubrique));
  };

  // À faire -> En attente.
  await drag('a7', 'waiting');
  await expect(cardIn(page, 'waiting', 'a7')).toHaveCount(1);
  expect(await statusOf(page, 'domaine-a', 'a7')).toBe('waiting');

  // En attente -> Un jour peut-être.
  await drag('a7', 'someday');
  await expect(cardIn(page, 'someday', 'a7')).toHaveCount(1);
  expect(await statusOf(page, 'domaine-a', 'a7')).toBe('someday');

  // Un jour peut-être -> À faire (the status becomes todo).
  await drag('a7', 'todo');
  await expect(cardIn(page, 'todo', 'a7')).toHaveCount(1);
  expect(await statusOf(page, 'domaine-a', 'a7')).toBe('todo');

  // Dropping a card on its own rubrique sends no mutation.
  const statusRequests = [];
  page.on('request', (request) => {
    if (/\/status$/.test(new URL(request.url()).pathname)) statusRequests.push(request.url());
  });
  await cardIn(page, 'todo', 'a3').locator('.gtd-grip').dragTo(col(page, 'todo'));
  await page.waitForTimeout(150);
  expect(statusRequests).toEqual([]);
  expect(await statusOf(page, 'domaine-a', 'a3')).toBe('in_progress');

  // A drop outside the three rubriques is ignored too.
  await cardIn(page, 'todo', 'a3').locator('.gtd-grip').dragTo(page.locator('.topbar'));
  await page.waitForTimeout(150);
  expect(statusRequests).toEqual([]);
  await expect(cardIn(page, 'todo', 'a3')).toHaveCount(1);
  expect(await statusOf(page, 'domaine-a', 'a3')).toBe('in_progress');

  // A cancelled drag leaves the card and its status in place.
  await page.evaluate(() => {
    const card = document.getElementById('gtd-node-a3');
    const dataTransfer = new DataTransfer();
    card.dispatchEvent(
      new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer })
    );
    document.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
  });
  await page.waitForTimeout(100);
  expect(statusRequests).toEqual([]);
  await expect(cardIn(page, 'todo', 'a3')).toHaveCount(1);
  expect(await statusOf(page, 'domaine-a', 'a3')).toBe('in_progress');

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.9 Keyboard menu, focus and announcement                           */
/* ------------------------------------------------------------------ */

test('1.9 le menu de rubrique classe au clavier, restaure le focus et annonce', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, stateA);
  await page.goto('/');

  const card = cardIn(page, 'todo', 'a1-2');
  await card.locator('.gtd-move-summary').click();
  await card.locator('.gtd-move-item', { hasText: 'En attente' }).click();

  await expect(cardIn(page, 'waiting', 'a1-2')).toHaveCount(1);
  expect(await statusOf(page, 'domaine-a', 'a1-2')).toBe('waiting');
  expect(
    await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('gtd-card-title'))
  ).toBe(true);
  await expect(page.locator('#gtd-announcer')).toContainText('Tâche A1.2');
  await expect(page.locator('#gtd-announcer')).toContainText('En attente');

  // The current rubrique is disabled in the card menu.
  const moved = cardIn(page, 'waiting', 'a1-2');
  await moved.locator('.gtd-move-summary').click();
  await expect(moved.locator('.gtd-move-item.current')).toBeDisabled();
  await expect(moved.locator('.gtd-move-item.current')).toHaveText('En attente');

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.10 Touch drag from the grip                                       */
/* ------------------------------------------------------------------ */

async function touchDrag(page, from, to, steps = 10) {
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
  await cdp.detach();
}

test('1.10 le doigt déplace une carte depuis sa poignée', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: origin,
    storageState: stateA,
    viewport: { width: 1280, height: 900 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto('/');

  const grip = cardIn(page, 'someday', 'b4').locator('.gtd-grip');
  const target = col(page, 'waiting');
  await grip.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const from = await grip.boundingBox();
  const to = await target.boundingBox();
  expect(from).not.toBeNull();
  expect(to).not.toBeNull();

  await touchDrag(
    page,
    { x: from.x + from.width / 2, y: from.y + from.height / 2 },
    { x: to.x + to.width / 2, y: Math.min(to.y + 120, to.y + to.height - 20) }
  );

  await expect(cardIn(page, 'waiting', 'b4')).toHaveCount(1);
  expect(await statusOf(page, 'domaine-b', 'b4')).toBe('waiting');

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.11 Archived domain                                                */
/* ------------------------------------------------------------------ */

test('1.11 une tâche d’un domaine archivé n’apparaît plus', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, stateB);

  await page.goto('/administration');
  const form = page.locator('#admin-domains .admin-create');
  await form.locator('input[name="name"]').fill('À archiver');
  await form.locator('button[type="submit"]').click();
  const row = page.locator('#admin-domains-table tbody tr', { hasText: 'À archiver' });
  await expect(row).toHaveCount(1);
  const href = await row.locator('a.admin-url').getAttribute('href');
  const slug = href.split('/').pop();

  await page.goto('/');
  await expect(page.locator(`.gtd-card-title[href^="/domaine/${slug}"]`)).toHaveCount(1);

  await page.goto('/administration');
  const action = await row.locator('form[action$="/archive"]').getAttribute('action');
  const archived = await page.request.post(action, { form: {} });
  expect(archived.ok()).toBeTruthy();

  await page.goto('/');
  await expect(page.locator(`.gtd-card-title[href^="/domaine/${slug}"]`)).toHaveCount(0);

  await context.close();
});
