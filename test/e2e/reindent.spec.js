'use strict';

// End-to-end checks of the outline's indentation in a real browser: keyboard
// reindentation and the indentation step on narrow screens.
//
// The keyboard cases cover the manual checklist of
// openspec/changes/tab-indents-line (tasks 6.1 to 6.9): Tab / Shift+Tab while
// editing a title and while a line is selected, the caret and the typed text
// surviving the reindent, the silent no-op when the move is impossible
// (asserted as "not a single request"), and — the regression that motivated
// this suite — the context menu still working after the outline has been
// re-rendered. The responsive cases (section 7) cover
// openspec/changes/halve-indent-on-narrow-screens: below 640px the indentation
// step is halved, without changing depths or the display order. The
// touch-spacing cases (section 8) cover
// openspec/changes/increase-line-spacing-on-narrow-screens: below the same
// 640px breakpoint each row is at least 44px tall, without changing depths,
// parents or the display order.
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

// Three nested levels (depths 0, 1 and 2), used by the responsive indentation
// checks in section 7. Kept apart from the fixtures above so the existing
// keyboard tests start from the same trees as before.
const INDENT_FIXTURE = {
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
        {
          id: 'b',
          title: 'Tâche B',
          status: 'todo',
          collapsed: false,
          children: [
            { id: 'c', title: 'Tâche C', status: 'todo', collapsed: false, children: [] },
          ],
        },
      ],
    },
  ],
  displayOrder: ['a', 'b', 'c'],
};

// One line whose title cannot fit on a single phone-width line, used by the
// touch-spacing check in section 8: the row must grow past 44px rather than
// clip or truncate the title. Kept apart from the fixtures above so the
// keyboard and indentation tests start from the same trees as before.
const WRAP_FIXTURE = {
  id: DOMAIN_ID,
  name: 'E2E',
  slug: 'e2e',
  order: 0,
  labels: ['theme-e2e'],
  projects: [
    {
      id: 'long',
      title:
        'Une tâche dont le titre est assez long pour revenir sur plusieurs lignes sur un téléphone',
      status: 'todo',
      collapsed: false,
      children: [],
    },
  ],
  displayOrder: ['long'],
};

// A long outline used by the touch auto-scroll check in section 9: enough rows
// to need scrolling at 390x844, so a drag held near the bottom edge must scroll
// the page to reach a target that started off-screen.
const LONG_FIXTURE = {
  id: DOMAIN_ID,
  name: 'E2E',
  slug: 'e2e',
  order: 0,
  labels: [],
  projects: Array.from({ length: 30 }, (_, i) => ({
    id: `n${i}`,
    title: `Tâche ${i + 1}`,
    status: 'todo',
    collapsed: false,
    children: [],
  })),
  displayOrder: Array.from({ length: 30 }, (_, i) => `n${i}`),
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
  // A smartphone-shaped context for the touch cases (section 9): same session,
  // 390x844 and touch enabled, so the no-hover behaviour and the pointer-event
  // drag are exercised the way a phone triggers them.
  touchPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: STATE_FILE,
      baseURL: ORIGIN,
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
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

/* ------------------------------------------------------------------ */
/* 7. Indentation step vs window width                                */
/*    (openspec/changes/halve-indent-on-narrow-screens)                */
/* ------------------------------------------------------------------ */

// The computed left margin of every displayed line, keyed by node id. The
// indentation is applied by CSS (`.line { margin-left: depth * step }`), so the
// computed value proves both the step and the depth it was derived from.
const lineMargins = (page) =>
  page.locator('#outline .line').evaluateAll((rows) =>
    Object.fromEntries(
      rows.map((row) => [row.dataset.id, parseFloat(getComputedStyle(row).marginLeft)])
    )
  );

// What a resize must not change: the depth, the parent and the display order.
const outlineLayout = (page) =>
  page.locator('#outline .line').evaluateAll((rows) =>
    rows.map((row) => ({
      id: row.dataset.id,
      depth: row.dataset.depth,
      parent: row.dataset.parent,
    }))
  );

async function expectMargins(page, expected) {
  const actual = await lineMargins(page);
  for (const [id, px] of Object.entries(expected)) {
    expect(actual, `marge calculée de la ligne ${id}`).toHaveProperty(id);
    expect(actual[id]).toBeCloseTo(px, 3);
  }
}

test('7.1 pas plein au-dessus du seuil de 640 px', async ({ page }) => {
  await resetDomainTo(INDENT_FIXTURE);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(domainPath);

  await expectMargins(page, { a: 0, b: 25.6, c: 51.2 });
});

test('7.2 pas réduit de moitié à 640 px et en dessous', async ({ page }) => {
  await resetDomainTo(INDENT_FIXTURE);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(domainPath);

  await expectMargins(page, { a: 0, b: 12.8, c: 25.6 });
});

test('7.3 le seuil de 640 px est inclusif', async ({ page }) => {
  await resetDomainTo(INDENT_FIXTURE);
  await page.goto(domainPath);

  await page.setViewportSize({ width: 640, height: 720 });
  await expectMargins(page, { c: 25.6 });

  await page.setViewportSize({ width: 641, height: 720 });
  await expectMargins(page, { c: 51.2 });
});

test('7.4 la bascule suit le redimensionnement, sans rechargement', async ({ page }) => {
  await resetDomainTo(INDENT_FIXTURE);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(domainPath);

  const before = await outlineLayout(page);
  await expectMargins(page, { a: 0, b: 25.6, c: 51.2 });

  // A reload would wipe this marker; a media query must not need one.
  await page.evaluate(() => {
    window.__noReload = true;
  });

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => window.__noReload)).toBe(true);
  await expectMargins(page, { a: 0, b: 12.8, c: 25.6 });
  expect(await outlineLayout(page)).toEqual(before);

  await page.setViewportSize({ width: 1280, height: 720 });
  await expectMargins(page, { a: 0, b: 25.6, c: 51.2 });
  expect(await outlineLayout(page)).toEqual(before);
});

