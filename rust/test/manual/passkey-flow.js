'use strict';

// Parcours d'intégration complet contre le serveur Rust, avec un
// authentificateur WebAuthn logiciel (P-256 / ES256) : enrôlement, cérémonie
// d'attestation, connexion par assertion, puis CRUD de l'outline, thèmes,
// étiquettes et archives.
//
// Aucun navigateur n'est nécessaire : le script construit les structures
// WebAuthn exactement comme le ferait un authentificateur de plateforme.

const crypto = require('crypto');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3555';
const EMAIL = process.env.TEST_EMAIL || 'test@example.fr';
const CODE_FILE =
  process.env.CODE_FILE || './dev-codes.txt';
const STATE_FILE = process.env.PASSKEY_STATE || './passkey-state.json';

let cookie = '';
let privateKey = null;
let credentialId = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function b64url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest();
}

/* --- Encodage CBOR minimal (map, entiers, octets, texte) ------------- */

function cborHeader(major, value) {
  if (value < 24) return Buffer.from([(major << 5) | value]);
  if (value < 256) return Buffer.from([(major << 5) | 24, value]);
  if (value < 65536) {
    const buffer = Buffer.alloc(3);
    buffer[0] = (major << 5) | 25;
    buffer.writeUInt16BE(value, 1);
    return buffer;
  }
  const buffer = Buffer.alloc(5);
  buffer[0] = (major << 5) | 26;
  buffer.writeUInt32BE(value, 1);
  return buffer;
}

function cborInt(value) {
  return value >= 0 ? cborHeader(0, value) : cborHeader(1, -1 - value);
}

function cborBytes(value) {
  const body = Buffer.from(value);
  return Buffer.concat([cborHeader(2, body.length), body]);
}

function cborText(value) {
  const body = Buffer.from(value, 'utf8');
  return Buffer.concat([cborHeader(3, body.length), body]);
}

function cborMap(entries) {
  const parts = [cborHeader(5, entries.length)];
  for (const [key, value] of entries) {
    parts.push(cborInt(key), value);
  }
  return Buffer.concat(parts);
}

function cborTextMap(entries) {
  const parts = [cborHeader(5, entries.length)];
  for (const [key, value] of entries) {
    parts.push(cborText(key), value);
  }
  return Buffer.concat(parts);
}

/* --- Authentificateur logiciel --------------------------------------- */

function newCredential() {
  const { publicKey, privateKey: secret } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  });
  privateKey = secret;
  const jwk = publicKey.export({ format: 'jwk' });
  const x = Buffer.from(jwk.x, 'base64url');
  const y = Buffer.from(jwk.y, 'base64url');
  credentialId = crypto.randomBytes(32);
  const coseKey = cborMap([
    [1, cborInt(2)], // kty: EC2
    [3, cborInt(-7)], // alg: ES256
    [-1, cborInt(1)], // crv: P-256
    [-2, cborBytes(x)],
    [-3, cborBytes(y)],
  ]);
  return { coseKey, credentialId };
}

function registrationResponse(challenge, rpId, origin) {
  const { coseKey, credentialId } = newCredential();
  const clientDataJSON = Buffer.from(
    JSON.stringify({ type: 'webauthn.create', challenge, origin, crossOrigin: false })
  );
  const authData = Buffer.concat([
    sha256(Buffer.from(rpId)),
    Buffer.from([0x45]), // UP | UV | AT
    Buffer.from([0, 0, 0, 0]),
    Buffer.alloc(16, 0),
    (() => {
      const length = Buffer.alloc(2);
      length.writeUInt16BE(credentialId.length, 0);
      return length;
    })(),
    credentialId,
    coseKey,
  ]);
  const attestationObject = cborTextMap([
    ['fmt', cborText('none')],
    ['attStmt', cborMap([])],
    ['authData', cborBytes(authData)],
  ]);
  return {
    id: b64url(credentialId),
    rawId: b64url(credentialId),
    response: {
      clientDataJSON: b64url(clientDataJSON),
      attestationObject: b64url(attestationObject),
      transports: ['internal'],
    },
    type: 'public-key',
    clientExtensionResults: {},
  };
}

