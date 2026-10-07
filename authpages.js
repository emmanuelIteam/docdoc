'use strict';

// Server-rendered HTML for the access pages: the home page shown when no
// session exists, the two enrollment steps, the passkey registration screen and
// the passkey management screen.
//
// These pages are deliberately outside the application shell (no sidebar): they
// are what a visitor sees *before* any space is resolved, so they must render
// without loading a single domain or theme.

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function alert(kind, message) {
  if (!message) return '';
  return `<p class="auth-alert ${kind}">${escapeHtml(message)}</p>`;
}

function authShell(title, body, opts = {}) {
  const scripts = opts.scripts
    ? opts.scripts.map((src) => `<script src="${src}"></script>`).join('')
    : '';
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} — docdoc</title>
  <link rel="stylesheet" href="/style.css">
</head>
<body class="auth-body">
  <main class="auth-main">
    <a class="auth-brand" href="/">docdoc</a>
    ${body}
  </main>
  ${scripts}
</body>
</html>`;
}

const CLIENT_SCRIPTS = ['/simplewebauthn.js', '/auth.js'];

// Shown whenever a request arrives without an authenticated session. The
// browser has no session, which is all the server can know: it must therefore
// offer both doors, because a returning user on a new browser has a space and
// no way to prove it by email alone.
function renderHome(options = {}) {
  return authShell(
    'Accès',
    `<section class="auth-card">
      <h2>Aucun espace docdoc n'est associé à ce navigateur</h2>
      <p>Créez votre espace de travail, ou connectez-vous avec une passkey déjà enregistrée.</p>
      ${alert('error', options.error)}
      ${alert('notice', options.notice)}
      <div class="auth-actions">
        <a class="btn primary" href="/auth/signup">Créer un compte</a>
        <button type="button" class="btn" id="signin-btn">Se connecter</button>
      </div>
      <p class="auth-note" id="auth-status" role="status"></p>
    </section>`,
    { scripts: CLIENT_SCRIPTS }
  );
}

function renderEmailForm(options = {}) {
  return authShell(
    'Créer un compte',
    `<form method="post" action="/auth/email" class="auth-card">
      <h2>Créer un compte</h2>
      <p>Indiquez votre adresse email : docdoc y enverra un code d'accès à usage unique.</p>
      ${alert('error', options.error)}
      <label for="email">Adresse email</label>
      <input id="email" name="email" type="email" required autocomplete="email" autofocus
             value="${escapeHtml(options.value || '')}">
      <button class="btn primary" type="submit">Recevoir un code</button>
      <a class="auth-link" href="/">Retour</a>
    </form>`
  );
}

function renderCodeForm(options = {}) {
  const email = escapeHtml(options.email || '');
  return authShell(
    'Saisir le code',
    `<form method="post" action="/auth/email/verify" class="auth-card">
      <h2>Saisir le code</h2>
      <p>Un code à 6 chiffres a été envoyé à <strong>${email}</strong>. Il ne peut être utilisé qu'une fois.</p>
      ${alert('error', options.error)}
      ${alert('notice', options.notice)}
      <label for="code">Code</label>
      <input id="code" name="code" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6"
             required autofocus autocomplete="one-time-code">
      <button class="btn primary" type="submit">Valider</button>
    </form>
    <form method="post" action="/auth/email/resend" class="auth-card auth-secondary">
      <button class="btn link" type="submit">Renvoyer un nouveau code</button>
    </form>
    <form method="post" action="/auth/cancel" class="auth-card auth-secondary">
      <button class="btn link" type="submit">Utiliser une autre adresse</button>
    </form>`
  );
}

// The last enrollment step. The passkey is created by the browser API, driven
// by /auth.js, against the options issued by the server.
function renderPasskeyEnrollment(options = {}) {
  return authShell(
    'Enregistrer une passkey',
    `<section class="auth-card">
      <h2>Enregistrer une passkey</h2>
      <p>Votre adresse est vérifiée. Enregistrez maintenant une passkey : elle remplacera le code
         pour toutes vos prochaines connexions.</p>
      ${alert('error', options.error)}
      <button type="button" class="btn primary" id="register-passkey-btn">Enregistrer une passkey</button>
      <p class="auth-note" id="auth-status" role="status"></p>
    </section>`,
    { scripts: CLIENT_SCRIPTS }
  );
}

function passkeyRow(passkey) {
  const id = escapeHtml(passkey.id);
  const created = passkey.createdAt ? new Date(passkey.createdAt).toLocaleDateString('fr-FR') : '';
  const used = passkey.lastUsedAt ? new Date(passkey.lastUsedAt).toLocaleDateString('fr-FR') : 'jamais';
  const backup = passkey.backedUp ? 'synchronisée' : 'liée à cet appareil';
  return `<li class="passkey-row">
      <div class="passkey-info">
        <form method="post" action="/auth/passkeys/rename" class="inline-form passkey-rename">
          <input type="hidden" name="credentialId" value="${id}">
          <input name="label" value="${escapeHtml(passkey.label || '')}" maxlength="60"
                 aria-label="Nom de la passkey">
          <button class="btn-mini" type="submit" title="Renommer">✏️</button>
        </form>
        <span class="passkey-meta">${escapeHtml(backup)} · créée le ${escapeHtml(created)} · dernière utilisation : ${escapeHtml(used)}</span>
      </div>
      <form method="post" action="/auth/passkeys/revoke" class="inline-form"
            onsubmit="return confirm('Révoquer cette passkey ?');">
        <input type="hidden" name="credentialId" value="${id}">
        <button class="btn-mini danger" type="submit" title="Révoquer">🗑</button>
      </form>
    </li>`;
}

function renderPasskeys(options = {}) {
  const account = options.account;
  const passkeys = account && Array.isArray(account.passkeys) ? account.passkeys : [];
  const rows = passkeys.length
    ? `<ul class="passkey-list">${passkeys.map(passkeyRow).join('')}</ul>`
    : '<p class="auth-note">Aucune passkey enregistrée.</p>';
  return authShell(
    'Mes passkeys',
    `<section class="auth-card auth-wide">
      <h2>Mes passkeys</h2>
      <p>Compte : <strong>${escapeHtml(account ? account.email : '')}</strong></p>
      ${alert('error', options.error)}
      ${alert('notice', options.notice)}
      ${rows}
      <div class="auth-actions">
        <button type="button" class="btn primary" id="register-passkey-btn">Ajouter une passkey</button>
        <a class="btn" href="/">Retour à mes projets</a>
      </div>
      <p class="auth-note" id="auth-status" role="status"></p>
      <p class="auth-note">Si vous perdez tous vos appareils, la page d'accueil permet de recevoir un
         nouveau code par email et d'enregistrer une passkey de remplacement.</p>
    </section>`,
    { scripts: CLIENT_SCRIPTS }
  );
}

module.exports = {
  escapeHtml,
  renderHome,
  renderEmailForm,
  renderCodeForm,
  renderPasskeyEnrollment,
  renderPasskeys,
};
