/**
 * @file        database.js
 * @description SQLite database singleton with Cloudflare R2 backup/restore for persistence across Render deploys
 * @module      Database
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - WAL checkpoint (TRUNCATE) runs before every R2 upload to avoid stale main-file reads
 *   - backupNow() exported for immediate post-write persistence (e.g. registration)
 *   - Auto-detects storage mode: R2 > Render Disk > ephemeral /tmp
 */

import { DatabaseSync }                            from 'node:sqlite';
import { readFileSync, writeFileSync, mkdirSync }  from 'fs';
import { dirname, join }                           from 'path';
import { fileURLToPath }                           from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH   = process.env.DB_PATH || '/tmp/properly.db';

// Trim whitespace from env vars — Render dashboard can add invisible spaces on copy-paste
const _R2_ACCOUNT_ID    = (process.env.R2_ACCOUNT_ID    || '').trim();
const _R2_ACCESS_KEY_ID = (process.env.R2_ACCESS_KEY_ID || '').trim();
const _R2_SECRET_KEY    = (process.env.R2_SECRET_KEY    || '').trim();
const _R2_BUCKET        = (process.env.R2_BUCKET        || '').trim();

const USE_R2 = Boolean(_R2_ACCOUNT_ID && _R2_ACCESS_KEY_ID && _R2_SECRET_KEY && _R2_BUCKET);
const USE_DISK  = !USE_R2 && DB_PATH.startsWith('/data/');
export const dbStorageMode = USE_R2 ? 'r2' : USE_DISK ? 'render-disk' : 'ephemeral';

let _db          = null;
let _initPromise = null;
let _backupTimer = null;

