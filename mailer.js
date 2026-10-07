'use strict';

// Delivery of the one-time code.
//
// One interface (`sendCode`) and three providers behind it, so the calling
// code never depends on a vendor:
//   dev       — writes the code to the server log, sends nothing (default)
//   scaleway  — Scaleway Transactional Email (same account and region as the
//               container and the bucket)
//   brevo     — Brevo transactional email, the documented fallback
//
// `sendCode` never throws: a provider failure is reported to the caller so the
// visitor can be told the code could not be sent, and the server keeps running.

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
    else throw new Error(`Fournisseur d'email inconnu : ${provider}`);
    return { ok: true, provider };
  } catch (err) {
    console.error(`[docdoc] échec d'envoi du code à ${to} via ${provider} :`, err.message);
    return { ok: false, provider, error: err.message };
  }
}

// Called at startup: a development mailer in production means codes are
// written to the logs instead of being delivered.
function warnIfMisconfigured() {
  const c = config();
  if (process.env.NODE_ENV === 'production' && c.provider === 'dev') {
    console.warn(
      '\u26a0 EMAIL_PROVIDER vaut "dev" en production : les codes sont écrits dans les journaux ' +
        'et aucun email n\u2019est envoyé. Renseignez EMAIL_PROVIDER, EMAIL_FROM et les identifiants.'
    );
  }
}

// Whether the current configuration could actually deliver a code. Used by the
// enrollment route to fail early with an actionable message.
function isDeliverable() {
  const c = config();
  if (c.provider === 'dev') return process.env.NODE_ENV !== 'production';
  if (c.provider === 'scaleway') return Boolean(c.secretKey && c.from);
  if (c.provider === 'brevo') return Boolean(c.brevoApiKey && c.from);
  return false;
}

module.exports = {
  config,
  isDevMode,
  isDeliverable,
  sendCode,
  warnIfMisconfigured,
  DEFAULT_TTL_MINUTES,
};
