'use strict';

// End-to-end checks of the outline's keyboard indentation, in a real browser.
//
// These cover the manual checklist of openspec/changes/tab-indents-line
// (tasks 6.1 to 6.9): Tab / Shift+Tab while editing a title and while a line is
// selected, the caret and the typed text surviving the reindent, the silent
// no-op when the move is impossible (asserted as "not a single request"), and —
// the regression that motivated this suite — the context menu still working
// after the outline has been re-rendered.
//
// The application runs in this process, against a throwaway data directory, so
// the one-time code (written to the log by the development mailer) can be
// picked up, and the account is enrolled with a virtual authenticator driven
// over CDP: no passkey hardware, no browser download (the installed Chrome is
// used through `channel: 'chrome'`).
//
// Run with: npm run test:e2e

const fs = require('fs');
const os = require('os');
const path = require('path');
const { test: base, expect } = require('@playwright/test');

/* ------------------------------------------------------------------ */
/* Configuration, before the application module reads the environment   */
/* ------------------------------------------------------------------ */

const PORT = Number(process.env.E2E_PORT || 3499);
const ORIGIN = `http://localhost:${PORT}`;
const EMAIL = 'e2e@example.test';
const DOMAIN_ID = 'e2e-domain';

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'docdoc-e2e-'));
const STATE_FILE = path.join(DATA_DIR, 'session.json');

process.env.PORT = String(PORT);
process.env.NODE_ENV = 'development';
process.env.EMAIL_PROVIDER = 'dev';
process.env.AUTHORIZED_EMAILS = EMAIL;
process.env.RP_ID = 'localhost';
process.env.RP_ORIGIN = ORIGIN;
process.env.DOCDOC_DATA_DIR = DATA_DIR;
// A developer's local `.env` must not leak into the test.
process.env.DOCDOC_ENV_FILE = path.join(DATA_DIR, 'absent.env');
for (const key of ['S3_ENDPOINT', 'S3_BUCKET', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']) {
  delete process.env[key];
}

// The outline every test starts from: a project with one sub-line, and a second
// project that can be indented under the first one (and, from there, under the
// sub-line — which is what makes the two-Tab case reachable).
const FIXTURE = {
  id: DOMAIN_ID,
  name: 'E2E',
  slug: 'e2e',
  order: 0,
  labels: ['theme-e2e'],
  projects: [
    {
      id: 'a',
      title: 'Projet A',
      status: 'todo',
      collapsed: false,
      children: [
        { id: 'c', title: 'Tâche A1', status: 'todo', collapsed: false, children: [] },
      ],
    },
    { id: 'b', title: 'Projet B', status: 'todo', collapsed: false, children: [] },
  ],
  displayOrder: ['a', 'c', 'b'],
};

// The reported topology (openspec/changes/reindent-keeps-line-position): one
// task A on line 1 with two sub-tasks, B1 on line 2 and B2 on line 3. The caret
// is put on line 3, and reindenting must leave B2 on line 3.
const LINES_FIXTURE = {
  id: DOMAIN_ID,
  name: 'E2E',
  slug: 'e2e',
  order: 0,
  labels: ['theme-e2e'],
  projects: [
    {
      id: 'a',
      title: 'Tâche A',
      status: 'todo',
      collapsed: false,
      children: [
        { id: 'b1', title: 'Tâche B1', status: 'todo', collapsed: false, children: [] },
        { id: 'b2', title: 'Tâche B2', status: 'todo', collapsed: false, children: [] },
      ],
    },
  ],
  displayOrder: ['a', 'b1', 'b2'],
};

fs.writeFileSync(path.join(DATA_DIR, `${DOMAIN_ID}.json`), JSON.stringify(FIXTURE));
fs.writeFileSync(
  path.join(DATA_DIR, 'themes.json'),
  JSON.stringify([{ id: 'theme-e2e', name: 'Thème E2E', color: '#14b8a6' }])
);

// The one-time code exists only in the server log (development mailer).
let lastCode = null;
const realLog = console.log;
console.log = (...args) => {
  const found = /code pour \S+ : (\d{6})/.exec(args.map(String).join(' '));
  if (found) lastCode = found[1];
  realLog(...args);
};

const { start, invalidateSpace } = require('../../server');
const storage = require('../../storage');
const accounts = require('../../accounts');

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

let server = null;
let userId = null;
let domainPath = '/domaine/e2e';

const test = base.extend({
  // Every test gets a context carrying the session obtained once below: the
  // passkey ceremony is far too slow (and too stateful) to repeat per test.
  page: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: STATE_FILE, baseURL: ORIGIN });
    const page = await context.newPage();
    try {
      await use(page);
    } finally {
      await context.close();
    }
  },
});