/* ------------------------------------------------------------------ */
/* 8. Touch height vs window width                                    */
/*    (openspec/changes/increase-line-spacing-on-narrow-screens)      */
/* ------------------------------------------------------------------ */

// The compact height of a line at the default 16px root: a 20px title
// (line-height 1.25) plus the 0.04rem vertical padding. Computed from
// getBoundingClientRect so the assertion covers the whole box, not just the
// stylesheet.
const COMPACT_HEIGHT = 21.3;

// The computed height of every displayed line, keyed by node id. The touch
// height is applied by CSS (`.line { min-height: 2.75rem }` under the 640px
// media query), so the measured box proves both the rule and its breakpoint.
const lineHeights = (page) =>
  page.locator('#outline .line').evaluateAll((rows) =>
    Object.fromEntries(
      rows.map((row) => [row.dataset.id, row.getBoundingClientRect().height])
    )
  );

// Half a pixel of tolerance: `rem` values and the browser's rounding of the
// 0.04rem padding can move the compact height by a fraction of a pixel.
function expectCompactHeights(heights) {
  for (const [id, height] of Object.entries(heights)) {
    expect(height, `hauteur compacte de la ligne ${id}`).toBeCloseTo(COMPACT_HEIGHT, 0);
  }
}

function expectTouchHeights(heights) {
  for (const [id, height] of Object.entries(heights)) {
    expect(height, `hauteur tactile de la ligne ${id}`).toBeGreaterThanOrEqual(44);
    expect(height, `hauteur tactile de la ligne ${id}`).toBeLessThan(44.5);
  }
}

test('8.1 la hauteur reste compacte sur un écran large', async ({ page }) => {
  await resetDomainTo(INDENT_FIXTURE);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(domainPath);

  expectCompactHeights(await lineHeights(page));
});

test('8.2 chaque ligne offre une cible tactile de 44 px à 390 px', async ({ page }) => {
  await resetDomainTo(INDENT_FIXTURE);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(domainPath);

  expectTouchHeights(await lineHeights(page));
});

test('8.3 le seuil de 640 px est inclusif pour la hauteur', async ({ page }) => {
  await resetDomainTo(INDENT_FIXTURE);
  await page.goto(domainPath);

  await page.setViewportSize({ width: 640, height: 720 });
  expectTouchHeights(await lineHeights(page));

  await page.setViewportSize({ width: 641, height: 720 });
  expectCompactHeights(await lineHeights(page));
});

