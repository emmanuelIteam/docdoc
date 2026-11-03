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
// openspec/changes/increase-line-spacing-on-narrow-screens, then
// openspec/changes/reduce-line-spacing-on-narrow-screens: below the same
// 640px breakpoint each row is at least 39.6px tall (2.475rem, 90% of the
// former 44px), without changing depths, parents or the display order.
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
// touch-spacing check in section 8: the row must grow past 39.6px rather than
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

// A collapsed project with one hidden child, used by section 10: adding a
// sub-task from the context menu must reveal the new line even though its
// parent was collapsed.
const COLLAPSED_FIXTURE = {
  id: DOMAIN_ID,
  name: 'E2E',
  slug: 'e2e',
  order: 0,
  labels: ['theme-e2e'],
  projects: [
    {
      id: 'p',
      title: 'Projet replié',
      status: 'todo',
      collapsed: true,
      children: [
        { id: 'h', title: 'Tâche cachée', status: 'todo', collapsed: false, children: [] },
      ],
    },
  ],
  displayOrder: ['p', 'h'],
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

// A tall outline with a deep hierarchy, used by the sticky ancestry cases in
// section 12 (openspec change add-sticky-ancestor-breadcrumb): 20 projects,
// each with two tasks, the first carrying a sub-task. At 720px or 844px high
// the page scrolls far enough to pin any of the sub-tasks under the header.
const DEEP_FIXTURE = (() => {
  const projects = [];
  const displayOrder = [];
  for (let i = 0; i < 20; i++) {
    const project = {
      id: `p${i}`,
      title: `Projet ${i + 1}`,
      status: 'todo',
      collapsed: false,
      children: [],
    };
    displayOrder.push(project.id);
    for (let j = 0; j < 2; j++) {
      const task = {
        id: `t${i}-${j}`,
        title: `Tâche ${i + 1}.${j + 1}`,
        status: 'todo',
        collapsed: false,
        children: [],
      };
      project.children.push(task);
      displayOrder.push(task.id);
      if (j === 0) {
        const subtask = {
          id: `s${i}`,
          title: `Sous-tâche ${i + 1}.1.1`,
          status: 'todo',
          collapsed: false,
          children: [],
        };
        task.children.push(subtask);
        displayOrder.push(subtask.id);
      }
    }
    projects.push(project);
  }
  return {
    id: DOMAIN_ID,
    name: 'E2E',
    slug: 'e2e',
    order: 0,
    labels: ['theme-e2e'],
    projects,
    displayOrder,
  };
})();

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

// The whole enrollment: email → one-time code → passkey → the homepage.
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
  // The root is the homepage now, not a redirect to the default domain.
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 20000 });
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
  // Enrollment lands on the homepage; the fixtures' domain is addressed
  // explicitly from now on.
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
/*    (increase-line-spacing-on-narrow-screens, then                    */
/*     reduce-line-spacing-on-narrow-screens)                           */
/* ------------------------------------------------------------------ */

// The compact height of a line at the default 16px root: a 20px title
// (line-height 1.25) plus the 0.04rem vertical padding. Computed from
// getBoundingClientRect so the assertion covers the whole box, not just the
// stylesheet.
const COMPACT_HEIGHT = 21.3;

// The minimum height of a line on a narrow screen: 2.475rem at the default
// 16px root, i.e. 39.6px and 90% of the former 44px. Applied by CSS
// (`.line { min-height: 2.475rem }` under the 640px media query), so the
// measured box proves both the rule and its breakpoint.
const TOUCH_HEIGHT = 39.6;

// The computed height of every displayed line, keyed by node id.
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

// Every line is at least TOUCH_HEIGHT tall. Only a title that fits on one
// line proves the exact value: with the sidebar open at 390px the content is
// only ~150px wide, so a short title can wrap and the row then grows past the
// minimum (the same behaviour 8.5 asserts for a long title).
function expectTouchHeights(heights) {
  for (const [id, height] of Object.entries(heights)) {
    expect(height, `hauteur tactile minimale de la ligne ${id}`).toBeGreaterThanOrEqual(
      TOUCH_HEIGHT - 0.1
    );
  }
}

