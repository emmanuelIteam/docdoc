'use strict';

// End-to-end checks of the homepage (openspec changes add-homepage-open-tasks
// and list-leaf-tasks-with-parent-hierarchy).
//
// The application is started as a *child process* (as in administration.spec.js
// and sidebar.spec.js): its configuration is read once at require time, and the
// child gets its own in-memory store unless a bucket is configured.
//
// Two accounts are authorized. Account A enrolls first and adopts the two
// fixture domains written to the throwaway data directory; the legacy files are
// then removed so account B starts with an empty space. Account B is used for
// the empty states: no domain at all, a domain without any in-progress line,
// and only parent lines in progress.
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

// Domain A: in-progress leaves at several depths (a1-1-1, a2-1, a2-2) and
// in-progress parents (a1, a1-1) that must not be listed. a2-2 and a3 share a
// title inside the same domain but have different chains; a3 and b1 share it
// across domains. a2 carries a long title so the chain has to wrap on a narrow
// screen. The lines that must not be listed are a1-2 (todo), a4 and a4-1 (done),
// and b2 (todo). The display order interleaves them so the listing order is
// checked.
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
        { id: 'a2-1', title: 'Tâche A2.1 cachée', status: 'in_progress', collapsed: false, children: [] },
        { id: 'a2-2', title: 'Projet partagé', status: 'in_progress', collapsed: false, children: [] },
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
  ],
  displayOrder: ['a1', 'a1-1', 'a1-1-1', 'a1-2', 'a2', 'a2-1', 'a2-2', 'a3', 'a4', 'a4-1'],
};

