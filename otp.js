'use strict';

// One-time codes sent by email, the single bootstrap step before a passkey
// exists.
//
// A code is bound to the address that asked for it, expires, can be used once,
// and is never stored in a readable form: only a salt and the digest of
// `salt:code` are kept, so the store cannot hand a code back to anyone.
//
// The store is in memory. The application runs as a single process (one
// container, max_scale = 1), so a code has the same lifetime as the process;
// requiring a new code after a restart is the intended, harmless outcome.

const crypto = require('crypto');

function intFromEnv(name, fallback) {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function limits() {
  return {
    ttlMs: intFromEnv('OTP_TTL_SECONDS', 600) * 1000,
    resendCooldownMs: intFromEnv('OTP_RESEND_COOLDOWN_SECONDS', 60) * 1000,
    maxAttempts: intFromEnv('OTP_MAX_ATTEMPTS', 5),
    maxRequests: intFromEnv('OTP_MAX_REQUESTS', 5),
    requestWindowMs: intFromEnv('OTP_REQUEST_WINDOW_SECONDS', 900) * 1000,
  };
}

function normalizeEmail(email) {
  return String(email == null ? '' : email).trim().toLowerCase();
}

function hashCode(salt, code) {
  return crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a), 'utf8');
  const right = Buffer.from(String(b), 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

// code by address, and the request timestamps used for rate limiting
const codes = new Map();
const requests = new Map();

function pruneRequests(key, now, windowMs) {
  const stamps = (requests.get(key) || []).filter((t) => now - t < windowMs);
  requests.set(key, stamps);
  return stamps;
}

function retryAfter(stamps, now, windowMs) {
  if (stamps.length === 0) return 0;
  return Math.max(1, Math.ceil((windowMs - (now - stamps[0])) / 1000));
}

// Ask for a code: enforces the resend cooldown and the request rate before
// issuing anything, so an over-eager caller cannot flood the address.
function requestCode(email, clientKey) {
  const now = Date.now();
  const { ttlMs, resendCooldownMs, maxRequests, requestWindowMs } = limits();
  const address = normalizeEmail(email);

  const previous = codes.get(address);
  if (previous && !previous.usedAt && now - previous.issuedAt < resendCooldownMs) {
    return {
      ok: false,
      reason: 'cooldown',
      retryAfterSeconds: Math.ceil((resendCooldownMs - (now - previous.issuedAt)) / 1000),
    };
  }

  const addressStamps = pruneRequests(`e:${address}`, now, requestWindowMs);
  if (addressStamps.length >= maxRequests) {
    return {
      ok: false,
      reason: 'rate-limited',
      retryAfterSeconds: retryAfter(addressStamps, now, requestWindowMs),
    };
  }

  const client = clientKey ? `c:${clientKey}` : null;
  const clientStamps = client ? pruneRequests(client, now, requestWindowMs) : [];
  if (client && clientStamps.length >= maxRequests) {
    return {
      ok: false,
      reason: 'rate-limited',
      retryAfterSeconds: retryAfter(clientStamps, now, requestWindowMs),
    };
  }

  const code = String(crypto.randomInt(0, 10 ** 6)).padStart(6, '0');
  const salt = crypto.randomBytes(16).toString('hex');
  codes.set(address, {
    salt,
    hash: hashCode(salt, code),
    issuedAt: now,
    expiresAt: now + ttlMs,
    attempts: 0,
    usedAt: null,
  });
  addressStamps.push(now);
  if (client) clientStamps.push(now);

  return { ok: true, code, expiresAt: now + ttlMs };
}

// Check a submitted code. Every failure mode is distinguished so the form can
// say what actually went wrong.
function verifyCode(email, submitted) {
  const address = normalizeEmail(email);
  const record = codes.get(address);
  if (!record) return { ok: false, reason: 'none' };

  const now = Date.now();
  if (record.usedAt) return { ok: false, reason: 'used' };
  if (now > record.expiresAt) {
    codes.delete(address);
    return { ok: false, reason: 'expired' };
  }

  const { maxAttempts } = limits();
  if (record.attempts >= maxAttempts) {
    codes.delete(address);
    return { ok: false, reason: 'attempts' };
  }

  const candidate = String(submitted == null ? '' : submitted).trim();
  if (!/^\d{6}$/.test(candidate) || !safeEqual(hashCode(record.salt, candidate), record.hash)) {
    record.attempts += 1;
    if (record.attempts >= maxAttempts) {
      codes.delete(address);
      return { ok: false, reason: 'attempts' };
    }
    return { ok: false, reason: 'mismatch' };
  }

  // Consumed: the code is spent the moment it is accepted.
  record.usedAt = now;
  codes.delete(address);
  return { ok: true };
}

// Forget everything: used by the tests to isolate cases.
function reset() {
  codes.clear();
  requests.clear();
}

module.exports = {
  normalizeEmail,
  requestCode,
  verifyCode,
  limits,
  reset,
};