// A virtual authenticator makes `navigator.credentials.create/get` resolve
// without any user gesture, so the enrollment the UI performs just works.
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

async function waitForCode() {
  for (let i = 0; i < 120; i++) {
    if (lastCode) return lastCode;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('aucun code à usage unique reçu du serveur');
}

// The whole enrollment: email → one-time code → passkey → the domain page.
async function enroll(page) {
  await page.goto('/');
  await page.click('a[href="/auth/signup"]');
  await page.fill('#email', EMAIL);
  await page.click('form[action="/auth/email"] button[type="submit"]');
  await page.waitForSelector('#code');
  await page.fill('#code', await waitForCode());
  await page.click('form[action="/auth/email/verify"] button[type="submit"]');
  await page.waitForSelector('#register-passkey-btn');
  await page.click('#register-passkey-btn');
  await page.waitForURL(/\/domaine\//, { timeout: 20000 });
}

// Put the fixture outline back, so each test starts from the same tree.
async function resetDomainTo(fixture) {
  await storage.writeJson(storage.domainKey(userId, DOMAIN_ID), fixture);
  invalidateSpace(userId);
}

async function resetDomain() {
  await resetDomainTo(FIXTURE);
}

test.beforeAll(async ({ browser }) => {
  server = await start();

  const context = await browser.newContext({ baseURL: ORIGIN });
  const page = await context.newPage();
  await addVirtualAuthenticator(page);
  await enroll(page);
  domainPath = new URL(page.url()).pathname;
  await context.storageState({ path: STATE_FILE });
  await context.close();

  const account = await accounts.getAccountByEmail(EMAIL);
  if (!account) throw new Error("le compte de test n'a pas été créé");
  userId = account.userId;
});

test.afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

test.beforeEach(resetDomain);

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const line = (page, id) => page.locator(`#outline .line[data-id="${id}"]`);

// The id of every displayed line, in display order. The reported defect was an
// *order* problem (the outdented line was displayed above the lines it
// followed), so the assertions read the order, not only the depth.
const rowIds = (page) =>
  page.locator('#outline .line').evaluateAll((rows) => rows.map((row) => row.dataset.id));

// Open the inline title editor of a line and let the caret settle (the app
// places it on the next animation frame).
async function enterEdit(page, id) {
  await line(page, id).locator('.title').click();
  const input = line(page, id).locator('.title-input');
  await expect(input).toBeVisible();
  await page.waitForTimeout(120);
  return input;
}

// Select a line: the selection button is only visible on hover.
async function selectLine(page, id) {
  await line(page, id).hover();
  await line(page, id).locator('.bullet').click();
  await expect(line(page, id)).toHaveClass(/selected-head/);
}

// Every indent/outdent request the page sends, for the "no request at all"
// assertions.
function watchReindent(page) {
  const calls = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (/\/(indent|outdent)$/.test(pathname)) calls.push(`${request.method()} ${pathname}`);
  });
  return calls;
}

/* ------------------------------------------------------------------ */
/* 6.1 – 6.4: the title being edited                                   */
/* ------------------------------------------------------------------ */

test('6.1 Tab pendant l’édition indente, sans fermer le champ ni perdre le curseur', async ({ page }) => {
  await page.goto(domainPath);
  const input = await enterEdit(page, 'b');
  await page.keyboard.press('Home');
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
  expect(await input.evaluate((el) => el.selectionStart)).toBe(6);

  await page.keyboard.press('Tab');

  await expect(line(page, 'b')).toHaveAttribute('data-depth', '1');
  await expect(line(page, 'b')).toHaveAttribute('data-parent', 'a');
  const reopened = line(page, 'b').locator('.title-input');
  await expect(reopened).toBeFocused();
  await expect.poll(() => reopened.evaluate((el) => el.selectionStart)).toBe(6);
});

test('6.2 MAJ+Tab pendant l’édition désindente, sans quitter le champ', async ({ page }) => {
  await page.goto(domainPath);
  await enterEdit(page, 'c');

  await page.keyboard.press('Shift+Tab');

  await expect(line(page, 'c')).toHaveAttribute('data-depth', '0');
  await expect(line(page, 'c')).toHaveAttribute('data-parent', '');
  await expect(line(page, 'c').locator('.title-input')).toBeFocused();
});

