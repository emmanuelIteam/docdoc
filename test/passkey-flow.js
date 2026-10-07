'use strict';

// End-to-end check of the access flow, driven over HTTP against a real server
// instance, with a software authenticator standing in for the browser.
//
// WebAuthn cannot be exercised with curl, so the attestation and the assertion
// are built here: a real P-256 key pair signs the challenge, and the CBOR
// structures are the ones a browser would return. That makes the ceremony
// wiring — challenge round-trip, single use, origin and RP ID checks, credential
// storage, account creation — testable without a browser.
//
// Run with: node test/passkey-flow.js

const crypto = require('crypto');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// The relying party is derived from the environment at require time, so it is
// configured before the server module is loaded.
const PORT = 3456;
const ORIGIN = `http://localhost:${PORT}`;
const RP_ID = 'localhost';
const AUTHORIZED = 'emmanuel.grandiere@laposte.net';

// A fixture standing in for the pre-account data, so the adoption path is
// exercised against a known input instead of whatever the repo happens to hold.
const FIXTURE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'docdoc-data-'));
fs.writeFileSync(
  path.join(FIXTURE_DIR, 'aaaa1111-2222-3333-4444-555566667777.json'),
  JSON.stringify({
    id: 'aaaa1111-2222-3333-4444-555566667777',
    name: 'Voyages',
    slug: 'voyages',
    order: 0,
    labels: ['theme-voyages'],
    projects: [
      { id: 'n1', title: 'Réserver le camping', status: 'todo', collapsed: false, children: [] },
    ],
    displayOrder: ['n1'],
  })
);
fs.writeFileSync(
  path.join(FIXTURE_DIR, 'themes.json'),
  JSON.stringify([{ id: 'theme-voyages', name: 'Voyages', color: '#14b8a6' }])
);

process.env.PORT = String(PORT);
process.env.RP_ID = RP_ID;
process.env.RP_ORIGIN = ORIGIN;
process.env.NODE_ENV = 'development';
process.env.AUTHORIZED_EMAILS = AUTHORIZED;
process.env.EMAIL_PROVIDER = 'dev';
process.env.DOCDOC_DATA_DIR = FIXTURE_DIR;
for (const key of ['S3_ENDPOINT', 'S3_BUCKET', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']) {
  delete process.env[key];
}

// The one-time code is only ever visible in the server log (development mailer),
// so the log is where the test picks it up.
let lastCode = null;
const realLog = console.log;
console.log = (...args) => {
  const line = args.map(String).join(' ');
  const found = /code pour \S+ : (\d{6})/.exec(line);
  if (found) lastCode = found[1];
  realLog(...args);
};

const { start } = require('../server');
const storage = require('../storage');
const accounts = require('../accounts');

/* ------------------------------------------------------------------ */
/* Minimal CBOR encoder, enough for an attestation object              */
/* ------------------------------------------------------------------ */

function head(major, value) {
  if (value < 24) return Buffer.from([(major << 5) | value]);
  if (value < 256) return Buffer.from([(major << 5) | 24, value]);
  if (value < 65536) {
    const b = Buffer.alloc(3);
    b[0] = (major << 5) | 25;
    b.writeUInt16BE(value, 1);
    return b;
  }
  const b = Buffer.alloc(5);
  b[0] = (major << 5) | 26;
  b.writeUInt32BE(value, 1);
  return b;
}
const text = (s) => {
  const body = Buffer.from(s, 'utf8');
  return Buffer.concat([head(3, body.length), body]);
};
const bytes = (b) => Buffer.concat([head(2, b.length), b]);
const int = (n) => (n >= 0 ? head(0, n) : head(1, -1 - n));
const map = (pairs) => Buffer.concat([head(5, pairs.length), ...pairs.flat()]);

/* ------------------------------------------------------------------ */
/* Software authenticator                                              */
/* ------------------------------------------------------------------ */

const AAGUID = Buffer.alloc(16);

function coseEs256(publicKey) {
  const jwk = publicKey.export({ format: 'jwk' });
  return map([
    [int(1), int(2)], // kty: EC2
    [int(3), int(-7)], // alg: ES256
    [int(-1), int(1)], // crv: P-256
    [int(-2), bytes(Buffer.from(jwk.x, 'base64url'))],
    [int(-3), bytes(Buffer.from(jwk.y, 'base64url'))],
  ]);
}

function authenticatorData(flags, counter, attested) {
  const rpIdHash = crypto.createHash('sha256').update(RP_ID).digest();
  const parts = [rpIdHash, Buffer.from([flags])];
  const counterBuf = Buffer.alloc(4);
  counterBuf.writeUInt32BE(counter, 0);
  parts.push(counterBuf);
  if (attested) {
    const length = Buffer.alloc(2);
    length.writeUInt16BE(attested.credentialId.length, 0);
    parts.push(AAGUID, length, attested.credentialId, attested.coseKey);
  }
  return Buffer.concat(parts);
}

function clientData(type, challenge) {
  return Buffer.from(
    JSON.stringify({ type, challenge, origin: ORIGIN, crossOrigin: false }),
    'utf8'
  );
}

function createPasskey() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return {
    privateKey,
    publicKey,
    credentialId: crypto.randomBytes(32),
    counter: 0,
  };
}

