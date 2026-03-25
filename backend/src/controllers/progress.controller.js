/**
 * @file        progress.controller.js
 * @description Reading progress controller — session lifecycle (start/page/complete) and progress retrieval for both static and AI stories
 * @module      Progress
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - storyType param ("static"|"ai") routes DB writes to correct table
 *   - completeSession awards acorns at 90%=full, 70%=75%, 50%=50%, <50%=0
 *   - checkAndAwardAchievements fires on every session completion
 */

import getDb from '../db/database.js';

// ── GET CHILD ─────────────────────────────────────────────────
export const getChild = (req, res) => {
  const db    = getDb();
  const child = db.prepare('SELECT * FROM children WHERE id = ? AND user_id = ?')
    .get(req.child.id, req.user.userId);
  if (!child) return res.status(404).json({ success: false, message: 'Child not found' });
  res.json({ success: true, data: { child: formatChild(child) } });
};

// ── UPDATE CHILD (phase, avatar — from parent dashboard) ──────
// Note: full child CRUD is in children.controller.js
// This endpoint just handles phase/avatar changes in-session
export const updateChild = (req, res) => {
  const db = getDb();
  const { phase, avatar } = req.body;
  const sets = [], vals = [];
  if (phase  !== undefined) { sets.push('phase=?');  vals.push(parseInt(phase));  }
  if (avatar !== undefined) { sets.push('avatar=?'); vals.push(avatar); }
  if (!sets.length) return res.status(400).json({ success: false, message: 'Nothing to update' });
  sets.push('updated_at=CURRENT_TIMESTAMP');
  vals.push(req.child.id);
  const child = db.prepare(`UPDATE children SET ${sets.join(',')} WHERE id=? RETURNING *`).get(...vals);
  res.json({ success: true, data: { child: formatChild(child) } });
};

