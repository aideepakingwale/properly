/**
 * @file        ai-story.controller.js
 * @description AI story controller — batch generation, retrieval, progress tracking for personalised stories
 * @module      AI Stories
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - Batch generation runs asynchronously; stories appear in list as they complete
 *   - Daily limit of 5 AI stories per child enforced in generateAiStoryBatch
 *   - Stories are scoped to child_id — cross-child access is rejected by requireChild
 */

import getDb from '../db/database.js';
import { generateBatch, THEMES, PHASE_PHONICS } from '../services/story-generator.service.js';

// ── UTILITIES ─────────────────────────────────────────────────
function formatStory(story, pages) {
  return {
    id:            story.id,
    batchId:       story.batch_id,
    title:         story.title,
    emoji:         story.emoji,
    coverScene:    story.cover_scene,
    phase:         story.phase,
    theme:         story.theme,
    targetPhonemes:JSON.parse(story.target_phonemes || '[]'),
    acorns:        story.acorns,
    pageCount:     story.page_count,
    // Student profile snapshot
    childName:     story.child_name,
    childAge:      story.child_age,
    childGender:   story.child_gender,
    childInterests:JSON.parse(story.child_interests || '[]'),
    // Progress
    status:        story.status || 'unread',
    bestAccuracy:  story.best_accuracy || 0,
    timesRead:     story.times_read || 0,
    lastReadAt:    story.last_read_at,
    completedAt:   story.completed_at,
    moral:         story.moral || null,   // populated when story loaded with pages
    isAiGenerated: true,
    aiProvider:    story.ai_provider,
    createdAt:     story.created_at,
    pages: pages ? pages.map(p => ({
      index:         p.page_index,
      text:          p.text,
      scene:         p.scene_emoji,
      bg:            p.bg_class,
      targetWords:   JSON.parse(p.target_words || '[]'),
      bestAccuracy:  p.best_accuracy,
      attempts:      p.attempts || 0,
      completedAt:   p.completed_at,
    })) : undefined,
  };
}

// ── GET THEMES ────────────────────────────────────────────────
export const getThemes = (_req, res) => {
  res.json({ success: true, data: { themes: Object.entries(THEMES).map(([id, t]) => ({ id, emoji: t.emoji })) } });
};

// ── GET PHASE INFO ────────────────────────────────────────────
export const getPhaseInfo = (req, res) => {
  const phase = parseInt(req.params.phase);
  const p = PHASE_PHONICS[phase];
  if (!p) return res.status(400).json({ success: false, message: 'Invalid phase' });
  res.json({ success: true, data: { phase, ...p } });
};