test('6.3 le titre saisi avant le raccourci est conservé et enregistré', async ({ page }) => {
  await page.goto(domainPath);
  const input = await enterEdit(page, 'b');
  await input.fill('Projet B renommé');

  await page.keyboard.press('Tab');

  await expect(line(page, 'b')).toHaveAttribute('data-depth', '1');
  await expect(line(page, 'b').locator('.title-input')).toHaveValue('Projet B renommé');

  // Really persisted, not just shown back by the editor.
  await page.reload();
  await expect(line(page, 'b').locator('.title')).toHaveText('Projet B renommé');
});

test('6.4 deux Tab de suite indente de deux crans', async ({ page }) => {
  await page.goto(domainPath);
  await enterEdit(page, 'b');

  await page.keyboard.press('Tab');
  await expect(line(page, 'b')).toHaveAttribute('data-depth', '1');
  await expect(line(page, 'b').locator('.title-input')).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(line(page, 'b')).toHaveAttribute('data-depth', '2');
  await expect(line(page, 'b')).toHaveAttribute('data-parent', 'c');
});

/* ------------------------------------------------------------------ */
/* 6.5: the selected line                                              */
/* ------------------------------------------------------------------ */

test('6.5 Tab sur une ligne sélectionnée indente et garde la sélection', async ({ page }) => {
  await page.goto(domainPath);
  await selectLine(page, 'b');

  await page.keyboard.press('Tab');

  await expect(line(page, 'b')).toHaveAttribute('data-depth', '1');
  await expect(line(page, 'b')).toHaveClass(/selected-head/);
  await expect(line(page, 'b').locator('.menu')).toBeVisible();

  // Still selected after a second move, and Shift+Tab undoes it.
  await page.keyboard.press('Shift+Tab');
  await expect(line(page, 'b')).toHaveAttribute('data-depth', '0');
  await expect(line(page, 'b')).toHaveClass(/selected-head/);
});

/* ------------------------------------------------------------------ */
/* 6.6 – 6.7: the impossible moves send nothing                        */
/* ------------------------------------------------------------------ */

test('6.6 Tab sur un premier enfant ne fait rien et n’envoie aucune requête', async ({ page }) => {
  await page.goto(domainPath);
  const calls = watchReindent(page);
  await enterEdit(page, 'c');

  await page.keyboard.press('Tab');
  await page.waitForTimeout(300);

  expect(calls).toEqual([]);
  await expect(line(page, 'c')).toHaveAttribute('data-depth', '1');
  await expect(line(page, 'c').locator('.title-input')).toBeFocused();
});

test('6.7 MAJ+Tab sur une ligne racine ne fait rien et n’envoie aucune requête', async ({ page }) => {
  await page.goto(domainPath);
  const calls = watchReindent(page);
  await enterEdit(page, 'a');

  await page.keyboard.press('Shift+Tab');
  await page.waitForTimeout(300);

  expect(calls).toEqual([]);
  await expect(line(page, 'a')).toHaveAttribute('data-depth', '0');
  await expect(line(page, 'a').locator('.title-input')).toBeFocused();
});

/* ------------------------------------------------------------------ */
/* 6.8: Tab keeps its meaning outside the outline lines                */
/* ------------------------------------------------------------------ */

test('6.8 Tab dans un formulaire de la page garde son sens de navigation', async ({ page }) => {
  await page.goto(domainPath);
  const calls = watchReindent(page);

  // Since add-administration-page the sidebar carries no form anymore; the
  // domain page's label picker is the remaining plain form on this page. Tab in
  // it must keep its ordinary meaning (move to the next control), and never be
  // turned into an indent.
  await page.click('#label-add-btn');
  const picker = page.locator('#label-attach-form select[name="themeId"]');
  await picker.focus();
  await expect(picker).toBeFocused();

  await page.keyboard.press('Tab');
  await page.waitForTimeout(200);

  expect(calls).toEqual([]);
  await expect(picker).not.toBeFocused();
  await expect(line(page, 'b')).toHaveAttribute('data-depth', '0');
  await expect(line(page, 'a')).toHaveAttribute('data-depth', '0');
});

