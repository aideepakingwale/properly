/**
 * Database — uses Node.js built-in SQLite (node:sqlite)
 *
 * Requires Node.js v22.5+ (Node 24 is fine).
 * Zero native compilation — works on Windows, Mac, Linux with no build tools.
 *
 * API is identical to better-sqlite3:
 *   db.prepare(sql).run(...args)
 *   db.prepare(sql).get(...args)   → one row or undefined
 *   db.prepare(sql).all(...args)   → array of rows
 *   db.transaction(fn)()           → atomic transaction (shim added below)
 *   db.exec(sql)                   → run raw SQL
 */

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DB_PATH = process.env.DB_PATH || './data/properly.db';

// Ensure parent directory exists
try { mkdirSync(dirname(DB_PATH), { recursive: true }); } catch {}

let _db = null;

export function getDb() {
  if (_db) return _db;

  _db = new DatabaseSync(DB_PATH);

  // Performance settings (via exec — node:sqlite has no .pragma() helper)
  _db.exec("PRAGMA journal_mode = WAL");
  _db.exec("PRAGMA foreign_keys = ON");
  _db.exec("PRAGMA synchronous = NORMAL");
  _db.exec("PRAGMA cache_size = -32000");
  _db.exec("PRAGMA temp_store = MEMORY");

  // Add .transaction() shim so all existing controller code works unchanged
  // better-sqlite3 API: const doWork = db.transaction(fn); doWork(args)
  _db.transaction = (fn) => (...args) => {
    _db.exec('BEGIN');
    try {
      const result = fn(...args);
      _db.exec('COMMIT');
      return result;
    } catch (e) {
      try { _db.exec('ROLLBACK'); } catch {}
      throw e;
    }
  };

  // Run schema (CREATE TABLE IF NOT EXISTS — safe to run every startup)
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  _db.exec(schema);

  // ── SAFE MIGRATIONS (for existing databases) ─────────────
  // OAuth columns (social login)
  // These are no-ops on fresh DBs (columns already in schema)
  // On existing DBs they add the new columns without data loss
  const cols = _db.prepare("PRAGMA table_info(users)").all().map(r => r.name);
  if (!cols.includes('email_verified')) {
    _db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0");
    _db.exec("ALTER TABLE users ADD COLUMN verify_token TEXT");
    _db.exec("ALTER TABLE users ADD COLUMN verify_expires DATETIME");
    _db.exec("ALTER TABLE users ADD COLUMN verify_sent_at DATETIME");
    console.log('✅ Migration: email verification columns added');
  }
  // Ensure subscriptions table exists for existing DBs
  _db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      plan TEXT NOT NULL DEFAULT 'free',
      status TEXT NOT NULL DEFAULT 'active',
      stripe_customer_id TEXT UNIQUE,
      stripe_sub_id TEXT UNIQUE,
      stripe_price_id TEXT,
      current_period_end DATETIME,
      cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
      trial_end DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── Migrate reading_sessions and completed_stories story_type column ──────────
  const rsCols = _db.prepare("PRAGMA table_info(reading_sessions)").all().map(r => r.name);
  if (!rsCols.includes('story_type')) {
    _db.exec("ALTER TABLE reading_sessions ADD COLUMN story_type TEXT NOT NULL DEFAULT 'static'");
    console.log('✅ Migration: reading_sessions.story_type added');
  }
  const csCols = _db.prepare("PRAGMA table_info(completed_stories)").all().map(r => r.name);
  if (!csCols.includes('story_type')) {
    _db.exec("ALTER TABLE completed_stories ADD COLUMN story_type TEXT NOT NULL DEFAULT 'static'");
    console.log('✅ Migration: completed_stories.story_type added');
  }

  // ── Migrate ai_stories progress columns ─────────────────────────────────────
  const aiCols = _db.prepare("PRAGMA table_info(ai_stories)").all().map(r => r.name);
  if (!aiCols.includes('batch_id')) {
    _db.exec("ALTER TABLE ai_stories ADD COLUMN batch_id TEXT");
    _db.exec("ALTER TABLE ai_stories ADD COLUMN child_name TEXT NOT NULL DEFAULT ''");
    _db.exec("ALTER TABLE ai_stories ADD COLUMN child_age INTEGER");
    _db.exec("ALTER TABLE ai_stories ADD COLUMN child_gender TEXT DEFAULT 'neutral'");
    _db.exec("ALTER TABLE ai_stories ADD COLUMN child_interests TEXT NOT NULL DEFAULT '[]'");
    _db.exec("ALTER TABLE ai_stories ADD COLUMN struggled_words TEXT NOT NULL DEFAULT '[]'");
    _db.exec("ALTER TABLE ai_stories ADD COLUMN status TEXT NOT NULL DEFAULT 'unread'");
    _db.exec("ALTER TABLE ai_stories ADD COLUMN best_accuracy REAL DEFAULT 0");
    _db.exec("ALTER TABLE ai_stories ADD COLUMN times_read INTEGER NOT NULL DEFAULT 0");
    _db.exec("ALTER TABLE ai_stories ADD COLUMN last_read_at DATETIME");
    _db.exec("ALTER TABLE ai_stories ADD COLUMN completed_at DATETIME");
    console.log('✅ Migration: ai_stories progress columns added');
  }
  const aiPageCols = _db.prepare("PRAGMA table_info(ai_story_pages)").all().map(r => r.name);
  if (!aiPageCols.includes('best_accuracy')) {
    _db.exec("ALTER TABLE ai_story_pages ADD COLUMN best_accuracy REAL DEFAULT NULL");
    _db.exec("ALTER TABLE ai_story_pages ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0");
    _db.exec("ALTER TABLE ai_story_pages ADD COLUMN last_spoken TEXT");
    _db.exec("ALTER TABLE ai_story_pages ADD COLUMN last_word_scores TEXT");
    _db.exec("ALTER TABLE ai_story_pages ADD COLUMN completed_at DATETIME");
    console.log('✅ Migration: ai_story_pages progress columns added');
  }
  const childCols = _db.prepare("PRAGMA table_info(children)").all().map(r => r.name);
  if (!childCols.includes('age')) {
    _db.exec("ALTER TABLE children ADD COLUMN age INTEGER");
    _db.exec("ALTER TABLE children ADD COLUMN gender TEXT DEFAULT 'neutral'");
    console.log('✅ Migration: children age+gender columns added');
  }
  // Create new tables if they don't exist
  _db.exec(`
    CREATE TABLE IF NOT EXISTS ai_story_sessions (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      ai_story_id TEXT NOT NULL REFERENCES ai_stories(id) ON DELETE CASCADE,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      pages_read INTEGER NOT NULL DEFAULT 0,
      total_pages INTEGER NOT NULL DEFAULT 3,
      accuracy REAL,
      acorns_earned INTEGER DEFAULT 0
    )
  `);
  _db.exec(`
    CREATE TABLE IF NOT EXISTS ai_story_batches (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      child_id TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
      requested_count INTEGER NOT NULL DEFAULT 5,
      generated_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      themes_used TEXT NOT NULL DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    )
  `);

  if (!cols.includes('oauth_provider')) {
    _db.exec("ALTER TABLE users ADD COLUMN oauth_provider TEXT");
    _db.exec("ALTER TABLE users ADD COLUMN oauth_id TEXT");
    _db.exec("ALTER TABLE users ADD COLUMN oauth_name TEXT");
    _db.exec("ALTER TABLE users ADD COLUMN oauth_avatar TEXT");
    console.log('✅ Migration: OAuth columns added');
  }

  console.log(`✅ Database ready: ${DB_PATH}`);
  return _db;
}

export default getDb;
