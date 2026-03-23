/**
 * Database — SQLite with Cloudflare R2 backup/restore
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │  OPTION A — Cloudflare R2  (FREE — recommended)              │
 * │  • 10 GB free, zero egress fees                              │
 * │  • DB backed up to R2 every 5 min + on graceful shutdown     │
 * │  • Restored from R2 on every startup                         │
 * │  • Setup: see R2_ACCOUNT_ID / R2_ACCESS_KEY_ID in .env       │
 * ├──────────────────────────────────────────────────────────────┤
 * │  OPTION B — Render Disk  ($7/mo Starter plan)                │
 * │  • Uncomment disk: block in render.yaml                      │
 * │  • Set DB_PATH=/data/properly.db                             │
 * └──────────────────────────────────────────────────────────────┘
 *
 * Auto-detection order:
 *   1. R2_ACCOUNT_ID set  → R2 backup/restore
 *   2. DB_PATH = /data/…  → Render Disk (persistent local file)
 *   3. fallback           → /tmp  (ephemeral — warns on startup)
 */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── STORAGE MODE DETECTION ────────────────────────────────────
const DB_PATH = process.env.DB_PATH || '/tmp/properly.db';

const USE_R2   = Boolean(
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_KEY &&
  process.env.R2_BUCKET
);
const USE_DISK = !USE_R2 && DB_PATH.startsWith('/data/');
const STORAGE  = USE_R2 ? 'r2' : USE_DISK ? 'render-disk' : 'ephemeral';

// ── SINGLETON ─────────────────────────────────────────────────
let _db          = null;
let _initPromise = null;
let _backupTimer = null;

// ── STARTUP: RESTORE FROM R2 ──────────────────────────────────
async function restoreFromR2(localPath) {
  const { r2RestoreDb } = await import('../services/r2.service.js');
  return r2RestoreDb(localPath);
}

