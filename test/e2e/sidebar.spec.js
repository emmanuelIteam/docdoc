'use strict';

// End-to-end checks of the left sidebar on a phone (openspec changes
// collapse-sidebar-on-domain-select, tasks 1.1 to 1.3, and pin-sidebar-footer,
// tasks 1.6 and 1.7).
//
// The application is started as a *child process*, as in administration.spec.js:
// this spec coexists with the other suites in the same Playwright worker, and
// the server module reads its configuration once at require time. A child
// process also gives the test its own in-memory store (no bucket configured), so
// the fixtures of one spec can never leak into another.
//
// The child's stdout goes to a file (not a pipe): the development mailer writes
// the one-time codes there. Two domains are adopted at enrollment, which is what
// makes a sidebar selection possible at all.
//
// Run with: npm run test:e2e

const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { test, expect } = require('@playwright/test');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const EMAIL = 'sidebar-e2e@example.test';
const PHONE = { width: 390, height: 844 };

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
    // A developer's local `.env` must not leak into the test.
    DOCDOC_ENV_FILE: path.join(dataDir, 'absent.env'),
    SESSION_SECRET: 'sidebar-e2e-secret',
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
/* Fixtures: two domains, so one can be picked from the sidebar        */
/* ------------------------------------------------------------------ */

const FIRST = {
  id: 'e2e',
  name: 'E2E',
  slug: 'e2e',
  order: 0,
  labels: [],
  projects: [{ id: 'a', title: 'Projet A', status: 'todo', collapsed: false, children: [] }],
  displayOrder: ['a'],
};

const SECOND = {
  id: 'e2e2',
  name: 'E2E 2',
  slug: 'e2e2',
  order: 1,
  labels: [],
  projects: [{ id: 'z', title: 'Projet Z', status: 'todo', collapsed: false, children: [] }],
  displayOrder: ['z'],
};

function writeFixtures() {
  fs.writeFileSync(path.join(dataDir, `${FIRST.id}.json`), JSON.stringify(FIRST));
  fs.writeFileSync(path.join(dataDir, `${SECOND.id}.json`), JSON.stringify(SECOND));
  fs.writeFileSync(path.join(dataDir, 'themes.json'), JSON.stringify([]));
}

/* ------------------------------------------------------------------ */
/* Server lifecycle and signed-in pages                                */
/* ------------------------------------------------------------------ */

// A signed-in context at a given viewport. The phone context also enables touch
// and mobile emulation, so the panel is exercised the way a smartphone uses it.
async function signedInPage(browser, options = {}) {
  const context = await browser.newContext({
    baseURL: origin,
    storageState,
    ...options,
  });
  const page = await context.newPage();
  return { context, page };
}

const collapsedKey = (page) => page.evaluate(() => localStorage.getItem('sidebarCollapsed'));

const domainLink = (page, slug) => page.locator(`#sidebar-nav a.sidebar-link[href="/domaine/${slug}"]`);