/* ------------------------------------------------------------------ */
/* 6.9: the context menu survives the re-render                        */
/* ------------------------------------------------------------------ */

test('6.9a le menu reste utilisable après un Tab (régression)', async ({ page }) => {
  await page.goto(domainPath);
  await selectLine(page, 'b');
  await page.keyboard.press('Tab');
  await expect(line(page, 'b')).toHaveAttribute('data-depth', '1');

  // The outline was re-rendered from scratch: if htmx has not re-bound the new
  // nodes' hx-* attributes, this click does nothing at all.
  await line(page, 'b').locator('.menu button[title="En cours"]').click();
  await expect(line(page, 'b').locator('.title')).toHaveClass(/status-in-progress/);
});

test('6.9b Entrée crée toujours une ligne sœur, et ses menus fonctionnent', async ({ page }) => {
  await page.goto(domainPath);
  await enterEdit(page, 'b');

  await page.keyboard.press('Enter');

  const newInput = page.locator('#outline .title-input');
  await expect(newInput).toBeFocused();
  const newId = await newInput.evaluate((el) => el.closest('.line').dataset.id);
  await expect(line(page, newId)).toHaveAttribute('data-depth', '0');

  await selectLine(page, newId);
  await line(page, newId).locator('.menu button[title="Terminé"]').click();
  await expect(line(page, newId).locator('.title')).toHaveClass(/status-done/);
});

/* ------------------------------------------------------------------ */
/* 4.1 – 4.4: a reindent changes the depth, not the place in the        */
/* outline (openspec/changes/reindent-keeps-line-position). Before the  */
/* fix, outdenting B2 displayed it above B1: the line jumped from line  */
/* 3 to line 2.                                                         */
/* ------------------------------------------------------------------ */

test('4.1-4.2 MAJ+Tab puis Tab pendant l’édition gardent la ligne sur sa ligne', async ({ page }) => {
  await resetDomainTo(LINES_FIXTURE);
  await page.goto(domainPath);
  expect(await rowIds(page)).toEqual(['a', 'b1', 'b2']);

  await enterEdit(page, 'b2');
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');

  await page.keyboard.press('Shift+Tab');

  await expect(line(page, 'b2')).toHaveAttribute('data-depth', '0');
  await expect(line(page, 'b2')).toHaveAttribute('data-parent', '');
  expect(await rowIds(page)).toEqual(['a', 'b1', 'b2']);
  const reopened = line(page, 'b2').locator('.title-input');
  await expect(reopened).toBeFocused();
  await expect.poll(() => reopened.evaluate((el) => el.selectionStart)).toBe(2);

  await page.keyboard.press('Tab');

  await expect(line(page, 'b2')).toHaveAttribute('data-depth', '1');
  await expect(line(page, 'b2')).toHaveAttribute('data-parent', 'a');
  expect(await rowIds(page)).toEqual(['a', 'b1', 'b2']);
  await expect(line(page, 'b2').locator('.title-input')).toBeFocused();
});

test('4.3 MAJ+Tab puis Tab sur une ligne sélectionnée gardent la ligne', async ({ page }) => {
  await resetDomainTo(LINES_FIXTURE);
  await page.goto(domainPath);
  await selectLine(page, 'b2');

  await page.keyboard.press('Shift+Tab');

  await expect(line(page, 'b2')).toHaveAttribute('data-depth', '0');
  await expect(line(page, 'b2')).toHaveClass(/selected-head/);
  expect(await rowIds(page)).toEqual(['a', 'b1', 'b2']);

  await page.keyboard.press('Tab');

  await expect(line(page, 'b2')).toHaveAttribute('data-depth', '1');
  await expect(line(page, 'b2')).toHaveAttribute('data-parent', 'a');
  await expect(line(page, 'b2')).toHaveClass(/selected-head/);
  expect(await rowIds(page)).toEqual(['a', 'b1', 'b2']);
});

test('4.4 le bouton « ← » du menu garde la ligne sur sa ligne', async ({ page }) => {
  await resetDomainTo(LINES_FIXTURE);
  await page.goto(domainPath);
  await selectLine(page, 'b2');

  await line(page, 'b2').locator('.menu button[title="Désindenter"]').click();

  await expect(line(page, 'b2')).toHaveAttribute('data-depth', '0');
  await expect(line(page, 'b2')).toHaveAttribute('data-parent', '');
  expect(await rowIds(page)).toEqual(['a', 'b1', 'b2']);
});