// Domain B: the same title as a3, plus a todo line. Listed after domain A.
const DOMAIN_B = {
  id: 'home-dom-b',
  name: 'Domaine B',
  slug: 'domaine-b',
  order: 1,
  labels: [],
  projects: [
    { id: 'b1', title: 'Projet partagé', status: 'in_progress', collapsed: false, children: [] },
    { id: 'b2', title: 'Projet B2', status: 'todo', collapsed: false, children: [] },
  ],
  displayOrder: ['b1', 'b2'],
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

const taskTitles = (page) => page.locator('.home-task .home-task-title');
const taskDomains = (page) => page.locator('.home-task .home-task-domain');
const homeTask = (slug, id) =>
  `.home-task[href="/domaine/${slug}?reveal=${id}#node-${id}"]`;

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
/* 1.1 The aggregate listing                                           */
/* ------------------------------------------------------------------ */

test("1.1 la page d'accueil ne liste que les tâches feuilles en cours, dans l'ordre", async ({ browser }) => {
  const { context, page } = await signedInPage(browser, stateA);

  await page.goto('/');
  await expect(page.locator('.topbar h1')).toHaveText('Tâches en cours');

  // Only leaves, in sidebar domain order then in the outline's display order.
  await expect(taskTitles(page)).toHaveText([
    'Sous-tâche A1.1.1',
    'Tâche A2.1 cachée',
    'Projet partagé',
    'Projet partagé',
    'Projet partagé',
  ]);
  // The domain name is repeated on every entry, so the repeated title stays
  // distinguishable.
  await expect(taskDomains(page)).toHaveText([
    'Domaine A',
    'Domaine A',
    'Domaine A',
    'Domaine A',
    'Domaine B',
  ]);

  // In-progress parents are not entries, even though their titles appear in the
  // context line of their leaves: the absence is checked by href, not by text.
  await expect(page.locator(homeTask('domaine-a', 'a1'))).toHaveCount(0);
  await expect(page.locator(homeTask('domaine-a', 'a1-1'))).toHaveCount(0);

  // The second line carries the domain, then the parents from the top-level
  // project down to the immediate parent.
  const parentsOf = (slug, id) =>
    page.locator(homeTask(slug, id)).locator('.home-task-parent');
  const domainOf = (slug, id) =>
    page.locator(homeTask(slug, id)).locator('.home-task-domain');
  await expect(domainOf('domaine-a', 'a1-1-1')).toHaveText('Domaine A');
  await expect(parentsOf('domaine-a', 'a1-1-1')).toHaveText(['Projet A1', 'Tâche A1.1']);
  await expect(domainOf('domaine-a', 'a2-1')).toHaveText('Domaine A');
  await expect(parentsOf('domaine-a', 'a2-1')).toHaveText([
    'Projet A2 replié avec un titre de tâche mère volontairement long',
  ]);
  // Same title as a3, but in another branch: the chain distinguishes them.
  await expect(parentsOf('domaine-a', 'a2-2')).toHaveText([
    'Projet A2 replié avec un titre de tâche mère volontairement long',
  ]);
  // A leaf without parent shows its domain alone.
  await expect(domainOf('domaine-a', 'a3')).toHaveText('Domaine A');
  await expect(parentsOf('domaine-a', 'a3')).toHaveCount(0);
  await expect(domainOf('domaine-b', 'b1')).toHaveText('Domaine B');
  await expect(parentsOf('domaine-b', 'b1')).toHaveCount(0);

  // Todo and done lines are not listed, at any depth.
  for (const title of ['Tâche A1.2', 'Projet A4 terminé', 'Tâche A4.1 terminée', 'Projet B2']) {
    await expect(page.locator('.home-task', { hasText: title })).toHaveCount(0);
  }

  // Each entry is the existing deep link, exactly.
  await expect(page.locator(homeTask('domaine-a', 'a3'))).toHaveCount(1);
  await expect(page.locator(homeTask('domaine-b', 'b1'))).toHaveCount(1);

  // A leaf hidden on its domain page by a collapsed ancestor is still listed.
  await page.goto('/domaine/domaine-a');
  await expect(page.locator('#node-a2-1')).toHaveCount(0);
  await page.goto('/');
  await expect(page.locator(homeTask('domaine-a', 'a2-1'))).toHaveCount(1);

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.2 Opening a task in its context                                   */
/* ------------------------------------------------------------------ */

test("1.2 ouvrir une tâche sous un ancêtre replié la déplie, la cible et ne change pas son statut", async ({ browser }) => {
  const { context, page } = await signedInPage(browser, stateA);

  await page.goto('/');
  await page.click(homeTask('domaine-a', 'a2-1'));

  await expect(page).toHaveURL(/\/domaine\/domaine-a\?reveal=a2-1#node-a2-1$/);
  const target = page.locator('#node-a2-1');
  await expect(target).toBeVisible();
  // The ancestor is force-expanded by `?reveal` without its persisted state
  // changing, and the line is the fragment target, hence highlighted.
  await expect(page.locator('#node-a2')).not.toHaveClass(/collapsed/);
  expect(await target.evaluate((el) => el.matches(':target'))).toBe(true);
  // No rename field opened, and the status is untouched.
  await expect(page.locator('.title-input')).toHaveCount(0);
  await expect(target.locator('.title')).toHaveClass(/status-in-progress/);

  // Back on the homepage, the task is still listed with the same status.
  await page.goto('/');
  await expect(page.locator(homeTask('domaine-a', 'a2-1'))).toHaveCount(1);

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.3 Keyboard activation                                             */
/* ------------------------------------------------------------------ */

test('1.3 une entrée est activable au clavier', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, stateA);

  await page.goto('/');
  await page.locator(homeTask('domaine-a', 'a1-1-1')).focus();
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

  // Present at the head of the panel, inactive on a domain page.
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

  // Active on the homepage, and no domain is highlighted there.
  await home.click();
  await expect(page).toHaveURL(/\/(\?.*)?$/);
  await expect(page.locator('a.sidebar-home')).toHaveClass(/active/);
  await expect(page.locator('a.sidebar-home')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#sidebar-nav a.sidebar-link.active')).toHaveCount(0);

  // Inactive again on the administration page.
  await page.goto('/administration');
  await expect(page.locator('a.sidebar-home')).not.toHaveClass(/active/);

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.5 The two empty states (account B)                                */
/* ------------------------------------------------------------------ */

test('1.5 les états vides : aucun domaine, puis aucune tâche en cours', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, stateB);

  // No domain yet: the root stays the homepage and points at Administration.
  await page.goto('/');
  await expect(page.locator('.topbar h1')).toHaveText('Tâches en cours');
  await expect(page.locator('.empty-state h2')).toHaveText('Aucun domaine');
  await expect(page.locator('.empty-state a[href="/administration"]')).toHaveCount(1);
  await expect(page.locator('.home-task')).toHaveCount(0);

  // Create one domain: it has a default todo line, so still nothing in progress.
  await page.goto('/administration');
  const form = page.locator('#admin-domains .admin-create');
  await form.locator('input[name="name"]').fill('Maison');
  await form.locator('button[type="submit"]').click();
  await expect(page.locator('#admin-domains-table tbody tr')).toHaveCount(1);

  await page.goto('/');
  await expect(page.locator('.empty-state h2')).toHaveText('Aucune tâche en cours');
  await expect(page.locator('.home-task')).toHaveCount(0);

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.6 Narrow screen: the context line wraps                           */
/* ------------------------------------------------------------------ */

test('1.6 en 390 px la seconde ligne revient à la ligne sans troncature ni débordement', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, stateA);
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/');

  const layout = await page.locator(homeTask('domaine-a', 'a2-1')).evaluate((entry) => {
    const title = entry.querySelector('.home-task-title').getBoundingClientRect();
    const contextEl = entry.querySelector('.home-task-context');
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

  // The context sits on a second line, below the title, and wraps rather than
  // being cut: no ellipsis, no overflow, no horizontal scrolling.
  expect(layout.contextTop).toBeGreaterThanOrEqual(layout.titleBottom - 1);
  expect(layout.contextLines).toBeGreaterThan(1);
  expect(layout.textOverflow.every((value) => value !== 'ellipsis')).toBe(true);
  expect(layout.parentOverflow).toBe(false);
  expect(layout.contextRight).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth);

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.7 Only parent tasks in progress: the homepage stays empty         */
/* ------------------------------------------------------------------ */

test("1.7 seules des tâches mères en cours : l'accueil reste vide", async ({ browser }) => {
  const { context, page } = await signedInPage(browser, stateB);

  // Give account B a domain, then make its only line a parent by adding a child.
  await page.goto('/administration');
  const form = page.locator('#admin-domains .admin-create');
  await form.locator('input[name="name"]').fill('Parents seulement');
  await form.locator('button[type="submit"]').click();
  const row = page.locator('#admin-domains-table tbody tr', { hasText: 'Parents seulement' });
  await expect(row).toHaveCount(1);
  const href = await row.locator('a.admin-url').getAttribute('href');
  const slug = href.split('/').pop();

  // Visiting the domain materializes its default line, which becomes the parent.
  await page.goto(href);
  const outline = await (await page.request.get(`/domaine/${slug}/api/outline`)).json();
  const parentId = outline[0].id;
  const child = await page.request.post(`/domaine/${slug}/api/nodes`, { form: { parentId } });
  expect(child.ok()).toBeTruthy();
  // Only the parent goes in progress; its child stays "À faire".
  await page.request.post(`/domaine/${slug}/api/nodes/${parentId}/status`, {
    form: { status: 'in_progress', scope: 'head' },
  });

  // The parent really is in progress on its domain page...
  await page.goto(href);
  await expect(page.locator(`#node-${parentId} .title`)).toHaveClass(/status-in-progress/);

  // ...yet the homepage lists nothing: it explains that no leaf is in progress
  // instead of claiming that no line is.
  await page.goto('/');
  await expect(page.locator('.empty-state h2')).toHaveText('Aucune tâche en cours');
  await expect(page.locator('.empty-state p')).toContainText('Aucune tâche sans sous-tâche');
  await expect(page.locator('.home-task')).toHaveCount(0);

  await context.close();
});
