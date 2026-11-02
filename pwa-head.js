'use strict';

// Installability metadata shared by the two HTML shells.
//
// `renderShell` (server.js) renders the authenticated application and
// `authShell` (authpages.js) renders the access pages. They are two distinct
// templates but every document must point at the same manifest with the same
// icon and theme metadata, so the tags live here rather than being duplicated:
// a change made once cannot be forgotten in the other shell.
//
// Keep this in sync with public/manifest.webmanifest: the theme color and the
// icon paths are the same contract.

const THEME_COLOR = '#2563eb';

function installabilityHead() {
  return [
    `<meta name="theme-color" content="${THEME_COLOR}">`,
    '<link rel="manifest" href="/manifest.webmanifest">',
    '<link rel="icon" href="/icons/favicon-32.png" sizes="32x32" type="image/png">',
    '<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-title" content="docdoc">',
  ].join('\n  ');
}

module.exports = { installabilityHead, THEME_COLOR };
