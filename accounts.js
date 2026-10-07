'use strict';

// Account records and the two lookup indexes that make sign-in possible.
//
// Layout (see the key builders in storage.js):
//   users/{userId}/account.json               the account itself
//   users/by-email/{sha256(email)}.json        email      -> userId
//   users/by-credential/{credentialId}.json   credential -> userId
//
// The email is hashed into the index key so no address is written into an
// object name. The credential index exists for the discoverable-credential
// sign-in, where the browser returns a credential id and nothing else: without
// it, resolving the account would mean scanning every account.

const crypto = require('crypto');
const storage = require('./storage');

const EMAIL_INDEX_PREFIX = 'users/by-email/';
const CREDENTIAL_INDEX_PREFIX = 'users/by-credential/';

// Accounts go through the same object store as the rest of the data: the bucket
// when one is configured, the process-wide in-memory store otherwise (see
// storage.js).
const read = (key) => storage.readJson(key);
const write = (key, data) => storage.writeJson(key, data);

// Trim and lower-case, so the same address typed with different casing or
// stray spaces resolves to the same account.
function normalizeEmail(email) {
  return String(email == null ? '' : email).trim().toLowerCase();
}

function emailIndexKey(email) {
  const digest = crypto.createHash('sha256').update(normalizeEmail(email)).digest('hex');
  return `${EMAIL_INDEX_PREFIX}${digest}.json`;
}

function credentialIndexKey(credentialId) {
  const id = String(credentialId == null ? '' : credentialId);
  // A credential id is base64url; anything else is refused rather than
  // interpolated into an object key.
  if (!/^[A-Za-z0-9_-]{1,512}$/.test(id)) {
    throw new Error('Identifiant de passkey invalide');
  }
  return `${CREDENTIAL_INDEX_PREFIX}${id}.json`;
}

function newAccount(email, userId) {
  return {
    userId: userId || crypto.randomUUID(),
    email: normalizeEmail(email),
    createdAt: new Date().toISOString(),
    passkeys: [],
  };
}

async function getAccount(userId) {
  if (!userId) return null;
  const account = await read(storage.accountKey(userId));
  if (!account || typeof account !== 'object' || account.userId !== userId) return null;
  if (!Array.isArray(account.passkeys)) account.passkeys = [];
  return account;
}

async function getAccountByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const index = await read(emailIndexKey(normalized));
  if (!index || !index.userId) return null;
  return getAccount(index.userId);
}

async function getAccountByCredential(credentialId) {
  let key;
  try {
    key = credentialIndexKey(credentialId);
  } catch {
    return null;
  }
  const index = await read(key);
  if (!index || !index.userId) return null;
  return getAccount(index.userId);
}

async function saveAccount(account) {
  await write(storage.accountKey(account.userId), account);
  await write(emailIndexKey(account.email), { userId: account.userId });
  return account;
}

// Return the account of an address, creating it when it does not exist yet.
// A second account for the same address is never created: the existing one is
// returned with `created: false`.
//
// `options.userId` carries the handle the authenticator already stored during
// the registration ceremony, so the account is created with that exact
// identifier rather than a fresh one.
async function ensureAccount(email, options = {}) {
  const existing = await getAccountByEmail(email);
  if (existing) return { account: existing, created: false };
  const account = newAccount(email, options.userId);
  await saveAccount(account);
  return { account, created: true };
}

function findPasskey(account, credentialId) {
  return (account.passkeys || []).find((p) => p.id === credentialId) || null;
}

// Record a freshly registered credential and index it, so an assertion with
// that credential resolves back to this account without a scan.
async function addPasskey(account, passkey) {
  const stored = {
    id: passkey.id,
    publicKey: passkey.publicKey,
    counter: Number.isInteger(passkey.counter) ? passkey.counter : 0,
    transports: Array.isArray(passkey.transports) ? passkey.transports : [],
    label: passkey.label || 'Passkey',
    deviceType: passkey.deviceType || 'singleDevice',
    backedUp: Boolean(passkey.backedUp),
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };
  account.passkeys = (account.passkeys || []).filter((p) => p.id !== stored.id);
  account.passkeys.push(stored);
  await saveAccount(account);
  await write(credentialIndexKey(stored.id), { userId: account.userId });
  return stored;
}

async function removePasskey(account, credentialId) {
  const passkey = findPasskey(account, credentialId);
  if (!passkey) return false;
  account.passkeys = account.passkeys.filter((p) => p.id !== credentialId);
  await saveAccount(account);
  // The credential index is dropped so the revoked credential no longer
  // resolves to this account.
  await storage.deleteObject(credentialIndexKey(credentialId));
  return true;
}

async function renamePasskey(account, credentialId, label) {
  const passkey = findPasskey(account, credentialId);
  if (!passkey) return null;
  const clean = String(label == null ? '' : label).trim();
  if (!clean) return null;
  passkey.label = clean.slice(0, 60);
  await saveAccount(account);
  return passkey;
}

// Remember the signature counter observed on the last successful assertion.
// The counter of a synchronized passkey can legitimately stay put, so a
// non-increasing value is recorded rather than treated as an error.
async function touchPasskey(account, credentialId, counter) {
  const passkey = findPasskey(account, credentialId);
  if (!passkey) return null;
  if (Number.isInteger(counter)) passkey.counter = counter;
  passkey.lastUsedAt = new Date().toISOString();
  await saveAccount(account);
  return passkey;
}

module.exports = {
  normalizeEmail,
  emailIndexKey,
  credentialIndexKey,
  getAccount,
  getAccountByEmail,
  getAccountByCredential,
  saveAccount,
  ensureAccount,
  addPasskey,
  removePasskey,
  renamePasskey,
  touchPasskey,
  findPasskey,
};
