'use strict';

// Progressive enhancement for installing docdoc and keeping it up to date.
//
// Loaded by both HTML shells. Without it the application works exactly as
// before: the install control is rendered `hidden` by the server and nothing
// here is required for navigation, forms or htmx.
//
// Three concerns live together because they all depend on the service worker
// registration and the install events:
//   1. register /sw.js (scope /) in a secure context;
//   2. drive the install control: native prompt when the browser offers one,
//      iOS instructions otherwise, nothing when the browser can do neither;
//   3. offer a reload when a new worker takes control, never impose it.

(function () {
  const installButton = document.getElementById('install-btn');
  const installHint = document.getElementById('install-hint');

  function isStandalone() {
    try {
      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        navigator.standalone === true
      );
    } catch {
      return false;
    }
  }

  // iPadOS reports a Macintosh platform; the touch point count is what tells it
  // apart from a desktop Safari, where installation does not exist either way.
  const isIos =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function showInstallControl() {
    if (!installButton || isStandalone()) return;
    installButton.hidden = false;
  }

  function hideInstallControl() {
    if (installButton) installButton.hidden = true;
    if (installHint) installHint.hidden = true;
  }

  /* ---------------------------------------------------------------- */
  /* 1. Service worker registration                                    */
  /* ---------------------------------------------------------------- */

  if ('serviceWorker' in navigator && window.isSecureContext) {
    // Captured before registering: a first installation also fires
    // `controllerchange`, and that must not look like an update.
    let hadController = Boolean(navigator.serviceWorker.controller);

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) {
        hadController = true;
        return;
      }
      showUpdateNotice();
    });

    try {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
        // Offline support is a bonus: a failed registration must leave the
        // application untouched.
        console.warn('[docdoc] service worker non enregistré :', err.message);
      });
    } catch (err) {
      console.warn('[docdoc] service worker indisponible :', err.message);
    }
  }

  /* ---------------------------------------------------------------- */
  /* 2. Install control                                                */
  /* ---------------------------------------------------------------- */

  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (event) => {
    // Keep the browser's mini-infobar out of the way; the sidebar control is
    // the single entry point.
    event.preventDefault();
    deferredPrompt = event;
    showInstallControl();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallControl();
  });

  if (installButton) {
    installButton.addEventListener('click', async () => {
      if (deferredPrompt) {
        const promptEvent = deferredPrompt;
        // A captured event can be used once; a dismissal leaves the button
        // visible so the user can try again on a later visit.
        deferredPrompt = null;
        try {
          promptEvent.prompt();
          const choice = await promptEvent.userChoice;
          if (choice && choice.outcome === 'accepted') hideInstallControl();
        } catch (err) {
          console.warn('[docdoc] invite d\u2019installation :', err.message);
        }
        return;
      }

      // No native prompt: only iOS Safari has a manual path.
      if (installHint) installHint.hidden = false;
    });
  }

  // iOS never fires `beforeinstallprompt`; show the control so it can reveal
  // the Share-menu instructions. Everywhere else the control stays hidden
  // until the browser actually offers an installation.
  if (!('onbeforeinstallprompt' in window) && isIos && !isStandalone()) {
    showInstallControl();
  }

  /* ---------------------------------------------------------------- */
  /* 3. Update notice                                                  */
  /* ---------------------------------------------------------------- */

  let updateNotice = null;

  function showUpdateNotice() {
    if (updateNotice || !document.body) return;

    const notice = document.createElement('div');
    notice.className = 'pwa-update';
    notice.setAttribute('role', 'status');

    const text = document.createElement('span');
    text.textContent = 'Nouvelle version disponible.';

    const reload = document.createElement('button');
    reload.type = 'button';
    reload.className = 'btn';
    reload.textContent = 'Recharger';
    reload.addEventListener('click', () => window.location.reload());

    notice.append(text, reload);
    document.body.appendChild(notice);
    updateNotice = notice;
  }
})();
