-- Properly AI Phonics Tutor — SQLite Schema
-- Run: node src/db/migrate.js

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── USERS (Parents) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email           TEXT UNIQUE COLLATE NOCASE,       -- nullable for social-only accounts
  password        TEXT,                              -- nullable for social-only accounts
  email_verified  INTEGER NOT NULL DEFAULT 0,
  verify_token    TEXT,
  verify_expires  DATETIME,
  verify_sent_at  DATETIME,
  oauth_provider  TEXT,                              -- 'google' | 'facebook' | NULL
  oauth_id        TEXT,                              -- provider's user ID
  oauth_name      TEXT,                              -- display name from provider
  oauth_avatar    TEXT,                              -- profile photo URL
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── CHILDREN (Linked to parent) ──────────────────────────────
CREATE TABLE IF NOT EXISTS children (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  phase        INTEGER NOT NULL DEFAULT 2 CHECK(phase BETWEEN 2 AND 6),
  acorns       INTEGER NOT NULL DEFAULT 60,
  total_acorns INTEGER NOT NULL DEFAULT 60,
  words_read   INTEGER NOT NULL DEFAULT 0,
  streak       INTEGER NOT NULL DEFAULT 1,
  last_read    TEXT,
  has_perfect  INTEGER NOT NULL DEFAULT 0,
  avatar       TEXT DEFAULT 'hedgehog',
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── STORIES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stories (
  id          TEXT PRIMARY KEY,
  phase       INTEGER NOT NULL CHECK(phase BETWEEN 2 AND 6),
  title       TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  cover       TEXT NOT NULL,
  acorns      INTEGER NOT NULL DEFAULT 15,
  page_count  INTEGER NOT NULL DEFAULT 3,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── STORY PAGES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS story_pages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id   TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  page_index INTEGER NOT NULL,
  text       TEXT NOT NULL,
  scene      TEXT NOT NULL DEFAULT '🌿',
  bg_class   TEXT NOT NULL DEFAULT 'bg-warm',
  is_dark    INTEGER NOT NULL DEFAULT 0
);

-- ── READING SESSIONS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reading_sessions (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  child_id     TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  story_id     TEXT NOT NULL REFERENCES stories(id),
  started_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  accuracy     REAL,
  acorns_earned INTEGER DEFAULT 0,
  pages_read   INTEGER DEFAULT 0
);

-- ── PAGE RESULTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS page_results (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    TEXT NOT NULL REFERENCES reading_sessions(id) ON DELETE CASCADE,
  page_index    INTEGER NOT NULL,
  spoken_text   TEXT,
  accuracy      REAL,
  word_scores   TEXT,  -- JSON blob
  attempts      INTEGER DEFAULT 1,
  recorded_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── COMPLETED STORIES ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS completed_stories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id   TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  story_id   TEXT NOT NULL REFERENCES stories(id),
  best_acc   REAL DEFAULT 0,
  times_read INTEGER DEFAULT 1,
  completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(child_id, story_id)
);

-- ── SHOP ITEMS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_items (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  emoji    TEXT NOT NULL,
  cost     INTEGER NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('digital','print','physical')),
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER DEFAULT 0
);

-- ── OWNED ITEMS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS owned_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id   TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  item_id    TEXT NOT NULL REFERENCES shop_items(id),
  purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(child_id, item_id)
);

-- ── ACHIEVEMENTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS achievements (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  description TEXT NOT NULL,
  xp          INTEGER DEFAULT 50,
  condition_type TEXT NOT NULL,
  condition_value INTEGER NOT NULL
);

-- ── EARNED ACHIEVEMENTS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS earned_achievements (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id     TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES achievements(id),
  earned_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(child_id, achievement_id)
);

