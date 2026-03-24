/**
 * @file        admin.controller.js
 * @description Admin REST API — dashboard stats, user management, shop CRUD, analytics, config, and live API key tests
 * @module      Admin
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - All endpoints require authMiddleware + requireAdmin (is_admin=1)
 *   - Test endpoints (testAzure, testGemini, etc.) call real external APIs server-side — no keys exposed to browser
 *   - getR2Status performs a live ListObjectsV2 to confirm backup presence
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
export const debugEnv = (_req, res) => {
  // Shows which R2 env vars are present and their lengths
  // Helps diagnose "not configured" when vars appear to be set
  const vars = ['R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_KEY','R2_BUCKET'];
  const report = {};
  for (const v of vars) {
    const val = process.env[v];
    if (!val) {
      report[v] = { present: false, value: null };
    } else {
      // Show first 4 + last 4 chars so you can verify the value without exposing it fully
      const trimmed = val.trim();
      const masked  = trimmed.length > 8
        ? trimmed.slice(0,4) + '...' + trimmed.slice(-4)
        : '***';
      report[v] = {
        present:      true,
        length:       trimmed.length,
        hasWhitespace: val !== trimmed,
        preview:      masked,
      };
    }
  }
  const allPresent = vars.every(v => report[v].present);
  res.json({ success: true, data: { allPresent, vars: report, nodeEnv: process.env.NODE_ENV } });
};

export const getR2Status = async (_req, res) => {
  // Check env vars directly — module-level constants from database.js are
  // evaluated at startup and cannot be re-read via dynamic import
  // Trim whitespace — Render dashboard can inject invisible spaces when copy-pasting keys
  const R2_ACCOUNT_ID    = (process.env.R2_ACCOUNT_ID    || '').trim();
  const R2_ACCESS_KEY_ID = (process.env.R2_ACCESS_KEY_ID || '').trim();
  const R2_SECRET_KEY    = (process.env.R2_SECRET_KEY    || '').trim();
  const R2_BUCKET        = (process.env.R2_BUCKET        || '').trim();

  const r2Configured = Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_KEY && R2_BUCKET);

  // Get current storage mode from the exported constant
  const { dbStorageMode } = await import('../db/database.js');

  if (!r2Configured) {
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
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId:     R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_KEY,
      },
    });
    const bucket = R2_BUCKET;

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
    r2:      { configured: !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_KEY && process.env.R2_BUCKET), bucket: process.env.R2_BUCKET || null },
    stripe:  { configured: !!(process.env.STRIPE_SECRET_KEY) },
    adminEmails: (process.env.ADMIN_EMAILS || '').split(',').filter(Boolean),
    jwtExpiry: process.env.JWT_EXPIRES_IN || '30d',
  }});
};

// ── API KEY TEST ENDPOINTS ─────────────────────────────────────

export const testAzure = async (_req, res) => {
  const key    = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION || 'uksouth';
  if (!key) return res.json({ success: false, service: 'azure', error: 'AZURE_SPEECH_KEY not set' });

  const results = {};

  // Test 1: TTS — synthesise a short phrase
  try {
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-GB"><voice name="en-GB-SoniaNeural"><prosody rate="0.9">Test</prosody></voice></speak>`;
    const ttsRes = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
      },
      body: ssml,
    });
    results.tts = ttsRes.ok
      ? { ok: true, note: `Neural TTS working (${region}) — ${ttsRes.headers.get('content-length') || '?'} bytes returned` }
      : { ok: false, note: `TTS HTTP ${ttsRes.status}: ${await ttsRes.text()}` };
  } catch (e) {
    results.tts = { ok: false, note: e.message };
  }

  // Test 2: STT token (quick auth check)
  try {
    const tokenRes = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': key },
    });
    results.stt = tokenRes.ok
      ? { ok: true, note: 'Speech-to-Text auth token issued successfully' }
      : { ok: false, note: `STT token HTTP ${tokenRes.status}: ${await tokenRes.text()}` };
  } catch (e) {
    results.stt = { ok: false, note: e.message };
  }

  const allOk = Object.values(results).every(r => r.ok);
  res.json({ success: allOk, service: 'azure', region, results });
};

export const testGemini = async (_req, res) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'your-gemini-api-key-here')
    return res.json({ success: false, service: 'gemini', error: 'GEMINI_API_KEY not set' });

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Say "Properly API test OK" and nothing else.' }] }] }),
      }
    );
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.json({ success: false, service: 'gemini', error: `HTTP ${r.status}: ${err?.error?.message || r.statusText}` });
    }
    const data   = await r.json();
    const reply  = data?.candidates?.[0]?.content?.parts?.[0]?.text || '(no text)';
    const tokens = data?.usageMetadata;
    res.json({ success: true, service: 'gemini', reply: reply.trim(),
      note: `Model: gemini-2.5-flash · Tokens: ${tokens?.totalTokenCount ?? '?'}` });
  } catch (e) {
    res.json({ success: false, service: 'gemini', error: e.message });
  }
};

export const testGroq = async (_req, res) => {
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.json({ success: false, service: 'groq', error: 'GROQ_API_KEY not set' });

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 20,
        messages: [{ role: 'user', content: 'Say "Properly API test OK" and nothing else.' }],
      }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.json({ success: false, service: 'groq', error: `HTTP ${r.status}: ${err?.error?.message || r.statusText}` });
    }
    const data  = await r.json();
    const reply = data?.choices?.[0]?.message?.content || '(no text)';
    const usage = data?.usage;
    res.json({ success: true, service: 'groq', reply: reply.trim(),
      note: `Model: llama-3.1-8b-instant · Tokens: ${usage?.total_tokens ?? '?'}` });
  } catch (e) {
    res.json({ success: false, service: 'groq', error: e.message });
  }
};

export const testResend = async (_req, res) => {
  const key = process.env.RESEND_API_KEY;
  if (!key) return res.json({ success: false, service: 'resend', error: 'RESEND_API_KEY not set' });

  try {
    // Just hit the /domains endpoint — read-only, no email sent
    const r = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.json({ success: false, service: 'resend', error: `HTTP ${r.status}: ${err?.message || r.statusText}` });
    }
    const data    = await r.json();
    const domains = data?.data?.map(d => `${d.name} (${d.status})`) || [];
    res.json({ success: true, service: 'resend',
      note: domains.length ? `Verified domains: ${domains.join(', ')}` : 'Key valid — no verified domains yet (add one at resend.com)' });
  } catch (e) {
    res.json({ success: false, service: 'resend', error: e.message });
  }
};

export const testStripe = async (_req, res) => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return res.json({ success: false, service: 'stripe', error: 'STRIPE_SECRET_KEY not set' });

  try {
    const r = await fetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      return res.json({ success: false, service: 'stripe', error: `HTTP ${r.status}: ${err?.error?.message || r.statusText}` });
    }
    const data    = await r.json();
    const mode    = key.startsWith('sk_live') ? '🔴 LIVE' : '🟡 TEST';
    const balance = data.available?.[0];
    res.json({ success: true, service: 'stripe', mode,
      note: `${mode} mode · Available balance: ${balance ? (balance.amount / 100).toFixed(2) + ' ' + balance.currency.toUpperCase() : 'N/A'}` });
  } catch (e) {
    res.json({ success: false, service: 'stripe', error: e.message });
  }
};
