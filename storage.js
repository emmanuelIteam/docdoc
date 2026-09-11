'use strict';

// S3-compatible object storage adapter.
//
// The app talks to a single S3-compatible endpoint chosen by configuration:
// Scaleway Object Storage in production (S3_ENDPOINT from the Terraform
// deployment) or a local MinIO instance in development. All data lives in the
// bucket; there is no filesystem store for the data layer.

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
  if (!isConfigured()) return null;
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
  if (!isConfigured()) return;
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
  if (!isConfigured()) return [];
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
// archiving a domain).
async function moveObject(srcKey, destKey) {
  if (!isConfigured()) return;
  await client().send(
    new CopyObjectCommand({
      Bucket: bucket(),
      CopySource: `${bucket()}/${srcKey}`,
      Key: destKey,
    })
  );
  await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: srcKey }));
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
};
