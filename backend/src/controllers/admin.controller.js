/**
 * Admin Controller — full administration API
 *
 * All routes require: authMiddleware + requireAdmin
 *
 * Sections:
 *   Dashboard  — summary stats, recent activity
 *   Users      — list, search, view, update plan, toggle admin, delete
 *   Shop       — CRUD for shop items
 *   Stories    — list curriculum stories + AI story stats
 *   Progress   — per-user/child reading analytics
 *   Config     — runtime feature flags
 */

import getDb from '../db/database.js';

// ── HELPERS ────────────────────────────────────────────────────
function paginate(req) {
  const page  = Math.max(1, parseInt(req.query.page  || 1));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || 25)));
  return { page, limit, offset: (page - 1) * limit };
}

function fmtUser(u, sub) {
  return {
    id:        u.id,
    email:     u.email,
    verified:  Boolean(u.email_verified),
    isAdmin:   Boolean(u.is_admin),
    plan:      sub?.plan || 'free',
    planStatus:sub?.status || 'active',
    createdAt: u.created_at,
    oauthProvider: u.oauth_provider || null,
  };
}

// ── DASHBOARD ──────────────────────────────────────────────────
export const getDashboard = (req, res) => {
  const db = getDb();

  const totalUsers     = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
  const verifiedUsers  = db.prepare('SELECT COUNT(*) as n FROM users WHERE email_verified=1').get().n;
  const adminCount     = db.prepare('SELECT COUNT(*) as n FROM users WHERE is_admin=1').get().n;
  const totalChildren  = db.prepare('SELECT COUNT(*) as n FROM children').get().n;
  const totalSessions  = db.prepare('SELECT COUNT(*) as n FROM reading_sessions WHERE completed_at IS NOT NULL').get().n;
  const totalAiStories = db.prepare('SELECT COUNT(*) as n FROM ai_stories').get().n;
  const aiCompleted    = db.prepare("SELECT COUNT(*) as n FROM ai_stories WHERE status='completed'").get().n;

  const planBreakdown = db.prepare(`
    SELECT COALESCE(s.plan,'free') as plan, COUNT(*) as n
    FROM users u LEFT JOIN subscriptions s ON s.user_id=u.id
    GROUP BY COALESCE(s.plan,'free')
  `).all();

  const recentUsers = db.prepare(`
    SELECT u.id, u.email, u.email_verified, u.is_admin, u.created_at,
           COALESCE(s.plan,'free') as plan
    FROM users u LEFT JOIN subscriptions s ON s.user_id=u.id
    ORDER BY u.created_at DESC LIMIT 10
  `).all();

  const recentSessions = db.prepare(`
    SELECT rs.id, rs.accuracy, rs.acorns_earned, rs.story_type, rs.completed_at,
           c.name as child_name, u.email as parent_email,
           COALESCE(st.title, ai.title, 'Unknown') as story_title
    FROM reading_sessions rs
    JOIN children c ON c.id=rs.child_id
    JOIN users u ON u.id=c.user_id
    LEFT JOIN stories st ON st.id=rs.story_id AND rs.story_type='static'
    LEFT JOIN ai_stories ai ON ai.id=rs.story_id AND rs.story_type='ai'
    WHERE rs.completed_at IS NOT NULL
    ORDER BY rs.completed_at DESC LIMIT 10
  `).all();

  const weeklySignups = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as n
    FROM users
    WHERE created_at >= date('now','-7 days')
    GROUP BY date(created_at) ORDER BY day
  `).all();

  const avgAccuracy = db.prepare(`
    SELECT ROUND(AVG(accuracy),1) as avg FROM reading_sessions WHERE accuracy IS NOT NULL
  `).get().avg;

  res.json({ success: true, data: {
    stats: { totalUsers, verifiedUsers, adminCount, totalChildren, totalSessions, totalAiStories, aiCompleted, avgAccuracy },
    planBreakdown,
    weeklySignups,
    recentUsers: recentUsers.map(u => ({ ...u, verified: Boolean(u.email_verified), isAdmin: Boolean(u.is_admin) })),
    recentSessions,
  }});
};

// ── USERS ──────────────────────────────────────────────────────
export const listUsers = (req, res) => {
  const db = getDb();
  const { page, limit, offset } = paginate(req);
  const search = req.query.search?.trim() || '';
  const plan   = req.query.plan || '';

  let sql = `
    SELECT u.*, COALESCE(s.plan,'free') as plan, s.status as plan_status,
           COUNT(DISTINCT c.id) as child_count,
           COUNT(DISTINCT rs.id) as session_count
    FROM users u
    LEFT JOIN subscriptions s ON s.user_id=u.id
    LEFT JOIN children c ON c.user_id=u.id
    LEFT JOIN reading_sessions rs ON rs.child_id=c.id AND rs.completed_at IS NOT NULL
  `;
  const params = [];
  const where  = [];
  if (search) { where.push("(u.email LIKE ? OR u.id LIKE ?)"); params.push(`%${search}%`, `%${search}%`); }
  if (plan)   { where.push("COALESCE(s.plan,'free') = ?"); params.push(plan); }
  if (where.length) sql += ' WHERE ' + where.join(' AND ');
  sql += ' GROUP BY u.id ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const users = db.prepare(sql).all(...params);
  const total = db.prepare(`SELECT COUNT(DISTINCT u.id) as n FROM users u LEFT JOIN subscriptions s ON s.user_id=u.id${where.length?' WHERE '+where.join(' AND '):''}`).get(...params.slice(0,-2)).n;

  res.json({ success: true, data: {
    users: users.map(u => ({
      ...fmtUser(u, { plan: u.plan, status: u.plan_status }),
      childCount: u.child_count, sessionCount: u.session_count,
    })),
    total, page, limit, pages: Math.ceil(total / limit),
  }});
};

export const getUser = (req, res) => {
  const db   = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const sub      = db.prepare('SELECT * FROM subscriptions WHERE user_id=?').get(user.id);
  const children = db.prepare('SELECT * FROM children WHERE user_id=?').all(user.id);

  const childrenWithProgress = children.map(c => {
    const sessions    = db.prepare('SELECT COUNT(*) as n FROM reading_sessions WHERE child_id=? AND completed_at IS NOT NULL').get(c.id).n;
    const aiCompleted = db.prepare("SELECT COUNT(*) as n FROM ai_stories WHERE child_id=? AND status='completed'").get(c.id).n;
    const avgAcc      = db.prepare('SELECT ROUND(AVG(accuracy),1) as avg FROM reading_sessions WHERE child_id=? AND accuracy IS NOT NULL').get(c.id).avg;
    return { id:c.id, name:c.name, phase:c.phase, age:c.age, gender:c.gender, acorns:c.acorns, sessions, aiCompleted, avgAccuracy: avgAcc };
  });

  const recentSessions = db.prepare(`
    SELECT rs.*, COALESCE(s.title, ai.title, 'Unknown') as story_title, c.name as child_name, rs.story_type
    FROM reading_sessions rs
    JOIN children c ON c.id=rs.child_id
    LEFT JOIN stories s ON s.id=rs.story_id AND rs.story_type='static'
    LEFT JOIN ai_stories ai ON ai.id=rs.story_id AND rs.story_type='ai'
    WHERE c.user_id=? AND rs.completed_at IS NOT NULL
    ORDER BY rs.completed_at DESC LIMIT 20
  `).all(user.id);

  res.json({ success: true, data: {
    user: fmtUser(user, sub), subscription: sub || null,
    children: childrenWithProgress, recentSessions,
  }});
};

export const updateUser = (req, res) => {
  const db = getDb();
  const { isAdmin, plan, planStatus } = req.body;
  const userId = req.params.userId;

  if (!db.prepare('SELECT id FROM users WHERE id=?').get(userId)) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  if (isAdmin !== undefined) {
    db.prepare('UPDATE users SET is_admin=? WHERE id=?').run(isAdmin ? 1 : 0, userId);
  }

  if (plan) {
    db.prepare(`
      INSERT INTO subscriptions (user_id, plan, status) VALUES (?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan, status=COALESCE(excluded.status,status), updated_at=CURRENT_TIMESTAMP
    `).run(userId, plan, planStatus || 'active');
  }

  res.json({ success: true });
};

export const deleteUser = (req, res) => {
  const db     = getDb();
  const userId = req.params.userId;
  if (userId === req.user.userId) return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
  db.prepare('DELETE FROM users WHERE id=?').run(userId);
  res.json({ success: true });
};

// ── SHOP ITEMS ─────────────────────────────────────────────────
export const listShopItems = (_req, res) => {
  const db    = getDb();
  const items = db.prepare('SELECT * FROM shop_items ORDER BY sort_order, cost').all();
  const owned = db.prepare('SELECT item_id, COUNT(*) as owners FROM owned_items GROUP BY item_id').all();
  const ownerMap = Object.fromEntries(owned.map(r => [r.item_id, r.owners]));
  res.json({ success: true, data: { items: items.map(i => ({ ...i, ownerCount: ownerMap[i.id] || 0 })) }});
};

export const createShopItem = (req, res) => {
  const db = getDb();
  const { id, name, emoji, cost, category = 'avatar', description = '', sortOrder = 99 } = req.body;
  if (!id || !name || !emoji || !cost) return res.status(400).json({ success: false, message: 'id, name, emoji, cost required' });
  try {
    db.prepare('INSERT INTO shop_items (id,name,emoji,cost,category,description,sort_order) VALUES (?,?,?,?,?,?,?)')
      .run(id, name, emoji, parseInt(cost), category, description, parseInt(sortOrder));
    res.status(201).json({ success: true, data: db.prepare('SELECT * FROM shop_items WHERE id=?').get(id) });
  } catch (e) {
    res.status(409).json({ success: false, message: e.message.includes('UNIQUE') ? 'Item ID already exists' : e.message });
  }
};

export const updateShopItem = (req, res) => {
  const db = getDb();
  const { name, emoji, cost, category, description, sortOrder } = req.body;
  const sets = [], vals = [];
  if (name        !== undefined) { sets.push('name=?');        vals.push(name); }
  if (emoji       !== undefined) { sets.push('emoji=?');       vals.push(emoji); }
  if (cost        !== undefined) { sets.push('cost=?');        vals.push(parseInt(cost)); }
  if (category    !== undefined) { sets.push('category=?');    vals.push(category); }
  if (description !== undefined) { sets.push('description=?'); vals.push(description); }
  if (sortOrder   !== undefined) { sets.push('sort_order=?');  vals.push(parseInt(sortOrder)); }
  if (!sets.length) return res.status(400).json({ success: false, message: 'Nothing to update' });
  vals.push(req.params.itemId);
  db.prepare(`UPDATE shop_items SET ${sets.join(',')} WHERE id=?`).run(...vals);
  res.json({ success: true, data: db.prepare('SELECT * FROM shop_items WHERE id=?').get(req.params.itemId) });
};

export const deleteShopItem = (req, res) => {
  getDb().prepare('DELETE FROM shop_items WHERE id=?').run(req.params.itemId);
  res.json({ success: true });
};

// ── STORIES ────────────────────────────────────────────────────
export const listStories = (_req, res) => {
  const db      = getDb();
  const stories = db.prepare('SELECT * FROM stories ORDER BY phase, sort_order').all();
  const stats   = db.prepare(`
    SELECT story_id, COUNT(*) as reads, ROUND(AVG(best_acc),1) as avg_acc
    FROM completed_stories WHERE story_type='static' GROUP BY story_id
  `).all();
  const statsMap = Object.fromEntries(stats.map(s => [s.story_id, s]));
  res.json({ success: true, data: {
    stories: stories.map(s => ({
      ...s, reads: statsMap[s.id]?.reads || 0, avgAccuracy: statsMap[s.id]?.avg_acc || null,
    })),
  }});
};

export const getAiStoryStats = (_req, res) => {
  const db = getDb();
  const byTheme = db.prepare(`
    SELECT theme, COUNT(*) as total,
           SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed,
           ROUND(AVG(CASE WHEN best_accuracy>0 THEN best_accuracy END),1) as avg_acc
    FROM ai_stories WHERE is_active=1 GROUP BY theme ORDER BY total DESC
  `).all();
  const byProvider = db.prepare(`
    SELECT ai_provider, COUNT(*) as total FROM ai_stories WHERE is_active=1 GROUP BY ai_provider
  `).all();
  const daily = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as generated
    FROM ai_stories WHERE created_at >= date('now','-30 days')
    GROUP BY date(created_at) ORDER BY day
  `).all();
  res.json({ success: true, data: { byTheme, byProvider, daily }});
};

