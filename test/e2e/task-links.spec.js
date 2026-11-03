'use strict';

// End-to-end checks of inline task links (openspec change
// add-inline-task-links, tasks 6.1 to 6.4).
//
// The application runs as a child process on a port picked at run time, with a
// throwaway data directory holding two fixture domains: the active one (`e2e`)
// and a second one (`e2e2`) used to resolve a link across domains. The
// historical local import adopts both at enrollment, so the fixtures survive
// the child process boundary without any storage API.
//
// One account is enrolled once; each test gets a fresh signed-in context whose
// fixture titles and statuses are reset through the HTTP API before the test
// runs. Tests never press Enter in the title field (which would create a line):
// they commit with a blur, which is one of the normal validation paths.

const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { test: base, expect } = require('@playwright/test');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const EMAIL = 'task-links-e2e@example.test';
const DOMAIN_ID = 'e2e';
const SECOND_ID = 'e2e-second';
const SECOND_SLUG = 'e2e2';

let origin = '';
let dataDir = '';
let logFile = '';
let storageState = '';
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
    AUTHORIZED_EMAILS: EMAIL,
    RP_ID: 'localhost',
    RP_ORIGIN: origin,
    DOCDOC_DATA_DIR: dataDir,
    DOCDOC_ENV_FILE: path.join(dataDir, 'absent.env'),
    SESSION_SECRET: 'task-links-e2e-secret',
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

async function enroll(page) {
  await page.goto('/');
  await page.click('a[href="/auth/signup"]');
  await page.fill('#email', EMAIL);
  await page.click('form[action="/auth/email"] button[type="submit"]');
  await page.waitForSelector('#code');
  await page.fill('#code', await waitForCode(EMAIL));
  await page.click('form[action="/auth/email/verify"] button[type="submit"]');
  await page.waitForSelector('#register-passkey-btn');
  await page.click('#register-passkey-btn');
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 20000 });
  await page.waitForSelector('#sidebar');
}

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const linkTo = (slug, id) => `/domaine/${slug}?reveal=${id}#node-${id}`;

const TITLES = {
  a: 'Projet A',
  b: 'Tâche 3',
  c: 'Tâche C',
  around: 'Voir  la suite',
  sel: 'Remplacer ceci',
  linker: `[Tâche 3](${linkTo(DOMAIN_ID, 'b')})`,
  linker2: `[Tâche 3 bis cible](${linkTo(DOMAIN_ID, 't2')})`,
  t2: 'Tâche 3 bis cible',
  escaped: `Voir [<b>x</b>](${linkTo(DOMAIN_ID, 'b')})`,
  bare: 'Voir https://example.com',
  p: 'Projet replié',
  hidden: 'Tâche cachée',
  z: "Tâche de l'autre domaine",
};

const FIXTURE = {
  id: DOMAIN_ID,
  name: 'E2E',
  slug: DOMAIN_ID,
  order: 0,
  labels: [],
  projects: [
    {
      id: 'a',
      title: TITLES.a,
      status: 'todo',
      collapsed: false,
      children: [
        { id: 'b', title: TITLES.b, status: 'todo', collapsed: false, children: [] },
        { id: 'c', title: TITLES.c, status: 'todo', collapsed: false, children: [] },
        { id: 'around', title: TITLES.around, status: 'todo', collapsed: false, children: [] },
        { id: 'sel', title: TITLES.sel, status: 'todo', collapsed: false, children: [] },
        { id: 'linker', title: TITLES.linker, status: 'todo', collapsed: false, children: [] },
        { id: 'linker2', title: TITLES.linker2, status: 'todo', collapsed: false, children: [] },
        { id: 't2', title: TITLES.t2, status: 'todo', collapsed: false, children: [] },
        { id: 'escaped', title: TITLES.escaped, status: 'todo', collapsed: false, children: [] },
      ],
    },
    {
      id: 'p',
      title: TITLES.p,
      status: 'todo',
      collapsed: true,
      children: [{ id: 'hidden', title: TITLES.hidden, status: 'todo', collapsed: false, children: [] }],
    },
    { id: 'bare', title: TITLES.bare, status: 'todo', collapsed: false, children: [] },
  ],
  displayOrder: ['a', 'b', 'c', 'around', 'sel', 'linker', 'linker2', 't2', 'escaped', 'p', 'hidden', 'bare'],
};