// ── R2 CLIENT (lazy, singleton) ───────────────────────────────
let _s3 = null;
async function getS3() {
  if (_s3) return _s3;
  const { S3Client } = await import('@aws-sdk/client-s3');
  _s3 = new S3Client({
    region:   'auto',
    endpoint: `https://${_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     _R2_ACCESS_KEY_ID,
      secretAccessKey: _R2_SECRET_KEY,
    },
  });
  return _s3;
}

const R2_KEY    = 'db/properly.db';
const R2_BUCKET = () => _R2_BUCKET;

// ── R2 OPERATIONS ─────────────────────────────────────────────
async function r2Upload(buf) {
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const s3 = await getS3();
  await s3.send(new PutObjectCommand({
    Bucket:      R2_BUCKET(),
    Key:         R2_KEY,
    Body:        buf,
    ContentType: 'application/octet-stream',
    Metadata:    { ts: new Date().toISOString(), bytes: String(buf.length) },
  }));
}

async function r2Download() {
  const { GetObjectCommand, HeadObjectCommand } = await import('@aws-sdk/client-s3');
  const s3 = await getS3();

  // Check existence
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET(), Key: R2_KEY }));
  } catch (e) {
    if (e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404) return null;
    throw e; // re-throw unexpected errors
  }

  const res    = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET(), Key: R2_KEY }));
  const chunks = [];
  for await (const chunk of res.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// ── BACKUP (checkpoint WAL first) ─────────────────────────────
async function backup(reason = 'scheduled') {
  if (!USE_R2 || !_db) return;
  try {
    // Force all WAL writes into the main .db file before reading it
    _db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    const buf = readFileSync(DB_PATH);
    await r2Upload(buf);
    console.log(`✅ R2 backup [${reason}]: ${(buf.length / 1024).toFixed(1)} KB`);
  } catch (e) {
    console.error(`❌ R2 backup [${reason}] FAILED:`, e.message);
  }
}

// ── RESTORE (on startup) ──────────────────────────────────────
async function restore() {
  if (!USE_R2) return;
  console.log('🔄 R2: attempting DB restore…');
  try {
    const buf = await r2Download();
    if (!buf) {
      console.log('📦 R2: no backup found — fresh DB will be created and uploaded after init');
      return;
    }
    try { mkdirSync(dirname(DB_PATH), { recursive: true }); } catch {}
    writeFileSync(DB_PATH, buf);
    console.log(`✅ R2: restored ${(buf.length / 1024).toFixed(1)} KB → ${DB_PATH}`);
  } catch (e) {
    console.error('❌ R2 restore FAILED:', e.message);
    console.error('   Check R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_KEY, R2_BUCKET env vars');
    console.error('   Starting with empty DB — existing users will be missing until R2 is fixed');
  }
}

// ── MAIN INIT ─────────────────────────────────────────────────
async function initDb() {
  try { mkdirSync(dirname(DB_PATH), { recursive: true }); } catch {}

  if (dbStorageMode === 'ephemeral') {
    console.warn('⚠️  DB EPHEMERAL — users lost on every deploy!');
    console.warn('   → Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_KEY, R2_BUCKET in Render env');
  }

  // Always try to restore from R2 first
  await restore();

  // Open SQLite
  const db = new DatabaseSync(DB_PATH);

  // WAL mode with synchronous=FULL for durability, checkpoint aggressively
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA synchronous = FULL');
  db.exec('PRAGMA cache_size = -16000');
  db.exec('PRAGMA temp_store = MEMORY');
  db.exec('PRAGMA wal_autocheckpoint = 50'); // checkpoint every 50 pages (more frequent)

  // Transaction shim (matches better-sqlite3 API)
  db.transaction = (fn) => (...args) => {
    db.exec('BEGIN');
    try   { const r = fn(...args); db.exec('COMMIT');   return r; }
    catch (e) { try { db.exec('ROLLBACK'); } catch {} throw e; }
  };

  // Schema + migrations
  db.exec(readFileSync(join(__dirname, 'schema.sql'), 'utf8'));
  migrate(db);

  if (USE_R2) {
    // Backup every 60 seconds
    _backupTimer = setInterval(() => backup('60s'), 60_000);

    // Shutdown hooks
    const shutdown = async (sig) => {
      console.log(`\n[${sig}] Final DB backup before shutdown…`);
      clearInterval(_backupTimer);
      await backup('shutdown');
      process.exit(0);
    };
    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT',  () => shutdown('SIGINT'));

    // Upload baseline after 3s (ensures R2 has something even on first deploy)
    setTimeout(() => backup('init'), 3000);
  }

  console.log(`✅ DB ready [${dbStorageMode}] — ${DB_PATH}`);
  return db;
}

// ── MIGRATIONS ────────────────────────────────────────────────
function migrate(db) {
  const cols = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map(r => r.name);

  const uc = cols('users');
  if (!uc.includes('is_admin'))       { db.exec('ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0'); }
  if (!uc.includes('email_verified')) {
    db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0');
    db.exec('ALTER TABLE users ADD COLUMN verify_token TEXT');
    db.exec('ALTER TABLE users ADD COLUMN verify_expires DATETIME');
    db.exec('ALTER TABLE users ADD COLUMN verify_sent_at DATETIME');
  }
  if (!uc.includes('oauth_provider')) {
    db.exec('ALTER TABLE users ADD COLUMN oauth_provider TEXT');
    db.exec('ALTER TABLE users ADD COLUMN oauth_id TEXT');
    db.exec('ALTER TABLE users ADD COLUMN oauth_name TEXT');
    db.exec('ALTER TABLE users ADD COLUMN oauth_avatar TEXT');
  }

  db.exec(`CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'free', status TEXT NOT NULL DEFAULT 'active',
    stripe_customer_id TEXT UNIQUE, stripe_sub_id TEXT UNIQUE, stripe_price_id TEXT,
    current_period_end DATETIME, cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
    trial_end DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  const rc = cols('reading_sessions');
  if (!rc.includes('story_type'))
    db.exec("ALTER TABLE reading_sessions ADD COLUMN story_type TEXT NOT NULL DEFAULT 'static'");

  const cc = cols('completed_stories');
  if (!cc.includes('story_type'))
    db.exec("ALTER TABLE completed_stories ADD COLUMN story_type TEXT NOT NULL DEFAULT 'static'");

  const ac = cols('ai_stories');
  if (!ac.includes('batch_id')) {
    for (const c of [
      "batch_id TEXT","child_name TEXT NOT NULL DEFAULT ''","child_age INTEGER",
      "child_gender TEXT DEFAULT 'neutral'","child_interests TEXT NOT NULL DEFAULT '[]'",
      "struggled_words TEXT NOT NULL DEFAULT '[]'","status TEXT NOT NULL DEFAULT 'unread'",
      "best_accuracy REAL DEFAULT 0","times_read INTEGER NOT NULL DEFAULT 0",
      "last_read_at DATETIME","completed_at DATETIME",
    ]) db.exec(`ALTER TABLE ai_stories ADD COLUMN ${c}`);
  }

  const pc = cols('ai_story_pages');
  if (!pc.includes('best_accuracy')) {
    for (const c of ['best_accuracy REAL DEFAULT NULL','attempts INTEGER NOT NULL DEFAULT 0',
      'last_spoken TEXT','last_word_scores TEXT','completed_at DATETIME'])
      db.exec(`ALTER TABLE ai_story_pages ADD COLUMN ${c}`);
  }

  const chc = cols('children');
  if (!chc.includes('age')) {
    db.exec('ALTER TABLE children ADD COLUMN age INTEGER');
    db.exec("ALTER TABLE children ADD COLUMN gender TEXT DEFAULT 'neutral'");
  }

  db.exec(`CREATE TABLE IF NOT EXISTS ai_story_sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    ai_story_id TEXT NOT NULL REFERENCES ai_stories(id) ON DELETE CASCADE,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP, completed_at DATETIME,
    pages_read INTEGER NOT NULL DEFAULT 0, total_pages INTEGER NOT NULL DEFAULT 3,
    accuracy REAL, acorns_earned INTEGER DEFAULT 0
  )`);

  // App settings table (debug flags, feature toggles)
  db.exec(`CREATE TABLE IF NOT EXISTS app_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Detect if story pages need expanding (old 3-page stories → new 5-6 page stories)
  // This fires once on existing deployments and is a no-op after the first run
  try {
    const pageCountRow = db.prepare("SELECT COUNT(*) as n FROM story_pages").get();
    const storyCountRow = db.prepare("SELECT COUNT(*) as n FROM stories").get();
    const EXPECTED_MIN_PAGES = storyCountRow.n * 4;  // at least 4 pages per story
    if (storyCountRow.n > 0 && pageCountRow.n < EXPECTED_MIN_PAGES) {
      console.log(`[Migration] Expanding story pages: found ${pageCountRow.n} pages for ${storyCountRow.n} stories — reseeding pages…`);
      // Dynamic import to avoid circular dep at module load time
      import('../db/seed.js').then(mod => {
        if (mod.seedDatabase) mod.seedDatabase(db);
      }).catch(e => console.warn('[Migration] Reseed failed:', e.message));
    }
  } catch {}

  db.exec(`CREATE TABLE IF NOT EXISTS ai_story_batches (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    requested_count INTEGER NOT NULL DEFAULT 5, generated_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending', themes_used TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, completed_at DATETIME
  )`);


  // ── BOOK FEATURE MIGRATION ────────────────────────────────
  db.exec(`CREATE TABLE IF NOT EXISTS book_credits (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credits INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS story_books (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    ai_story_id TEXT NOT NULL REFERENCES ai_stories(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    pdf_r2_key TEXT, cover_r2_key TEXT, page_count INTEGER DEFAULT 0,
    print_ordered INTEGER NOT NULL DEFAULT 0, print_address TEXT, error_msg TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS story_book_pages (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    book_id TEXT NOT NULL REFERENCES story_books(id) ON DELETE CASCADE,
    page_num INTEGER NOT NULL, text TEXT NOT NULL DEFAULT '',
    image_prompt TEXT NOT NULL DEFAULT '', image_r2_key TEXT, image_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS book_credit_transactions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delta INTEGER NOT NULL, reason TEXT NOT NULL, admin_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);


  // Content reports table
  db.exec(`CREATE TABLE IF NOT EXISTS content_reports (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    child_id TEXT REFERENCES children(id) ON DELETE SET NULL,
    content_type TEXT NOT NULL, content_id TEXT NOT NULL, content_title TEXT,
    reason TEXT NOT NULL, detail TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_note TEXT, credits_awarded INTEGER DEFAULT 0, credit_type TEXT,
    reviewed_by TEXT REFERENCES users(id), reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);


  // Book generation debug logging columns
  try { db.exec(`ALTER TABLE story_books ADD COLUMN generation_log TEXT`); } catch {}
  try { db.exec(`ALTER TABLE story_books ADD COLUMN generation_progress TEXT`); } catch {}


  // Book generation debug logs
  db.exec(`CREATE TABLE IF NOT EXISTS book_generation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id TEXT NOT NULL,
    step TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ok',
    detail TEXT,
    duration_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Clean up duplicate story_pages rows (from old INSERT OR REPLACE bug)
  // Keep only the row with the LOWEST id for each (story_id, page_index) pair
  try {
    const dupeCount = db.prepare(`
      SELECT COUNT(*) as n FROM story_pages sp
      WHERE id != (
        SELECT MIN(id) FROM story_pages
        WHERE story_id = sp.story_id AND page_index = sp.page_index
      )
    `).get().n;
    if (dupeCount > 0) {
      db.exec(`
        DELETE FROM story_pages
        WHERE id NOT IN (
          SELECT MIN(id) FROM story_pages
          GROUP BY story_id, page_index
        )
      `);
      console.log(`✅ Migration: removed \${dupeCount} duplicate story_pages rows`);
    }
  } catch (e) {
    console.warn('[Migration] Dupe cleanup failed:', e.message);
  }

  console.log('✅ Migrations complete');
}

// ── PUBLIC API ────────────────────────────────────────────────
export async function initDatabase() {
  if (_db) return _db;
  if (!_initPromise) _initPromise = initDb();
  _db = await _initPromise;
  return _db;
}

export function getDb() {
  if (!_db) throw new Error('DB not ready — await initDatabase() first');
  return _db;
}

/** Call after critical writes (registration, plan change) to avoid data loss */
export const backupNow = () => backup('immediate');

export default getDb;
