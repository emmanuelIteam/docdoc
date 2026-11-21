'use strict';

// Test de bout en bout du serveur Rust dans le Chrome installé, avec un
// authentificateur WebAuthn virtuel piloté par CDP : enrôlement réel par code,
// création de passkey, puis gestes principaux de l'outline.
//
// Prérequis : le serveur tourne sur BASE_URL avec EMAIL_PROVIDER=dev et
// DOCDOC_DEV_CODE_FILE pointant vers CODE_FILE.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3555';
const CODE_FILE =
  process.env.CODE_FILE || './dev-codes.txt';
const EMAIL = process.env.TEST_EMAIL || 'test@example.fr';
const EDGE =
  process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = Number(process.env.CDP_PORT || 9222);

async function waitForCdp() {
  for (let i = 0; i < 200; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (response.ok) return;
    } catch {
      /* pas encore prêt */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Edge CDP indisponible');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function selectLine(line) {
  await line.scrollIntoViewIfNeeded();
  await line.hover();
  await line.locator('.bullet').click();
}

function readLastCode() {
  const text = fs.readFileSync(CODE_FILE, 'utf8');
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const match = lines[i].match(new RegExp(`^${EMAIL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} (\\d{6})$`));
    if (match) return match[1];
  }
  return null;
}

(async () => {
  const profile = path.resolve('./edge-profile');
  fs.rmSync(profile, { recursive: true, force: true });
  const edge = spawn(
    EDGE,
    [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-sync',
      '--no-sandbox',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );
  edge.on('error', (error) => console.error('EDGE ERROR', error.message));
  edge.on('exit', (code) => console.error('EDGE EXIT', code));
  await waitForCdp();
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
  const context = await browser.newContext({
    baseURL: BASE,
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('response', async (response) => {
    if (response.url().includes('/auth/passkey/')) {
      console.log('HTTP', response.status(), response.url().replace(BASE, ''));
      if (response.status() >= 400) {
        console.log('BODY', (await response.text()).slice(0, 300));
      }
    }
  });
  page.on('dialog', (dialog) => dialog.accept());

  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  console.log('OK authenticator virtuel', authenticatorId.slice(0, 8));

  await page.goto('/auth/signup');
  await page.fill('#email', EMAIL);
  await page.click('form[action="/auth/email"] button[type=submit]');
  await page.waitForSelector('#code', { timeout: 10000 });
  const code = readLastCode();
  assert(code, 'code introuvable');
  await page.fill('#code', code);
  await page.click('form[action="/auth/email/verify"] button[type=submit]');
  await page.waitForSelector('#register-passkey-btn', { timeout: 10000 });
  console.log('OK enrôlement par code');

  await page.click('#register-passkey-btn');
  try {
    await page.waitForURL(`${BASE}/`, { timeout: 20000 });
  } catch (error) {
    console.log('URL au moment de l’échec:', page.url());
    console.log('STATUT:', await page.textContent('#auth-status').catch(() => ''));
    console.log('ERREURS PAGE:', errors);
    await page.screenshot({ path: './register-fail.png', fullPage: true });
    throw error;
  }
  assert((await page.textContent('body')).includes('Domaines'), 'coquille attendue après connexion');
  console.log('OK passkey enregistrée et connexion');

  await page.goto('/administration');
  await page.fill('#admin-domains input[name="name"]', 'Maison');
  await page.click('#admin-domains form.admin-create button[type=submit]');
  await page.waitForURL('**/administration', { timeout: 10000 });
  assert((await page.textContent('#admin-domains-table')).includes('Maison'), 'domaine créé');
  console.log('OK création de domaine');

  await page.click('a.sidebar-link[href="/domaine/maison"]');
  await page.waitForSelector('#outline .line', { timeout: 10000 });
  let titles = await page.locator('#outline .line .title').allTextContents();
  assert(titles.includes('Nouveau projet'), 'projet par défaut attendu');
  console.log('OK projet par défaut');

  await page.locator('#outline .line .title').first().click();
  await page.waitForSelector('.title-input');
  await page.fill('.title-input', 'Rénover la cuisine');
  await page.locator('.title-input').evaluate((element) => element.blur());
  await page.waitForTimeout(600);
  assert((await page.textContent('#outline')).includes('Rénover la cuisine'), 'renommage');
  console.log('OK renommage');

  await page.reload();
  await page.waitForSelector('#outline .line');
  assert((await page.textContent('#outline')).includes('Rénover la cuisine'), 'renommage persistant');
  console.log('OK persistance du renommage');

  const parent = page.locator('#outline .line').first();
  await selectLine(parent);
  await page.waitForSelector('#outline .line.selected-head .menu');
  await parent.locator('.add-child').click();
  await page.waitForSelector('.title-input');
  await page.fill('.title-input', 'Choisir les couleurs');
  await page.locator('.title-input').evaluate((element) => element.blur());
  await page.waitForTimeout(800);
  const outlineText = await page.textContent('#outline');
  assert(outlineText.includes('Choisir les couleurs'), 'sous-tâche créée');
  assert(outlineText.includes('Nouvelle tâche') === false, 'sous-tâche renommée');
  console.log('OK ajout et renommage de sous-tâche');

  const childLine = page.locator('#outline .line', { hasText: 'Choisir les couleurs' }).first();
  await selectLine(childLine);
  await page.waitForSelector('#outline .line.selected-head .menu');
  await childLine.locator('.menu button[title="En cours"]').click();
  await page.waitForTimeout(800);
  const childAfter = page.locator('#outline .line', { hasText: 'Choisir les couleurs' }).first();
  assert((await childAfter.getAttribute('class')).includes('status-in-progress') === false, 'statut sur le titre');
  assert((await childAfter.locator('.title').getAttribute('class')).includes('status-in-progress'), 'statut en cours');
  console.log('OK statut « En cours »');

  await page.reload();
  await page.waitForSelector('#outline .line');
  const childReloaded = page.locator('#outline .line', { hasText: 'Choisir les couleurs' }).first();
  assert((await childReloaded.locator('.title').getAttribute('class')).includes('status-in-progress'), 'statut persistant');
  console.log('OK persistance du statut');

  const parentLine = page.locator('#outline .line').first();
  await parentLine.hover();
  await parentLine.locator('.bullet').dblclick();
  await page.waitForTimeout(800);
  assert((await parentLine.getAttribute('class')).includes('collapsed'), 'repli');
  assert((await page.textContent('#outline')).includes('Choisir les couleurs') === false, 'enfant masqué');
  console.log('OK repli');

  await page.reload();
  await page.waitForSelector('#outline .line');
  assert((await page.locator('#outline .line').first().getAttribute('class')).includes('collapsed'), 'repli persistant');
  console.log('OK persistance du repli');

  await page.goto('/');
  const homeText = await page.textContent('body');
  assert(homeText.includes('Choisir les couleurs'), 'tâche en cours sur l’accueil');
  assert(homeText.includes('Maison'), 'domaine sur l’accueil');
  console.log('OK accueil des tâches en cours');

  await page.goto('/administration');
  await page.fill('#admin-themes input[name="name"]', 'Travaux');
  await page.click('#admin-themes form.admin-create button[type=submit]');
  await page.waitForURL('**/administration', { timeout: 10000 });
  assert((await page.textContent('#admin-themes')).includes('Travaux'), 'thème créé');
  const cell = page.locator('.matrix-toggle').first();
  await cell.click();
  await page.waitForURL('**/administration', { timeout: 10000 });
  assert((await page.textContent('#sidebar-nav')).includes('Travaux'), 'groupe de thème dans la barre');
  console.log('OK thème et étiquette');

  await page.goto('/aide');
  const guide = await page.textContent('body');
  assert(guide.includes('Version développement'), 'version de développement');
  assert(guide.includes('Déplacer une ligne'), 'guide');
  console.log('OK page d’aide');

  const domainId = await page.evaluate(async () => {
    const response = await fetch('/administration');
    const html = await response.text();
    const match = html.match(/action="\/api\/domains\/([^"/]+)\/archive"/);
    return match ? match[1] : null;
  });
  assert(domainId, 'id du domaine');

  await page.goto('/administration');
  await page.locator(`form[action="/api/domains/${domainId}/archive"] button`).click();
  await page.waitForURL('**/administration', { timeout: 10000 });
  await page.goto('/administration');
  const adminText = await page.textContent('body');
  assert(adminText.includes('Domaines archivés (1)'), 'archive visible');
  await page.click('#admin-archives summary');
  await page.click('#admin-archives-table button');
  await page.waitForURL('**/administration', { timeout: 10000 });
  assert((await page.textContent('#admin-domains-table')).includes('Maison'), 'domaine restauré');
  console.log('OK archivage et restauration');

  await page.goto('/domaine/maison');
  await page.waitForSelector('#outline .line');
  await page.screenshot({ path: './domain.png', fullPage: true });
  await page.goto('/');
  await page.waitForTimeout(300);
  await page.screenshot({ path: './home.png', fullPage: true });

  if (errors.length) {
    console.log('ERREURS CONSOLE:', errors.slice(0, 5));
  }
  assert(errors.length === 0, 'erreurs JavaScript: ' + errors.slice(0, 3).join(' | '));

  await browser.close();
  edge.kill();
  console.log('TOUT EST OK');
})().catch(async (error) => {
  console.error('ÉCHEC:', error.message);
  process.exit(1);
});