test.beforeAll(async ({ browser }) => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docdoc-sidebar-e2e-'));
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

/* ------------------------------------------------------------------ */
/* 1.1 The phone: picking a domain closes the panel                    */
/* ------------------------------------------------------------------ */

test('1.1 sur un smartphone, choisir un domaine referme le panneau', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, {
    viewport: PHONE,
    hasTouch: true,
    isMobile: true,
  });

  await page.goto('/domaine/e2e');
  // The premise: the panel is open, so a domain can be picked from it.
  await expect(page.locator('#sidebar')).toHaveCSS('width', '240px');
  await expect(domainLink(page, 'e2e2')).toBeVisible();

  await domainLink(page, 'e2e2').click();

  await page.waitForURL(/\/domaine\/e2e2$/);
  await expect(page.locator('.topbar h1')).toHaveText('E2E 2');
  // The panel is closed on the page that was just selected, without a reload.
  await expect(page.locator('body')).toHaveClass(/sidebar-collapsed/);
  await expect(page.locator('#sidebar')).toHaveCSS('width', '0px');
  // The state is persisted: that is what makes a full page load arrive closed.
  expect(await collapsedKey(page)).toBe('1');

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.2 It survives a reload, and the toggle reopens it                 */
/* ------------------------------------------------------------------ */

test('1.2 le repli persiste après rechargement, et le bouton rouvre le panneau', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, {
    viewport: PHONE,
    hasTouch: true,
    isMobile: true,
  });

  await page.goto('/domaine/e2e');
  await domainLink(page, 'e2e2').click();
  await page.waitForURL(/\/domaine\/e2e2$/);
  await expect(page.locator('body')).toHaveClass(/sidebar-collapsed/);

  await page.reload();
  await expect(page.locator('.topbar h1')).toHaveText('E2E 2');
  await expect(page.locator('body')).toHaveClass(/sidebar-collapsed/);
  await expect(page.locator('#sidebar')).toHaveCSS('width', '0px');

  // The same control that closes the panel reopens it: one state, one button.
  await page.click('#sidebar-toggle');
  await expect(page.locator('body')).not.toHaveClass(/sidebar-collapsed/);
  await expect(page.locator('#sidebar')).toHaveCSS('width', '240px');
  expect(await collapsedKey(page)).toBe('');

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.3 A wide screen keeps the panel as it was                         */
/* ------------------------------------------------------------------ */

test('1.3 sur un écran large, choisir un domaine laisse le panneau ouvert', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, { viewport: { width: 1280, height: 720 } });

  await page.goto('/domaine/e2e');
  await expect(page.locator('#sidebar')).toHaveCSS('width', '240px');

  await domainLink(page, 'e2e2').click();
  await page.waitForURL(/\/domaine\/e2e2$/);
  await expect(page.locator('.topbar h1')).toHaveText('E2E 2');

  await expect(page.locator('body')).not.toHaveClass(/sidebar-collapsed/);
  await expect(page.locator('#sidebar')).toHaveCSS('width', '240px');
  expect(await collapsedKey(page)).toBe(null);

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.4 Every panel entry that opens a page closes the panel (phone)    */
/* ------------------------------------------------------------------ */

test('1.4 sur un smartphone, toute entrée qui ouvre une page referme le panneau', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, {
    viewport: PHONE,
    hasTouch: true,
    isMobile: true,
  });

  // The previous entry left the panel collapsed and persisted; reopen it from a
  // short domain page before each one.
  async function openPanel(path = '/domaine/e2e') {
    await page.goto(path);
    if (await page.locator('body').evaluate((el) => el.classList.contains('sidebar-collapsed'))) {
      await page.click('#sidebar-toggle');
    }
    await expect(page.locator('#sidebar')).toHaveCSS('width', '240px');
  }

  await openPanel();
  await page.click('a.sidebar-home');
  await page.waitForURL(/\/(\?.*)?$/);
  await expect(page.locator('body')).toHaveClass(/sidebar-collapsed/);

  await openPanel();
  await page.click('a.sidebar-admin');
  await page.waitForURL(/\/administration$/);
  await expect(page.locator('body')).toHaveClass(/sidebar-collapsed/);

  await openPanel();
  await page.click('a.sidebar-help');
  await page.waitForURL(/\/aide$/);
  await expect(page.locator('body')).toHaveClass(/sidebar-collapsed/);

  // The passkeys page has no panel of its own, but the state is persisted, so
  // returning to a page that displays the panel arrives collapsed. The fixed
  // labels bar no longer covers the session box while the panel is open.
  await openPanel();
  await page.click('#sidebar a[href="/auth/passkeys"]');
  await page.waitForURL(/\/auth\/passkeys$/);
  expect(await collapsedKey(page)).toBe('1');
  await page.goto('/domaine/e2e');
  await expect(page.locator('body')).toHaveClass(/sidebar-collapsed/);
  await expect(page.locator('#sidebar')).toHaveCSS('width', '0px');

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.5 A wide screen keeps the panel as it was                         */
/* ------------------------------------------------------------------ */

test('1.5 sur un écran large, les entrées du panneau laissent le panneau ouvert', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, { viewport: { width: 1280, height: 720 } });

  await page.goto('/domaine/e2e');
  await page.click('a.sidebar-home');
  await page.waitForURL(/\/(\?.*)?$/);
  await expect(page.locator('body')).not.toHaveClass(/sidebar-collapsed/);
  await expect(page.locator('#sidebar')).toHaveCSS('width', '240px');
  expect(await collapsedKey(page)).toBe(null);

  await page.goto('/domaine/e2e');
  await page.click('a.sidebar-admin');
  await page.waitForURL(/\/administration$/);
  await expect(page.locator('body')).not.toHaveClass(/sidebar-collapsed/);
  await expect(page.locator('#sidebar')).toHaveCSS('width', '240px');
  expect(await collapsedKey(page)).toBe(null);

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.6 The panel is one screen tall: the bottom block stays at the     */
/*     bottom of the screen, and only the domain list scrolls          */
/* ------------------------------------------------------------------ */

// The panel's geometry, read in one evaluate: what "the bottom block is on
// screen" means is the distance between its bottom edge and the bottom of the
// window, which must not depend on the height of the page.
async function panelGeometry(page) {
  return page.evaluate(() => {
    const sidebar = document.querySelector('#sidebar');
    const nav = document.querySelector('#sidebar-nav');
    const footer = document.querySelector('.sidebar-footer');
    const navRect = nav.getBoundingClientRect();
    const footerRect = footer.getBoundingClientRect();
    return {
      viewportH: window.innerHeight,
      paddingBottom: parseFloat(getComputedStyle(sidebar).paddingBottom),
      navTop: navRect.top,
      navBottom: navRect.bottom,
      footerTop: footerRect.top,
      footerBottom: footerRect.bottom,
      navScrollHeight: nav.scrollHeight,
      navClientHeight: nav.clientHeight,
      pageScrollY: window.scrollY,
    };
  });
}

// The block rests on the panel's bottom padding, within a pixel of rounding.
const atScreenBottom = (box) =>
  Math.abs(box.footerBottom - (box.viewportH - box.paddingBottom)) <= 1;

test('1.6 avec une liste courte, le bloc bas repose au bas de l’écran', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, { viewport: { width: 1280, height: 720 } });

  await page.goto('/domaine/e2e');
  const box = await panelGeometry(page);

  // The premise: two domains fit, so the list does not scroll.
  expect(box.navScrollHeight).toBe(box.navClientHeight);
  // The block is on screen, under the list, at the bottom of the window.
  expect(box.footerTop).toBeGreaterThan(0);
  expect(box.navBottom).toBeLessThanOrEqual(box.footerTop);
  expect(atScreenBottom(box)).toBe(true);

  await context.close();
});