test('8.4 la hauteur suit le redimensionnement, sans rechargement', async ({ page }) => {
  await resetDomainTo(INDENT_FIXTURE);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(domainPath);

  const before = await outlineLayout(page);
  expectCompactHeights(await lineHeights(page));

  // A reload would wipe this marker; a media query must not need one.
  await page.evaluate(() => {
    window.__noReload = true;
  });

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => window.__noReload)).toBe(true);
  expectTouchHeights(await lineHeights(page));
  expect(await outlineLayout(page)).toEqual(before);

  await page.setViewportSize({ width: 1280, height: 720 });
  expectCompactHeights(await lineHeights(page));
  expect(await outlineLayout(page)).toEqual(before);
});

test('8.5 un titre long grandit la ligne au-delà de 44 px sans troncature', async ({ page }) => {
  await resetDomainTo(WRAP_FIXTURE);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(domainPath);

  const info = await line(page, 'long').evaluate((row) => {
    const title = row.querySelector('.title');
    return {
      rowHeight: row.getBoundingClientRect().height,
      titleHeight: title.getBoundingClientRect().height,
      overflows: row.scrollHeight > row.clientHeight + 1,
      whiteSpace: getComputedStyle(title).whiteSpace,
      textOverflow: getComputedStyle(title).textOverflow,
    };
  });

  expect(info.rowHeight, 'la ligne grandit pour son titre').toBeGreaterThan(44);
  // More than two 20px title lines: the text really wrapped.
  expect(info.titleHeight, 'le titre occupe plusieurs lignes').toBeGreaterThan(40);
  expect(info.overflows, 'aucun contenu coupé ou débordant').toBe(false);
  expect(info.whiteSpace).toBe('normal');
  expect(info.textOverflow).toBe('clip');
});

/* ------------------------------------------------------------------ */
/* 9. Touch: always-visible selection button and drag handle           */
/*    (openspec/changes/add-touch-drag-handle)                         */
/* ------------------------------------------------------------------ */

// The touch gestures are played over CDP: Playwright exposes a tap helper but
// no drag, and these are the events a phone actually sends. `touchBegin`
// returns the session so a test can inspect the mid-gesture state (the invalid
// target, the auto-scroll) before releasing.
async function touchBegin(page, from, to, steps = 8) {
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
  await page.waitForTimeout(60);
  return cdp;
}

async function touchEnd(cdp, { cancel = false } = {}) {
  await cdp.send('Input.dispatchTouchEvent', {
    type: cancel ? 'touchCancel' : 'touchEnd',
    touchPoints: [],
  });
  await cdp.detach();
}

async function touchDrag(page, from, to, steps) {
  const cdp = await touchBegin(page, from, to, steps);
  await touchEnd(cdp);
}

// Every request to the move endpoint, with its JSON body.
function watchMoves(page) {
  const calls = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (/\/move$/.test(pathname)) {
      calls.push({ method: request.method(), body: request.postDataJSON() });
    }
  });
  return calls;
}

