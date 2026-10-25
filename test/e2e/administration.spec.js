'use strict';

// End-to-end checks of the administration page (openspec change
// add-administration-page, tasks 6.1 to 6.3).
//
// The application is started as a *child process* rather than in-process: this
// spec coexists with reindent.spec.js in the same Playwright worker, and the
// server module reads its configuration once at require time. A child process
// also gives the test its own in-memory store (no bucket configured), so the
// fixtures of one spec can never leak into the other.
//
// The child's stdout goes to a file (not a pipe): the sandbox denies piped
// stdio, and the development mailer writes the one-time codes to the log — the
// file is both the log and the code source.
//
// The port is chosen free at run time, so a server left behind by an earlier
// run can never make a fresh child fail to bind while the test talks to the old
// one.
//
// Run with: npm run test:e2e

const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { test, expect } = require('@playwright/test');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const EMAIL_A = 'admin-e2e@example.test';
const EMAIL_B = 'admin-e2e-b@example.test';

let origin = '';
let dataDir = '';
let logFile = '';
let stateA = '';
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
    SESSION_SECRET: 'admin-e2e-secret',
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
/* Enrollment (same ceremony as reindent.spec.js)                      */
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

// A signed-in context for an account. The session is obtained once by `enroll`
// and replayed from the saved storage state by later tests.
function signedInBrowser(browser, storageState) {
  return browser.newContext({ baseURL: origin, storageState });
}