function expectTouchHeight(heights, id) {
  expect(heights[id], `hauteur tactile exacte de la ligne ${id}`).toBeCloseTo(TOUCH_HEIGHT, 0);
}

test('8.1 la hauteur reste compacte sur un écran large', async ({ page }) => {
  await resetDomainTo(INDENT_FIXTURE);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(domainPath);

  expectCompactHeights(await lineHeights(page));
});

test('8.2 chaque ligne offre une cible tactile de 39,6 px à 390 px', async ({ page }) => {
  await resetDomainTo(INDENT_FIXTURE);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(domainPath);

  const heights = await lineHeights(page);
  expectTouchHeights(heights);
  // Depth 0, title on one line: the row is exactly the CSS minimum.
  expectTouchHeight(heights, 'a');
});

test('8.3 le seuil de 640 px est inclusif pour la hauteur', async ({ page }) => {
  await resetDomainTo(INDENT_FIXTURE);
  await page.goto(domainPath);

  await page.setViewportSize({ width: 640, height: 720 });
  const heights = await lineHeights(page);
  expectTouchHeights(heights);
  expectTouchHeight(heights, 'a');

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
  const narrow = await lineHeights(page);
  expectTouchHeights(narrow);
  expectTouchHeight(narrow, 'a');
  expect(await outlineLayout(page)).toEqual(before);

  await page.setViewportSize({ width: 1280, height: 720 });
  expectCompactHeights(await lineHeights(page));
  expect(await outlineLayout(page)).toEqual(before);
});