function authenticationResponse(challenge, rpId, origin, counter) {
  const clientDataJSON = Buffer.from(
    JSON.stringify({ type: 'webauthn.get', challenge, origin, crossOrigin: false })
  );
  const authData = Buffer.concat([
    sha256(Buffer.from(rpId)),
    Buffer.from([0x05]), // UP | UV
    (() => {
      const buffer = Buffer.alloc(4);
      buffer.writeUInt32BE(counter, 0);
      return buffer;
    })(),
  ]);
  const signature = crypto.sign('sha256', Buffer.concat([authData, sha256(clientDataJSON)]), privateKey);
  return {
    id: b64url(credentialId),
    rawId: b64url(credentialId),
    response: {
      clientDataJSON: b64url(clientDataJSON),
      authenticatorData: b64url(authData),
      signature: b64url(signature),
      userHandle: null,
    },
    type: 'public-key',
    clientExtensionResults: {},
  };
}

/* --- HTTP ------------------------------------------------------------ */

function absorb(response) {
  const set = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
  for (const line of set) {
    const pair = line.split(';')[0];
    if (pair.startsWith('docdoc.sid=')) cookie = pair;
  }
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookie) headers.cookie = cookie;
  if (options.json !== undefined) {
    headers['content-type'] = 'application/json';
    options.body = JSON.stringify(options.json);
    delete options.json;
  }
  const response = await fetch(BASE + path, { ...options, headers, redirect: 'manual' });
  absorb(response);
  const text = await response.text();
  return { response, text };
}

function form(values) {
  return new URLSearchParams(values).toString();
}

function readCode() {
  const lines = fs.readFileSync(CODE_FILE, 'utf8').trim().split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const match = lines[i].match(new RegExp(`^${EMAIL} (\\d{6})$`));
    if (match) return match[1];
  }
  return null;
}