test.beforeAll(async ({ browser }) => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docdoc-admin-e2e-'));
  logFile = path.join(dataDir, 'server.log');
  stateA = path.join(dataDir, 'session-a.json');
  const port = await freePort();
  origin = `http://localhost:${port}`;

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
  await enroll(page, EMAIL_A);
  await context.storageState({ path: stateA });
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

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const domainRow = (page, slug) =>
  page
    .locator('#admin-domains-table tbody tr')
    .filter({ has: page.locator(`a.admin-url[href="/domaine/${slug}"]`) });

function acceptDialogs(page) {
  page.on('dialog', (dialog) => dialog.accept());
}

/* ------------------------------------------------------------------ */
/* 6.1 The whole administration flow, in one serial walk-through       */
/* ------------------------------------------------------------------ */

test('6.1 créer, renommer, colorer, réordonner, étiqueter, archiver, restaurer et purger', async ({ browser }) => {
  const context = await signedInBrowser(browser, stateA);
  const page = await context.newPage();
  acceptDialogs(page);

  // The entry point: the sidebar footer, not a hidden form.
  await page.goto('/');
  await page.click('a.sidebar-admin');
  await expect(page).toHaveURL(/\/administration$/);
  await expect(page.locator('#admin-themes')).toBeVisible();
  await expect(page.locator('#admin-domains')).toBeVisible();
  await expect(page.locator('.admin-archives')).not.toHaveJSProperty('open', true);
  await expect(page.locator('#admin-themes > .admin-empty')).toContainText('Aucun thème');
  await expect(page.locator('#admin-domains > .admin-empty')).toContainText('Aucun domaine');

  // Create two themes (name + color).
  const themeForm = page.locator('#admin-themes .admin-create');
  await themeForm.locator('input[name="name"]').fill('Maison');
  await themeForm.locator('input[name="color"]').fill('#e11d48');
  await themeForm.locator('button[type="submit"]').click();
  await expect(page.locator('.admin-list .admin-row')).toHaveCount(1);
  await expect(page.locator('#sidebar .theme-group-name').first()).toHaveText('Maison');

  await themeForm.locator('input[name="name"]').fill('Travail');
  await themeForm.locator('input[name="color"]').fill('#2563eb');
  await themeForm.locator('button[type="submit"]').click();
  await expect(page.locator('.admin-list .admin-row')).toHaveCount(2);

  // Change the color of the first theme: the sidebar dot follows.
  const firstThemeRow = page.locator('.admin-list .admin-row').nth(0);
  await firstThemeRow.locator('input[name="color"]').fill('#008000');
  await firstThemeRow.locator('button[title="Enregistrer le nom et la couleur"]').click();
  await expect(page.locator('#sidebar .theme-group-header .theme-dot').first()).toHaveAttribute(
    'style',
    /#008000/i
  );

  // Reorder the themes: Maison moves below Travail.
  await firstThemeRow.locator('button[title="Descendre"]').click();
  await expect(page.locator('.admin-list .admin-row').nth(0).locator('input[name="name"]')).toHaveValue(
    'Travail'
  );
  await expect(page.locator('#sidebar .theme-group-name').nth(0)).toHaveText('Travail');

  // Create two domains.
  const domainForm = page.locator('#admin-domains .admin-create');
  await domainForm.locator('input[name="name"]').fill('Alpha');
  await domainForm.locator('button[type="submit"]').click();
  await domainForm.locator('input[name="name"]').fill('Beta');
  await domainForm.locator('button[type="submit"]').click();
  await expect(page.locator('#admin-domains-table tbody tr')).toHaveCount(2);
  await expect(domainRow(page, 'alpha')).toHaveCount(1);
  await expect(domainRow(page, 'beta')).toHaveCount(1);
  await expect(page.locator('#sidebar .sidebar-link').first()).toHaveText('Alpha');

  // Reorder the domains: Beta first, in the table and in the sidebar.
  await domainRow(page, 'beta').locator('button[title="Monter"]').click();
  await expect(page.locator('#admin-domains-table tbody tr').nth(0)).toContainText('/domaine/beta');
  await expect(page.locator('#sidebar .sidebar-link').first()).toHaveText('Beta');

  // The matrix attaches Travail (first row) to Beta (first column, after the
  // reorder). The sidebar regroups the domain under that theme.
  const matrixCell = page.locator('.matrix tbody tr').nth(0).locator('td').nth(0).locator('.matrix-toggle');
  await expect(matrixCell).toHaveAttribute('aria-pressed', 'false');
  await matrixCell.click();
  await expect(matrixCell).toHaveAttribute('aria-pressed', 'true');
  const travailGroup = page.locator('#sidebar .theme-group').filter({ hasText: 'Travail' }).first();
  await expect(travailGroup.locator('.sidebar-link')).toHaveText(['Beta']);

  // Toggling the cell again detaches the theme.
  await matrixCell.click();
  await expect(matrixCell).toHaveAttribute('aria-pressed', 'false');
  const untagged = page.locator('#sidebar .theme-group').filter({ hasText: 'Sans thème' });
  await expect(untagged.locator('.sidebar-link')).toHaveText(['Beta', 'Alpha']);

  // Archive Alpha: it leaves the sidebar and appears in the collapsed archives.
  await domainRow(page, 'alpha').locator('button[title="Archiver"]').click();
  await expect(page).toHaveURL(/\/administration$/);
  await expect(domainRow(page, 'alpha')).toHaveCount(0);
  await expect(page.locator('#sidebar a.sidebar-link', { hasText: 'Alpha' })).toHaveCount(0);
  await page.locator('.admin-archives summary').click();
  await expect(page.locator('#admin-archives-table tbody tr')).toHaveCount(1);

  // Recreate an active "Alpha" (slug "alpha"), then restore the archived one:
  // the restored domain must get a distinct slug and be appended at the end.
  await domainForm.locator('input[name="name"]').fill('Alpha');
  await domainForm.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/administration$/);
  await expect(domainRow(page, 'alpha')).toHaveCount(1);

  // The creation reloaded the page, so the archives section is collapsed again.
  await page.locator('.admin-archives summary').click();
  await page
    .locator('#admin-archives-table tbody tr')
    .filter({ hasText: 'Alpha' })
    .locator('button', { hasText: 'Restaurer' })
    .click();
  await expect(page).toHaveURL(/\/administration$/);
  await expect(domainRow(page, 'alpha-2')).toHaveCount(1);
  await expect(page.locator('#admin-domains-table tbody tr').last()).toContainText('/domaine/alpha-2');
  await expect(page.locator('#sidebar .sidebar-nav .sidebar-link').last()).toHaveText('Alpha');

  // The restored domain is really reachable at its regenerated URL.
  await page.goto('/domaine/alpha-2');
  await expect(page.locator('h1')).toHaveText('Alpha');

  // Rename a domain from the page: the form stays hidden until the ✎ control
  // is activated, the warning is shown, the slug is regenerated.
  await page.goto('/administration');
  const restoredRow = domainRow(page, 'alpha-2');
  await expect(restoredRow.locator('input[name="name"]')).toBeHidden();
  await restoredRow.locator('.admin-rename summary').click();
  await expect(restoredRow.locator('.admin-hint')).toBeVisible();
  await expect(restoredRow.locator('.admin-hint')).toContainText('URL sera régénérée');
  await restoredRow.locator('input[name="name"]').fill('Omega');
  await restoredRow.locator('button[title="Enregistrer le nom"]').click();
  await expect(page).toHaveURL(/\/administration$/);
  await expect(domainRow(page, 'omega')).toHaveCount(1);
  const gone = await page.request.get('/domaine/alpha-2');
  expect(gone.status()).toBe(404);
  expect(await gone.text()).toContain('Domaine introuvable');

  // Purge: archive Beta, then delete its archive object for good.
  await page.goto('/administration');
  await domainRow(page, 'beta').locator('button[title="Archiver"]').click();
  await page.locator('.admin-archives summary').click();
  await expect(page.locator('#admin-archives-table tbody tr')).toHaveCount(1);
  await page
    .locator('#admin-archives-table tbody tr')
    .filter({ hasText: 'Beta' })
    .locator('button', { hasText: 'Purger' })
    .click();
  await expect(page.locator('.admin-archives .admin-empty')).toContainText('Aucun domaine archivé');

  // Delete a theme from the page: the palette and the sidebar lose it, and its
  // label is pruned from every domain (none carries it at this point).
  await page.locator('.admin-list .admin-row').nth(1).locator('button[title="Supprimer"]').click();
  await expect(page.locator('input.theme-name-input')).toHaveCount(1);
  await expect(page.locator('#sidebar .theme-group-name')).toHaveText(['Travail', 'Sans thème']);

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 6.2 The sidebar and the domain page no longer manage anything       */
/* ------------------------------------------------------------------ */

test('6.2 le panneau et la page domaine n’offrent plus de contrôles de gestion', async ({ browser }) => {
  const context = await signedInBrowser(browser, stateA);
  const page = await context.newPage();

  // Self-sufficient: this test creates the domain it visits, so it does not
  // depend on the state left by 6.1 (the worker is restarted after a failure).
  await page.goto('/administration');
  const domainForm = page.locator('#admin-domains .admin-create');
  await domainForm.locator('input[name="name"]').fill('Navigation');
  await domainForm.locator('button[type="submit"]').click();

  await expect(page.locator('#sidebar')).toBeVisible();
  const sidebar = page.locator('#sidebar');
  await expect(sidebar.locator('input, select, textarea')).toHaveCount(0);
  await expect(sidebar.locator('#new-theme-btn, #new-theme-form, #new-domain-btn, #new-domain-form')).toHaveCount(0);
  await expect(sidebar.locator('form[action^="/api/themes"]')).toHaveCount(0);
  await expect(sidebar.locator('button[title="Renommer"], button[title="Supprimer"]')).toHaveCount(0);
  await expect(sidebar.locator('a.sidebar-admin')).toHaveCount(1);

  // The domain page keeps its content, with the labels in a floating bar and no
  // management control of its own.
  const firstDomain = page.locator('#admin-domains-table a.admin-url').first();
  await expect(firstDomain).toHaveCount(1);
  const domainHref = await firstDomain.getAttribute('href');
  await page.goto(domainHref);
  await expect(page.locator('#outline')).toHaveCount(1);
  await expect(page.locator('#labels-bar')).toHaveCount(1);
  expect(await page.locator('#labels-bar').evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
  await expect(page.locator('.toolbar')).toHaveCount(0);
  await expect(page.locator('.rename-input, .admin-rename')).toHaveCount(0);
  await expect(page.locator('form[action$="/archive"]')).toHaveCount(0);

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 6.3 Archives are confined to the account                            */
/* ------------------------------------------------------------------ */

test('6.3 les archives sont confinées au compte et une archive inconnue est refusée', async ({ browser }) => {
  // Give account A a theme with a name no other account should ever see.
  const contextA = await signedInBrowser(browser, stateA);
  const pageA = await contextA.newPage();
  await pageA.goto('/administration');
  const themeForm = pageA.locator('#admin-themes .admin-create');
  await themeForm.locator('input[name="name"]').fill('Confidentiel');
  await themeForm.locator('button[type="submit"]').click();
  await expect(pageA.locator('input.theme-name-input[value="Confidentiel"]')).toHaveCount(1);

  // A second authorized account, enrolled from scratch.
  const contextB = await browser.newContext({ baseURL: origin });
  const pageB = await contextB.newPage();
  await addVirtualAuthenticator(pageB);
  await enroll(pageB, EMAIL_B);

  await pageB.goto('/administration');
  await expect(pageB.locator('#admin-themes > .admin-empty')).toContainText('Aucun thème');
  await expect(pageB.locator('#admin-domains > .admin-empty')).toContainText('Aucun domaine');
  await expect(pageB.locator('.admin-archives .admin-empty')).toContainText('Aucun domaine archivé');
  await expect(pageB.locator('body')).not.toContainText('Confidentiel');

  // An unknown archive id is a 404, and nothing is created.
  const restore = await contextB.request.post('/api/archives/inconnu/restore', { form: {} });
  expect(restore.status()).toBe(404);
  expect(await restore.text()).toContain('Archive introuvable');

  const purge = await contextB.request.post('/api/archives/inconnu/purge', { form: {} });
  expect(purge.status()).toBe(404);

  await contextB.close();

  // Account A still holds its own theme.
  await pageA.reload();
  await expect(pageA.locator('input.theme-name-input[value="Confidentiel"]')).toHaveCount(1);
  await contextA.close();
});

/* ------------------------------------------------------------------ */
/* 6.6 – 6.8: the domain page's new invariants and gestures            */
/* ------------------------------------------------------------------ */

async function createTheme(page, name, color = '#0ea5e9') {
  const form = page.locator('#admin-themes .admin-create');
  await form.locator('input[name="name"]').fill(name);
  await form.locator('input[name="color"]').fill(color);
  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/administration$/);
}

async function createDomain(page, name) {
  const form = page.locator('#admin-domains .admin-create');
  await form.locator('input[name="name"]').fill(name);
  await form.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/administration$/);
}

async function domainHref(page, slug) {
  const link = domainRow(page, slug).locator('a.admin-url');
  await expect(link).toHaveCount(1);
  return link.getAttribute('href');
}

test('6.6 un domaine ne reste jamais sans ligne', async ({ browser }) => {
  const context = await signedInBrowser(browser, stateA);
  const page = await context.newPage();
  acceptDialogs(page);

  await page.goto('/administration');
  await createDomain(page, 'Projet');
  await page.goto(await domainHref(page, 'projet'));

  await expect(page.locator('#outline .line')).toHaveCount(1);
  await expect(page.locator('#outline .line .title')).toHaveText('Nouveau projet');

  // Delete the only line: the response already carries its replacement, since a
  // domain without any line would have no way to create one (no toolbar).
  const line = page.locator('#outline .line').first();
  await line.hover();
  await line.locator('.bullet').click();
  await expect(line).toHaveClass(/selected-head/);
  await line.locator('.menu button[title="Supprimer"]').click();

  await expect(page.locator('#outline .line')).toHaveCount(1);
  await expect(page.locator('#outline .line .title')).toHaveText('Nouveau projet');

  await context.close();
});

test('6.7 la barre d’étiquettes met à jour la barre et le panneau sans rechargement', async ({ browser }) => {
  const context = await signedInBrowser(browser, stateA);
  const page = await context.newPage();

  await page.goto('/administration');
  await createTheme(page, 'Barre');
  await createDomain(page, 'Étiquette');
  await page.goto(await domainHref(page, 'etiquette'));

  await expect(page.locator('#labels-bar')).toBeVisible();
  // A marker on `window` survives an htmx swap, never a page reload.
  await page.evaluate(() => {
    window.__noReloadMarker = 'kept';
  });

  await page.click('#label-add-btn');
  const picker = page.locator('#label-attach-form');
  await expect(picker).toBeVisible();
  await picker.locator('select').selectOption({ label: 'Barre' });
  await picker.locator('button[type="submit"]').click();

  await expect(page.locator('#labels-bar .label-chip-name')).toHaveText(['Barre']);
  expect(await page.evaluate(() => window.__noReloadMarker)).toBe('kept');
  const group = page.locator('#sidebar .theme-group').filter({ hasText: 'Barre' }).first();
  await expect(group.locator('.sidebar-link')).toHaveText(['Étiquette']);

  // Detach: the chip goes, the sidebar falls back to "Sans thème", still in place.
  await page.locator('#labels-bar .label-chip-x').click();
  await expect(page.locator('#labels-bar .label-chip-name')).toHaveCount(0);
  expect(await page.evaluate(() => window.__noReloadMarker)).toBe('kept');
  const untagged = page.locator('#sidebar .theme-group').filter({ hasText: 'Sans thème' });
  await expect(untagged.locator('.sidebar-link', { hasText: 'Étiquette' })).toHaveCount(1);

  await context.close();
});

test('6.8 le renommage d’un domaine est derrière un bouton ✎', async ({ browser }) => {
  const context = await signedInBrowser(browser, stateA);
  const page = await context.newPage();

  await page.goto('/administration');
  await createDomain(page, 'Renommable');
  const row = domainRow(page, 'renommable');
  const nameInput = row.locator('input[name="name"]');
  await expect(nameInput).toBeHidden();
  await expect(row.locator('.admin-hint')).toBeHidden();

  await row.locator('.admin-rename summary').click();
  await expect(nameInput).toBeVisible();
  await expect(row.locator('.admin-hint')).toBeVisible();
  await expect(row.locator('.admin-hint')).toContainText('URL sera régénérée');

  await nameInput.fill('Renommé');
  await row.locator('button[title="Enregistrer le nom"]').click();
  await expect(page).toHaveURL(/\/administration$/);
  await expect(domainRow(page, 'renomme')).toHaveCount(1);

  // The domain page itself still offers no renaming control.
  await page.goto('/domaine/renomme');
  await expect(page.locator('.rename-input, .admin-rename, [title="Renommer"]')).toHaveCount(0);

  await context.close();
});