test('8.5 un titre long grandit la ligne au-delà de 39,6 px sans troncature', async ({ page }) => {
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

  expect(info.rowHeight, 'la ligne grandit pour son titre').toBeGreaterThan(TOUCH_HEIGHT);
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

/* ------------------------------------------------------------------ */
/* 10: the "+" action creates a sub-task ready to be named             */
/* (openspec change add-child-opens-inline).                           */
/* ------------------------------------------------------------------ */

// The selection of a text field: `start` and `end` of the selected range.
const selection = (input) =>
  input.evaluate((el) => `${el.selectionStart}:${el.selectionEnd}`);

test('10.1 + crée une sous-tâche et sélectionne son titre par défaut', async ({ page }) => {
  await page.goto(domainPath);
  await selectLine(page, 'c');

  await line(page, 'c').locator('.menu button[title="Ajouter une tâche"]').click();

  const input = page.locator('#outline .title-input');
  await expect(input).toBeVisible();
  await expect(input).toHaveValue('Nouvelle tâche');
  const defaultValue = 'Nouvelle tâche';
  await expect.poll(() => selection(input)).toBe(`0:${defaultValue.length}`);

  const newId = await input.evaluate((el) => el.closest('.line').dataset.id);
  await expect(line(page, newId)).toHaveAttribute('data-parent', 'c');
  await expect(line(page, newId)).toHaveAttribute('data-depth', '2');

  // Typing replaces the selected default title instead of appending to it.
  await page.keyboard.type('Tâche ajoutée');
  await expect(input).toHaveValue('Tâche ajoutée');

  const saved = page.waitForResponse(
    (res) => res.request().method() === 'PUT' && res.url().includes(`/api/nodes/${newId}`)
  );
  await input.evaluate((el) => el.blur());
  expect((await saved).status()).toBe(200);

  await page.reload();
  await expect(line(page, newId).locator('.title')).toHaveText('Tâche ajoutée');
});

test('10.2 + sur une ligne repliée la déplie et affiche la nouvelle sous-tâche', async ({ page }) => {
  await resetDomainTo(COLLAPSED_FIXTURE);
  await page.goto(domainPath);
  await expect(line(page, 'h')).toHaveCount(0);

  await selectLine(page, 'p');
  await line(page, 'p').locator('.menu button[title="Ajouter une tâche"]').click();

  const input = page.locator('#outline .title-input');
  await expect(input).toBeVisible();
  await expect(line(page, 'h')).toBeVisible();

  const newId = await input.evaluate((el) => el.closest('.line').dataset.id);
  await expect(line(page, newId)).toHaveAttribute('data-parent', 'p');
  await expect(line(page, newId)).toHaveAttribute('data-depth', '1');
});

/* ------------------------------------------------------------------ */
/* 11: the bullet shows that a collapsed line still has sub-tasks      */
/*     (openspec change show-collapsed-subtasks-indicator).            */
/* ------------------------------------------------------------------ */

// The ring drawn over the bullet of a collapsed line.
const ring = (page, id) => line(page, id).locator('.bullet-subtasks');

// Collapse or expand a line through the real gesture: double-click its bullet.
// At 1280px the bullet is revealed on hover, so the line is hovered first.
async function toggleCollapse(page, id) {
  await line(page, id).hover();
  await line(page, id).locator('.bullet').dblclick();
}

test('11.1 une ligne repliée montre sa puce et son anneau sans survol', async ({ page }) => {
  await resetDomainTo(COLLAPSED_FIXTURE);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(domainPath);
  await page.mouse.move(0, 0);

  await expect(line(page, 'p')).toHaveClass(/collapsed/);
  await expect(line(page, 'p').locator('.bullet')).toBeVisible();
  await expect(ring(page, 'p')).toBeVisible();
  // The hidden sub-task is still absent from the DOM.
  await expect(line(page, 'h')).toHaveCount(0);

  // The ring is an out-of-flow circle, so it never takes part in the layout.
  const shape = await ring(page, 'p').evaluate((el) => {
    const s = getComputedStyle(el);
    return { position: s.position, border: s.borderTopWidth, radius: s.borderTopLeftRadius };
  });
  expect(shape.position).toBe('absolute');
  expect(parseFloat(shape.border)).toBe(1);
  expect(shape.radius).toBe('50%');
});

test('11.2 ni une ligne dépliée ni une ligne sans sous-ligne ne portent l’anneau', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(domainPath);
  await page.mouse.move(0, 0);

  // `a` has a child but is expanded: no ring, and the bullet keeps its
  // hover-only reveal.
  await expect(line(page, 'a')).not.toHaveClass(/collapsed/);
  await expect(ring(page, 'a')).toHaveCount(0);
  await expect(line(page, 'a').locator('.bullet')).toBeHidden();

  // `b` has no child at all.
  await expect(line(page, 'b')).not.toHaveClass(/collapsed/);
  await expect(ring(page, 'b')).toHaveCount(0);
  await expect(line(page, 'b').locator('.bullet')).toBeHidden();
  await expect(line(page, 'b').locator('.bullet')).toHaveAttribute(
    'aria-label',
    'Sélectionner la ligne'
  );
});

test('11.3 le repliage ajoute l’anneau, le dépliage le retire', async ({ page }) => {
  await page.goto(domainPath);
  await expect(line(page, 'c')).toBeVisible();

  await toggleCollapse(page, 'a');
  await expect(line(page, 'a')).toHaveClass(/collapsed/);
  await expect(line(page, 'c')).toHaveCount(0);
  await expect(ring(page, 'a')).toBeVisible();

  await toggleCollapse(page, 'a');
  await expect(line(page, 'a')).not.toHaveClass(/collapsed/);
  await expect(line(page, 'c')).toBeVisible();
  await expect(ring(page, 'a')).toHaveCount(0);
});

test('11.4 une ligne dépliée par ?reveal n’affiche pas d’anneau', async ({ page }) => {
  await resetDomainTo(COLLAPSED_FIXTURE);
  await page.goto(`${domainPath}?reveal=h`);

  // `p` is persisted collapsed but the reveal displays it expanded.
  await expect(line(page, 'h')).toBeVisible();
  await expect(line(page, 'p')).not.toHaveClass(/collapsed/);
  await expect(ring(page, 'p')).toHaveCount(0);

  // Without the parameter the persisted state (and its ring) is back.
  await page.goto(domainPath);
  await expect(line(page, 'p')).toHaveClass(/collapsed/);
  await expect(ring(page, 'p')).toBeVisible();
});

test('11.5 l’anneau ne décale ni le titre de la ligne ni celui d’une voisine', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(domainPath);
  const beforeA = await titleLeft(page, 'a');
  const beforeB = await titleLeft(page, 'b');

  await toggleCollapse(page, 'a');

  await expect(line(page, 'a')).toHaveClass(/collapsed/);
  expect(await titleLeft(page, 'a')).toBeCloseTo(beforeA, 1);
  expect(await titleLeft(page, 'b')).toBeCloseTo(beforeB, 1);
});