async function waitCode() {
  for (let i = 0; i < 50; i += 1) {
    const code = readCode();
    if (code) return code;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('code introuvable');
}

/* --- Parcours -------------------------------------------------------- */

(async () => {
  let r = await request('/');
  assert(r.response.status === 200, 'accueil public');
  assert(r.text.includes('Créer un compte'), 'accueil public: bouton');

  r = await request('/auth/email', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ email: EMAIL }),
  });
  assert(r.response.status === 200, 'demande de code: ' + r.response.status);
  assert(cookie.startsWith('docdoc.sid='), 'cookie');
  const code = await waitCode();
  console.log('OK code email', code);

  r = await request('/auth/email/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ code }),
  });
  assert(r.response.status === 200, 'validation du code: ' + r.response.status);
  assert(r.text.includes('Enregistrer une passkey'), 'écran passkey');
  console.log('OK code validé');

  r = await request('/auth/passkey/register/options', {
    method: 'POST',
    json: {},
  });
  assert(r.response.status === 200, 'options enregistrement: ' + r.response.status);
  const registrationOptions = JSON.parse(r.text);
  assert(registrationOptions.rp.id === '127.0.0.1', 'RP ID: ' + registrationOptions.rp.id);
  assert(registrationOptions.user.name === EMAIL, 'userName');
  assert(registrationOptions.authenticatorSelection.residentKey === 'required', 'residentKey');
  console.log('OK options WebAuthn', registrationOptions.challenge.slice(0, 8) + '…');

  const attestation = registrationResponse(
    registrationOptions.challenge,
    registrationOptions.rp.id,
    BASE
  );
  r = await request('/auth/passkey/register/verify', {
    method: 'POST',
    json: { ...attestation, deviceLabel: 'Authentificateur de test' },
  });
  assert(r.response.status === 200, 'vérification attestation: ' + r.response.status + ' ' + r.text);
  const registered = JSON.parse(r.text);
  assert(registered.ok === true && registered.redirect === '/', 'inscription');
  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify({
      jwk: privateKey.export({ format: 'jwk' }),
      credentialId: b64url(credentialId),
      counter: 1,
      email: EMAIL,
    })
  );
  console.log('OK passkey enregistrée');

  r = await request('/');
  assert(r.response.status === 200, 'accueil authentifié');
  assert(r.text.includes('Aucun domaine'), 'accueil vide');
  assert(r.text.includes(EMAIL), 'email dans la barre');
  console.log('OK session authentifiée');

  r = await request('/domaine/maison');
  assert(r.response.status === 404, 'domaine absent');

  r = await request('/api/domains', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ name: 'Maison', returnTo: '/administration' }),
  });
  assert(r.response.status === 302, 'création domaine: ' + r.response.status);
  assert(r.response.headers.get('location') === '/administration', 'redirection administration');
  console.log('OK domaine créé');

  r = await request('/administration');
  assert(r.response.status === 200, 'administration');
  const domainId = (r.text.match(/\/api\/domains\/([^"/]+)\/archive/) || [])[1];
  assert(domainId, 'id du domaine');
  const projectId = (r.text.match(/action="\/api\/domains\/([^"/]+)\/rename"/) || [])[1];

  r = await request('/domaine/maison');
  assert(r.response.status === 200, 'page domaine');
  assert(r.text.includes('Nouveau projet'), 'projet par défaut');
  assert(r.text.includes('id="outline"'), 'outline');
  const nodeId = (r.text.match(/id="node-([^"]+)"/) || [])[1];
  assert(nodeId, 'id du projet');
  console.log('OK projet par défaut', nodeId.slice(0, 8) + '…');

  r = await request(`/domaine/maison/api/nodes/${nodeId}`, {
    method: 'PUT',
    json: { title: 'Rénover la cuisine' },
  });
  assert(r.response.status === 200, 'renommage: ' + r.response.status);
  assert(JSON.parse(r.text).ok === true, 'renommage ok');

  r = await request(`/domaine/maison/api/nodes/${nodeId}/next`, { method: 'POST' });
  assert(r.response.status === 200, 'création ligne suivante: ' + r.response.status);
  const secondId = r.response.headers.get('x-new-node-id');
  assert(secondId, 'X-New-Node-Id');
  r = await request(`/domaine/maison/api/nodes/${secondId}`, {
    method: 'PUT',
    json: { title: 'Choisir les couleurs' },
  });
  assert(r.response.status === 200, 'renommage 2');

  r = await request('/domaine/maison/api/nodes', {
    method: 'POST',
    json: { parentId: nodeId },
  });
  assert(r.response.status === 200, 'création sous-tâche: ' + r.response.status);
  const childId = r.response.headers.get('x-new-node-id');
  assert(childId, 'id sous-tâche');
  assert(r.text.includes(`parent="${nodeId}"`), 'sous-tâche imbriquée');
  r = await request(`/domaine/maison/api/nodes/${childId}`, {
    method: 'PUT',
    json: { title: 'Faire la liste' },
  });
  assert(r.response.status === 200, 'renommage sous-tâche');
  console.log('OK création et renommage');

  r = await request(`/domaine/maison/api/nodes/${childId}/status`, {
    method: 'POST',
    json: { status: 'in_progress', scope: 'head' },
  });
  assert(r.response.status === 200, 'statut: ' + r.response.status);
  assert(r.text.includes('status-in-progress'), 'classe de statut');
  console.log('OK statut en cours');

  r = await request('/');
  assert(r.text.includes('Faire la liste'), 'tâche en cours à l’accueil');
  assert(r.text.includes('Rénover la cuisine'), 'chaîne de parents');
  console.log('OK accueil des tâches en cours');

  r = await request(`/domaine/maison/api/nodes/${nodeId}/toggle`, { method: 'POST' });
  assert(r.response.status === 200, 'repli: ' + r.response.status);
  assert(r.text.includes('class="line collapsed"'), 'ligne repliée');
  r = await request('/domaine/maison?reveal=' + childId);
  assert(r.text.includes('id="node-' + childId + '"'), 'révélation de la sous-tâche');
  console.log('OK repli et révélation');

  r = await request(`/domaine/maison/api/nodes/${nodeId}`);
  assert(r.response.status === 200, 'lecture nœud');
  assert(JSON.parse(r.text).title === 'Rénover la cuisine', 'titre du nœud');

  r = await request(`/domaine/maison/api/nodes/${childId}/indent`, { method: 'POST' });
  assert(r.response.status === 200, 'indentation');
  r = await request(`/domaine/maison/api/nodes/${childId}/outdent`, { method: 'POST' });
  assert(r.response.status === 200, 'désindentation');

  r = await request(`/domaine/maison/api/nodes/${childId}/move`, {
    method: 'POST',
    json: { targetId: secondId, position: 'before' },
  });
  assert(r.response.status === 200, 'déplacement: ' + r.response.status);
  const movedIndex = r.text.indexOf('id="node-' + childId + '"');
  const targetIndex = r.text.indexOf('id="node-' + secondId + '"');
  assert(movedIndex !== -1 && movedIndex < targetIndex, 'position avant la cible');
  console.log('OK indentation et déplacement');

  const badMove = await request(`/domaine/maison/api/nodes/${nodeId}/move`, {
    method: 'POST',
    json: { targetId: nodeId, position: 'inside' },
  });
  assert(badMove.response.status === 400, 'déplacement cyclique refusé: ' + badMove.response.status);

  r = await request('/api/themes', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ name: 'Travaux', color: '#14b8a6', returnTo: '/administration' }),
  });
  assert(r.response.status === 302, 'création thème');
  r = await request('/administration');
  const themeId = (r.text.match(/\/api\/themes\/([^"/]+)\/rename/) || [])[1];
  assert(themeId, 'id du thème');

  r = await request(`/api/themes/${themeId}/labels`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ domainId, action: 'attach', returnTo: '/administration' }),
  });
  assert(r.response.status === 302, 'attachement étiquette');
  r = await request('/domaine/maison');
  assert(r.text.includes('Travaux'), 'étiquette sur le domaine');
  assert(r.text.includes('labels-bar'), 'barre d’étiquettes');
  console.log('OK thème et étiquette');

  r = await request(`/domaine/maison/api/nodes/${childId}/move`, {
    method: 'POST',
    json: { targetId: null, position: 'inside' },
  });
  assert(r.response.status === 200, 'déplacement racine');

  r = await request(`/api/domains/${domainId}/archive`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ returnTo: '/administration' }),
  });
  assert(r.response.status === 302, 'archivage: ' + r.response.status);
  r = await request('/administration');
  assert(r.text.includes('Domaines archivés (1)'), 'archive listée');
  r = await request(`/api/archives/${domainId}/restore`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ returnTo: '/administration' }),
  });
  assert(r.response.status === 302, 'restauration');
  r = await request('/administration');
  assert(r.text.includes('Maison'), 'domaine restauré');
  console.log('OK archivage et restauration');

  r = await request('/logout', { method: 'POST' });
  assert(r.response.status === 302, 'déconnexion');
  r = await request('/api/me');
  assert(r.response.status === 401, 'session fermée');

  r = await request('/auth/passkey/login/options', { method: 'POST', json: {} });
  assert(r.response.status === 200, 'options connexion');
  const loginOptions = JSON.parse(r.text);
  const assertion = authenticationResponse(loginOptions.challenge, loginOptions.rpId, BASE, 1);
  r = await request('/auth/passkey/login/verify', { method: 'POST', json: assertion });
  assert(r.response.status === 200, 'connexion: ' + r.response.status + ' ' + r.text);
  assert(JSON.parse(r.text).ok === true, 'connexion ok');
  r = await request('/api/me');
  assert(r.response.status === 200, 'api/me reconnecté');
  assert(JSON.parse(r.text).email === EMAIL, 'email reconnecté');
  console.log('OK reconnexion par passkey');

  r = await request('/domaine/maison');
  assert(r.response.status === 200, 'domaine après reconnexion');
  assert(r.text.includes('Rénover la cuisine'), 'données persistées');

  r = await request('/auth/passkeys');
  assert(r.response.status === 200, 'gestion des passkeys');
  assert(r.text.includes('Authentificateur de test'), 'libellé de passkey');

  console.log('TOUT EST OK');
})().catch((error) => {
  console.error('ÉCHEC:', error.message);
  process.exit(1);
});
