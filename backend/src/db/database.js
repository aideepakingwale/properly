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
