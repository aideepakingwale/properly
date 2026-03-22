import getDb from '../db/database.js';

// ── CHILDREN ─────────────────────────────────────────────────
export const getChild = (req, res) => {
  res.json({ success: true, data: formatChild(req.child) });
};

export const updateChild = (req, res) => {
  const { phase, avatar } = req.body;
  const db = getDb();
  const fields = [];
  const vals = [];
  if (phase !== undefined) { fields.push('phase = ?'); vals.push(Math.min(6, Math.max(2, parseInt(phase)))); }
  if (avatar !== undefined) { fields.push('avatar = ?'); vals.push(avatar); }
  if (!fields.length) return res.status(400).json({ success: false, message: 'Nothing to update' });
  vals.push(req.child.id);
  db.prepare(`UPDATE children SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
  const updated = db.prepare('SELECT * FROM children WHERE id = ?').get(req.child.id);
  res.json({ success: true, data: formatChild(updated) });
};

// ── SESSIONS ─────────────────────────────────────────────────
export const startSession = (req, res) => {
  const { storyId } = req.body;
  const db = getDb();
  const story = db.prepare('SELECT id FROM stories WHERE id = ?').get(storyId);
  if (!story) return res.status(404).json({ success: false, message: 'Story not found' });

  const session = db.prepare(`
    INSERT INTO reading_sessions (child_id, story_id) VALUES (?,?) RETURNING *
  `).get(req.child.id, storyId);

  res.status(201).json({ success: true, data: { sessionId: session.id } });
};

export const submitPage = (req, res) => {
  const { sessionId, pageIndex, spokenText, accuracy, wordScores, acornsEarned } = req.body;
  const db = getDb();

  // Verify session belongs to child
  const session = db.prepare('SELECT * FROM reading_sessions WHERE id = ? AND child_id = ?')
    .get(sessionId, req.child.id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

  db.prepare(`
    INSERT OR IGNORE INTO page_results (session_id, page_index, spoken_text, accuracy, word_scores, attempts)
    VALUES (?,?,?,?,?,1)
  `).run(sessionId, pageIndex, spokenText || '', accuracy || 0, JSON.stringify(wordScores || []));

  // Update child stats
  const wordsOnPage = (spokenText || '').split(/\s+/).filter(Boolean).length;
  db.prepare('UPDATE children SET words_read = words_read + ?, acorns = acorns + ?, total_acorns = total_acorns + ? WHERE id = ?')
    .run(wordsOnPage, acornsEarned || 0, acornsEarned || 0, req.child.id);

  if (accuracy >= 99.9) {
    db.prepare('UPDATE children SET has_perfect = 1 WHERE id = ?').run(req.child.id);
  }

  res.json({ success: true });
};

export const completeSession = (req, res) => {
  const { sessionId, accuracy, acornsEarned } = req.body;
  const db = getDb();

  const session = db.prepare('SELECT * FROM reading_sessions WHERE id = ? AND child_id = ?')
    .get(sessionId, req.child.id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

  const completeAndAward = db.transaction(() => {
    // Mark session complete
    db.prepare(`UPDATE reading_sessions SET completed_at = CURRENT_TIMESTAMP, accuracy = ?, acorns_earned = ?
      WHERE id = ?`).run(accuracy || 0, acornsEarned || 0, sessionId);

    // Upsert completed_stories
    db.prepare(`
      INSERT INTO completed_stories (child_id, story_id, best_acc, times_read)
      VALUES (?,?,?,1)
      ON CONFLICT(child_id, story_id) DO UPDATE SET
        best_acc = MAX(best_acc, excluded.best_acc),
        times_read = times_read + 1,
        completed_at = CURRENT_TIMESTAMP
    `).run(req.child.id, session.story_id, accuracy || 0);

    // Award story acorns
    const story = db.prepare('SELECT acorns FROM stories WHERE id = ?').get(session.story_id);
    const storyBonus = story?.acorns || 0;
    db.prepare('UPDATE children SET acorns = acorns + ?, total_acorns = total_acorns + ? WHERE id = ?')
      .run(storyBonus, storyBonus, req.child.id);

    // Update streak
    const child = db.prepare('SELECT * FROM children WHERE id = ?').get(req.child.id);
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const newStreak = child.last_read === today
      ? child.streak
      : child.last_read === yesterday
        ? child.streak + 1
        : 1;
    db.prepare('UPDATE children SET streak = ?, last_read = ? WHERE id = ?')
      .run(newStreak, today, req.child.id);

    // Check achievements
    const updated = db.prepare('SELECT * FROM children WHERE id = ?').get(req.child.id);
    const completedCount = db.prepare('SELECT COUNT(*) as n FROM completed_stories WHERE child_id = ?').get(req.child.id).n;
    const newlyEarned = checkAndAwardAchievements(db, updated, completedCount);

    return { child: updated, newlyEarned, storyBonus };
  });

  const result = completeAndAward();
  res.json({
    success: true,
    data: {
      child: formatChild(result.child),
      storyBonus: result.storyBonus,
      newAchievements: result.newlyEarned,
    }
  });
};

function checkAndAwardAchievements(db, child, completedCount) {
  const allAch = db.prepare('SELECT * FROM achievements').all();
  const earned = new Set(
    db.prepare('SELECT achievement_id FROM earned_achievements WHERE child_id = ?').all(child.id).map(r => r.achievement_id)
  );
  const insert = db.prepare('INSERT OR IGNORE INTO earned_achievements (child_id, achievement_id) VALUES (?,?)');
  const newlyEarned = [];

  for (const ach of allAch) {
    if (earned.has(ach.id)) continue;
    let met = false;
    switch (ach.condition_type) {
      case 'stories_done':   met = completedCount >= ach.condition_value; break;
      case 'phase':          met = child.phase >= ach.condition_value; break;
      case 'streak':         met = child.streak >= ach.condition_value; break;
      case 'total_acorns':   met = child.total_acorns >= ach.condition_value; break;
      case 'words_read':     met = child.words_read >= ach.condition_value; break;
      case 'has_perfect':    met = child.has_perfect >= ach.condition_value; break;
    }
    if (met) { insert.run(child.id, ach.id); newlyEarned.push(ach); }
  }
  return newlyEarned;
}

export const getProgress = (req, res) => {
  const db = getDb();
  const child = req.child;
  const completed = db.prepare('SELECT * FROM completed_stories WHERE child_id = ?').all(child.id);
  const achievements = db.prepare(`
    SELECT a.* FROM achievements a
    JOIN earned_achievements ea ON ea.achievement_id = a.id
    WHERE ea.child_id = ? ORDER BY ea.earned_at DESC
  `).all(child.id);
  const sessions = db.prepare(`
    SELECT rs.*, s.title, s.emoji FROM reading_sessions rs
    JOIN stories s ON s.id = rs.story_id
    WHERE rs.child_id = ? AND rs.completed_at IS NOT NULL
    ORDER BY rs.completed_at DESC LIMIT 10
  `).all(child.id);
  const customGoal = db.prepare('SELECT * FROM custom_goals WHERE child_id = ?').get(child.id);

  res.json({
    success: true,
    data: {
      child: formatChild(child),
      completedStories: completed.map(c => ({ storyId: c.story_id, bestAcc: c.best_acc, timesRead: c.times_read })),
      achievements,
      recentSessions: sessions,
      customGoal,
    }
  });
};

export const upsertGoal = (req, res) => {
  const { title, emoji, cost } = req.body;
  const db = getDb();
  db.prepare(`
    INSERT INTO custom_goals (child_id, title, emoji, cost) VALUES (?,?,?,?)
    ON CONFLICT(child_id) DO UPDATE SET title=excluded.title, emoji=excluded.emoji, cost=excluded.cost
  `).run(req.child.id, title, emoji || '🎁', parseInt(cost));
  const goal = db.prepare('SELECT * FROM custom_goals WHERE child_id = ?').get(req.child.id);
  res.json({ success: true, data: goal });
};

export const deleteGoal = (req, res) => {
  getDb().prepare('DELETE FROM custom_goals WHERE child_id = ?').run(req.child.id);
  res.json({ success: true });
};

function formatChild(c) {
  return {
    id: c.id, name: c.name, phase: c.phase,
    acorns: c.acorns, totalAcorns: c.total_acorns,
    wordsRead: c.words_read, streak: c.streak,
    lastRead: c.last_read, hasPerfect: Boolean(c.has_perfect), avatar: c.avatar,
  };
}
