/* Passkey ceremonies for the access pages.
   The two buttons (sign in, register a passkey) call the server for ceremony
   options, hand them to the browser API, and post the response back for
   verification. Nothing is decided on the client. */

'use strict';

const passkeyLib = window.SimpleWebAuthnBrowser;
const authStatusEl = document.getElementById('auth-status');

function setStatus(message, kind) {
  if (!authStatusEl) return;
  authStatusEl.textContent = message || '';
  authStatusEl.className = 'auth-note' + (kind ? ' ' + kind : '');
}

async function authApi(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const err = new Error((data && data.error) || 'Erreur inattendue');
    err.cause = data;
    throw err;
  }
  return data || {};
}

// A browser without WebAuthn must be told, not left with a dead button.
function unsupported() {
  if (!window.PublicKeyCredential || !passkeyLib) {
    setStatus("Ce navigateur ne gère pas les passkeys. Utilisez un navigateur récent.", 'error');
    return true;
  }
  return false;
}

// Turn a DOMException from the ceremony into a sentence a human can act on.
function explain(error) {
  const name = error && error.name;
  if (name === 'NotAllowedError' || name === 'AbortError') {
    return "Opération annulée, ou délai dépassé. Réessayez.";
  }
  if (name === 'InvalidStateError') {
    return "Cette passkey est déjà enregistrée sur cet appareil : utilisez « Se connecter ».";
  }
  if (name === 'SecurityError') {
    return "Origine non sécurisée : les passkeys exigent HTTPS (ou localhost).";
  }
  return (error && error.message) || "L'opération a échoué.";
}

async function registerPasskey() {
  if (unsupported()) return;
  setStatus('Suivez les instructions de votre appareil…');
  try {
    const options = await authApi('/auth/passkey/register/options');
    const attestation = await passkeyLib.startRegistration({ optionsJSON: options });
    const result = await authApi('/auth/passkey/register/verify', attestation);
    window.location.href = result.redirect || '/';
  } catch (error) {
    setStatus(explain(error), 'error');
  }
}

async function signIn() {
  if (unsupported()) return;
  setStatus('Choisissez votre passkey…');
  try {
    const options = await authApi('/auth/passkey/login/options');
    const assertion = await passkeyLib.startAuthentication({ optionsJSON: options });
    const result = await authApi('/auth/passkey/login/verify', assertion);
    window.location.href = result.redirect || '/';
  } catch (error) {
    setStatus(explain(error), 'error');
  }
}

const registerBtn = document.getElementById('register-passkey-btn');
if (registerBtn) registerBtn.addEventListener('click', registerPasskey);

const signInBtn = document.getElementById('signin-btn');
if (signInBtn) signInBtn.addEventListener('click', signIn);