-- ── CUSTOM GOALS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_goals (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id   TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE UNIQUE,
  title      TEXT NOT NULL,
  emoji      TEXT NOT NULL DEFAULT '🎁',
  cost       INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── INDEXES ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_children_user   ON children(user_id);
CREATE INDEX IF NOT EXISTS idx_pages_story     ON story_pages(story_id, page_index);
CREATE INDEX IF NOT EXISTS idx_sessions_child  ON reading_sessions(child_id);
CREATE INDEX IF NOT EXISTS idx_completed_child ON completed_stories(child_id);
CREATE INDEX IF NOT EXISTS idx_owned_child     ON owned_items(child_id);
CREATE INDEX IF NOT EXISTS idx_earned_child    ON earned_achievements(child_id);
CREATE INDEX IF NOT EXISTS idx_stories_phase   ON stories(phase, sort_order);

-- ── TRIGGERS ─────────────────────────────────────────────────
CREATE TRIGGER IF NOT EXISTS trg_users_updated
  AFTER UPDATE ON users
  BEGIN UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

CREATE TRIGGER IF NOT EXISTS trg_children_updated
  AFTER UPDATE ON children
  BEGIN UPDATE children SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;

-- ── AI-GENERATED STORIES ──────────────────────────────────────
-- Each story is unique to one child, generated by AI
CREATE TABLE IF NOT EXISTS ai_stories (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  child_id      TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  emoji         TEXT NOT NULL DEFAULT '📖',
  cover_scene   TEXT NOT NULL DEFAULT '🌳',
  phase         INTEGER NOT NULL,
  theme         TEXT NOT NULL DEFAULT 'adventure',
  target_phonemes TEXT NOT NULL DEFAULT '[]',   -- JSON array of phoneme patterns targeted
  acorns        INTEGER NOT NULL DEFAULT 20,
  page_count    INTEGER NOT NULL DEFAULT 3,
  generation_prompt TEXT,                        -- stored for debug/regeneration
  ai_provider   TEXT NOT NULL DEFAULT 'gemini',  -- which AI generated it
  is_active     INTEGER NOT NULL DEFAULT 1,       -- soft-delete flag
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_story_pages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  story_id      TEXT NOT NULL REFERENCES ai_stories(id) ON DELETE CASCADE,
  page_index    INTEGER NOT NULL,
  text          TEXT NOT NULL,
  scene_emoji   TEXT NOT NULL DEFAULT '🌿',
  bg_class      TEXT NOT NULL DEFAULT 'bg-warm',
  target_words  TEXT NOT NULL DEFAULT '[]',   -- JSON array of phonics target words on this page
  UNIQUE(story_id, page_index)
);

-- ── CHILD INTERESTS & PERSONALISATION ────────────────────────
-- Parents set these; used to personalise AI story themes
CREATE TABLE IF NOT EXISTS child_interests (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id    TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE UNIQUE,
  interests   TEXT NOT NULL DEFAULT '[]',     -- JSON array: ["dinosaurs","space","cats"]
  favourite_colour TEXT DEFAULT 'green',
  favourite_animal TEXT DEFAULT 'owl',
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── STRUGGLED WORDS (for spaced repetition) ──────────────────
-- Track which words a child consistently gets wrong
CREATE TABLE IF NOT EXISTS struggled_words (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id    TEXT NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  word        TEXT NOT NULL,
  phoneme     TEXT,                           -- the specific phoneme causing trouble
  fail_count  INTEGER NOT NULL DEFAULT 1,
  last_seen   DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(child_id, word)
);

CREATE INDEX IF NOT EXISTS idx_ai_stories_child  ON ai_stories(child_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_pages_story    ON ai_story_pages(story_id, page_index);
CREATE INDEX IF NOT EXISTS idx_struggled_child   ON struggled_words(child_id, fail_count DESC);

-- ── EMAIL VERIFICATION ────────────────────────────────────────
-- Columns added via migration in database.js (ALTER TABLE run safely at startup)
CREATE INDEX IF NOT EXISTS idx_users_verify_token ON users(verify_token);

CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);

-- ── SUBSCRIPTIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id             TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan                TEXT NOT NULL DEFAULT 'free',   -- free | sprout | forest
  status              TEXT NOT NULL DEFAULT 'active', -- active | cancelled | past_due | trialing
  stripe_customer_id  TEXT UNIQUE,
  stripe_sub_id       TEXT UNIQUE,
  stripe_price_id     TEXT,
  current_period_end  DATETIME,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  trial_end           DATETIME,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user   ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_customer_id);