function registrationResponse(authenticator, challenge, flags = 0x45) {
  const authData = authenticatorData(
    flags, // user present | user verified | attested credential data (+ backup flags)
    0,
    { credentialId: authenticator.credentialId, coseKey: coseEs256(authenticator.publicKey) }
  );
  const attestationObject = map([
    [text('fmt'), text('none')],
    [text('attStmt'), map([])],
    [text('authData'), bytes(authData)],
  ]);
  const id = authenticator.credentialId.toString('base64url');
  return {
    id,
    rawId: id,
    response: {
      attestationObject: attestationObject.toString('base64url'),
      clientDataJSON: clientData('webauthn.create', challenge).toString('base64url'),
      transports: ['internal'],
    },
    type: 'public-key',
    clientExtensionResults: {},
    authenticatorAttachment: 'platform',
  };
}

function assertionResponse(authenticator, challenge, counter, userHandle) {
  const authData = authenticatorData(0x05, counter, null); // user present | user verified
  const data = clientData('webauthn.get', challenge);
  const signature = crypto.sign(
    'sha256',
    Buffer.concat([authData, crypto.createHash('sha256').update(data).digest()]),
    authenticator.privateKey
  );
  const id = authenticator.credentialId.toString('base64url');
  return {
    id,
    rawId: id,
    response: {
      clientDataJSON: data.toString('base64url'),
      authenticatorData: authData.toString('base64url'),
      signature: signature.toString('base64url'),
      userHandle: userHandle || null,
    },
    type: 'public-key',
    clientExtensionResults: {},
  };
}

/* ------------------------------------------------------------------ */
/* HTTP client with a cookie jar                                       */
/* ------------------------------------------------------------------ */

let cookie = '';
const base = `http://127.0.0.1:${PORT}`;

