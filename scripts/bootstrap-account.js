'use strict';

// Offline bootstrap of the first account.
//
// Creates the account record of an authorized address and adopts the data that
// predates accounts (bucket-root keys, then the historical local files), so the
// application can be restarted with access control enabled and find its data
// already in place.
//
// Usage:
//   node scripts/bootstrap-account.js [email]
//
// The address defaults to the first entry of AUTHORIZED_EMAILS. The command is
// idempotent: running it again finds the account and nothing left to adopt.

// Same `.env` handling as the server, before anything reads the environment.
require('../env');

const accounts = require('../accounts');
const migration = require('../migration');
const storage = require('../storage');

function targetEmail() {
  const fromArgv = (process.argv[2] || '').trim();
  const fromEnv = String(process.env.AUTHORIZED_EMAILS || '')
    .split(',')[0]
    .trim();
  return accounts.normalizeEmail(fromArgv || fromEnv);
}

async function main() {
  const email = targetEmail();
  if (!email) {
    console.error(
      'Adresse manquante. Passez-la en argument ou renseignez AUTHORIZED_EMAILS.'
    );
    process.exit(1);
  }
  if (!storage.isConfigured()) {
    console.error(
      'S3 non configuré : renseignez S3_ENDPOINT, S3_BUCKET, AWS_ACCESS_KEY_ID et AWS_SECRET_ACCESS_KEY.'
    );
    process.exit(1);
  }

  await storage.ensureBucket();
  console.log(`Bucket « ${storage.bucket()} » prêt.`);

  const { account, created } = await accounts.ensureAccount(email);
  console.log(
    created
      ? `Compte créé : ${account.email} (userId ${account.userId})`
      : `Compte déjà présent : ${account.email} (userId ${account.userId})`
  );

  const summary = await migration.adoptLegacyData(account.userId);
  console.log(
    `Adoption : ${summary.domains} domaine(s), ${summary.archive} archive(s), ` +
      `palette ${summary.themes ? 'reprise' : 'absente'}, ` +
      `${summary.imported} fichier(s) local(aux) importé(s).`
  );
  console.log('Vous pouvez redémarrer l\u2019application et enrôler une passkey depuis la page d\u2019accueil.');
}

main().catch((err) => {
  console.error('Échec du bootstrap :', err.message);
  process.exit(1);
});
