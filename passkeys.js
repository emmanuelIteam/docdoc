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
// is the full HTTPS origin. Both are frozen configuration because a passkey is
// bound to them for life: changing the host invalidates every passkey.
function config() {
  const port = process.env.PORT || 3000;
  return {
    rpID: process.env.RP_ID || (isProduction() ? '' : 'localhost'),
    rpOrigin: process.env.RP_ORIGIN || (isProduction() ? '' : `http://localhost:${port}`),
  };
}

// A misconfigured relying party in production would issue passkeys bound to the
// wrong host, which is unrecoverable — refuse rather than guess.
function assertConfigured() {
  const { rpID, rpOrigin } = config();
  if (!rpID || !rpOrigin) {
    throw new Error(
      'RP_ID et RP_ORIGIN sont obligatoires en production (nom d\u2019hôte et origine HTTPS de l\u2019application).'
    );
  }
  return { rpID, rpOrigin };
}

function isConfigured() {
  const { rpID, rpOrigin } = config();
  return Boolean(rpID && rpOrigin);
}

// --- Registration (creating a passkey) --------------------------------

// The user handle is the account's opaque identifier, never the email: it is
// stored by the authenticator and shown back to the user, and an address can
// change. The email is only the human-readable `userName`.
async function registrationOptions(account, email) {
  const { rpID } = assertConfigured();
  return generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
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
async function verifyRegistration(response, expectedChallenge) {
  const { rpID, rpOrigin } = assertConfigured();
  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: rpOrigin,
    expectedRPID: rpID,
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
async function authenticationOptions(account) {
  const { rpID } = assertConfigured();
  const allowCredentials =
    account && account.passkeys && account.passkeys.length
      ? account.passkeys.map((p) => ({
          id: p.id,
          transports: p.transports && p.transports.length ? p.transports : undefined,
        }))
      : undefined;
  return generateAuthenticationOptions({
    rpID,
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
async function verifyAuthentication(response, expectedChallenge, passkey) {
  const { rpID, rpOrigin } = assertConfigured();
  const base = {
    response,
    expectedChallenge,
    expectedOrigin: rpOrigin,
    expectedRPID: rpID,
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
  config,
  isConfigured,
  assertConfigured,
  registrationOptions,
  verifyRegistration,
  authenticationOptions,
  verifyAuthentication,
};