async function call(method, path, { json, form, headers = {} } = {}) {
  const requestHeaders = { ...headers };
  if (cookie) requestHeaders.cookie = cookie;
  let body;
  if (form) {
    requestHeaders['content-type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(form).toString();
  } else if (json !== undefined) {
    requestHeaders['content-type'] = 'application/json';
    body = JSON.stringify(json);
  }
  const response = await fetch(base + path, {
    method,
    headers: requestHeaders,
    body,
    redirect: 'manual',
  });
  for (const raw of response.headers.getSetCookie()) {
    const pair = raw.split(';')[0];
    if (pair.startsWith('docdoc.sid=')) cookie = pair;
  }
  const text = await response.text();
  let asJson = null;
  try {
    asJson = JSON.parse(text);
  } catch {
    asJson = null;
  }
  return {
    status: response.status,
    text,
    json: asJson,
    location: response.headers.get('location'),
    hxRedirect: response.headers.get('hx-redirect'),
  };
}

const pass = [];
function ok(label) {
  pass.push(label);
  realLog(`  \u2713 ${label}`);
}

/* ------------------------------------------------------------------ */
/* The journey                                                         */
/* ------------------------------------------------------------------ */

async function main() {
  const server = await start();
  realLog(`\nServeur de test sur ${base}\n`);

  // 1. An unknown visitor is told there is no space and offered both doors.
  let res = await call('GET', '/');
  assert.strictEqual(res.status, 200);
  assert.match(res.text, /Aucun espace docdoc/);
  assert.match(res.text, /Créer un compte/);
  assert.match(res.text, /id="signin-btn"/);
  ok('page d\u2019accueil : « aucun espace » + les deux portes');

  // 2. An address outside the allowlist is refused, and nothing is sent.
  lastCode = null;
  res = await call('POST', '/auth/email', { form: { email: 'intrus@example.com' } });
  assert.strictEqual(res.status, 403);
  assert.match(res.text, /pas habilit/);
  assert.strictEqual(lastCode, null, 'aucun code ne doit être émis pour une adresse non habilitée');
  ok('adresse non habilitée : refus sans envoi de code');

  // 3. A malformed address is rejected before anything else.
  res = await call('POST', '/auth/email', { form: { email: 'pas-une-adresse' } });
  assert.strictEqual(res.status, 400);
  ok('adresse malformée : refus');

  // 4. The authorized address receives a code.
  lastCode = null;
  res = await call('POST', '/auth/email', { form: { email: AUTHORIZED.toUpperCase() } });
  assert.strictEqual(res.status, 200, res.text.slice(0, 200));
  assert.match(res.text, /Saisir le code/);
  assert.ok(lastCode, 'un code doit avoir été émis');
  ok('adresse habilitée (casse différente) : code émis');

  // 5. A resend during the cooldown is refused.
  res = await call('POST', '/auth/email/resend', { form: {} });
  assert.strictEqual(res.status, 429);
  ok('renvoi immédiat : refusé (délai de garde)');

  // 6. A wrong code is refused and the visitor stays on the code form.
  res = await call('POST', '/auth/email/verify', { form: { code: '000000' } });
  assert.strictEqual(res.status, 400);
  assert.match(res.text, /incorrect/);
  ok('code incorrect : refusé');

  // 7. The right code opens a registration session.
  res = await call('POST', '/auth/email/verify', { form: { code: lastCode } });
  assert.strictEqual(res.status, 200);
  assert.match(res.text, /Enregistrer une passkey/);
  ok('code correct : session d\u2019enrôlement ouverte');

  // 8. That session must not reach any account data.
  res = await call('GET', '/api/me');
  assert.strictEqual(res.status, 401, 'une session d\u2019enrôlement ne doit pas être authentifiée');
  res = await call('GET', '/domaine/quelque-chose');
  assert.strictEqual(res.status, 302);
  assert.strictEqual(res.location, '/');
  ok('session d\u2019enrôlement : aucun accès aux données');

  // 9. Registration options come from the server, with an opaque user handle.
  res = await call('POST', '/auth/passkey/register/options', { json: {} });
  assert.strictEqual(res.status, 200, res.text.slice(0, 200));
  const registrationOptions = res.json;
  assert.ok(registrationOptions.challenge);
  assert.strictEqual(registrationOptions.rp.id, RP_ID);
  assert.strictEqual(registrationOptions.authenticatorSelection.residentKey, 'required');
  assert.strictEqual(registrationOptions.attestation, 'none');
  const handle = Buffer.from(registrationOptions.user.id, 'base64url').toString('utf8');
  assert.ok(!handle.includes('@'), 'le user handle ne doit pas être l\u2019adresse email');
  ok('options d\u2019enregistrement : challenge, RP ID, user handle opaque');

  // 10. A bogus attestation is refused, and no account is created.
  res = await call('POST', '/auth/passkey/register/verify', {
    json: { id: 'nope', rawId: 'nope', type: 'public-key', response: {}, clientExtensionResults: {} },
  });
  assert.strictEqual(res.status, 400);
  ok('attestation invalide : refusée');

  // 11. Register for real: the challenge is consumed by the first attempt, so a
  // fresh ceremony is needed after the failed one above.
  res = await call('POST', '/auth/passkey/register/options', { json: {} });
  const authenticator = createPasskey();
  // 0x5D = attested credential data | backup eligible | backed up | user
  // verified | user present: a synchronized passkey, which must be accepted.
  const attestation = registrationResponse(authenticator, res.json.challenge, 0x5d);
  res = await call('POST', '/auth/passkey/register/verify', { json: attestation });
  assert.strictEqual(res.status, 200, res.text.slice(0, 300));
  assert.strictEqual(res.json.ok, true);
  ok('enregistrement de la passkey : compte et espace créés');

  // 12. The session is now fully authenticated, and the pre-account data has
  // been adopted into the new space — with no example outline invented.
  res = await call('GET', '/api/me');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.json.email, AUTHORIZED);
  res = await call('GET', '/');
  assert.strictEqual(res.status, 302, 'le domaine adopté doit être servi');
  assert.strictEqual(res.location, '/domaine/voyages');
  res = await call('GET', '/domaine/voyages');
  assert.strictEqual(res.status, 200);
  assert.match(res.text, /Réserver le camping/);
  assert.doesNotMatch(res.text, /domaine\/projets/, 'aucun domaine d\u2019exemple ne doit être créé');
  ok('adoption des données existantes, sans seed inventé');

  // 13. The space works: a new domain can be created alongside the adopted one.
  res = await call('POST', '/api/domains', { form: { name: 'Maison' } });
  assert.strictEqual(res.status, 302);
  assert.strictEqual(res.location, '/domaine/maison');
  res = await call('GET', '/domaine/maison');
  assert.strictEqual(res.status, 200);
  assert.match(res.text, /Maison/);
  ok('création et affichage d\u2019un domaine dans l\u2019espace du compte');

  // 14. Passkey management lists exactly this account's passkey.
  res = await call('GET', '/auth/passkeys');
  assert.strictEqual(res.status, 200);
  assert.match(res.text, /Mes passkeys/);
  assert.ok(res.text.includes(attestation.id), 'la passkey enregistrée doit être listée');
  assert.match(res.text, /synchronisée/, 'une passkey synchronisée doit être acceptée comme telle');
  ok('gestion des passkeys : la passkey du compte est listée');

  // 15. The last passkey cannot be revoked.
  res = await call('POST', '/auth/passkeys/revoke', {
    form: { credentialId: attestation.id },
  });
  assert.strictEqual(res.status, 302);
  assert.match(decodeURIComponent(res.location), /dernière passkey/);
  ok('révocation de la dernière passkey : refusée');

  // 16. Signing out ends the session.
  res = await call('POST', '/logout', { form: {} });
  assert.strictEqual(res.status, 302);
  res = await call('GET', '/api/me');
  assert.strictEqual(res.status, 401);
  ok('déconnexion : session détruite');

  // 17. An unauthenticated page request is sent home, an API call gets a bare 401.
  res = await call('GET', '/domaine/maison');
  assert.strictEqual(res.status, 302);
  assert.strictEqual(res.location, '/');
  res = await call('GET', '/domaine/maison/api/outline', { headers: { 'HX-Request': 'true' } });
  assert.strictEqual(res.status, 401);
  assert.strictEqual(
    res.hxRedirect,
    '/',
    'une session expirée doit rediriger l\u2019échange htmx au lieu d\u2019injecter la page d\u2019accueil'
  );
  res = await call('GET', '/domaine/maison/api/outline');
  assert.strictEqual(res.status, 401);
  assert.deepStrictEqual(res.json, { authenticated: false });
  ok('visiteur non authentifié : aucune donnée exposée, htmx redirigé');

  // 18. Sign-in with the passkey, without typing an address.
  res = await call('POST', '/auth/passkey/login/options', { json: {} });
  assert.strictEqual(res.status, 200);
  assert.ok(res.json.challenge);
  assert.ok(
    res.json.allowCredentials === undefined || res.json.allowCredentials.length === 0,
    'la connexion découvrable ne doit pas restreindre les credentials'
  );
  const signInChallenge = res.json.challenge;

  // 19. A replayed assertion is refused: the challenge is single use.
  const assertion = assertionResponse(authenticator, signInChallenge, 1, handle);
  res = await call('POST', '/auth/passkey/login/verify', { json: assertion });
  assert.strictEqual(res.status, 200, res.text.slice(0, 300));
  assert.strictEqual(res.json.ok, true);
  res = await call('POST', '/auth/passkey/login/verify', { json: assertion });
  assert.strictEqual(res.status, 400, 'une assertion rejouée doit être refusée');
  ok('connexion par passkey découvrable, assertion rejouée refusée');

  // 20. The signed-in user finds the same space.
  res = await call('GET', '/api/me');
  assert.strictEqual(res.status, 200);
  res = await call('GET', '/domaine/maison');
  assert.strictEqual(res.status, 200);
  assert.match(res.text, /Maison/);
  ok('reconnexion : le même espace est retrouvé');

  // 21. An assertion whose counter did not increase is still accepted: a
  // synchronized passkey may report a counter that stays put.
  res = await call('POST', '/auth/passkey/login/options', { json: {} });
  const stale = assertionResponse(authenticator, res.json.challenge, 1, handle);
  res = await call('POST', '/auth/passkey/login/verify', { json: stale });
  assert.strictEqual(res.status, 200, res.text.slice(0, 300));
  ok('compteur non croissant : assertion acceptée');

  // 22. A passkey can be renamed.
  res = await call('POST', '/auth/passkeys/rename', {
    form: { credentialId: attestation.id, label: 'PC portable' },
  });
  assert.strictEqual(res.status, 302);
  res = await call('GET', '/auth/passkeys');
  assert.match(res.text, /PC portable/);
  ok('gestion des passkeys : renommage');

  // 23. Recovery: the email code path adds a passkey to the *existing* account.
  res = await call('POST', '/logout', { form: {} });
  lastCode = null;
  res = await call('POST', '/auth/email', { form: { email: AUTHORIZED } });
  assert.strictEqual(res.status, 200, res.text.slice(0, 200));
  assert.ok(lastCode, 'un nouveau code doit être émis');
  res = await call('POST', '/auth/email/verify', { form: { code: lastCode } });
  assert.strictEqual(res.status, 200);

  res = await call('POST', '/auth/passkey/register/options', { json: {} });
  assert.strictEqual(res.status, 200);
  const second = createPasskey();
  const secondAttestation = registrationResponse(second, res.json.challenge);
  res = await call('POST', '/auth/passkey/register/verify', { json: secondAttestation });
  assert.strictEqual(res.status, 200, res.text.slice(0, 300));

  res = await call('GET', '/auth/passkeys');
  assert.ok(res.text.includes(secondAttestation.id), 'la nouvelle passkey doit être listée');
  assert.ok(res.text.includes(attestation.id), 'la passkey existante doit être conservée');
  res = await call('GET', '/domaine/maison');
  assert.strictEqual(res.status, 200, 'le compte existant doit être réutilisé, jamais recréé');
  ok('récupération : passkey ajoutée au compte existant, sans second compte');

  // 24. Revoking one of two passkeys is allowed, and takes effect at once.
  res = await call('POST', '/auth/passkeys/revoke', {
    form: { credentialId: secondAttestation.id },
  });
  assert.strictEqual(res.status, 302);
  assert.match(res.location, /ok=1/);

  res = await call('POST', '/auth/passkey/login/options', { json: {} });
  const revokedAttempt = assertionResponse(second, res.json.challenge, 1, handle);
  res = await call('POST', '/auth/passkey/login/verify', { json: revokedAttempt });
  assert.strictEqual(res.status, 401, 'une passkey révoquée ne doit plus pouvoir se connecter');
  ok('révocation : effective immédiatement');

  // 25. Key layout: nothing is left at the bucket root, every object sits under
  // an account prefix, and no address appears in a key.
  const allKeys = await storage.listKeys('');
  assert.ok(allKeys.length > 0, 'des objets doivent avoir été écrits');
  assert.ok(
    allKeys.every((key) => key.startsWith('users/')),
    `toutes les clés doivent être scopées par utilisateur : ${allKeys.filter((k) => !k.startsWith('users/')).join(', ')}`
  );
  assert.ok(allKeys.some((key) => /^users\/by-email\/[0-9a-f]{64}\.json$/.test(key)), 'index email absent');
  assert.ok(allKeys.some((key) => /^users\/by-credential\/[A-Za-z0-9_-]+\.json$/.test(key)), 'index credential absent');
  assert.ok(allKeys.some((key) => /^users\/[^/]+\/domains\/.+\.json$/.test(key)), 'domaine non scopé');
  assert.ok(allKeys.some((key) => /^users\/[^/]+\/themes\.json$/.test(key)), 'palette non scopée');
  assert.ok(allKeys.some((key) => /^users\/[^/]+\/account\.json$/.test(key)), 'compte absent');
  assert.ok(
    allKeys.every((key) => !key.toLowerCase().includes('emmanuel')),
    'aucune adresse email ne doit apparaître dans une clé'
  );
  ok('layout de clés : tout est scopé par compte, aucune adresse en clair');

  // 26. Isolation: a second account's data must never be reachable from this
  // session, and its keys must stay under its own prefix.
  const other = await accounts.ensureAccount('autre@example.com');
  await storage.writeJson(storage.domainKey(other.account.userId, 'secret'), {
    id: 'secret',
    name: 'SecretAutre',
    slug: 'secret-autre',
    order: 0,
    labels: [],
    projects: [{ id: 's1', title: 'Confidentiel', status: 'todo', collapsed: false, children: [] }],
    displayOrder: ['s1'],
  });

  res = await call('GET', '/domaine/secret-autre');
  assert.strictEqual(res.status, 404, 'le domaine d\u2019un autre compte ne doit pas être servi');
  res = await call('GET', '/domaine/maison');
  assert.strictEqual(res.status, 200);
  assert.doesNotMatch(res.text, /SecretAutre/, 'le domaine d\u2019un autre compte ne doit pas être listé');
  res = await call('GET', '/domaine/secret/api/outline');
  assert.strictEqual(res.status, 404);
  ok('isolation : les données d\u2019un autre compte sont inatteignables');

  realLog(`\n${pass.length} vérifications passées.\n`);
  server.close();
}

main().catch((err) => {
  console.error('\nÉCHEC :', err.message);
  if (err.stack) console.error(err.stack.split('\n').slice(1, 4).join('\n'));
  process.exit(1);
});