test('11.6 la poignée de la tête repliée remplace l’anneau, qui revient ensuite', async ({ page }) => {
  await resetDomainTo(COLLAPSED_FIXTURE);
  await page.goto(domainPath);

  const bullet = line(page, 'p').locator('.bullet');
  await expect(bullet).toHaveAttribute('aria-label', /repliée/);
  await expect(bullet).toHaveAttribute('aria-label', /sous-tâches/);

  await bullet.click();
  await expect(line(page, 'p')).toHaveClass(/selected-head/);
  await expect(line(page, 'p').locator('.bullet-grip')).toBeVisible();
  await expect(ring(page, 'p')).toBeHidden();

  // Leaving the line clears the selection: the dot and its ring come back.
  await page.mouse.move(0, 0);
  await expect(line(page, 'p')).not.toHaveClass(/selected-head/);
  await expect(ring(page, 'p')).toBeVisible();
});

test('11.7 deux clics rapprochés replient, sans dépendre de l’événement dblclick', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(domainPath);
  await line(page, 'a').hover();
  const centre = await bulletCentre(page, 'a');

  // Two independent clicks: the browser is not asked to synthesize `dblclick`.
  await page.mouse.click(centre.x, centre.y);
  await page.waitForTimeout(120);
  await page.mouse.click(centre.x, centre.y);

  await expect(line(page, 'a')).toHaveClass(/collapsed/);
  await expect(line(page, 'c')).toHaveCount(0);
});

test('11.8 deux clics espacés ne replient pas', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(domainPath);
  await line(page, 'a').hover();
  const centre = await bulletCentre(page, 'a');

  await page.mouse.click(centre.x, centre.y);
  await page.waitForTimeout(700);
  await page.mouse.click(centre.x, centre.y);

  await expect(line(page, 'a')).not.toHaveClass(/collapsed/);
  await expect(line(page, 'c')).toBeVisible();
});

/* ------------------------------------------------------------------ */
/* 12: the domain name and the parent-task hierarchy stay pinned        */
/*     while scrolling (openspec change                                  */
/*     add-sticky-ancestor-breadcrumb).                                  */
/* ------------------------------------------------------------------ */

const ancestryItems = (page) => page.locator('#ancestry .ancestry-item');

// Scroll so the given line is the first visible one: a line counts as visible
// while any part of it remains below the stuck header, so the target is placed
// slightly under the bar (-10px) and its predecessor is then fully hidden.
async function scrollLineUnderBar(page, id, gap = -10) {
  await line(page, id).evaluate((el, gap) => {
    const barHeight = document.getElementById('topbar').getBoundingClientRect().height;
    const target = el.getBoundingClientRect().top + window.scrollY - barHeight - gap;
    window.scrollTo(0, target);
  }, gap);
  await page.waitForTimeout(120);
}

test('12.1 la barre reste collée en haut et garde le nom du domaine', async ({ page }) => {
  await resetDomainTo(DEEP_FIXTURE);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(domainPath);

  await page.evaluate(() => window.scrollTo(0, 900));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  const geometry = await page.locator('#topbar').evaluate((el) => ({
    position: getComputedStyle(el).position,
    top: el.getBoundingClientRect().top,
  }));
  expect(geometry.position).toBe('sticky');
  expect(Math.abs(geometry.top)).toBeLessThanOrEqual(1);

  await expect(page.locator('#topbar h1')).toHaveText('E2E');
  await expect(page.locator('#topbar h1')).toBeVisible();
  await expect(page.locator('#topbar')).toHaveClass(/is-stuck/);
});

