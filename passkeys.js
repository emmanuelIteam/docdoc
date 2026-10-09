'use strict';

// WebAuthn ceremonies, on top of @simplewebauthn/server.
//
// This module owns the relying-party configuration (RP ID and origin) and the
// four ceremony steps. It deliberately does not touch sessions: the caller
// stores the challenge it gets back and passes it to the verification call, so
// the challenge's lifetime and single use stay visible in one place.

const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

const RP_NAME = 'docdoc';

// How long a ceremony may stay pending before its challenge is refused.
const CEREMONY_TTL_MS = 5 * 60 * 1000;

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

// The RP ID is the host served to the browser (no scheme, no port); the origin
// is the full origin. In production both are frozen configuration, because a
// passkey is bound to them for life: changing the host invalidates every
// passkey, so a missing value is refused rather than guessed.
//
// In development they follow the address actually used, so opening the
// application as `localhost` or as `127.0.0.1` both work. A fixed default of
// `localhost` would make the ceremony fail with an origin mismatch as soon as
// the browser is pointed at any other local address.
function relyingParty(req) {
  const configuredId = String(process.env.RP_ID || '').trim();
  const configuredOrigin = String(process.env.RP_ORIGIN || '').trim();
  if (configuredId && configuredOrigin) {
    return { rpID: configuredId, rpOrigin: configuredOrigin, source: 'configuration' };
  }
  if (isProduction()) {
    throw new Error(
      'RP_ID et RP_ORIGIN sont obligatoires en production (nom d\u2019hôte et origine HTTPS de l\u2019application).'
    );
  }
  if (!req) {
    throw new Error('RP_ID et RP_ORIGIN doivent être configurés hors d\u2019une requête HTTP.');
  }
  const host = req.get('host') || `localhost:${process.env.PORT || 3000}`;
  return {
    rpID: req.hostname || host.split(':')[0],
    rpOrigin: `${req.protocol}://${host}`,
    source: 'requête',
  };
}

// Whether a relying party can be resolved at all: either it is configured, or
// the application runs outside production and derives it per request.
function isConfigured() {
  if (process.env.RP_ID && process.env.RP_ORIGIN) return true;
  return !isProduction();
}

// --- Registration (creating a passkey) --------------------------------

// The user handle is the account's opaque identifier, never the email: it is
// stored by the authenticator and shown back to the user, and an address can
// change. The email is only the human-readable `userName`.
async function registrationOptions(rp, account, email) {
  return generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rp.rpID,
    userName: email,
    userDisplayName: email,
    userID: new TextEncoder().encode(account.userId),
    attestationType: 'none',
    excludeCredentials: (account.passkeys || []).map((p) => ({
      id: p.id,
      transports: p.transports && p.transports.length ? p.transports : undefined,
    })),
    authenticatorSelection: {
      // A discoverable credential is what makes sign-in possible without
      // typing an email address.
      residentKey: 'required',
      userVerification: 'preferred',
    },
    supportedAlgorithmIDs: [-8, -7, -257],
  });
}

// Verify the attestation and normalise the credential for storage. Returns null
// when the response does not verify.
async function verifyRegistration(rp, response, expectedChallenge) {
  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: rp.rpOrigin,
    expectedRPID: rp.rpID,
    requireUserVerification: false,
  });
  if (!result.verified) return null;

  const { credential, credentialDeviceType, credentialBackedUp } = result.registrationInfo;
  return {
    id: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    transports: credential.transports || [],
    deviceType: credentialDeviceType,
    backedUp: credentialBackedUp,
  };
}

// --- Authentication (using a passkey) ---------------------------------

// Without `account`, no `allowCredentials` is sent: the browser then offers the
// discoverable passkeys it holds, which is the sign-in path that needs no email.
async function authenticationOptions(rp, account) {
  const allowCredentials =
    account && account.passkeys && account.passkeys.length
      ? account.passkeys.map((p) => ({
          id: p.id,
          transports: p.transports && p.transports.length ? p.transports : undefined,
        }))
      : undefined;
  return generateAuthenticationOptions({
    rpID: rp.rpID,
    allowCredentials,
    userVerification: 'preferred',
  });
}

// Verify an assertion. Returns { newCounter, counterAnomaly } on success, or
// null when the assertion does not verify.
//
// The library refuses a signature counter that did not increase. That rule is
// right for a device-bound authenticator and wrong for a synchronized passkey,
// which may report a counter of 0 forever or reset it after a restore. In that
// one case the assertion is re-verified with a neutral stored counter: every
// other check — challenge, origin, RP ID and signature — still runs, and the
// anomaly is reported so it can be logged.
async function verifyAuthentication(rp, response, expectedChallenge, passkey) {
  const base = {
    response,
    expectedChallenge,
    expectedOrigin: rp.rpOrigin,
    expectedRPID: rp.rpID,
    requireUserVerification: false,
  };
  const stored = {
    id: passkey.id,
    publicKey: Buffer.from(passkey.publicKey, 'base64url'),
    counter: Number.isInteger(passkey.counter) ? passkey.counter : 0,
    transports: passkey.transports && passkey.transports.length ? passkey.transports : undefined,
  };

  let result;
  let counterAnomaly = false;
  try {
    result = await verifyAuthenticationResponse({ ...base, credential: stored });
  } catch (err) {
    if (!/counter value/i.test(String(err && err.message))) throw err;
    counterAnomaly = true;
    result = await verifyAuthenticationResponse({
      ...base,
      credential: { ...stored, counter: 0 },
    });
  }

  if (!result.verified) return null;
  return { newCounter: result.authenticationInfo.newCounter, counterAnomaly };
}

module.exports = {
  RP_NAME,
  CEREMONY_TTL_MS,
  relyingParty,
  isConfigured,
  registrationOptions,
  verifyRegistration,
  authenticationOptions,
  verifyAuthentication,
};