const SECOND_FIXTURE = {
  id: SECOND_ID,
  name: 'E2E 2',
  slug: SECOND_SLUG,
  order: 1,
  labels: [],
  projects: [{ id: 'z', title: TITLES.z, status: 'todo', collapsed: false, children: [] }],
  displayOrder: ['z'],
};

function writeFixtures() {
  fs.writeFileSync(path.join(dataDir, `${DOMAIN_ID}.json`), JSON.stringify(FIXTURE));
  fs.writeFileSync(path.join(dataDir, `${SECOND_ID}.json`), JSON.stringify(SECOND_FIXTURE));
  fs.writeFileSync(path.join(dataDir, 'themes.json'), JSON.stringify([]));
}

/* ------------------------------------------------------------------ */
/* Server lifecycle and signed-in pages                                */
/* ------------------------------------------------------------------ */

const test = base.extend({
  page: async ({ browser }, use) => {
    const context = await browser.newContext({ baseURL: origin, storageState });
    const page = await context.newPage();
    try {
      await resetFixtures(page);
      await use(page);
    } finally {
      await context.close();
    }
  },
});

test.beforeAll(async ({ browser }) => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docdoc-task-links-e2e-'));
  logFile = path.join(dataDir, 'server.log');
  storageState = path.join(dataDir, 'session.json');
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

  const context = await browser.newContext({ baseURL: origin });
  const page = await context.newPage();
  await addVirtualAuthenticator(page);
  await enroll(page);
  await context.storageState({ path: storageState });
  await context.close();
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

// Restore the fixture titles and statuses through the API, so each test starts
// from the same outline even though the tests share one server.
async function resetFixtures(page) {
  for (const [id, title] of Object.entries(TITLES)) {
    const slug = id === 'z' ? SECOND_SLUG : DOMAIN_ID;
    await page.request.put(`${origin}/domaine/${slug}/api/nodes/${id}`, { data: { title } });
    await page.request.post(`${origin}/domaine/${slug}/api/nodes/${id}/status`, {
      form: { status: 'todo', scope: 'head' },
    });
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const line = (page, id) => page.locator(`#outline .line[data-id="${id}"]`);

// Open the title editor. Linked titles are opened from the context menu, since
// a click on their label follows the link instead of renaming.
async function openEditor(page, id, viaMenu = false) {
  const row = line(page, id);
  if (viaMenu) {
    await row.hover();
    await row.locator('.bullet').click();
    await expect(row).toHaveClass(/selected-head/);
    await row.locator('.menu-item.rename').click();
  } else {
    await row.locator('.title').click();
  }
  const input = row.locator('.title-input');
  await expect(input).toBeVisible();
  await page.waitForTimeout(80);
  return input;
}

// Dispatch a paste event carrying `text/plain`, the way the browser does. A
// synthetic event is enough: the app reads the clipboard from the event.
async function pasteText(input, text) {
  await input.evaluate((el, value) => {
    const data = new DataTransfer();
    data.setData('text/plain', value);
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: data });
    el.dispatchEvent(event);
  }, text);
}

// Commit the title by leaving the field (the other normal validation path,
// besides Enter, which would create a new line).
async function commit(input) {
  await input.evaluate((el) => el.blur());
}

/* ------------------------------------------------------------------ */
/* 6.1 – 6.2: paste, labels and fallbacks                              */
/* ------------------------------------------------------------------ */

test('6.1 coller un lien de tâche le transforme en lien nommé', async ({ page }) => {
  await page.goto(`/domaine/${DOMAIN_ID}`);
  const input = await openEditor(page, 'sel');
  await input.selectText();
  await pasteText(input, linkTo(DOMAIN_ID, 'b'));

  await expect(input).toHaveValue(`[Tâche 3](${linkTo(DOMAIN_ID, 'b')})`);
  await commit(input);

  const link = line(page, 'sel').locator('.title .title-link');
  await expect(link).toHaveText('Tâche 3');
  await expect(link).toHaveAttribute('href', linkTo(DOMAIN_ID, 'b'));

  // The title was saved: a reload still shows the named link.
  await page.reload();
  await expect(line(page, 'sel').locator('.title .title-link')).toHaveText('Tâche 3');
});

test('6.1 le collage conserve le texte autour du curseur', async ({ page }) => {
  await page.goto(`/domaine/${DOMAIN_ID}`);
  const input = await openEditor(page, 'around');
  await input.evaluate((el) => el.setSelectionRange(5, 5));
  await pasteText(input, linkTo(DOMAIN_ID, 'b'));

  await expect(input).toHaveValue(`Voir [Tâche 3](${linkTo(DOMAIN_ID, 'b')}) la suite`);
  await commit(input);

  const title = line(page, 'around').locator('.title');
  await expect(title).toHaveText('Voir Tâche 3 la suite');
  await expect(title.locator('.title-link')).toHaveText('Tâche 3');
});

test('6.1 une sélection est remplacée par le lien nommé', async ({ page }) => {
  await page.goto(`/domaine/${DOMAIN_ID}`);
  const input = await openEditor(page, 'sel');
  await input.selectText();
  await pasteText(input, linkTo(DOMAIN_ID, 'b'));
  await expect(input).toHaveValue(`[Tâche 3](${linkTo(DOMAIN_ID, 'b')})`);
  await commit(input);
  await expect(line(page, 'sel').locator('.title')).toHaveText('Tâche 3');
});

test('6.2 une cible dans un autre domaine est résolue', async ({ page }) => {
  await page.goto(`/domaine/${DOMAIN_ID}`);
  const input = await openEditor(page, 'c');
  await input.selectText();
  await pasteText(input, linkTo(SECOND_SLUG, 'z'));

  await expect(input).toHaveValue(`[Tâche de l'autre domaine](${linkTo(SECOND_SLUG, 'z')})`);
  await commit(input);

  const link = line(page, 'c').locator('.title .title-link');
  await expect(link).toHaveText("Tâche de l'autre domaine");
  await expect(link).toHaveAttribute('href', linkTo(SECOND_SLUG, 'z'));
});

test('6.2 une cible repliée, absente du DOM, est résolue par l’API', async ({ page }) => {
  await page.goto(`/domaine/${DOMAIN_ID}`);
  await expect(page.locator('#node-hidden')).toHaveCount(0);

  const input = await openEditor(page, 'c');
  await input.selectText();
  await pasteText(input, linkTo(DOMAIN_ID, 'hidden'));
  await expect(input).toHaveValue(`[Tâche cachée](${linkTo(DOMAIN_ID, 'hidden')})`);
});

test('6.2 le libellé d’une cible qui est elle-même un lien est son texte affiché', async ({ page }) => {
  await page.goto(`/domaine/${DOMAIN_ID}`);
  const input = await openEditor(page, 'c');
  await input.selectText();
  await pasteText(input, linkTo(DOMAIN_ID, 'linker'));
  await expect(input).toHaveValue(`[Tâche 3](${linkTo(DOMAIN_ID, 'linker')})`);
});

test('6.2 un lien inconnu est collé brut', async ({ page }) => {
  await page.goto(`/domaine/${DOMAIN_ID}`);
  const input = await openEditor(page, 'c');
  await input.selectText();
  const raw = linkTo(DOMAIN_ID, 'zzz');
  await pasteText(input, raw);
  await expect(input).toHaveValue(raw);
});

test('6.2 le parseur refuse une URL externe ou des ids discordants', async ({ page }) => {
  await page.goto(`/domaine/${DOMAIN_ID}`);
  const results = await page.evaluate((slug) => [
    parseTaskLink(`/domaine/${slug}?reveal=b#node-b`),
    parseTaskLink('https://example.com/domaine/e2e?reveal=b#node-b'),
    parseTaskLink(`/domaine/${slug}?reveal=b`),
    parseTaskLink(`/domaine/${slug}?reveal=b#node-c`),
    parseTaskLink('//example.com/domaine/e2e?reveal=b#node-b'),
  ], DOMAIN_ID);
  expect(results[0]).toEqual({ slug: DOMAIN_ID, id: 'b', href: linkTo(DOMAIN_ID, 'b') });
  expect(results.slice(1)).toEqual([null, null, null, null]);
});

/* ------------------------------------------------------------------ */
/* 6.2: the resolution route                                           */
/* ------------------------------------------------------------------ */

test('6.2 la route de résolution répond 200 et 404', async ({ page }) => {
  const found = await page.request.get(`/domaine/${DOMAIN_ID}/api/nodes/b`);
  expect(found.status()).toBe(200);
  expect(await found.json()).toEqual({ id: 'b', title: 'Tâche 3' });

  const unknownNode = await page.request.get(`/domaine/${DOMAIN_ID}/api/nodes/nope`);
  expect(unknownNode.status()).toBe(404);

  const unknownDomain = await page.request.get('/domaine/inconnu/api/nodes/b');
  expect(unknownDomain.status()).toBe(404);
});

/* ------------------------------------------------------------------ */
/* 6.3: rendering, navigation and editing                              */
/* ------------------------------------------------------------------ */

test('6.3 un lien est rendu comme une ancre, le reste du titre est échappé', async ({ page }) => {
  await page.goto(`/domaine/${DOMAIN_ID}`);

  const link = line(page, 'linker').locator('.title .title-link');
  await expect(link).toHaveText('Tâche 3');
  await expect(link).toHaveAttribute('href', linkTo(DOMAIN_ID, 'b'));

  const escaped = line(page, 'escaped').locator('.title-link');
  await expect(escaped).toHaveText('<b>x</b>');
  await expect(line(page, 'escaped').locator('.title b')).toHaveCount(0);
  await expect(line(page, 'bare').locator('.title a')).toHaveCount(0);

  // The manual lives on the Help page since move-user-manual-to-help-page, not
  // in a footer at the bottom of the outline.
  await page.goto('/aide');
  const guide = page.locator('.guide');
  await expect(guide).toContainText('lien nommé');
  await expect(guide).toContainText('ligne cible');
});

test('6.3 cliquer sur le lien ouvre la ligne cible sans ouvrir le renommage', async ({ page }) => {
  await page.goto(`/domaine/${DOMAIN_ID}`);
  await line(page, 'linker').locator('.title-link').click();

  await page.waitForURL((url) => url.hash === '#node-b');
  await expect(page.locator('#node-b')).toBeVisible();
  await expect(page.locator('.title-input')).toHaveCount(0);
  const targeted = await page.evaluate(() => Boolean(document.querySelector('#node-b:target')));
  expect(targeted).toBe(true);
});

test('6.3 le menu contextuel ouvre le renommage d’un titre entièrement lié', async ({ page }) => {
  await page.goto(`/domaine/${DOMAIN_ID}`);
  const input = await openEditor(page, 'linker', true);
  await expect(input).toHaveValue(TITLES.linker);
  await page.keyboard.press('Escape');
  await expect(line(page, 'linker').locator('.title-link')).toHaveText('Tâche 3');
});

test('6.3 éditer le libellé garde le lien, le retirer le supprime', async ({ page }) => {
  await page.goto(`/domaine/${DOMAIN_ID}`);

  let input = await openEditor(page, 'linker', true);
  await input.fill(`[Nouveau libellé](${linkTo(DOMAIN_ID, 'b')})`);
  await commit(input);
  await expect(line(page, 'linker').locator('.title-link')).toHaveText('Nouveau libellé');

  await page.reload();
  await expect(line(page, 'linker').locator('.title-link')).toHaveText('Nouveau libellé');

  input = await openEditor(page, 'linker', true);
  await input.fill('Nouveau libellé');
  await commit(input);
  await expect(line(page, 'linker').locator('.title-link')).toHaveCount(0);
  await expect(line(page, 'linker').locator('.title')).toHaveText('Nouveau libellé');
});

test('6.3 renommer la cible ne réécrit pas le libellé du lien', async ({ page }) => {
  await page.goto(`/domaine/${DOMAIN_ID}`);
  const before = await line(page, 'linker2').locator('.title-link').textContent();
  expect(before).toBe('Tâche 3 bis cible');

  await page.request.put(`${origin}/domaine/${DOMAIN_ID}/api/nodes/t2`, {
    data: { title: 'Tâche 3 bis renommée' },
  });
  await page.reload();

  await expect(line(page, 'linker2').locator('.title-link')).toHaveText('Tâche 3 bis cible');
});

test('6.3 une ligne liée terminée garde son style de statut', async ({ page }) => {
  await page.goto(`/domaine/${DOMAIN_ID}`);
  const row = line(page, 'linker');
  await row.hover();
  await row.locator('.bullet').click();
  await row.locator('.menu-item[title="Terminé"]').click();

  await expect(row.locator('.title')).toHaveClass(/status-done/);
  await expect(row.locator('.title-link')).toHaveText('Tâche 3');
});

test('6.3 le curseur affiché est projeté dans la source', async ({ page }) => {
  await page.goto(`/domaine/${DOMAIN_ID}`);
  const source = `Voir [Tâche 3](${linkTo(DOMAIN_ID, 'b')}) la suite`;
  const mapped = await page.evaluate((title) => {
    const displayed = displayTitle(title);
    const offset = displayed.indexOf('la suite');
    const fromSource = sourceOffset(title, offset);
    // The click right after the label (on the following space) is the one that
    // used to land inside the label, before `](url)`: it must map after the
    // link syntax instead.
    const edge = displayed.indexOf(' la suite');
    const fromEdge = sourceOffset(title, edge);
    // A click well inside the label still maps into the label part.
    const inLabel = sourceOffset(title, displayed.indexOf('Tâche') + 1);
    return {
      displayed,
      suffix: title.slice(fromSource),
      edgeSuffix: title.slice(fromEdge),
      inLabelSuffix: title.slice(inLabel),
    };
  }, source);
  expect(mapped.displayed).toBe('Voir Tâche 3 la suite');
  expect(mapped.suffix).toBe('la suite');
  expect(mapped.edgeSuffix).toBe(' la suite');
  expect(mapped.inLabelSuffix.startsWith('âche 3](')).toBe(true);
});

test('6.5 un titre entièrement lié reste éditable sur un écran étroit', async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: origin,
    storageState,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await resetFixtures(page);
    await page.goto(`/domaine/${DOMAIN_ID}`);

    const row = line(page, 'linker');
    // At 390px the selection button is visible without hovering. The context
    // menu is horizontally scrollable/clipped like the rest of the narrow
    // layout; Playwright scrolls the rename action into view before clicking.
    await row.locator('.bullet').click();
    await row.locator('.menu-item.rename').click();
    const input = row.locator('.title-input');
    await expect(input).toBeVisible();
    await expect(input).toHaveValue(TITLES.linker);
    await page.keyboard.press('Escape');
    await expect(row.locator('.title-link')).toHaveText('Tâche 3');
  } finally {
    await context.close();
  }
});