test('12.2 la chaîne empile la hiérarchie de la première ligne visible', async ({ page }) => {
  await resetDomainTo(DEEP_FIXTURE);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(domainPath);

  await scrollLineUnderBar(page, 's8');

  await expect(ancestryItems(page)).toHaveText(['Projet 9', 'Tâche 9.1']);

  const layout = await page.evaluate(() => {
    const box = (selector) => {
      const rect = document.querySelector(selector).getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, left: rect.left, height: rect.height };
    };
    const fontOf = (selector) => {
      const style = getComputedStyle(document.querySelector(selector));
      return { size: style.fontSize, family: style.fontFamily, lineHeight: style.lineHeight };
    };
    const items = Array.from(document.querySelectorAll('#ancestry .ancestry-item'), (el) => {
      const rect = el.getBoundingClientRect();
      const row = el.querySelector('.ancestry-row').getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        indent: row.left,
      };
    });
    return {
      items,
      h1: box('#topbar h1'),
      topbar: box('#topbar'),
      panel: box('#ancestry'),
      panelPosition: getComputedStyle(document.querySelector('#ancestry')).position,
      crumbFont: fontOf('#ancestry .ancestry-row'),
      titleFont: fontOf('#outline .title'),
    };
  });

  // One level per line, each one indented one step further.
  expect(layout.items).toHaveLength(2);
  expect(layout.items[1].top).toBeGreaterThanOrEqual(layout.items[0].bottom - 1);
  expect(layout.items[1].indent).toBeGreaterThan(layout.items[0].indent);

  // The pinned task rows share the outline's exact anatomy: same typography and
  // the same left edge as the line they represent, so they stay aligned with
  // the sub-tasks that remain visible.
  const alignment = await page.evaluate(() => {
    const crumb = document
      .querySelector('#ancestry .ancestry-item:last-child .ancestry-label')
      .getBoundingClientRect();
    const title = document
      .querySelector('#outline .line[data-id="t8-0"] .title')
      .getBoundingClientRect();
    return { crumb: crumb.left, title: title.left };
  });
  expect(Math.abs(alignment.crumb - alignment.title)).toBeLessThanOrEqual(1);

  // The pinned task lines keep the outline's typography: same family, same
  // 1rem size, same line box.
  expect(layout.crumbFont.size).toBe(layout.titleFont.size);
  expect(layout.crumbFont.family).toBe(layout.titleFont.family);
  expect(layout.crumbFont.lineHeight).toBe(layout.titleFont.lineHeight);

  // The stack is in the header's flow: it sits under the title row, grows the
  // header, and never floats over the outline. `relative` only anchors the
  // separator pseudo-element, it does not take the bar out of the flow.
  expect(layout.panelPosition).not.toBe('absolute');
  expect(layout.panelPosition).not.toBe('fixed');
  expect(layout.panel.top).toBeGreaterThanOrEqual(layout.h1.bottom - 1);
  expect(layout.topbar.height).toBeGreaterThan(layout.h1.height);
  expect(layout.topbar.bottom).toBeGreaterThanOrEqual(layout.panel.bottom - 1);
});

test('12.3 la chaîne suit le défilement et se vide sur un projet racine', async ({ page }) => {
  await resetDomainTo(DEEP_FIXTURE);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(domainPath);

  await scrollLineUnderBar(page, 's8');
  await expect(ancestryItems(page)).toHaveText(['Projet 9', 'Tâche 9.1']);

  await scrollLineUnderBar(page, 's10');
  await expect(ancestryItems(page)).toHaveText(['Projet 11', 'Tâche 11.1']);

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(ancestryItems(page)).toHaveCount(0);
  await expect(page.locator('#topbar h1')).toHaveText('E2E');
});