test('1.7 avec une liste longue, seule la liste défile et le bloc bas reste à l’écran', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, { viewport: { width: 1280, height: 720 } });

  // Enough domains to overflow the screen, created through the application so
  // the store, the slugs and the sidebar are the real ones.
  for (let i = 1; i <= 24; i++) {
    const response = await page.request.post('/api/domains', { form: { name: `Domaine ${i}` } });
    expect(response.ok()).toBe(true);
  }

  await page.goto('/domaine/e2e');
  const overflowing = await panelGeometry(page);
  // The list, not the page, carries the overflow.
  expect(overflowing.navScrollHeight).toBeGreaterThan(overflowing.navClientHeight);
  expect(overflowing.footerTop).toBeGreaterThan(0);
  expect(overflowing.navBottom).toBeLessThanOrEqual(overflowing.footerTop);
  expect(atScreenBottom(overflowing)).toBe(true);

  // A page taller than the window: the panel stays pinned while the page
  // scrolls under it, so the block does not leave the screen.
  await page.goto('/administration');
  const before = await panelGeometry(page);
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForFunction(() => window.scrollY > 0);
  const after = await panelGeometry(page);

  expect(after.pageScrollY).toBeGreaterThan(0);
  expect(atScreenBottom(after)).toBe(true);
  expect(Math.abs(after.footerBottom - before.footerBottom)).toBeLessThanOrEqual(1);

  // The same holds on a phone-sized window.
  const phone = await signedInPage(browser, {
    viewport: PHONE,
    hasTouch: true,
    isMobile: true,
  });
  await phone.page.goto('/domaine/e2e');
  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.8 The labels bar steps aside while the panel is open              */
/* ------------------------------------------------------------------ */

