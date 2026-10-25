'use strict';

// S3-compatible object storage adapter.
//
// The app talks to a single S3-compatible endpoint chosen by configuration:
// Scaleway Object Storage in production (S3_ENDPOINT from the Terraform
// deployment) or a local MinIO instance in development. All data lives in the
// bucket; there is no filesystem store for the data layer.
//
// Every operation is addressed by an explicit key or prefix, and the key
// builders below are the single place that decides where an account's data
// lives: everything a user owns sits under `users/{userId}/`, so a listing or a
// move can never reach another account's objects. The bucket-root keys
// (`domains/`, `archive/`, `themes.json`) are the legacy single-tenant layout,
// read only by the one-time adoption.

const {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');

function config() {
  return {
    endpoint: process.env.S3_ENDPOINT || '',
    region: process.env.S3_REGION || 'fr-par',
    bucket: process.env.S3_BUCKET || '',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  };
}

function isConfigured() {
  const c = config();
  return Boolean(c.endpoint && c.bucket && c.accessKeyId && c.secretAccessKey);
}

function bucket() {
  return config().bucket;
}

/* ------------------------------------------------------------------ */
/* Key layout                                                          */
/* ------------------------------------------------------------------ */

const USERS_PREFIX = 'users/';

// The keys written before accounts existed. They are only ever read by the
// one-time adoption that moves them into the first account's space.
const LEGACY_KEYS = {
  domainsPrefix: 'domains/',
  archivePrefix: 'archive/',
  themesKey: 'themes.json',
};

function userPrefix(userId) {
  return `${USERS_PREFIX}${userId}/`;
}

function userKey(userId, suffix) {
  return userPrefix(userId) + suffix;
}

function domainKey(userId, id) {
  return userKey(userId, `domains/${id}.json`);
}

function archiveKey(userId, id) {
  return userKey(userId, `archive/${id}.json`);
}

function themesKey(userId) {
  return userKey(userId, 'themes.json');
}

function accountKey(userId) {
  return userKey(userId, 'account.json');
}

// The domain keys of one account: listing is confined to the account's own
// prefix, so another account's objects can never appear in the result.
function listDomainKeys(userId) {
  return listKeys(userKey(userId, 'domains/'));
}

// The archived domain keys of one account, confined to its own archive prefix
// exactly like the active domains: an archive listing can never reach another
// account's objects.
function listArchiveKeys(userId) {
  return listKeys(userKey(userId, 'archive/'));
}

let clientInstance = null;
function client() {
  if (!clientInstance) {
    const c = config();
    clientInstance = new S3Client({
      // Path-style addressing works across Scaleway Object Storage and MinIO.
      endpoint: c.endpoint,
      region: c.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: c.accessKeyId,
        secretAccessKey: c.secretAccessKey,
      },
    });
  }
  return clientInstance;
}

// In-memory stand-in used when no bucket is configured (a local run without
// S3/MinIO). The whole application then works against this map: it is what the
// startup warning means by "les données restent en mémoire". Nothing survives a
// restart, and there is exactly one such store, shared by every caller.
const memoryStore = new Map();

// Create the bucket if it does not already exist. A safe no-op when it exists,
// and a no-op when S3 is not configured (local run without a bucket).
async function ensureBucket() {
  if (!isConfigured()) return false;
  try {
    await client().send(new HeadBucketCommand({ Bucket: bucket() }));
  } catch {
    await client().send(new CreateBucketCommand({ Bucket: bucket() }));
  }
  return true;
}

// Read and parse a JSON object. Returns null when the object is missing or
// cannot be parsed.
async function readJson(key) {
  if (!isConfigured()) {
    const raw = memoryStore.get(key);
    if (raw === undefined) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  try {
    const res = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    const body = await res.Body.transformToString();
    return JSON.parse(body);
  } catch {
    return null;
  }
}

// Write an object as JSON with a single atomic PUT.
async function writeJson(key, data) {
  if (!isConfigured()) {
    memoryStore.set(key, JSON.stringify(data, null, 2));
    return;
  }
  await client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json',
    })
  );
}

// List the object keys under a prefix (paginated).
async function listKeys(prefix) {
  if (!isConfigured()) {
    return [...memoryStore.keys()].filter((key) => key.startsWith(prefix)).sort();
  }
  const keys = [];
  let continuationToken;
  do {
    const res = await client().send(
      new ListObjectsV2Command({
        Bucket: bucket(),
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    for (const obj of res.Contents || []) keys.push(obj.Key);
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

// Move an object: copy to the destination then delete the source (used for
// archiving a domain, and for adopting the legacy bucket-root layout).
async function moveObject(srcKey, destKey) {
  if (!isConfigured()) {
    const raw = memoryStore.get(srcKey);
    if (raw === undefined) return;
    memoryStore.set(destKey, raw);
    memoryStore.delete(srcKey);
    return;
  }
  await client().send(
    new CopyObjectCommand({
      Bucket: bucket(),
      CopySource: `${bucket()}/${srcKey}`,
      Key: destKey,
    })
  );
  await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: srcKey }));
}

// Delete a single object (used when a passkey is revoked, so its index entry
// stops resolving to the account).
async function deleteObject(key) {
  if (!isConfigured()) {
    memoryStore.delete(key);
    return;
  }
  await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

module.exports = {
  config,
  isConfigured,
  bucket,
  ensureBucket,
  readJson,
  writeJson,
  listKeys,
  moveObject,
  deleteObject,
  // Key layout
  USERS_PREFIX,
  LEGACY_KEYS,
  userPrefix,
  userKey,
  domainKey,
  archiveKey,
  themesKey,
  accountKey,
  listDomainKeys,
  listArchiveKeys,
};