test('12.4 un maillon ramène à sa tâche, qui s’arrête sous la barre', async ({ page }) => {
  await resetDomainTo(DEEP_FIXTURE);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(domainPath);
  await scrollLineUnderBar(page, 's8');
  const before = await page.evaluate(() => window.scrollY);

  await ancestryItems(page).first().click();

  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(before);
  // The chain shrinks after the jump (the target is a root), and the bar's
  // height transition moves the list up one last time: wait for it to settle.
  await page.waitForTimeout(350);
  const geometry = await page.evaluate(() => {
    const bar = document.getElementById('topbar').getBoundingClientRect();
    const target = document.getElementById('node-p8').getBoundingClientRect();
    return { barBottom: bar.bottom, targetTop: target.top };
  });
  // `scroll-margin-top` keeps the anchored line below the header, not under it.
  expect(geometry.targetTop).toBeGreaterThanOrEqual(geometry.barBottom - 1);
});

test('12.5 la chaîne est recalculée après un re-rendu de l’outline', async ({ page }) => {
  await resetDomainTo(DEEP_FIXTURE);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(domainPath);
  await scrollLineUnderBar(page, 's8');
  await expect(ancestryItems(page)).toHaveText(['Projet 9', 'Tâche 9.1']);

  // A real htmx round-trip: `reloadOutline` swaps #outline in place, with no
  // scroll event to wake the bar up.
  await page.evaluate(() => reloadOutline());
  await page.waitForTimeout(400);

  await expect(ancestryItems(page)).toHaveText(['Projet 9', 'Tâche 9.1']);
});

test('12.6 la chaîne reste lisible sur un écran étroit', async ({ page }) => {
  await resetDomainTo(DEEP_FIXTURE);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(domainPath);
  await scrollLineUnderBar(page, 's8');

  await expect(page.locator('#topbar h1')).toBeVisible();
  await expect(page.locator('#topbar h1')).toHaveText('E2E');
  await expect(ancestryItems(page)).toHaveText(['Projet 9', 'Tâche 9.1']);

  // No smaller font on a narrow screen: the pinned lines keep the outline's
  // 1rem size (the indentation step is the only thing that shrinks).
  const sizes = await page.evaluate(() => ({
    crumb: getComputedStyle(document.querySelector('#ancestry .ancestry-item')).fontSize,
    title: getComputedStyle(document.querySelector('#outline .title')).fontSize,
  }));
  expect(sizes.crumb).toBe(sizes.title);

  // The bar never widens the page: no horizontal scrollbar.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test('12.7 au bas de la page, la chaîne ne fait pas osciller le défilement', async ({ page }) => {
  await resetDomainTo(DEEP_FIXTURE);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(domainPath);

  // Jump to the very end: this is where a header that grows with the chain
  // would otherwise clamp the scroll, change the first line, and loop.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  const first = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.scrollY)).toBe(first);

  // The chain is still exactly the hierarchy of the line being read, including
  // a mother task whose own row straddles the bar (see 12.8).
  const state = await page.evaluate(() => {
    const header = document.getElementById('topbar').getBoundingClientRect();
    const lines = Array.from(document.querySelectorAll('#outline .line'));
    const top = lines.find((line) => line.getBoundingClientRect().bottom > header.bottom);
    const chain = Array.from(document.querySelectorAll('#ancestry .ancestry-item'), (el) =>
      el.textContent
    );
    const expected = [];
    let id = top ? top.dataset.parent : '';
    while (id) {
      const parent = document.querySelector(`#outline .line[data-id="${id}"]`);
      if (!parent) break;
      expected.unshift(parent.querySelector('.title').textContent);
      id = parent.dataset.parent;
    }
    const mothers = new Set(lines.map((line) => line.dataset.parent).filter(Boolean));
    if (top && mothers.has(top.dataset.id)) {
      const title = top.querySelector('.title').getBoundingClientRect();
      const hidden = (header.bottom - title.top) / Math.max(title.height, 1);
      if (hidden > 0.001) expected.push(top.querySelector('.title').textContent);
    }
    return { chain, expected };
  });
  expect(state.chain).toEqual(state.expected);
});