// ── START SESSION ─────────────────────────────────────────────
export const startSession = (req, res) => {
  const db   = getDb();
  const { storyId, storyType = 'static' } = req.body;
  if (!storyId) return res.status(400).json({ success: false, message: 'storyId required' });

  // Verify story exists in correct table
  if (storyType === 'ai') {
    const aiStory = db.prepare('SELECT id FROM ai_stories WHERE id=? AND child_id=?').get(storyId, req.child.id);
    if (!aiStory) return res.status(404).json({ success: false, message: 'AI story not found' });
  } else {
    const story = db.prepare('SELECT id FROM stories WHERE id=?').get(storyId);
    if (!story) return res.status(404).json({ success: false, message: 'Story not found' });
  }

  const session = db.prepare(`
    INSERT INTO reading_sessions (child_id, story_id, story_type)
    VALUES (?,?,?) RETURNING *
  `).get(req.child.id, storyId, storyType);

  // Mark AI story as in_progress
  if (storyType === 'ai') {
    db.prepare(`UPDATE ai_stories SET status='in_progress', last_read_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(storyId);
  }

  res.json({ success: true, data: { sessionId: session.id } });
};

// ── SUBMIT PAGE ───────────────────────────────────────────────
export const submitPage = (req, res) => {
  const db = getDb();
  const { sessionId, pageIndex, accuracy, spokenText, wordScores } = req.body;

  const session = db.prepare('SELECT * FROM reading_sessions WHERE id=? AND child_id=?')
    .get(sessionId, req.child.id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

  // Upsert page result
  db.prepare(`
    INSERT OR REPLACE INTO page_results
      (session_id, page_index, spoken_text, accuracy, word_scores, attempts)
    VALUES (?,?,?,?,?,
      COALESCE((SELECT attempts FROM page_results WHERE session_id=? AND page_index=?),0)+1
    )
  `).run(sessionId, pageIndex, spokenText || '', accuracy || 0,
         JSON.stringify(wordScores || []), sessionId, pageIndex);

  // For AI stories: update per-page progress
  if (session.story_type === 'ai') {
    const page = db.prepare('SELECT * FROM ai_story_pages WHERE story_id=? AND page_index=?')
      .get(session.story_id, pageIndex);
    if (page) {
      const newBest = Math.max(page.best_accuracy || 0, accuracy || 0);
      const isDone  = (accuracy || 0) >= 50;
      db.prepare(`
        UPDATE ai_story_pages SET
          best_accuracy=?, attempts=attempts+1, last_spoken=?, last_word_scores=?,
          completed_at=CASE WHEN ? AND completed_at IS NULL THEN CURRENT_TIMESTAMP ELSE completed_at END
        WHERE story_id=? AND page_index=?
      `).run(newBest, spokenText || '', JSON.stringify(wordScores || []),
             isDone ? 1 : 0, session.story_id, pageIndex);
    }
  }

  res.json({ success: true });
};

// ── COMPLETE SESSION ──────────────────────────────────────────
export const completeSession = (req, res) => {
  const db = getDb();
  const { sessionId, accuracy } = req.body;

  const session = db.prepare('SELECT * FROM reading_sessions WHERE id=? AND child_id=?')
    .get(sessionId, req.child.id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

  const acc = accuracy || 0;

  // Resolve acorns from the right table
  let acorns = 0;
  if (session.story_type === 'ai') {
    const aiStory = db.prepare('SELECT acorns, best_accuracy, times_read FROM ai_stories WHERE id=?').get(session.story_id);
    if (aiStory) {
      acorns = acc >= 90 ? aiStory.acorns
             : acc >= 70 ? Math.floor(aiStory.acorns * 0.75)
             : acc >= 50 ? Math.floor(aiStory.acorns * 0.5)
             : 0;
      // Update AI story progress
      const newBest = Math.max(aiStory.best_accuracy || 0, acc);
      db.prepare(`
        UPDATE ai_stories SET
          status='completed', best_accuracy=?, times_read=times_read+1,
          last_read_at=CURRENT_TIMESTAMP,
          completed_at=CASE WHEN completed_at IS NULL THEN CURRENT_TIMESTAMP ELSE completed_at END
        WHERE id=?
      `).run(newBest, session.story_id);
    }
  } else {
    const story = db.prepare('SELECT acorns FROM stories WHERE id=?').get(session.story_id);
    if (story) {
      acorns = acc >= 90 ? story.acorns
             : acc >= 70 ? Math.floor(story.acorns * 0.75)
             : acc >= 50 ? Math.floor(story.acorns * 0.5)
             : 0;
    }
  }

  // Mark session complete
  db.prepare(`
    UPDATE reading_sessions SET
      completed_at=CURRENT_TIMESTAMP, accuracy=?, acorns_earned=?, pages_read=pages_read+1
    WHERE id=?
  `).run(acc, acorns, sessionId);

  // Upsert completed_stories (both types)
  db.prepare(`
    INSERT INTO completed_stories (child_id, story_id, story_type, best_acc, times_read)
    VALUES (?,?,?,?,1)
    ON CONFLICT(child_id, story_id) DO UPDATE SET
      best_acc=MAX(best_acc, excluded.best_acc),
      times_read=times_read+1,
      completed_at=CURRENT_TIMESTAMP
  `).run(req.child.id, session.story_id, session.story_type, acc);

  // Award acorns
  if (acorns > 0) {
    db.prepare('UPDATE children SET acorns=acorns+?, total_acorns=total_acorns+? WHERE id=?')
      .run(acorns, acorns, req.child.id);
  }

  // Increment words read
  const pageCount = session.story_type === 'ai'
    ? (db.prepare('SELECT page_count FROM ai_stories WHERE id=?').get(session.story_id)?.page_count || 3)
    : (db.prepare('SELECT page_count FROM stories WHERE id=?').get(session.story_id)?.page_count || 3);
  db.prepare('UPDATE children SET words_read=words_read+? WHERE id=?').run(pageCount * 8, req.child.id);

  // Check achievements
  const newAchievements = checkAndAwardAchievements(req.child.id, acc, db);

  res.json({ success: true, data: { acornsEarned: acorns, accuracy: acc, newAchievements } });
};

// ── GET PROGRESS ──────────────────────────────────────────────
export const getProgress = (req, res) => {
  const db    = getDb();
  const child = db.prepare('SELECT * FROM children WHERE id=?').get(req.child.id);
  if (!child) return res.status(404).json({ success: false, message: 'Child not found' });

  // Completed static stories
  const completedStatic = db.prepare(
    "SELECT story_id, best_acc, times_read FROM completed_stories WHERE child_id=? AND story_type='static'"
  ).all(child.id);

  // Completed AI stories
  const completedAi = db.prepare(
    "SELECT story_id, best_acc, times_read FROM completed_stories WHERE child_id=? AND story_type='ai'"
  ).all(child.id);

  // Recent sessions (both types, last 10)
  const recentSessions = db.prepare(`
    SELECT rs.*, COALESCE(s.title, ai.title) as story_title, rs.story_type
    FROM reading_sessions rs
    LEFT JOIN stories s ON s.id=rs.story_id AND rs.story_type='static'
    LEFT JOIN ai_stories ai ON ai.id=rs.story_id AND rs.story_type='ai'
    WHERE rs.child_id=? AND rs.completed_at IS NOT NULL
    ORDER BY rs.completed_at DESC LIMIT 10
  `).all(child.id);

  // Achievements earned
  const earnedAchievements = db.prepare(`
    SELECT ea.achievement_id, ea.earned_at, a.title as name, a.emoji, a.description
    FROM earned_achievements ea JOIN achievements a ON a.id=ea.achievement_id
    WHERE ea.child_id=? ORDER BY ea.earned_at DESC
  `).all(child.id);

  // Custom goal
  const customGoal = db.prepare('SELECT * FROM custom_goals WHERE child_id=?').get(child.id);

  // AI story summary
  const aiStorySummary = db.prepare(`
    SELECT status, COUNT(*) as count FROM ai_stories WHERE child_id=? AND is_active=1 GROUP BY status
  `).all(child.id);

  res.json({
    success: true,
    data: {
      child: formatChild(child),
      completedStories: completedStatic.map(c => ({ storyId: c.story_id, bestAcc: c.best_acc, timesRead: c.times_read, type: 'static' })),
      completedAiStories: completedAi.map(c => ({ storyId: c.story_id, bestAcc: c.best_acc, timesRead: c.times_read, type: 'ai' })),
      recentSessions: recentSessions.map(s => ({
        id: s.id, storyTitle: s.story_title, storyType: s.story_type,
        accuracy: s.accuracy, acornsEarned: s.acorns_earned, completedAt: s.completed_at,
      })),
      earnedAchievements,
      customGoal: customGoal || null,
      aiStorySummary: Object.fromEntries(aiStorySummary.map(r => [r.status, r.count])),
    },
  });
};

// ── GOAL CRUD ─────────────────────────────────────────────────
export const upsertGoal = (req, res) => {
  const db = getDb();
  const { title, emoji, cost } = req.body;
  if (!title || !cost) return res.status(400).json({ success: false, message: 'title and cost required' });
  db.prepare(`
    INSERT INTO custom_goals (child_id, title, emoji, cost) VALUES (?,?,?,?)
    ON CONFLICT(child_id) DO UPDATE SET title=excluded.title, emoji=excluded.emoji, cost=excluded.cost
  `).run(req.child.id, title, emoji || '🎯', parseInt(cost));
  const goal = db.prepare('SELECT * FROM custom_goals WHERE child_id=?').get(req.child.id);
  res.json({ success: true, data: { goal } });
};

export const deleteGoal = (req, res) => {
  getDb().prepare('DELETE FROM custom_goals WHERE child_id=?').run(req.child.id);
  res.json({ success: true });
};

// ── HELPERS ───────────────────────────────────────────────────
function formatChild(c) {
  return {
    id: c.id, name: c.name, phase: c.phase,
    age: c.age || null, gender: c.gender || 'neutral',
    avatar: c.avatar || 'hedgehog',
    acorns: c.acorns, totalAcorns: c.total_acorns,
    wordsRead: c.words_read, streak: c.streak,
    lastRead: c.last_read, hasPerfect: Boolean(c.has_perfect),
    createdAt: c.created_at,
  };
}

function checkAndAwardAchievements(childId, accuracy, db) {
  const child      = db.prepare('SELECT * FROM children WHERE id=?').get(childId);
  const allAchs    = db.prepare('SELECT * FROM achievements').all();
  const earned     = new Set(db.prepare('SELECT achievement_id FROM earned_achievements WHERE child_id=?').all(childId).map(r => r.achievement_id));
  const newlyEarned= [];

  for (const ach of allAchs) {
    if (earned.has(ach.id)) continue;
    let unlock = false;
    if (ach.trigger === 'words_read'   && child.words_read   >= ach.threshold) unlock = true;
    if (ach.trigger === 'streak'       && child.streak       >= ach.threshold) unlock = true;
    if (ach.trigger === 'total_acorns' && child.total_acorns >= ach.threshold) unlock = true;
    if (ach.trigger === 'perfect'      && accuracy           >= 95)            unlock = true;
    if (unlock) {
      db.prepare('INSERT OR IGNORE INTO earned_achievements (child_id, achievement_id) VALUES (?,?)').run(childId, ach.id);
      newlyEarned.push({ id: ach.id, name: ach.name, emoji: ach.emoji, description: ach.description });
    }
  }
  return newlyEarned;
}