// The centre of a line's selection button (the dot, or the handle once the line
// is selected — same slot, same box).
async function bulletCentre(page, id) {
  const box = await line(page, id).locator('.bullet').boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const titleLeft = (page, id) =>
  line(page, id).locator('.title').evaluate((el) => el.getBoundingClientRect().left);

test('9.1 la puce est visible sans survol et mesure au moins 24 × 24 px', async ({ touchPage }) => {
  await touchPage.goto(domainPath);

  const bullet = line(touchPage, 'b').locator('.bullet');
  await expect(bullet).toBeVisible();
  const box = await bullet.boundingBox();
  expect(box.width, 'largeur de la cible tactile').toBeGreaterThanOrEqual(24);
  expect(box.height, 'hauteur de la cible tactile').toBeGreaterThanOrEqual(24);
});

test('9.2 un tap sur la puce sélectionne, sans renommer et sans déplacer', async ({ touchPage }) => {
  await touchPage.goto(domainPath);
  const before = await titleLeft(touchPage, 'a');
  const moves = watchMoves(touchPage);

  const centre = await bulletCentre(touchPage, 'a');
  await touchPage.touchscreen.tap(centre.x, centre.y);

  await expect(line(touchPage, 'a')).toHaveClass(/selected-head/);
  await expect(touchPage.locator('.title-input')).toHaveCount(0);
  // The dot became a handle in the same slot: the title did not shift.
  expect(await titleLeft(touchPage, 'a')).toBeCloseTo(before, 1);
  expect(moves).toEqual([]);
});

test('9.3 la tête sélectionnée affiche la poignée, les sous-lignes le point', async ({ touchPage }) => {
  await touchPage.goto(domainPath);
  const head = await bulletCentre(touchPage, 'a');
  await touchPage.touchscreen.tap(head.x, head.y);

  await expect(line(touchPage, 'a').locator('.bullet-grip')).toBeVisible();
  await expect(line(touchPage, 'a').locator('.bullet-dot')).toBeHidden();
  await expect(line(touchPage, 'c').locator('.bullet-dot')).toBeVisible();
  await expect(line(touchPage, 'c').locator('.bullet-grip')).toBeHidden();

  // Another line becomes the head: the dot comes back on the previous one.
  const other = await bulletCentre(touchPage, 'b');
  await touchPage.touchscreen.tap(other.x, other.y);
  await expect(line(touchPage, 'a').locator('.bullet-dot')).toBeVisible();
  await expect(line(touchPage, 'a').locator('.bullet-grip')).toBeHidden();
});

test('9.4 un glisser de la poignée déplace la ligne avant sa cible', async ({ touchPage }) => {
  await touchPage.goto(domainPath);
  const from = await bulletCentre(touchPage, 'b');
  await touchPage.touchscreen.tap(from.x, from.y);
  await expect(line(touchPage, 'b')).toHaveClass(/selected-head/);

  const moves = watchMoves(touchPage);
  const aBox = await line(touchPage, 'a').boundingBox();
  // Top quarter of `a`: the line must be inserted above it.
  await touchDrag(touchPage, from, { x: aBox.x + 40, y: aBox.y + 6 });

  await expect.poll(() => moves.length).toBe(1);
  expect(moves[0].method).toBe('POST');
  expect(moves[0].body).toEqual({ targetId: 'a', position: 'before' });
  await expect.poll(() => rowIds(touchPage)).toEqual(['b', 'a', 'c']);
  await expect(line(touchPage, 'b')).toHaveAttribute('data-depth', '0');
});

test('9.5 un dépôt sur son propre sous-arbre est invalide et ne déplace rien', async ({ touchPage }) => {
  await touchPage.goto(domainPath);
  const from = await bulletCentre(touchPage, 'a');
  const moves = watchMoves(touchPage);
  const cBox = await line(touchPage, 'c').boundingBox();

  const cdp = await touchBegin(touchPage, from, {
    x: cBox.x + 40,
    y: cBox.y + cBox.height / 2,
  });
  // Marked invalid while the finger is still down.
  await expect(touchPage.locator('#outline .line.drop-invalid')).toHaveCount(1);
  await touchEnd(cdp);

  await expect.poll(() => rowIds(touchPage)).toEqual(['a', 'c', 'b']);
  expect(moves).toEqual([]);
  await expect(touchPage.locator('.line.drop-invalid')).toHaveCount(0);
});

test('9.6 un glisser annulé ne déplace rien', async ({ touchPage }) => {
  await touchPage.goto(domainPath);
  const from = await bulletCentre(touchPage, 'b');
  const moves = watchMoves(touchPage);
  const aBox = await line(touchPage, 'a').boundingBox();

  const cdp = await touchBegin(touchPage, from, { x: aBox.x + 40, y: aBox.y + 6 });
  await expect(touchPage.locator('.line.dragging')).toHaveCount(1);
  await touchEnd(cdp, { cancel: true });

  await expect.poll(() => rowIds(touchPage)).toEqual(['a', 'c', 'b']);
  expect(moves).toEqual([]);
  await expect(touchPage.locator('.line.dragging')).toHaveCount(0);
  await expect(touchPage.locator('.line.drop-target, .line.drop-invalid')).toHaveCount(0);
});

test('9.7 le doigt près du bord bas fait défiler la page pendant le glisser', async ({ touchPage }) => {
  await resetDomainTo(LONG_FIXTURE);
  await touchPage.goto(domainPath);
  await touchPage.evaluate(() => window.scrollTo(0, 0));

  const from = await bulletCentre(touchPage, 'n0');
  const cdp = await touchBegin(touchPage, from, { x: from.x, y: 820 });
  await expect
    .poll(() => touchPage.evaluate(() => window.scrollY), { timeout: 4000 })
    .toBeGreaterThan(0);
  await touchEnd(cdp, { cancel: true });
});

test('9.8 sur un écran large, la puce reste révélée au survol', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(domainPath);

  const bullet = line(page, 'b').locator('.bullet');
  await expect(bullet).toBeHidden();
  await line(page, 'b').hover();
  await expect(bullet).toBeVisible();
});