// ── ANALYTICS ──────────────────────────────────────────────────
export const getAnalytics = (_req, res) => {
  const db = getDb();

  const sessionsByDay = db.prepare(`
    SELECT date(completed_at) as day,
           COUNT(*) as sessions,
           ROUND(AVG(accuracy),1) as avg_accuracy,
           SUM(acorns_earned) as acorns_awarded
    FROM reading_sessions WHERE completed_at >= date('now','-30 days')
    GROUP BY date(completed_at) ORDER BY day
  `).all();

  const phaseDistribution = db.prepare(`
    SELECT phase, COUNT(*) as children FROM children GROUP BY phase ORDER BY phase
  `).all();

  const topReaders = db.prepare(`
    SELECT c.name, u.email, c.phase, c.total_acorns, c.words_read,
           COUNT(rs.id) as sessions
    FROM children c
    JOIN users u ON u.id=c.user_id
    LEFT JOIN reading_sessions rs ON rs.child_id=c.id AND rs.completed_at IS NOT NULL
    GROUP BY c.id ORDER BY c.total_acorns DESC LIMIT 10
  `).all();

  const accuracyBuckets = db.prepare(`
    SELECT
      SUM(CASE WHEN accuracy >= 90 THEN 1 ELSE 0 END) as excellent,
      SUM(CASE WHEN accuracy >= 70 AND accuracy < 90 THEN 1 ELSE 0 END) as good,
      SUM(CASE WHEN accuracy >= 50 AND accuracy < 70 THEN 1 ELSE 0 END) as fair,
      SUM(CASE WHEN accuracy < 50 THEN 1 ELSE 0 END) as needs_work
    FROM reading_sessions WHERE accuracy IS NOT NULL
  `).get();

  res.json({ success: true, data: { sessionsByDay, phaseDistribution, topReaders, accuracyBuckets }});
};

