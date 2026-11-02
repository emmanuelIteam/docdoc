'use strict';

// End-to-end checks of the PWA support (openspec change add-pwa-support,
// tasks 7.1 to 7.7).
//
// Same harness as administration.spec.js: the application runs as a child
// process on a port picked at run time, with its own throwaway data directory
// and a log file (the sandbox denies piped stdio, and the development mailer
// writes the one-time codes there). One account is enrolled once in `beforeAll`
// and its storage state is replayed by each test.
//
// The service worker tests need a *controlled* page, which takes one reload
// after the first registration: `navigator.serviceWorker.ready` resolves when
// the worker is active, and `clients.claim()` takes control of the open page,
// but the first document itself was loaded before any worker existed.
//
// Task 7.8 (the update notice with two real CACHE_VERSION values) stays manual:
// it needs two deployments of `sw.js`. The notice rendering itself is exercised
// with a synthetic `controllerchange` below, and the manual procedure is:
//   1. load the app, wait for the worker, reload once;
//   2. bump CACHE_VERSION in public/sw.js and restart the server;
//   3. reload: the new worker activates, the notice appears, and clicking
//      Recharger applies the new cache.

const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { test, expect } = require('@playwright/test');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const EMAIL = 'pwa-e2e@example.test';

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
    SESSION_SECRET: 'pwa-e2e-secret',
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

function signedInBrowser(browser) {
  return browser.newContext({ baseURL: origin, storageState });
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

// Width and height of a PNG, read from the IHDR chunk (bytes 16..23).
function pngDimensions(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(buffer.subarray(0, 8).equals(signature)).toBe(true);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function declaredSize(sizes) {
  const [width, height] = sizes.split('x').map(Number);
  return { width, height };
}

// Load a page, wait for the worker to be active, then reload so the new worker
// controls the document.
async function controlledPage(context, url = '/administration') {
  const page = await context.newPage();
  await page.goto(url);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, {
    timeout: 15000,
  });
  return page;
}

/* ------------------------------------------------------------------ */
/* Fixture                                                             */
/* ------------------------------------------------------------------ */

test.beforeAll(async ({ browser }) => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docdoc-pwa-e2e-'));
  logFile = path.join(dataDir, 'server.log');
  storageState = path.join(dataDir, 'session.json');
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
  await enroll(page, EMAIL);
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
/* 7.1 to 7.3 — manifest, icons and document metadata                  */
/* ------------------------------------------------------------------ */

test('7.1-7.3 manifeste, icônes et balises <head>', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: origin });
  const page = await context.newPage();

  // 7.1 — the manifest itself.
  const manifestResponse = await page.request.get(`${origin}/manifest.webmanifest`);
  expect(manifestResponse.status()).toBe(200);
  expect(manifestResponse.headers()['content-type']).toContain('application/manifest+json');
  const manifestCacheControl = manifestResponse.headers()['cache-control'] || '';
  expect(manifestCacheControl).toContain('no-cache');
  expect(manifestCacheControl).not.toMatch(/max-age=[1-9]/);

  const manifest = await manifestResponse.json();
  expect(manifest.id).toBe('/');
  expect(manifest.start_url).toBe('/');
  expect(manifest.scope).toBe('/');
  expect(manifest.display).toBe('standalone');
  expect(manifest.lang).toBe('fr');
  expect(manifest.theme_color).toBe('#2563eb');
  expect(manifest.background_color).toBe('#fafafa');

  const sizes = manifest.icons.map((icon) => icon.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  expect(manifest.icons.some((icon) => icon.purpose === 'maskable' && icon.sizes === '512x512')).toBe(
    true
  );

  // 7.2 — every declared icon resolves at its declared size.
  for (const icon of manifest.icons) {
    const iconResponse = await page.request.get(origin + icon.src);
    expect(iconResponse.status()).toBe(200);
    expect(iconResponse.headers()['content-type']).toContain('image/png');
    expect(pngDimensions(await iconResponse.body())).toEqual(declaredSize(icon.sizes));
  }

  const apple = await page.request.get(`${origin}/icons/apple-touch-icon-180.png`);
  expect(apple.status()).toBe(200);
  expect(pngDimensions(await apple.body())).toEqual({ width: 180, height: 180 });

  // 7.3 — the access page carries each tag once.
  await page.goto('/');
  const accessHead = await page.evaluate(() => ({
    manifest: document.querySelectorAll('head link[rel="manifest"]').length,
    themeColor: document.querySelectorAll('head meta[name="theme-color"]').length,
    icon: document.querySelectorAll('head link[rel="icon"]').length,
    appleTouch: document.querySelectorAll('head link[rel="apple-touch-icon"]').length,
    mobileCapable: document.querySelectorAll('head meta[name="mobile-web-app-capable"]').length,
    appleCapable: document.querySelectorAll('head meta[name="apple-mobile-web-app-capable"]').length,
    appleTitle: document.querySelectorAll('head meta[name="apple-mobile-web-app-title"]').length,
  }));
  expect(accessHead).toEqual({
    manifest: 1,
    themeColor: 1,
    icon: 1,
    appleTouch: 1,
    mobileCapable: 1,
    appleCapable: 1,
    appleTitle: 1,
  });

  // 7.3 — and the authenticated shell does too (and stays installable).
  const signedIn = await signedInBrowser(browser);
  const adminPage = await signedIn.newPage();
  await adminPage.goto('/administration');
  const adminHead = await adminPage.evaluate(() => ({
    manifest: document.querySelectorAll('head link[rel="manifest"]').length,
    themeColor: document.querySelectorAll('head meta[name="theme-color"]').length,
    icon: document.querySelectorAll('head link[rel="icon"]').length,
    appleTouch: document.querySelectorAll('head link[rel="apple-touch-icon"]').length,
    appleCapable: document.querySelectorAll('head meta[name="apple-mobile-web-app-capable"]').length,
    appleTitle: document.querySelectorAll('head meta[name="apple-mobile-web-app-title"]').length,
    installHidden: document.getElementById('install-btn').hidden,
  }));
  expect(adminHead).toEqual({
    manifest: 1,
    themeColor: 1,
    icon: 1,
    appleTouch: 1,
    appleCapable: 1,
    appleTitle: 1,
    installHidden: true,
  });

  await signedIn.close();
  await context.close();
});