// ── GET CHILD'S AI STORIES ────────────────────────────────────
export const getAiStories = (req, res) => {
  const db   = getDb();
  const { status, theme, limit = 20, offset = 0 } = req.query;

  let sql = 'SELECT * FROM ai_stories WHERE child_id = ? AND is_active = 1';
  const params = [req.child.id];

  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (theme)  { sql += ' AND theme = ?';  params.push(theme);  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const stories = db.prepare(sql).all(...params);

  // Aggregate progress stats for the list view (no page content)
  const unread    = stories.filter(s => s.status === 'unread').length;
  const inProg    = stories.filter(s => s.status === 'in_progress').length;
  const completed = stories.filter(s => s.status === 'completed').length;

  res.json({
    success: true,
    data: {
      stories: stories.map(s => formatStory(s, null)),
      summary: { total: stories.length, unread, inProgress: inProg, completed },
    },
  });
};

// ── GET SINGLE STORY WITH PAGES ───────────────────────────────
export const getAiStory = (req, res) => {
  const db    = getDb();
  const story = db.prepare('SELECT * FROM ai_stories WHERE id = ? AND child_id = ?')
    .get(req.params.storyId, req.child.id);

  if (!story) return res.status(404).json({ success: false, message: 'Story not found' });

  const pages = db.prepare('SELECT * FROM ai_story_pages WHERE story_id = ? ORDER BY page_index')
    .all(story.id);

  res.json({ success: true, data: formatStory(story, pages) });
};

// ── BATCH GENERATE ────────────────────────────────────────────
export const generateAiStoryBatch = async (req, res) => {
  const db    = getDb();
  const child = req.child;
  const { count = 5, forceThemes = null } = req.body;

  // Clamp count 1–10
  const batchSize = Math.min(10, Math.max(1, parseInt(count) || 5));

  // Daily limit check (per-batch, not per-story)
  const todayBatches = db.prepare(`
    SELECT COUNT(*) as n FROM ai_story_batches
    WHERE child_id = ? AND date(created_at) = date('now')
  `).get(child.id).n;

  if (todayBatches >= 3) {
    return res.status(429).json({
      success: false, limitReached: true,
      message: 'Daily story batch limit reached (3 batches = up to 30 stories/day). Come back tomorrow!',
    });
  }

  // Gather full personalisation data
  const interestsRow = db.prepare('SELECT interests FROM child_interests WHERE child_id = ?').get(child.id);
  const interests = JSON.parse(interestsRow?.interests || '[]').map(i => i.toLowerCase().trim());

  const struggledWords = db.prepare(`
    SELECT word FROM struggled_words
    WHERE child_id = ? ORDER BY fail_count DESC, last_seen DESC LIMIT 8
  `).all(child.id).map(r => r.word);

  const recentTitles = db.prepare(`
    SELECT title FROM ai_stories WHERE child_id = ? ORDER BY created_at DESC LIMIT 8
  `).all(child.id).map(r => r.title);

  // Create batch record
  const batchId = crypto.randomUUID?.() || `b${Date.now()}`;
  db.prepare(`
    INSERT INTO ai_story_batches (id, child_id, requested_count, status)
    VALUES (?,?,?,'generating')
  `).run(batchId, child.id, batchSize);

  // Generate — collect debug steps
  const debugSteps = [];
  let result;
  try {
    result = await generateBatch({
      child: {
        id:     child.id,
        name:   child.name,
        phase:  child.phase,
        age:    child.age   || null,
        gender: child.gender || 'neutral',
      },
      interests,
      struggledWords,
      recentTitles,
      count: batchSize,
      forceThemes: forceThemes || null,
      onProgress: (step) => debugSteps.push(step),
    });
  } catch (err) {
    db.prepare("UPDATE ai_story_batches SET status='failed' WHERE id=?").run(batchId);
    console.error('Batch generation error:', err);
    return res.status(500).json({
      success: false,
      message: 'Story generation failed. Please try again.',
      _debug: { steps: debugSteps, error: err.message },
    });
  }

  const { stories, provider, themes } = result;

  // Log if we fell back to static rules — this means both AI providers failed
  if (provider === 'fallback') {
    console.warn(`[AI Story] Both AI providers failed — using fallback stories for batch ${batchId}`);
    try {
      db.prepare(`INSERT INTO content_reports
        (user_id, content_type, content_id, content_title, reason, detail, status)
        VALUES (?,?,?,?,?,?,?)`)
        .run(req.user.userId, 'ai_story', batchId,
          `Batch ${batchId}`, 'generation_failed',
          'Auto: Both Gemini and Groq failed — stories were generated using static fallback templates',
          'pending');
    } catch {}
  }

  // Persist each story and its pages
  const phaseAcorns = { 2:15, 3:20, 4:25, 5:30, 6:40 };
  const acorns      = phaseAcorns[child.phase] || 20;

  const savedStories = [];

  const insertBatch = db.transaction(() => {
    for (const story of stories) {
      const storyId = crypto.randomUUID?.() || `s${Date.now()}-${Math.random()}`;

      // Collect all unique target phonemes across pages
      const allPhonemes = [...new Set(
        (story.target_phonemes || []).concat(
          story.pages.flatMap(p => p.target_words || [])
        )
      )];

      db.prepare(`
        INSERT INTO ai_stories
          (id, child_id, batch_id, title, emoji, cover_scene, phase, theme,
           target_phonemes, acorns, page_count,
           child_name, child_age, child_gender, child_interests, struggled_words,
           status, ai_provider)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'unread',?)
      `).run(
        storyId, child.id, batchId,
        story.title, story.emoji || '📖', story.cover_scene || '🌿',
        child.phase, story.theme || themes[savedStories.length] || 'adventure',
        JSON.stringify(allPhonemes), acorns, story.pages.length,
        child.name, child.age || null, child.gender || 'neutral',
        JSON.stringify(interests), JSON.stringify(struggledWords),
        provider
      );

      // Store the moral in app_settings as a quick lookup (moral is also last page text)
      // Note: moral may not be in the schema — it lives as the last page's text

      // Insert pages
      story.pages.forEach((page, idx) => {
        db.prepare(`
          INSERT INTO ai_story_pages
            (story_id, page_index, text, scene_emoji, bg_class, target_words)
          VALUES (?,?,?,?,?,?)
        `).run(
          storyId, idx,
          page.text, page.scene || '🌿', page.bg || 'bg-warm',
          JSON.stringify(page.target_words || [])
        );
      });

      savedStories.push({ storyId, title: story.title, theme: story.theme });
    }
  });

  insertBatch();

  // Update batch record
  db.prepare(`
    UPDATE ai_story_batches SET
      status='done', generated_count=?, themes_used=?, completed_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(savedStories.length, JSON.stringify(themes), batchId);

  // Return the saved stories with pages
  const fullStories = savedStories.map(({ storyId }) => {
    const s = db.prepare('SELECT * FROM ai_stories WHERE id=?').get(storyId);
    const p = db.prepare('SELECT * FROM ai_story_pages WHERE story_id=? ORDER BY page_index').all(storyId);
    return formatStory(s, p);
  });

  res.status(201).json({
    success: true,
    data: {
      batchId,
      count:    fullStories.length,
      themes,
      provider,
      stories:  fullStories,
      _debug: {
        steps:    debugSteps,
        provider,
        geminiKey: !!process.env.GEMINI_API_KEY,
        groqKey:   !!process.env.GROQ_API_KEY,
        raw:       result._debug || null,
      },
    },
  });
};

// ── START AI STORY SESSION ─────────────────────────────────────
export const startAiStorySession = (req, res) => {
  const db    = getDb();
  const story = db.prepare('SELECT * FROM ai_stories WHERE id=? AND child_id=?')
    .get(req.params.storyId, req.child.id);
  if (!story) return res.status(404).json({ success: false, message: 'Story not found' });

  const session = db.prepare(`
    INSERT INTO ai_story_sessions (child_id, ai_story_id, total_pages)
    VALUES (?,?,?) RETURNING *
  `).get(req.child.id, story.id, story.page_count);

  // Mark story as in_progress
  db.prepare(`UPDATE ai_stories SET status='in_progress', last_read_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(story.id);

  res.json({ success: true, data: { sessionId: session.id } });
};

// ── SUBMIT AI STORY PAGE RESULT ───────────────────────────────
export const submitAiStoryPage = (req, res) => {
  const db = getDb();
  const { sessionId, pageIndex, accuracy, spokenText, wordScores } = req.body;

  const session = db.prepare('SELECT * FROM ai_story_sessions WHERE id=? AND child_id=?')
    .get(sessionId, req.child.id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

  // Update per-page progress
  const page = db.prepare(
    'SELECT * FROM ai_story_pages WHERE story_id=? AND page_index=?'
  ).get(session.ai_story_id, pageIndex);

  if (page) {
    const newBest = Math.max(page.best_accuracy || 0, accuracy || 0);
    const isComplete = (accuracy || 0) >= 50;
    db.prepare(`
      UPDATE ai_story_pages SET
        best_accuracy = ?,
        attempts = attempts + 1,
        last_spoken = ?,
        last_word_scores = ?,
        completed_at = CASE WHEN ? AND completed_at IS NULL THEN CURRENT_TIMESTAMP ELSE completed_at END
      WHERE story_id=? AND page_index=?
    `).run(newBest, spokenText || '', JSON.stringify(wordScores || []), isComplete ? 1 : 0, session.ai_story_id, pageIndex);
  }

  // Update session pages_read count
  db.prepare(`UPDATE ai_story_sessions SET pages_read = MAX(pages_read, ?) WHERE id=?`)
    .run(pageIndex + 1, sessionId);

  res.json({ success: true });
};

// ── COMPLETE AI STORY SESSION ─────────────────────────────────
export const completeAiStorySession = (req, res) => {
  const db = getDb();
  const { sessionId, accuracy } = req.body;

  const session = db.prepare('SELECT * FROM ai_story_sessions WHERE id=? AND child_id=?')
    .get(sessionId, req.child.id);
  if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

  const story = db.prepare('SELECT * FROM ai_stories WHERE id=?').get(session.ai_story_id);
  if (!story) return res.status(404).json({ success: false, message: 'Story not found' });

  const acc = accuracy || 0;
  const acornsEarned = acc >= 90 ? story.acorns : acc >= 70 ? Math.floor(story.acorns * 0.75) : acc >= 50 ? Math.floor(story.acorns * 0.5) : 0;

  // Mark session complete
  db.prepare(`
    UPDATE ai_story_sessions SET
      completed_at=CURRENT_TIMESTAMP, accuracy=?, acorns_earned=?, pages_read=total_pages
    WHERE id=?
  `).run(acc, acornsEarned, sessionId);

  // Update story progress
  const newBest = Math.max(story.best_accuracy || 0, acc);
  db.prepare(`
    UPDATE ai_stories SET
      status='completed',
      best_accuracy=?,
      times_read=times_read+1,
      last_read_at=CURRENT_TIMESTAMP,
      completed_at=CASE WHEN completed_at IS NULL THEN CURRENT_TIMESTAMP ELSE completed_at END
    WHERE id=?
  `).run(newBest, story.id);

  // Award acorns to child
  if (acornsEarned > 0) {
    db.prepare('UPDATE children SET acorns=acorns+?, total_acorns=total_acorns+? WHERE id=?')
      .run(acornsEarned, acornsEarned, req.child.id);
  }

  // Update words_read count
  db.prepare('UPDATE children SET words_read=words_read+? WHERE id=?')
    .run(story.page_count * 8, req.child.id);

  res.json({
    success: true,
    data: { acornsEarned, accuracy: acc, bestAccuracy: newBest, timesRead: (story.times_read || 0) + 1 },
  });
};

// ── GET STORY PROGRESS ────────────────────────────────────────
export const getAiStoryProgress = (req, res) => {
  const db    = getDb();
  const child = req.child;

  const stories = db.prepare(`
    SELECT s.*, COUNT(p.id) as total_pages,
           SUM(CASE WHEN p.completed_at IS NOT NULL THEN 1 ELSE 0 END) as pages_done,
           AVG(CASE WHEN p.best_accuracy IS NOT NULL THEN p.best_accuracy ELSE NULL END) as avg_accuracy
    FROM ai_stories s
    LEFT JOIN ai_story_pages p ON p.story_id = s.id
    WHERE s.child_id = ? AND s.is_active = 1
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `).all(child.id);

  const summary = {
    total:      stories.length,
    unread:     stories.filter(s => s.status === 'unread').length,
    inProgress: stories.filter(s => s.status === 'in_progress').length,
    completed:  stories.filter(s => s.status === 'completed').length,
    avgAccuracy: stories.filter(s => s.best_accuracy > 0).reduce((a, s) => a + s.best_accuracy, 0)
                / (stories.filter(s => s.best_accuracy > 0).length || 1),
    totalAcornsEarned: db.prepare(`
      SELECT COALESCE(SUM(acorns_earned),0) as n FROM ai_story_sessions WHERE child_id=?
    `).get(child.id).n,
  };

  const byTheme = {};
  for (const s of stories) {
    if (!byTheme[s.theme]) byTheme[s.theme] = { count:0, completed:0 };
    byTheme[s.theme].count++;
    if (s.status === 'completed') byTheme[s.theme].completed++;
  }

  res.json({ success: true, data: { summary, byTheme, stories: stories.map(s => formatStory(s, null)) } });
};

// ── DELETE AI STORY ───────────────────────────────────────────
export const deleteAiStory = (req, res) => {
  const db = getDb();
  db.prepare('UPDATE ai_stories SET is_active=0 WHERE id=? AND child_id=?')
    .run(req.params.storyId, req.child.id);
  res.json({ success: true });
};

// ── INTERESTS CRUD ────────────────────────────────────────────
export const getInterests = (req, res) => {
  const db  = getDb();
  const row = db.prepare('SELECT * FROM child_interests WHERE child_id=?').get(req.child.id);
  res.json({ success: true, data: {
    interests:       JSON.parse(row?.interests || '[]'),
    favouriteColour: row?.favourite_colour || 'green',
    favouriteAnimal: row?.favourite_animal || 'owl',
  }});
};

export const setInterests = (req, res) => {
  const db = getDb();
  const { interests = [], favouriteColour, favouriteAnimal } = req.body;
  const clean = interests.filter(i => typeof i==='string' && i.length<30).map(i=>i.toLowerCase().trim()).slice(0,8);
  db.prepare(`
    INSERT INTO child_interests (child_id,interests,favourite_colour,favourite_animal)
    VALUES (?,?,?,?)
    ON CONFLICT(child_id) DO UPDATE SET
      interests=excluded.interests,
      favourite_colour=COALESCE(excluded.favourite_colour, favourite_colour),
      favourite_animal=COALESCE(excluded.favourite_animal, favourite_animal),
      updated_at=CURRENT_TIMESTAMP
  `).run(req.child.id, JSON.stringify(clean), favouriteColour||null, favouriteAnimal||null);
  res.json({ success: true, data: { interests: clean } });
};

// ── STRUGGLE WORDS ─────────────────────────────────────────────
export const recordStruggle = (req, res) => {
  const db = getDb();
  const { word, phoneme } = req.body;
  if (!word) return res.status(400).json({ success:false, message:'word required' });
  db.prepare(`
    INSERT INTO struggled_words (child_id,word,phoneme,fail_count,last_seen)
    VALUES (?,?,?,1,CURRENT_TIMESTAMP)
    ON CONFLICT(child_id,word) DO UPDATE SET
      fail_count=fail_count+1, phoneme=COALESCE(excluded.phoneme,phoneme), last_seen=CURRENT_TIMESTAMP
  `).run(req.child.id, word.toLowerCase(), phoneme||null);
  res.json({ success: true });
};

export const getStruggles = (req, res) => {
  const db   = getDb();
  const rows = db.prepare('SELECT * FROM struggled_words WHERE child_id=? ORDER BY fail_count DESC, last_seen DESC LIMIT 20').all(req.child.id);
  res.json({ success: true, data: { words: rows } });
};

// ── GENERATION STATUS ─────────────────────────────────────────
export const getGenerationStatus = (_req, res) => {
  const pollToken = (process.env.POLLINATIONS_TOKEN || '').trim();
  res.json({ success: true, data: {
    geminiAvailable:      Boolean(process.env.GEMINI_API_KEY),
    groqAvailable:        Boolean(process.env.GROQ_API_KEY),
    batchSizeMax:         10,
    dailyBatchLimit:      3,
    // Book image generation
    // Image generation providers (checked in priority order)
    pollinationsTokenSet: Boolean(pollToken),
    hfTokenSet:           Boolean(process.env.HUGGINGFACE_TOKEN),
    imageProvider:        pollToken                     ? '🌸 Pollinations.ai (fastest ~5s)'
                        : process.env.HUGGINGFACE_TOKEN ? '🤗 HuggingFace AI (best quality)'
                        :                                 '📷 Picsum Photos (free placeholder)',
    imageProviderActive:  pollToken ? 'pollinations'
                        : process.env.HUGGINGFACE_TOKEN ? 'huggingface' : 'picsum',
    imageSetupTips: {
      pollinations:  pollToken   ? null : 'Get free key: pollinations.ai → Login → Settings → API Key → add as POLLINATIONS_TOKEN',
      huggingface:   process.env.HUGGINGFACE_TOKEN ? null : 'Get free key: huggingface.co/settings/tokens → New token → add as HUGGINGFACE_TOKEN',
    },
    r2Available:          Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID),
    imageStorage:         (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID)
                            ? 'Cloudflare R2 (permanent)'
                            : 'inline data URLs (SVG only — add R2 env vars for full storage)',
  }});
};