// ── CONFIG ─────────────────────────────────────────────────────
export const getR2Status = async (_req, res) => {
  const { USE_R2, dbStorageMode } = await import('../db/database.js').then(m => ({
    USE_R2: m.dbStorageMode === 'r2',
    dbStorageMode: m.dbStorageMode,
  }));

  if (!USE_R2) {
    return res.json({ success: true, data: {
      configured: false,
      storageMode: dbStorageMode,
      message: 'R2 not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_KEY, R2_BUCKET in Render env vars',
    }});
  }

  // Test actual R2 connectivity
  try {
    const { S3Client, HeadBucketCommand, ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    const s3 = new S3Client({
      region:   'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId:     process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_KEY,
      },
    });
    const bucket = process.env.R2_BUCKET;

    // List objects with db/ prefix to see backup
    const list = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: 'db/' }));
    const dbBackup = list.Contents?.find(o => o.Key === 'db/properly.db');

    res.json({ success: true, data: {
      configured: true,
      storageMode: dbStorageMode,
      bucket,
      backupExists: !!dbBackup,
      backupSize: dbBackup ? `${(dbBackup.Size / 1024).toFixed(1)} KB` : null,
      backupLastModified: dbBackup?.LastModified || null,
      message: dbBackup ? 'R2 connected ✅ — backup found' : 'R2 connected but no backup yet — will appear within 3s of startup',
    }});
  } catch (e) {
    res.json({ success: false, data: {
      configured: true,
      storageMode: dbStorageMode,
      error: e.message,
      message: 'R2 credentials set but connection FAILED — check values in Render env vars',
    }});
  }
};

export const triggerBackup = async (_req, res) => {
  try {
    const { backupNow } = await import('../db/database.js');
    await backupNow();
    res.json({ success: true, data: { message: 'Backup completed successfully' } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

export const getConfig = (_req, res) => {
  res.json({ success: true, data: {
    azure:   { key: process.env.AZURE_SPEECH_KEY   ? '***' : null, region: process.env.AZURE_SPEECH_REGION || 'uksouth' },
    gemini:  { key: process.env.GEMINI_API_KEY     ? '***' : null },
    groq:    { key: process.env.GROQ_API_KEY       ? '***' : null },
    resend:  { key: process.env.RESEND_API_KEY     ? '***' : null },
    r2:      { configured: !!(process.env.R2_ACCOUNT_ID), bucket: process.env.R2_BUCKET || null },
    stripe:  { configured: !!(process.env.STRIPE_SECRET_KEY) },
    adminEmails: (process.env.ADMIN_EMAILS || '').split(',').filter(Boolean),
    jwtExpiry: process.env.JWT_EXPIRES_IN || '30d',
  }});
};