/* ------------------------------------------------------------------ */
/* 7.4 — the worker is served and registered at the root scope         */
/* ------------------------------------------------------------------ */

test('7.4 service worker servi et enregistré à la racine', async ({ browser }) => {
  const context = await signedInBrowser(browser);
  const page = await controlledPage(context);

  const registration = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return {
      scope: reg.scope,
      active: Boolean(reg.active),
      script: navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL : '',
    };
  });
  expect(new URL(registration.scope).pathname).toBe('/');
  expect(registration.active).toBe(true);
  expect(registration.script).toContain('/sw.js');

  const workerResponse = await page.request.get(`${origin}/sw.js`);
  expect(workerResponse.status()).toBe(200);
  expect(workerResponse.headers()['content-type']).toContain('javascript');
  expect(workerResponse.headers()['cache-control']).toContain('no-cache');

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 7.5 — only public static assets enter Cache Storage                 */
/* ------------------------------------------------------------------ */

test('7.5 Cache Storage limité aux actifs publics', async ({ browser }) => {
  const context = await signedInBrowser(browser);
  const page = await controlledPage(context);

  // A domain whose name must never appear in the cache: visiting its page
  // generates a personal HTML response that the worker must not store.
  const domainForm = page.locator('#admin-domains .admin-create');
  await domainForm.locator('input[name="name"]').fill('ProjetSecretE2E');
  await domainForm.locator('button[type="submit"]').click();
  await expect(page.locator('#admin-domains-table tbody tr')).toHaveCount(1);
  const domainHref = await page
    .locator('#admin-domains-table tbody tr a.admin-url')
    .first()
    .getAttribute('href');
  await page.goto(domainHref);

  const inspection = await page.evaluate(async () => {
    const names = await caches.keys();
    const entries = [];
    for (const name of names) {
      const cache = await caches.open(name);
      for (const request of await cache.keys()) {
        const response = await cache.match(request);
        entries.push({
          name,
          pathname: new URL(request.url).pathname,
          body: await response.text(),
        });
      }
    }
    const adminCached = Boolean(await caches.match('/administration'));
    const controller = navigator.serviceWorker.controller
      ? navigator.serviceWorker.controller.scriptURL
      : '';
    return { names, entries, adminCached, controller };
  });

  const allowed = new Set([
    '/style.css',
    '/pwa.js',
    '/app.js',
    '/auth.js',
    '/simplewebauthn.js',
    '/htmx.min.js',
    '/manifest.webmanifest',
    '/offline.html',
  ]);

  expect(inspection.names.length).toBeGreaterThan(0);
  expect(inspection.names.every((name) => name.startsWith('docdoc-static-'))).toBe(true);
  expect(inspection.entries.length).toBeGreaterThan(0);
  for (const entry of inspection.entries) {
    expect(
      allowed.has(entry.pathname) || entry.pathname.startsWith('/icons/'),
      { message: `cache inattendu : ${entry.pathname}` }
    ).toBe(true);
    expect(entry.body).not.toContain(EMAIL);
    expect(entry.body).not.toContain('ProjetSecretE2E');
  }
  expect(inspection.adminCached).toBe(false);

  // The version in the cache name comes from sw.js, which is what a deployment
  // must bump when a precached asset changes.
  const workerSource = await (await page.request.get(`${origin}/sw.js`)).text();
  const version = /CACHE_VERSION\s*=\s*'([^']+)'/.exec(workerSource);
  expect(version).not.toBeNull();
  expect(inspection.names.some((name) => name === `docdoc-static-${version[1]}`)).toBe(true);

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 7.6 — a failed navigation shows the offline page                    */
/* ------------------------------------------------------------------ */

