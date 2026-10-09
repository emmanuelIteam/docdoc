'use strict';

// The access routes: home page, enrollment by email code, passkey ceremonies,
// passkey management, session status and sign-out.
//
// Everything that guards the application itself lives here too (`guard`), so
// there is exactly one place that decides whether a request may see a space.

const express = require('express');
const crypto = require('crypto');

const accounts = require('./accounts');
const otp = require('./otp');
const mailer = require('./mailer');
const passkeys = require('./passkeys');
const pages = require('./authpages');

// How long a verified code leaves the enrollment session open.
const ENROLLMENT_TTL_MS = 15 * 60 * 1000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return String(email == null ? '' : email).trim().toLowerCase();
}

function regenerate(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

function signedIn(req) {
  return Boolean(req.session && req.session.userId);
}

function enrollment(req) {
  const value = req.session && req.session.enrollment;
  if (!value || !value.email) return null;
  if (!value.expiresAt || value.expiresAt <= Date.now()) return null;
  return value;
}

function isHtmx(req) {
  return req.get('HX-Request') === 'true';
}

function isApiPath(req) {
  return req.path.startsWith('/api/') || req.path.includes('/api/');
}

function page(status, html) {
  return { status, html };
}

// --- Ceremony bookkeeping ---------------------------------------------
// The challenge lives server-side, expires, and is consumed by the first
// verification attempt, so a captured response cannot be replayed.

function putCeremony(req, type, challenge) {
  req.session.ceremony = { type, challenge, expiresAt: Date.now() + passkeys.CEREMONY_TTL_MS };
}

// Read and immediately consume the pending ceremony of the expected type.
function takeCeremony(req, type) {
  const ceremony = req.session && req.session.ceremony;
  if (req.session) delete req.session.ceremony;
  if (!ceremony || ceremony.type !== type) return null;
  if (!ceremony.expiresAt || ceremony.expiresAt <= Date.now()) return null;
  return ceremony;
}

function createAuth(options) {
  const authorized = new Set(
    (options.authorizedEmails || []).map(normalizeEmail).filter(Boolean)
  );
  const onAccountReady = options.onAccountReady || (async () => {});

  function emailForm(res, status, fields) {
    const { status: code, html } = page(status, pages.renderEmailForm(fields || {}));
    res.status(code).type('html').send(html);
  }

  function codeForm(res, status, fields) {
    // The form is told where the code actually went, so a development run does
    // not promise an email that was never sent.
    const html = pages.renderCodeForm({
      delivery: mailer.isDevMode() ? 'log' : 'email',
      ...fields,
    });
    res.status(status).type('html').send(html);
  }

  function enrollmentPage(res, status, fields) {
    res.status(status).type('html').send(pages.renderPasskeyEnrollment(fields || {}));
  }

  // --- Guard ----------------------------------------------------------

  // Deny everything that is not an authenticated session. A page gets the home
  // page (or is sent there); an API route gets a bare 401 that leaks nothing;
  // an htmx exchange is redirected so a fragment target is never filled with
  // the home page's HTML.
  function guard(req, res, next) {
    if (signedIn(req)) return next();
    if (isHtmx(req)) {
      res.set('HX-Redirect', '/');
      return res.status(401).end();
    }
    if (isApiPath(req)) return res.status(401).json({ authenticated: false });
    return res.redirect(302, '/');
  }

  // Registration is allowed either from a verified enrollment session (first
  // passkey of an account) or from a fully authenticated session (adding a
  // passkey to an existing account).
  function guardRegistration(req, res, next) {
    if (signedIn(req) || enrollment(req)) return next();
    return res.status(401).json({ error: 'Aucun enrôlement en cours. Recommencez la demande de code.' });
  }

  const router = express.Router();

  /* --- Home page ---------------------------------------------------- */

  router.get('/', (req, res, next) => {
    if (signedIn(req)) return next();
    if (req.query.deconnecte) {
      return res.type('html').send(pages.renderHome({ notice: 'Vous êtes déconnecté.' }));
    }
    return res.type('html').send(pages.renderHome({}));
  });

  router.get('/auth/signup', (req, res) => {
    if (signedIn(req)) return res.redirect(302, '/');
    return res.type('html').send(pages.renderEmailForm({}));
  });

  /* --- Enrollment step 1: the email address ------------------------- */

  router.post('/auth/email', async (req, res) => {
    const email = normalizeEmail(req.body && req.body.email);

    if (!email || !EMAIL_PATTERN.test(email)) {
      return emailForm(res, 400, {
        error: 'Adresse email invalide.',
        value: req.body && req.body.email,
      });
    }

    // The allowlist is checked before anything is sent: docdoc must never
    // deliver a code to an address it does not authorize.
    if (!authorized.has(email)) {
      return emailForm(res, 403, {
        error: "Vous n'êtes pas habilité sur docdoc.",
        value: email,
      });
    }

    const issued = otp.requestCode(email, req.ip);
    if (!issued.ok) {
      if (issued.reason === 'cooldown') {
        req.session.pendingEmail = email;
        return codeForm(res, 429, {
          email,
          error: `Un code a déjà été envoyé. Patientez ${issued.retryAfterSeconds} s avant d'en demander un autre.`,
        });
      }
      return emailForm(res, 429, {
        error: `Trop de demandes de code. Réessayez dans ${issued.retryAfterSeconds} s.`,
        value: email,
      });
    }

    req.session.pendingEmail = email;
    const delivery = await mailer.sendCode(email, issued.code, { ttlMinutes: 10 });
    if (!delivery.ok) {
      return emailForm(res, 502, {
        error: "Le code n'a pas pu être envoyé. Réessayez dans un instant.",
        value: email,
      });
    }

    return codeForm(res, 200, { email, notice: 'Code envoyé.' });
  });

  router.post('/auth/email/resend', async (req, res) => {
    const email = normalizeEmail(req.session && req.session.pendingEmail);
    if (!email) return emailForm(res, 400, { error: 'Commencez par indiquer votre adresse email.' });
    if (!authorized.has(email)) {
      return emailForm(res, 403, { error: "Vous n'êtes pas habilité sur docdoc.", value: email });
    }

    const issued = otp.requestCode(email, req.ip);
    if (!issued.ok) {
      const message =
        issued.reason === 'cooldown'
          ? `Un code valide est déjà en cours. Patientez ${issued.retryAfterSeconds} s.`
          : `Trop de demandes de code. Réessayez dans ${issued.retryAfterSeconds} s.`;
      return codeForm(res, 429, { email, error: message });
    }

    const delivery = await mailer.sendCode(email, issued.code, { ttlMinutes: 10 });
    if (!delivery.ok) {
      return codeForm(res, 502, { email, error: "Le code n'a pas pu être envoyé. Réessayez dans un instant." });
    }
    return codeForm(res, 200, { email, notice: 'Un nouveau code a été envoyé ; le précédent n\u2019est plus valable.' });
  });

  /* --- Enrollment step 2: the code ---------------------------------- */

  router.post('/auth/email/verify', (req, res) => {
    const email = normalizeEmail(req.session && req.session.pendingEmail);
    if (!email) return emailForm(res, 400, { error: 'Commencez par indiquer votre adresse email.' });

    const result = otp.verifyCode(email, req.body && req.body.code);
    if (!result.ok) {
      const messages = {
        mismatch: 'Code incorrect.',
        expired: 'Ce code a expiré. Demandez-en un nouveau.',
        used: 'Ce code a déjà été utilisé. Demandez-en un nouveau.',
        attempts: 'Trop de tentatives : ce code est invalidé. Demandez-en un nouveau.',
        none: 'Aucun code en cours pour cette adresse. Demandez-en un nouveau.',
      };
      const status = result.reason === 'attempts' ? 429 : 400;
      return codeForm(res, status, { email, error: messages[result.reason] || 'Code refusé.' });
    }

    delete req.session.pendingEmail;
    req.session.enrollment = {
      email,
      // The user handle is decided now and carried in the session, so the
      // account created after the ceremony has the identifier the authenticator
      // already stored. No account record exists yet.
      userId: crypto.randomUUID(),
      verifiedAt: Date.now(),
      expiresAt: Date.now() + ENROLLMENT_TTL_MS,
    };
    return enrollmentPage(res, 200, { email });
  });

  router.post('/auth/cancel', (req, res) => {
    if (req.session) {
      delete req.session.pendingEmail;
      delete req.session.enrollment;
      delete req.session.ceremony;
    }
    return res.redirect(302, '/');
  });

  /* --- Enrollment step 3: the passkey ------------------------------- */

  router.post('/auth/passkey/register/options', guardRegistration, async (req, res) => {
    let rp;
    try {
      rp = passkeys.relyingParty(req);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
    try {
      if (signedIn(req)) {
        const account = await accounts.getAccount(req.session.userId);
        if (!account) return res.status(401).json({ error: 'Compte introuvable.' });
        const options = await passkeys.registrationOptions(rp, account, account.email);
        putCeremony(req, 'registration', options.challenge);
        return res.json(options);
      }

      const pending = enrollment(req);
      if (!pending) {
        return res.status(401).json({ error: 'Enrôlement expiré. Recommencez la demande de code.' });
      }
      // An account may already exist (recovery, or a second device): reuse it,
      // otherwise present the provisional handle decided at code verification.
      const existing = await accounts.getAccountByEmail(pending.email);
      const context = existing || { userId: pending.userId, passkeys: [] };
      const options = await passkeys.registrationOptions(rp, context, pending.email);
      putCeremony(req, 'registration', options.challenge);
      return res.json(options);
    } catch (err) {
      console.error('[docdoc] options d\u2019enregistrement:', err.message);
      return res.status(500).json({ error: "Impossible de préparer l'enregistrement de la passkey." });
    }
  });

  router.post('/auth/passkey/register/verify', guardRegistration, async (req, res) => {
    const ceremony = takeCeremony(req, 'registration');
    if (!ceremony) {
      return res.status(400).json({ error: 'Cérémonie expirée ou inconnue. Recommencez.' });
    }

    let credential;
    try {
      credential = await passkeys.verifyRegistration(
        passkeys.relyingParty(req),
        req.body,
        ceremony.challenge
      );
    } catch (err) {
      console.error('[docdoc] vérification d\u2019attestation:', err.message);
      return res.status(400).json({ error: "L'enregistrement de la passkey a échoué." });
    }
    if (!credential) {
      return res.status(400).json({ error: "L'enregistrement de la passkey a échoué." });
    }

    try {
      // Adding a passkey to an account that is already open.
      if (signedIn(req)) {
        const account = await accounts.getAccount(req.session.userId);
        if (!account) return res.status(401).json({ error: 'Compte introuvable.' });
        await accounts.addPasskey(account, { ...credential, label: labelFor(req) });
        return res.json({ ok: true, redirect: '/auth/passkeys' });
      }

      const pending = enrollment(req);
      if (!pending) {
        return res.status(401).json({ error: 'Enrôlement expiré. Recommencez la demande de code.' });
      }

      const { account, created } = await accounts.ensureAccount(pending.email, {
        userId: pending.userId,
      });
      await accounts.addPasskey(account, { ...credential, label: labelFor(req) });
      // First login of this account: adopt the pre-account data and drop any
      // cached space of a previous session.
      await onAccountReady(account, created);

      // New session identifier on privilege change, so the enrollment session
      // cannot be fixated into an authenticated one.
      await regenerate(req);
      req.session.userId = account.userId;
      req.session.email = account.email;
      return res.json({ ok: true, redirect: '/' });
    } catch (err) {
      console.error('[docdoc] création du compte:', err.message);
      return res.status(500).json({ error: 'Le compte n\u2019a pas pu être créé.' });
    }
  });

  /* --- Sign-in with a passkey --------------------------------------- */

  router.post('/auth/passkey/login/options', async (req, res) => {
    let rp;
    try {
      rp = passkeys.relyingParty(req);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
    try {
      const email = normalizeEmail(req.body && req.body.email);
      // With an address, only that account's passkeys are acceptable; without
      // one, the browser offers the discoverable passkeys it holds.
      const account = email ? await accounts.getAccountByEmail(email) : null;
      const options = await passkeys.authenticationOptions(rp, account);
      putCeremony(req, 'authentication', options.challenge);
      return res.json(options);
    } catch (err) {
      console.error('[docdoc] options d\u2019assertion:', err.message);
      return res.status(500).json({ error: 'Impossible de préparer la connexion.' });
    }
  });

  router.post('/auth/passkey/login/verify', async (req, res) => {
    const ceremony = takeCeremony(req, 'authentication');
    if (!ceremony) return res.status(400).json({ error: 'Cérémonie expirée. Réessayez.' });

    const credentialId = req.body && req.body.id;
    try {
      // Resolve the account from the credential alone: this is what makes
      // sign-in without typing an address possible.
      const account = await accounts.getAccountByCredential(credentialId);
      if (!account) return res.status(401).json({ error: 'Passkey inconnue.' });

      const passkey = accounts.findPasskey(account, credentialId);
      if (!passkey) return res.status(401).json({ error: 'Passkey inconnue.' });

      const result = await passkeys.verifyAuthentication(
        passkeys.relyingParty(req),
        req.body,
        ceremony.challenge,
        passkey
      );
      if (!result) return res.status(401).json({ error: 'Connexion refusée.' });

      if (result.counterAnomaly) {
        console.warn(
          `[docdoc] compteur de signature non croissant pour la passkey ${credentialId} du compte ${account.userId}`
        );
      }
      await accounts.touchPasskey(account, credentialId, result.newCounter);
      await onAccountReady(account, false);

      await regenerate(req);
      req.session.userId = account.userId;
      req.session.email = account.email;
      return res.json({ ok: true, redirect: '/' });
    } catch (err) {
      console.error('[docdoc] vérification d\u2019assertion:', err.message);
      return res.status(401).json({ error: 'Connexion refusée.' });
    }
  });

  /* --- Passkey management ------------------------------------------- */

  router.get('/auth/passkeys', guard, async (req, res) => {
    const account = await accounts.getAccount(req.session.userId);
    if (!account) return res.redirect(302, '/logout');
    const notice = req.query.ok ? "C'est fait." : null;
    const error = req.query.erreur || null;
    return res.type('html').send(pages.renderPasskeys({ account, notice, error }));
  });

  router.post('/auth/passkeys/rename', guard, async (req, res) => {
    const account = await accounts.getAccount(req.session.userId);
    if (!account) return res.redirect(302, '/');
    const renamed = await accounts.renamePasskey(account, req.body.credentialId, req.body.label);
    return res.redirect(302, renamed ? '/auth/passkeys?ok=1' : '/auth/passkeys?erreur=Nom+invalide');
  });

  router.post('/auth/passkeys/revoke', guard, async (req, res) => {
    const account = await accounts.getAccount(req.session.userId);
    if (!account) return res.redirect(302, '/');
    // The last passkey is what keeps the account reachable without a code:
    // refuse to remove it, and say so.
    if ((account.passkeys || []).length <= 1) {
      return res.redirect(
        302,
        '/auth/passkeys?erreur=' + encodeURIComponent(
          'Impossible de révoquer la dernière passkey : enregistrez-en une autre d\u2019abord.'
        )
      );
    }
    await accounts.removePasskey(account, req.body.credentialId);
    return res.redirect(302, '/auth/passkeys?ok=1');
  });

  /* --- Session status and sign-out ---------------------------------- */

  router.get('/api/me', (req, res) => {
    if (!signedIn(req)) return res.status(401).json({ authenticated: false });
    return res.json({ authenticated: true, email: req.session.email || null });
  });

  router.post('/logout', (req, res) => {
    if (!req.session) return res.redirect(302, '/?deconnecte=1');
    return req.session.destroy(() => res.redirect(302, '/?deconnecte=1'));
  });

  return { router, guard, guardRegistration, signedIn };
}

// A passkey's first label: the browser does not tell the server what the device
// is called, so a neutral, ordered name is used and the user can rename it.
function labelFor(req) {
  return String((req.body && req.body.deviceLabel) || '').trim() || 'Passkey';
}

module.exports = { createAuth, ENROLLMENT_TTL_MS };