// Scroll so the top edge of the given line sits `gap` px below the bar's bottom
// edge: a positive gap leaves the row fully visible, a negative gap hides that
// many pixels of it behind the bar. The header's height is used, not its
// current bottom: at the top of the page the header is not stuck yet, and its
// flow position includes the content's padding. Once the page is scrolled the
// outline and the bar move by the same amount, so the gap is preserved when the
// chain grows.
async function scrollLineTopAtBar(page, id, gap) {
  await line(page, id).evaluate((el, gap) => {
    const barHeight = document.getElementById('topbar').getBoundingClientRect().height;
    const target = el.getBoundingClientRect().top + window.scrollY - (barHeight + gap);
    window.scrollTo(0, target);
  }, gap);
  await page.waitForTimeout(120);
}

// A mother task is a task with displayed children. Its own label is the context
// of those children, so it must never be absent while it crosses the bar: the
// hidden part of its title is pinned at the bar's bottom while the visible part
// stays in the line, so the label is split by the separator instead of being
// duplicated or dropped (openspec change split-pinned-label).
test('12.8 une tâche mère ne disparaît pas quand elle est épinglée ou désépinglée', async ({ page }) => {
  await resetDomainTo(DEEP_FIXTURE);
  await page.setViewportSize({ width: 1280, height: 720 });

  // Fully visible under the bar: the row itself carries the label, so the task
  // is not duplicated as a crumb (the chain describes the line being read,
  // which may be a line of the branch above).
  await page.goto(domainPath);
  await scrollLineTopAtBar(page, 't8-0', 30);
  const fullyVisible = await page.evaluate(() => {
    const bar = document.getElementById('topbar').getBoundingClientRect();
    const title = document.querySelector('#outline .line[data-id="t8-0"] .title');
    return {
      barBottom: bar.bottom,
      titleTop: title.getBoundingClientRect().top,
      chain: Array.from(document.querySelectorAll('#ancestry .ancestry-item'), (el) => el.textContent),
    };
  });
  expect(fullyVisible.titleTop).toBeGreaterThan(fullyVisible.barBottom);
  expect(fullyVisible.chain).not.toContain('Tâche 9.1');

  // Straddling the bar: the title is partly hidden. Its hidden fragment is the
  // last pinned row, clipped to exactly the missing part, so the separator cuts
  // the label instead of showing it twice or letting it vanish.
  await page.goto(domainPath);
  await scrollLineTopAtBar(page, 't8-0', -6);
  const straddling = await page.evaluate(() => {
    const bar = document.getElementById('topbar').getBoundingClientRect();
    const row = document.querySelector('#outline .line[data-id="t8-0"]');
    const title = row.querySelector('.title').getBoundingClientRect();
    const item = document.querySelector('#ancestry .ancestry-item:last-child');
    const itemRect = item.getBoundingClientRect();
    const rowRect = item.querySelector('.ancestry-row').getBoundingClientRect();
    const fraction = parseFloat(getComputedStyle(item).getPropertyValue('--pin-fraction'));
    return {
      barBottom: bar.bottom,
      rowTop: row.getBoundingClientRect().top,
      rowBottom: row.getBoundingClientRect().bottom,
      titleTop: title.top,
      titleHeight: title.height,
      itemTop: itemRect.top,
      itemBottom: itemRect.bottom,
      itemHeight: itemRect.height,
      crumbRowTop: rowRect.top,
      crumbRowBottom: rowRect.bottom,
      fraction,
      partial: item.classList.contains('is-partial'),
      href: item.getAttribute('href'),
    };
  });
  expect(straddling.rowTop).toBeLessThan(straddling.barBottom - 1);
  expect(straddling.rowBottom).toBeGreaterThan(straddling.barBottom);
  expect(straddling.titleTop).toBeLessThan(straddling.barBottom);
  expect(straddling.fraction).toBeGreaterThan(0);
  expect(straddling.fraction).toBeLessThan(1);
  expect(straddling.partial).toBe(true);
  expect(straddling.href).toBe('#node-t8-0');
  // The pinned row is translated so that the fragment it shows starts exactly
  // where the line's title starts to be hidden, and ends at the separator: the
  // two visible halves complement each other, with no gap and no overlapping
  // label.
  expect(Math.abs(straddling.crumbRowTop - straddling.titleTop)).toBeLessThanOrEqual(1);
  expect(Math.abs(straddling.itemBottom - straddling.barBottom)).toBeLessThanOrEqual(1);
  await expect(ancestryItems(page)).toHaveText(['Projet 9', 'Tâche 9.1']);

  // Fully behind the bar: the child is now the line being read and the mother
  // is a full pinned row, so nothing blinked out between the two states.
  await page.goto(domainPath);
  await scrollLineTopAtBar(page, 't8-0', -30);
  const hidden = await page.evaluate(() => {
    const bar = document.getElementById('topbar').getBoundingClientRect();
    const row = document.querySelector('#outline .line[data-id="t8-0"]');
    const item = document.querySelector('#ancestry .ancestry-item:last-child');
    return {
      barBottom: bar.bottom,
      rowBottom: row.getBoundingClientRect().bottom,
      fraction: parseFloat(getComputedStyle(item).getPropertyValue('--pin-fraction')),
    };
  });
  expect(hidden.rowBottom).toBeLessThan(hidden.barBottom);
  expect(hidden.fraction).toBe(1);
  await expect(ancestryItems(page)).toHaveText(['Projet 9', 'Tâche 9.1']);
});