// ── PERIODIC BACKUP TO R2 ─────────────────────────────────────
function scheduleR2Backup(localPath) {
  if (_backupTimer) clearInterval(_backupTimer);
  // Backup every 5 minutes
  _backupTimer = setInterval(async () => {
    const { r2BackupDb } = await import('../services/r2.service.js');
    await r2BackupDb(localPath);
  }, 5 * 60 * 1000);

  // Also backup on graceful shutdown
  const shutdown = async (sig) => {
    console.log(`\n[${sig}] Backing up DB before shutdown...`);
    const { r2BackupDb } = await import('../services/r2.service.js');
    await r2BackupDb(localPath);
    process.exit(0);
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT',  () => shutdown('SIGINT'));
}

// ── MAIN INIT ─────────────────────────────────────────────────
async function initDb() {
  let dbPath = DB_PATH;

  if (STORAGE === 'ephemeral') {
    console.warn('⚠️  DB is EPHEMERAL — data lost on redeploy!');
    console.warn('   Fix: set R2_ACCOUNT_ID + R2_ACCESS_KEY_ID + R2_SECRET_KEY + R2_BUCKET');
    console.warn('   Free: dash.cloudflare.com → R2 → Create bucket');
  }

  if (USE_R2) {
    // Ensure local directory exists
    try { mkdirSync(dirname(dbPath), { recursive: true }); } catch {}
    // Restore DB from R2 if a backup exists
    await restoreFromR2(dbPath);
    console.log(`✅ DB: R2-backed SQLite → ${dbPath}`);
  } else if (USE_DISK) {
    try { mkdirSync(dirname(dbPath), { recursive: true }); } catch {}
    console.log(`✅ DB: Render Disk → ${dbPath}`);
  } else {
    try { mkdirSync(dirname(dbPath), { recursive: true }); } catch {}
  }

  // Open SQLite
  const db = new DatabaseSync(dbPath);

  // Performance pragmas
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA cache_size = -32000');
  db.exec('PRAGMA temp_store = MEMORY');

  // Transaction shim (better-sqlite3 compatible API)
  db.transaction = (fn) => (...args) => {
    db.exec('BEGIN');
    try   { const r = fn(...args); db.exec('COMMIT');   return r; }
    catch (e) { try { db.exec('ROLLBACK'); } catch {} throw e; }
  };

  // Schema
  db.exec(readFileSync(join(__dirname, 'schema.sql'), 'utf8'));

  // Migrations
  migrate(db);

  // Schedule R2 backups after first write
  if (USE_R2) scheduleR2Backup(dbPath);

  // Do an immediate backup after init so the first deploy creates a baseline
  if (USE_R2) {
    const { r2BackupDb } = await import('../services/r2.service.js');
    r2BackupDb(dbPath).catch(() => {});  // non-blocking
  }

  console.log(`✅ DB ready (${STORAGE})`);
  return db;
}

// ── MIGRATIONS ────────────────────────────────────────────────
function migrate(db) {
  const userCols = db.prepare('PRAGMA table_info(users)').all().map(r => r.name);

  if (!userCols.includes('email_verified')) {
    db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0");
    db.exec("ALTER TABLE users ADD COLUMN verify_token TEXT");
    db.exec("ALTER TABLE users ADD COLUMN verify_expires DATETIME");
    db.exec("ALTER TABLE users ADD COLUMN verify_sent_at DATETIME");
    console.log('✅ Migration: email verification columns');
  }
  if (!userCols.includes('oauth_provider')) {
    db.exec("ALTER TABLE users ADD COLUMN oauth_provider TEXT");
    db.exec("ALTER TABLE users ADD COLUMN oauth_id TEXT");
    db.exec("ALTER TABLE users ADD COLUMN oauth_name TEXT");
    db.exec("ALTER TABLE users ADD COLUMN oauth_avatar TEXT");
    console.log('✅ Migration: OAuth columns');
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

  const rsCols = db.prepare('PRAGMA table_info(reading_sessions)').all().map(r => r.name);
  if (!rsCols.includes('story_type'))
    db.exec("ALTER TABLE reading_sessions ADD COLUMN story_type TEXT NOT NULL DEFAULT 'static'");

  const csCols = db.prepare('PRAGMA table_info(completed_stories)').all().map(r => r.name);
  if (!csCols.includes('story_type'))
    db.exec("ALTER TABLE completed_stories ADD COLUMN story_type TEXT NOT NULL DEFAULT 'static'");

  const aiCols = db.prepare('PRAGMA table_info(ai_stories)').all().map(r => r.name);
  if (!aiCols.includes('batch_id')) {
    for (const col of [
      "batch_id TEXT", "child_name TEXT NOT NULL DEFAULT ''", "child_age INTEGER",
      "child_gender TEXT DEFAULT 'neutral'", "child_interests TEXT NOT NULL DEFAULT '[]'",
      "struggled_words TEXT NOT NULL DEFAULT '[]'", "status TEXT NOT NULL DEFAULT 'unread'",
      "best_accuracy REAL DEFAULT 0", "times_read INTEGER NOT NULL DEFAULT 0",
      "last_read_at DATETIME", "completed_at DATETIME",
    ]) db.exec(`ALTER TABLE ai_stories ADD COLUMN ${col}`);
    console.log('✅ Migration: ai_stories progress columns');
  }

  const aiPgCols = db.prepare('PRAGMA table_info(ai_story_pages)').all().map(r => r.name);
  if (!aiPgCols.includes('best_accuracy')) {
    for (const col of [
      'best_accuracy REAL DEFAULT NULL', 'attempts INTEGER NOT NULL DEFAULT 0',
      'last_spoken TEXT', 'last_word_scores TEXT', 'completed_at DATETIME',
    ]) db.exec(`ALTER TABLE ai_story_pages ADD COLUMN ${col}`);
    console.log('✅ Migration: ai_story_pages progress columns');
  }

  const childCols = db.prepare('PRAGMA table_info(children)').all().map(r => r.name);
  if (!childCols.includes('age')) {
    db.exec('ALTER TABLE children ADD COLUMN age INTEGER');
    db.exec("ALTER TABLE children ADD COLUMN gender TEXT DEFAULT 'neutral'");
    console.log('✅ Migration: children age+gender');
  }

  db.exec(`CREATE TABLE IF NOT EXISTS ai_story_sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    ai_story_id TEXT NOT NULL REFERENCES ai_stories(id) ON DELETE CASCADE,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP, completed_at DATETIME,
    pages_read INTEGER NOT NULL DEFAULT 0, total_pages INTEGER NOT NULL DEFAULT 3,
    accuracy REAL, acorns_earned INTEGER DEFAULT 0
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS ai_story_batches (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    requested_count INTEGER NOT NULL DEFAULT 5, generated_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending', themes_used TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, completed_at DATETIME
  )`);
}

// ── PUBLIC API ────────────────────────────────────────────────
export async function initDatabase() {
  if (_db) return _db;
  if (!_initPromise) _initPromise = initDb();
  _db = await _initPromise;
  return _db;
}

export function getDb() {
  if (!_db) throw new Error('DB not ready — call initDatabase() at startup first');
  return _db;
}

export { STORAGE as dbStorageMode };
export default getDb;
