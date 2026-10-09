'use strict';

// Delivery of the one-time code.
//
// One interface (`sendCode`) and four providers behind it, so the calling code
// never depends on a vendor:
//   dev       — writes the code to the server log, sends nothing (default)
//   smtp      — any SMTP relay, with or without authentication. This is what a
//               local catcher (Mailpit, in docker-compose) uses, and it also
//               covers the SMTP relays of Scaleway TEM and Brevo in production.
//   scaleway  — Scaleway Transactional Email HTTP API (same account and region
//               as the container and the bucket)
//   brevo     — Brevo transactional email HTTP API, the documented fallback
//
// `sendCode` never throws: a provider failure is reported to the caller so the
// visitor can be told the code could not be sent, and the server keeps running.

const nodemailer = require('nodemailer');

const DEFAULT_TTL_MINUTES = 10;

function config() {
  return {
    provider: String(process.env.EMAIL_PROVIDER || 'dev').trim().toLowerCase(),
    from: String(process.env.EMAIL_FROM || '').trim(),
    fromName: String(process.env.EMAIL_FROM_NAME || 'docdoc').trim(),
    region: String(process.env.EMAIL_REGION || 'fr-par').trim(),
    secretKey: String(process.env.SCW_SECRET_KEY || process.env.EMAIL_API_KEY || '').trim(),
    projectId: String(process.env.SCW_DEFAULT_PROJECT_ID || '').trim(),
    brevoApiKey: String(process.env.BREVO_API_KEY || '').trim(),
    smtpHost: String(process.env.SMTP_HOST || '').trim(),
    smtpPort: Number.parseInt(process.env.SMTP_PORT, 10) || 1026,
    // true = TLS from the first byte (port 465). A local catcher listens in
    // clear text, and a submission port (587) upgrades with STARTTLS.
    smtpSecure: String(process.env.SMTP_SECURE || '').trim().toLowerCase() === 'true',
    smtpRequireTls: String(process.env.SMTP_REQUIRE_TLS || '').trim().toLowerCase() === 'true',
    smtpAllowSelfSigned:
      String(process.env.SMTP_ALLOW_SELF_SIGNED || '').trim().toLowerCase() === 'true',
    smtpUser: String(process.env.SMTP_USER || '').trim(),
    smtpPassword: String(process.env.SMTP_PASSWORD || ''),
    smtpConnectionTimeout: Number.parseInt(process.env.SMTP_TIMEOUT_MS, 10) || 10000,
  };
}

function isDevMode() {
  return config().provider === 'dev';
}

function message(code, ttlMinutes) {
  const subject = 'Votre code d\u2019accès docdoc';
  const text =
    `Votre code d'accès docdoc : ${code}\n\n` +
    `Il expire dans ${ttlMinutes} minutes et ne peut être utilisé qu'une fois.\n` +
    `Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.`;
  const html =
    '<p>Votre code d\u2019accès docdoc :</p>' +
    `<p style="font-size:28px;letter-spacing:6px;font-family:monospace"><strong>${code}</strong></p>` +
    `<p>Il expire dans ${ttlMinutes} minutes et ne peut être utilisé qu\u2019une fois.<br>` +
    `Si vous n\u2019êtes pas à l\u2019origine de cette demande, ignorez ce message.</p>`;
  return { subject, text, html };
}

async function postJson(url, headers, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`${response.status} ${detail.slice(0, 200)}`);
  }
  return response;
}

async function sendWithScaleway(to, code, ttlMinutes) {
  const c = config();
  if (!c.secretKey) throw new Error('SCW_SECRET_KEY manquante');
  if (!c.from) throw new Error('EMAIL_FROM manquante');
  const { subject, text, html } = message(code, ttlMinutes);
  await postJson(
    `https://api.scaleway.com/transactional-email/v1alpha1/regions/${c.region}/emails`,
    { 'X-Auth-Token': c.secretKey },
    {
      from: { email: c.from, name: c.fromName },
      to: [{ email: to }],
      subject,
      text,
      html,
      ...(c.projectId ? { project_id: c.projectId } : {}),
    }
  );
}

async function sendWithBrevo(to, code, ttlMinutes) {
  const c = config();
  if (!c.brevoApiKey) throw new Error('BREVO_API_KEY manquante');
  if (!c.from) throw new Error('EMAIL_FROM manquante');
  const { subject, text, html } = message(code, ttlMinutes);
  await postJson(
    'https://api.brevo.com/v3/smtp/email',
    { 'api-key': c.brevoApiKey },
    {
      sender: { email: c.from, name: c.fromName },
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }
  );
}

// A single transport is reused across sends: opening a connection per code would
// add a needless handshake, and a local catcher keeps the socket open anyway.
let smtpTransportInstance = null;

