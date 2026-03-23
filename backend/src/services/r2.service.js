/**
 * Cloudflare R2 Service
 *
 * R2 is S3-compatible object storage with:
 *   - 10 GB free storage forever
 *   - Zero egress fees (unlike S3)
 *   - Global CDN via Cloudflare Workers / public bucket URL
 *
 * Used for three things in Properly:
 *   1. SQLite database backup/restore  — persists DB across deploys (free)
 *
 * Setup (5 minutes):
 *   1. dash.cloudflare.com → R2 → Create bucket → name it "properly"
 *   2. R2 → Manage R2 API tokens → Create token (Object Read & Write)
 *   3. Copy: Account ID, Access Key ID, Secret Access Key
 *   4. Add to Render env vars:
 *        R2_ACCOUNT_ID      = abc123...
 *        R2_ACCESS_KEY_ID   = abc123...
 *        R2_SECRET_KEY      = abc123...
 *        R2_BUCKET          = properly
 *        R2_PUBLIC_URL      = https://pub-xxxx.r2.dev  (optional — for public CDN URLs)
 */

import { S3Client, PutObjectCommand, GetObjectCommand,
         HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ── CLIENT FACTORY ────────────────────────────────────────────
let _client = null;

function getClient() {
  if (_client) return _client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretKey   = process.env.R2_SECRET_KEY;

  if (!accountId || !accessKeyId || !secretKey) return null;

  _client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey: secretKey },
  });

  return _client;
}

export function r2Available() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_KEY &&
    process.env.R2_BUCKET
  );
}

const BUCKET = () => process.env.R2_BUCKET || 'properly';
const PUBLIC_URL = () => process.env.R2_PUBLIC_URL || null;

// ── CORE OPERATIONS ───────────────────────────────────────────

/**
 * Upload a buffer or string to R2
 * @returns {string} the object key
 */
export async function r2Put(key, body, contentType = 'application/octet-stream', meta = {}) {
  const client = getClient();
  if (!client) throw new Error('R2 not configured');

  const buf = typeof body === 'string' ? Buffer.from(body, 'utf8') : body;

  await client.send(new PutObjectCommand({
    Bucket:      BUCKET(),
    Key:         key,
    Body:        buf,
    ContentType: contentType,
    Metadata:    meta,
    CacheControl: contentType.startsWith('audio/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  }));

  return key;
}

/**
 * Download an object from R2 as a Buffer
 */
export async function r2Get(key) {
  const client = getClient();
  if (!client) throw new Error('R2 not configured');

  const res = await client.send(new GetObjectCommand({ Bucket: BUCKET(), Key: key }));
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

/**
 * Check if a key exists in R2
 */
export async function r2Exists(key) {
  const client = getClient();
  if (!client) return false;
  try {
    await client.send(new HeadObjectCommand({ Bucket: BUCKET(), Key: key }));
    return true;
  } catch { return false; }
}

/**
 * Delete an object from R2
 */
export async function r2Delete(key) {
  const client = getClient();
  if (!client) return;
  await client.send(new DeleteObjectCommand({ Bucket: BUCKET(), Key: key }));
}

/**
 * Get a public CDN URL for an object (requires public bucket or custom domain)
 * Falls back to a signed URL valid for 1 hour
 */
export async function r2Url(key, expiresIn = 3600) {
  const pub = PUBLIC_URL();
  if (pub) return `${pub}/${key}`;

  const client = getClient();
  if (!client) return null;
  return getSignedUrl(client, new GetObjectCommand({ Bucket: BUCKET(), Key: key }), { expiresIn });
}

// ── DB BACKUP / RESTORE ───────────────────────────────────────
const DB_BACKUP_KEY = 'db/properly.db';

/**
 * Restore SQLite DB from R2 on startup.
 * If no backup exists yet, starts fresh (first deploy).
 */
export async function r2RestoreDb(localPath) {
  if (!r2Available()) return false;
  try {
    const exists = await r2Exists(DB_BACKUP_KEY);
    if (!exists) {
      console.log('📦 R2: no DB backup found — starting fresh');
      return false;
    }
    const buf = await r2Get(DB_BACKUP_KEY);
    const { writeFileSync, mkdirSync } = await import('fs');
    const { dirname } = await import('path');
    mkdirSync(dirname(localPath), { recursive: true });
    writeFileSync(localPath, buf);
    console.log(`✅ R2: DB restored from backup (${(buf.length / 1024).toFixed(0)} KB)`);
    return true;
  } catch (e) {
    console.warn('⚠️  R2: DB restore failed:', e.message);
    return false;
  }
}

/**
 * Backup the SQLite DB file to R2.
 * Called: (a) every 5 minutes, (b) on graceful shutdown.
 */
export async function r2BackupDb(localPath) {
  if (!r2Available()) return;
  try {
    const { readFileSync } = await import('fs');
    const buf = readFileSync(localPath);
    await r2Put(DB_BACKUP_KEY, buf, 'application/octet-stream', {
      'backup-ts': new Date().toISOString(),
      'size-bytes': String(buf.length),
    });
    console.log(`✅ R2: DB backed up (${(buf.length / 1024).toFixed(0)} KB)`);
  } catch (e) {
    console.warn('⚠️  R2: DB backup failed:', e.message);
  }
}