test("1.8 sur un smartphone, la barre d'étiquettes s'efface derrière le panneau puis revient", async ({ browser }) => {
  const { context, page } = await signedInPage(browser, {
    viewport: PHONE,
    hasTouch: true,
    isMobile: true,
  });

  await page.goto('/domaine/e2e');
  await expect(page.locator('body')).toHaveClass(/has-labels-bar/);
  // The panel is open by default; the fixed bar would cover its session box, so
  // it is not displayed at all.
  await expect(page.locator('#sidebar')).toHaveCSS('width', '240px');
  await expect(page.locator('.labels-bar')).toBeHidden();

  // Collapsing the panel brings the bar back, fixed at the bottom right.
  await page.click('#sidebar-toggle');
  await expect(page.locator('.labels-bar')).toBeVisible();
  await expect(page.locator('.labels-bar')).toHaveCSS('position', 'fixed');

  // Reopening the panel hides it again.
  await page.click('#sidebar-toggle');
  await expect(page.locator('.labels-bar')).toBeHidden();

  // Above the breakpoint, the bar stays visible with the panel open.
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.locator('.labels-bar')).toBeVisible();

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.9 The page appears first, then the panel folds                    */
/* ------------------------------------------------------------------ */

// Installed in every document of the context: records when the page is ready
// and when the panel starts folding, so the test can prove the order.
function recordSidebarTiming() {
  window.__sidebarTiming = {
    readyAt: null,
    collapsedAtReady: null,
    collapseAt: null,
    widthDuring: null,
  };
  document.addEventListener('DOMContentLoaded', () => {
    const timing = window.__sidebarTiming;
    timing.readyAt = performance.now();
    timing.collapsedAtReady = document.body.classList.contains('sidebar-collapsed');
    const observer = new MutationObserver(() => {
      if (timing.collapseAt !== null) return;
      if (!document.body.classList.contains('sidebar-collapsed')) return;
      timing.collapseAt = performance.now();
      observer.disconnect();
      // Part-way into the fold, the width must be intermediate.
      window.setTimeout(() => {
        timing.widthDuring = document.getElementById('sidebar').getBoundingClientRect().width;
      }, 100);
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  });
}

test('1.9 sur un smartphone, la page apparaît d’abord, puis le panneau se replie', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, {
    viewport: PHONE,
    hasTouch: true,
    isMobile: true,
  });
  await context.addInitScript(recordSidebarTiming);

  await page.goto('/domaine/e2e');
  await expect(page.locator('#sidebar')).toHaveCSS('width', '240px');

  await domainLink(page, 'e2e2').click();
  await page.waitForURL(/\/domaine\/e2e2$/);

  // The new page arrives with the panel still open and its content fading in;
  // the fold is asked for afterwards.
  const fade = await page.locator('.content').evaluate((el) => {
    const style = getComputedStyle(el);
    return { name: style.animationName, duration: style.animationDuration };
  });
  expect(fade.name).toBe('page-fade-in');
  expect(parseFloat(fade.duration)).toBeGreaterThan(0);

  await page.waitForFunction(
    () => window.__sidebarTiming && window.__sidebarTiming.widthDuring !== null
  );
  const timing = await page.evaluate(() => window.__sidebarTiming);
  // The panel was open when the page was ready, and the fold only starts once
  // the fade is over.
  expect(timing.collapsedAtReady).toBe(false);
  expect(timing.collapseAt - timing.readyAt).toBeGreaterThanOrEqual(200);
  // It is a movement, not a jump: the width is intermediate during the fold.
  expect(timing.widthDuring).toBeGreaterThan(0);
  expect(timing.widthDuring).toBeLessThan(240);

  await expect(page.locator('body')).toHaveClass(/sidebar-collapsed/);
  await expect(page.locator('#sidebar')).toHaveCSS('width', '0px');
  expect(await collapsedKey(page)).toBe('1');

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 1.10 Reduced motion: no collapse animation, no fade                 */
/* ------------------------------------------------------------------ */

test('1.10 avec mouvement réduit, la page et le repli sont immédiats, sans fondu', async ({ browser }) => {
  const { context, page } = await signedInPage(browser, {
    viewport: PHONE,
    hasTouch: true,
    isMobile: true,
    reducedMotion: 'reduce',
  });

  await page.goto('/domaine/e2e');
  await expect(page.locator('#sidebar')).toHaveCSS('width', '240px');

  // The two animations are neutralised before any click.
  expect(await page.locator('#sidebar').evaluate((el) => getComputedStyle(el).transitionDuration)).toBe('0s');
  expect(await page.locator('.content').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');

  // The panel is folded on the next page, without a movement or a fade.
  await domainLink(page, 'e2e2').click();
  await page.waitForURL(/\/domaine\/e2e2$/);
  await expect(page.locator('body')).toHaveClass(/sidebar-collapsed/);
  expect(await page.locator('.content').evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  expect(await collapsedKey(page)).toBe('1');

  await context.close();
});
