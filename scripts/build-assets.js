#!/usr/bin/env node
'use strict';

// Minifie les assets statiques de l'image de release et inscrit dans le
// service worker la version de cache de la release.
//
// Appelé par l'étape `assets` du Dockerfile. `APP_VERSION` transporte le tag
// git qui a déclenché la release ; laissé vide (docker build local, exécution
// manuelle), le script minifie les fichiers sur place mais conserve la
// constante `CACHE_VERSION` du dépôt, dont dépend le développement local.
//
// Les noms de fichiers ne changent pas : `server.js`, `sw.js` et les pages les
// référencent par leur URL (`/app.js`, `/style.css`…).

const fs = require('fs');
const path = require('path');

// Les deux minifieurs sont des dépendances de build : un poste qui n'a pas
// lancé « pnpm install » doit obtenir une consigne claire, pas une trace Node.
function load(name) {
  try {
    return require(name);
  } catch (err) {
    console.error(`[build-assets] échec : module « ${name} » introuvable — lancez « pnpm install » avant de minifier.`);
    process.exit(1);
  }
}

const esbuild = load('esbuild');
const { transform: minifyCss } = load('lightningcss');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

// Fichiers réécrits sur place, sous le même nom et la même URL.
const MINIFIED_JS = ['app.js', 'auth.js', 'pwa.js'];
const MINIFIED_CSS = ['style.css'];

// Fichiers livrés tels quels : `htmx.min.js` et `simplewebauthn.js` sont déjà
// minifiés (et portent leur bandeau de licence), `sw.js` porte la version de
// cache que le contrôle après déploiement lit en clair, `offline.html` et le
// manifeste sont du contenu, pas du code à compresser.
const UNCHANGED = [
  'htmx.min.js',
  'simplewebauthn.js',
  'sw.js',
  'offline.html',
  'manifest.webmanifest',
];

const ICONS_DIR = 'icons';

function fail(message) {
  console.error(`[build-assets] échec : ${message}`);
  process.exit(1);
}

function read(file) {
  try {
    return fs.readFileSync(file);
  } catch (err) {
    fail(`fichier attendu illisible : ${path.relative(ROOT, file)} (${err.code})`);
  }
}

function kilobytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`;
}

function report(name, before, after) {
  const ratio = before > 0 ? Math.round((after / before) * 100) : 100;
  console.log(`[build-assets] ${name.padEnd(20)} ${kilobytes(before).padStart(10)} → ${kilobytes(after).padStart(10)} (${ratio} %)`);
}

function main() {
  // Un fichier manquant doit arrêter le build, pas produire une image partielle.
  for (const name of MINIFIED_JS) read(path.join(PUBLIC, name));
  for (const name of MINIFIED_CSS) read(path.join(PUBLIC, name));
  for (const name of UNCHANGED) read(path.join(PUBLIC, name));
  if (!fs.existsSync(path.join(PUBLIC, ICONS_DIR))) {
    fail(`répertoire attendu absent : public/${ICONS_DIR}`);
  }

  for (const name of MINIFIED_JS) {
    const file = path.join(PUBLIC, name);
    const source = read(file);
    const { code } = esbuild.transformSync(source, {
      loader: 'js',
      minify: true,
      charset: 'utf8',
    });
    const output = Buffer.from(code);
    if (output.length === 0) fail(`la minification de ${name} a produit un fichier vide`);
    fs.writeFileSync(file, output);
    report(name, source.length, output.length);
  }

  for (const name of MINIFIED_CSS) {
    const file = path.join(PUBLIC, name);
    const source = read(file);
    const { code } = minifyCss({ filename: file, code: source, minify: true });
    const output = Buffer.from(code);
    if (output.length === 0) fail(`la minification de ${name} a produit un fichier vide`);
    fs.writeFileSync(file, output);
    report(name, source.length, output.length);
  }

  for (const name of UNCHANGED) {
    console.log(`[build-assets] ${name.padEnd(20)} inchangé`);
  }

  const version = (process.env.APP_VERSION || '').trim();
  if (!version) {
    console.log('[build-assets] APP_VERSION vide : CACHE_VERSION du dépôt conservée (développement local)');
    return;
  }

  // Le tag finit dans une chaîne JavaScript et dans un nom de cache : il ne
  // peut contenir ni guillemet, ni antislash, ni saut de ligne.
  if (!/^[A-Za-z0-9._-]+$/.test(version)) {
    fail(`APP_VERSION invalide pour un nom de cache : « ${version} »`);
  }

  const swFile = path.join(PUBLIC, 'sw.js');
  const worker = read(swFile).toString('utf8');
  const declaration = /const CACHE_VERSION = '[^']*';/g;
  const found = worker.match(declaration);
  if (!found) fail('const CACHE_VERSION = \'…\'; introuvable dans public/sw.js');
  if (found.length !== 1) fail(`${found.length} occurrences de CACHE_VERSION dans public/sw.js, une seule attendue`);

  fs.writeFileSync(swFile, worker.replace(declaration, `const CACHE_VERSION = '${version}';`));
  console.log(`[build-assets] sw.js                CACHE_VERSION → '${version}'`);
}

try {
  main();
} catch (err) {
  fail(err && err.message ? err.message : String(err));
}
