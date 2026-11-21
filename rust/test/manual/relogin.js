'use strict';

// Après un redémarrage du serveur (backend S3), se connecte avec la passkey
// enregistrée par `passkey-flow.js` et vérifie que le compte et son outline sont
// rechargés depuis le bucket.

const crypto = require('crypto');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3555';
const STATE = process.env.PASSKEY_STATE || './passkey-state.json';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function b64url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest();
}

let cookie = '';

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

(async () => {
  const state = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  const privateKey = crypto.createPrivateKey({ key: state.jwk, format: 'jwk' });
  const credentialId = Buffer.from(state.credentialId, 'base64url');

  let r = await request('/api/me');
  assert(r.response.status === 401, 'aucune session au départ');

  r = await request('/auth/passkey/login/options', {
    method: 'POST',
    json: { email: state.email },
  });
  assert(r.response.status === 200, 'options de connexion: ' + r.response.status);
  const options = JSON.parse(r.text);

  const clientDataJSON = Buffer.from(
    JSON.stringify({
      type: 'webauthn.get',
      challenge: options.challenge,
      origin: BASE,
      crossOrigin: false,
    })
  );
  const authData = Buffer.concat([
    sha256(Buffer.from(options.rpId)),
    Buffer.from([0x05]),
    (() => {
      const counter = Buffer.alloc(4);
      counter.writeUInt32BE(state.counter, 0);
      return counter;
    })(),
  ]);
  const signature = crypto.sign(
    'sha256',
    Buffer.concat([authData, sha256(clientDataJSON)]),
    privateKey
  );
  const assertion = {
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

  r = await request('/auth/passkey/login/verify', { method: 'POST', json: assertion });
  assert(r.response.status === 200, 'connexion: ' + r.response.status + ' ' + r.text);
  assert(JSON.parse(r.text).ok === true, 'connexion ok');
  console.log('OK reconnexion après redémarrage');

  r = await request('/administration');
  assert(r.response.status === 200, 'administration');
  assert(r.text.includes('Maison'), 'domaine rechargé depuis S3');
  console.log('OK domaine rechargé');

  r = await request('/domaine/maison');
  assert(r.response.status === 200, 'domaine');
  assert(r.text.includes('Rénover la cuisine'), 'titre rechargé');
  assert(r.text.includes('Faire la liste'), 'sous-tâche rechargée');
  assert(r.text.includes('status-in-progress'), 'statut rechargé');
  console.log('OK outline rechargé');

  r = await request('/auth/passkeys');
  assert(r.text.includes('Authentificateur de test'), 'passkey rechargée');
  console.log('OK passkey rechargée');

  console.log('TOUT EST OK');
})().catch((error) => {
  console.error('ÉCHEC:', error.message);
  process.exit(1);
});