function smtpTransport() {
  if (smtpTransportInstance) return smtpTransportInstance;
  const c = config();
  if (!c.smtpHost) throw new Error('SMTP_HOST manquante');
  smtpTransportInstance = nodemailer.createTransport({
    host: c.smtpHost,
    port: c.smtpPort,
    // true = implicit TLS from the first byte (usually 465). Port 587 and the
    // clear-text port of a local catcher (1025) leave this false.
    secure: c.smtpSecure,
    requireTLS: c.smtpRequireTls,
    auth: c.smtpUser ? { user: c.smtpUser, pass: c.smtpPassword } : undefined,
    // Certificate verification stays on by default; a self-signed relay has to
    // be allowed explicitly rather than silently accepted.
    tls: c.smtpAllowSelfSigned ? { rejectUnauthorized: false } : undefined,
    connectionTimeout: c.smtpConnectionTimeout,
    greetingTimeout: c.smtpConnectionTimeout,
    socketTimeout: c.smtpConnectionTimeout * 2,
  });
  return smtpTransportInstance;
}

async function sendWithSmtp(to, code, ttlMinutes) {
  const c = config();
  if (!c.from) throw new Error('EMAIL_FROM manquante');
  const { subject, text, html } = message(code, ttlMinutes);
  await smtpTransport().sendMail({
    from: { address: c.from, name: c.fromName },
    to,
    subject,
    text,
    html,
  });
}

// Deliver `code` to `to`. Resolves to { ok: true } or { ok: false, error }.
async function sendCode(to, code, options = {}) {
  const ttlMinutes = options.ttlMinutes || DEFAULT_TTL_MINUTES;
  const provider = config().provider;

  if (provider === 'dev') {
    console.log(`[docdoc][dev] code pour ${to} : ${code} (valable ${ttlMinutes} min)`);
    return { ok: true, provider: 'dev' };
  }

  try {
    if (provider === 'scaleway') await sendWithScaleway(to, code, ttlMinutes);
    else if (provider === 'brevo') await sendWithBrevo(to, code, ttlMinutes);
    else if (provider === 'smtp') await sendWithSmtp(to, code, ttlMinutes);
    else throw new Error(`Fournisseur d'email inconnu : ${provider}`);
    return { ok: true, provider };
  } catch (err) {
    console.error(`[docdoc] échec d'envoi du code à ${to} via ${provider} :`, err.message);
    return { ok: false, provider, error: err.message };
  }
}

// One line describing where the codes actually go, printed at startup. In
// development mode nothing is sent, and the log line below is the only place
// the code appears — the fastest way to lose an hour is not knowing that.
function describe() {
  const c = config();
  if (c.provider === 'dev') {
    return (
      'mode développement — aucun email n\u2019est envoyé, le code s\u2019affiche dans ces journaux ' +
      '(ligne « [docdoc][dev] code pour … »)'
    );
  }
  if (c.provider === 'scaleway') {
    return `Scaleway Transactional Email (${c.region}), expéditeur ${c.from || '(EMAIL_FROM manquant)'}`;
  }
  if (c.provider === 'brevo') {
    return `Brevo, expéditeur ${c.from || '(EMAIL_FROM manquant)'}`;
  }
  if (c.provider === 'smtp') {
    return (
      `SMTP ${c.smtpHost || '(SMTP_HOST manquant)'}:${c.smtpPort}` +
      `${c.smtpSecure ? ' (TLS)' : ''}${c.smtpUser ? ', authentifié' : ', sans authentification'}` +
      `, expéditeur ${c.from || '(EMAIL_FROM manquant)'}`
    );
  }
  return `fournisseur inconnu « ${c.provider} » — l\u2019envoi échouera`;
}

// Called at startup: a development mailer in production means codes are written
// to the logs instead of being delivered, and an incomplete provider means every
// send will fail.
function warnIfMisconfigured() {
  const c = config();
  if (process.env.NODE_ENV === 'production' && c.provider === 'dev') {
    console.warn(
      '\u26a0 EMAIL_PROVIDER vaut "dev" en production : les codes sont écrits dans les journaux ' +
        'et aucun email n\u2019est envoyé. Renseignez EMAIL_PROVIDER, EMAIL_FROM et les identifiants.'
    );
    return;
  }
  if (c.provider === 'scaleway' && !c.secretKey) {
    console.warn('\u26a0 SCW_SECRET_KEY est absente : aucun code ne pourra être envoyé par Scaleway TEM.');
  }
  if (c.provider === 'brevo' && !c.brevoApiKey) {
    console.warn('\u26a0 BREVO_API_KEY est absente : aucun code ne pourra être envoyé par Brevo.');
  }
  if (c.provider === 'smtp' && !c.smtpHost) {
    console.warn('\u26a0 SMTP_HOST est absente : aucun code ne pourra être envoyé par SMTP.');
  }
  if (c.provider !== 'dev' && !c.from) {
    console.warn('\u26a0 EMAIL_FROM est absente : le fournisseur refusera l\u2019envoi.');
  }
}

// Whether the current configuration could actually deliver a code. Used by the
// enrollment route to fail early with an actionable message.
function isDeliverable() {
  const c = config();
  if (c.provider === 'dev') return process.env.NODE_ENV !== 'production';
  if (c.provider === 'scaleway') return Boolean(c.secretKey && c.from);
  if (c.provider === 'brevo') return Boolean(c.brevoApiKey && c.from);
  if (c.provider === 'smtp') return Boolean(c.smtpHost && c.from);
  return false;
}

module.exports = {
  config,
  isDevMode,
  isDeliverable,
  describe,
  sendCode,
  warnIfMisconfigured,
  DEFAULT_TTL_MINUTES,
};
