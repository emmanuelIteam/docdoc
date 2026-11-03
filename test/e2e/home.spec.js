'use strict';

// End-to-end checks of the homepage (openspec change add-homepage-open-tasks,
// tasks 4.4 to 4.7).
//
// The application is started as a *child process* (as in administration.spec.js
// and sidebar.spec.js): its configuration is read once at require time, and the
// child gets its own in-memory store unless a bucket is configured.
//
// Two accounts are authorized. Account A enrolls first and adopts the two
// fixture domains written to the throwaway data directory; the legacy files are
// then removed so account B starts with an empty space. Account B is used for
// the two empty states: no domain at all, then a domain without any in-progress
// line.
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

// Domain A: in-progress lines at three depths (a1, a1-1, a1-1-1), an
// in-progress line hidden under a collapsed parent (a2-1), a title repeated in
// domain B (a3), and lines that must not be listed (a1-2 todo, a4 and a4-1
// done). The display order interleaves them so the listing order is checked.
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
      title: 'Projet A2 replié',
      status: 'todo',
      collapsed: true,
      children: [
        { id: 'a2-1', title: 'Tâche A2.1 cachée', status: 'in_progress', collapsed: false, children: [] },
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
  displayOrder: ['a1', 'a1-1', 'a1-1-1', 'a1-2', 'a2', 'a2-1', 'a3', 'a4', 'a4-1'],
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

test("1.1 la page d'accueil liste les tâches en cours de tous les domaines, dans l'ordre", async ({ browser }) => {
  const { context, page } = await signedInPage(browser, stateA);

  await page.goto('/');
  await expect(page.locator('.topbar h1')).toHaveText('Tâches en cours');

  // Domains in sidebar order, then the outline's display order inside a domain.
  await expect(taskTitles(page)).toHaveText([
    'Projet A1',
    'Tâche A1.1',
    'Sous-tâche A1.1.1',
    'Tâche A2.1 cachée',
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
    'Domaine A',
    'Domaine B',
  ]);

  // Todo and done lines are not listed, at any depth.
  for (const title of ['Tâche A1.2', 'Projet A4 terminé', 'Tâche A4.1 terminée', 'Projet B2']) {
    await expect(page.locator('.home-task', { hasText: title })).toHaveCount(0);
  }

  // Each entry is the existing deep link, exactly.
  await expect(page.locator(homeTask('domaine-a', 'a3'))).toHaveCount(1);
  await expect(page.locator(homeTask('domaine-b', 'b1'))).toHaveCount(1);

  // A line hidden on its domain page by a collapsed ancestor is still listed.
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