test('7.6 navigation hors ligne servie par /offline.html', async ({ browser }) => {
  const context = await signedInBrowser(browser);
  const page = await controlledPage(context);

  await context.setOffline(true);
  try {
    // The worker answers the failed navigation with the cached offline page.
    await page.goto('/administration');
    await expect(page.locator('body')).toContainText('Vous êtes hors ligne');
    await expect(page.locator('body')).toContainText('Réessayer');
  } finally {
    await context.setOffline(false);
  }

  // A fragment request is not a navigation: it must fail rather than be
  // answered with the offline document.
  await context.setOffline(true);
  try {
    const fragment = await page.evaluate(async () => {
      try {
        const response = await fetch('/administration', { headers: { 'HX-Request': 'true' } });
        return { ok: true, text: await response.text() };
      } catch {
        return { ok: false, text: '' };
      }
    });
    expect(fragment.ok).toBe(false);
  } finally {
    await context.setOffline(false);
  }

  await context.close();
});

/* ------------------------------------------------------------------ */
/* 7.7 — the install control follows the browser events                */
/* ------------------------------------------------------------------ */

test('7.7 bouton d’installation : invite native, refus et installation', async ({ browser }) => {
  const context = await signedInBrowser(browser);
  const page = await context.newPage();
  await page.goto('/administration');

  const button = page.locator('#install-btn');
  await expect(button).toBeHidden();

  // Dismissed prompt: the button stays available for a later attempt.
  await page.evaluate(() => {
    window.__promptCalls = 0;
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = () => {
      window.__promptCalls += 1;
    };
    event.userChoice = Promise.resolve({ outcome: 'dismissed', platform: 'web' });
    window.dispatchEvent(event);
  });
  await expect(button).toBeVisible();
  await button.click();
  await expect.poll(() => page.evaluate(() => window.__promptCalls)).toBe(1);
  await expect(button).toBeVisible();

  // Accepted prompt: the control disappears.
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = () => {
      window.__promptCalls += 1;
    };
    event.userChoice = Promise.resolve({ outcome: 'accepted', platform: 'web' });
    window.dispatchEvent(event);
  });
  await button.click();
  await expect(button).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__promptCalls)).toBe(2);

  await context.close();
});

test('7.7 mode autonome : aucun bouton d’installation', async ({ browser }) => {
  const context = await signedInBrowser(browser);
  // iPadOS reports a Mac platform; simulating `navigator.standalone` covers the
  // second detection branch without depending on CDP media emulation.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { get: () => true, configurable: true });
  });
  const page = await context.newPage();
  await page.goto('/administration');
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true });
    event.prompt = () => {};
    event.userChoice = Promise.resolve({ outcome: 'dismissed', platform: 'web' });
    window.dispatchEvent(event);
  });
  await expect(page.locator('#install-btn')).toBeHidden();
  await context.close();
});

/* ------------------------------------------------------------------ */
/* 6.1-6.2 — the update notice, without automatic reload               */
/* ------------------------------------------------------------------ */

test('7.8 bandeau de mise à jour non intrusif', async ({ browser }) => {
  const context = await signedInBrowser(browser);
  const page = await controlledPage(context);

  // A marker a reload would erase: the notice must not reload on its own.
  await page.evaluate(() => {
    window.__pwaMarker = 'kept';
    navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));
  });
  const notice = page.locator('.pwa-update');
  await expect(notice).toBeVisible();
  await expect(notice).toContainText('Nouvelle version disponible');
  await expect(notice.getByRole('button', { name: 'Recharger' })).toBeVisible();
  expect(await page.evaluate(() => window.__pwaMarker)).toBe('kept');

  await context.close();
});