// The bar's height change is a short transition: the list glides by one row
// instead of jumping, and the pinned rows are not re-created while the fraction
// changes (only the height of the bar moves).
test('12.9 la barre de séparation accompagne la liste sans la faire sauter', async ({ page }) => {
  await resetDomainTo(DEEP_FIXTURE);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(domainPath);

  const setup = await page.evaluate(() => {
    window.__barTransitions = [];
    const bar = document.getElementById('ancestry');
    bar.addEventListener('transitionrun', (e) => window.__barTransitions.push('run:' + e.propertyName));
    bar.addEventListener('transitionend', (e) => window.__barTransitions.push('end:' + e.propertyName));
    return {
      bar: getComputedStyle(bar).transitionDuration,
      main: getComputedStyle(document.querySelector('main')).transitionDuration,
    };
  });
  expect(parseFloat(setup.bar)).toBeGreaterThan(0);
  expect(parseFloat(setup.main)).toBeGreaterThan(0);

  // Coming from the empty chain, the two rows of the new chain grow the bar
  // through a height transition (not an instant jump).
  await scrollLineUnderBar(page, 's8');
  await page.waitForTimeout(350);
  const events = await page.evaluate(() => window.__barTransitions);
  expect(events).toContain('run:height');
  expect(events).toContain('end:height');

  // While the same rows stay pinned and the task slides farther under the bar,
  // the bar's height does not change: the pinned block is stable and only the
  // clipped fragment moves.
  await scrollLineTopAtBar(page, 't8-0', -6);
  const before = await page.evaluate(() => ({
    height: document.getElementById('ancestry').getBoundingClientRect().height,
    scrollY: window.scrollY,
    crumb: document
      .querySelector('#ancestry .ancestry-item:last-child')
      .getBoundingClientRect().top,
  }));
  await scrollLineTopAtBar(page, 't8-0', -12);
  const after = await page.evaluate(() => ({
    height: document.getElementById('ancestry').getBoundingClientRect().height,
    scrollY: window.scrollY,
    crumb: document
      .querySelector('#ancestry .ancestry-item:last-child')
      .getBoundingClientRect().top,
  }));
  expect(after.scrollY).toBeGreaterThan(before.scrollY);
  expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(after.crumb - before.crumb)).toBeLessThanOrEqual(0.5);
});
