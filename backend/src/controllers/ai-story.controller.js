import getDb from '../db/database.js';
import { generateStory, THEMES, PHASE_PHONICS } from '../services/story-generator.service.js';

// ── HELPER ────────────────────────────────────────────────────
function pickBg(index) {
  return ['bg-warm','bg-green','bg-blue','bg-pink','bg-purple','bg-orange'][index % 6];
}

// ── GET THEMES (public) ───────────────────────────────────────
export const getThemes = (_req, res) => {
  res.json({ success: true, data: Object.entries(THEMES).map(([k, v]) => ({ id:k, label:k.charAt(0).toUpperCase()+k.slice(1), emoji:v.emoji })) });
};

// ── GET PHASE PHONICS INFO ────────────────────────────────────
export const getPhaseInfo = (req, res) => {
  const phase = parseInt(req.params.phase) || 2;
  res.json({ success: true, data: PHASE_PHONICS[phase] || PHASE_PHONICS[2] });
};

// ── GET CHILD'S AI STORIES ────────────────────────────────────
export const getAiStories = (req, res) => {
  const db = getDb();
  const stories = db.prepare(`
    SELECT s.*, COUNT(p.id) as page_count
    FROM ai_stories s
    LEFT JOIN ai_story_pages p ON p.story_id = s.id
    WHERE s.child_id = ? AND s.is_active = 1
    GROUP BY s.id
    ORDER BY s.created_at DESC
    LIMIT 20
  `).all(req.child.id);

  const completedSet = new Set(
    db.prepare('SELECT story_id FROM completed_stories WHERE child_id = ?').all(req.child.id).map(r => r.story_id)
  );

  res.json({
    success: true,
    data: stories.map(s => ({
      id: s.id,
      title: s.title,
      emoji: s.emoji,
      coverScene: s.cover_scene,
      phase: s.phase,
      theme: s.theme,
      targetPhonemes: JSON.parse(s.target_phonemes || '[]'),
      acorns: s.acorns,
      pageCount: s.page_count || 3,
      aiProvider: s.ai_provider,
      isAiGenerated: true,
      isCompleted: completedSet.has(s.id),
      createdAt: s.created_at,
    })),
  });
};

// ── GET SINGLE AI STORY WITH PAGES ───────────────────────────
export const getAiStory = (req, res) => {
  const db = getDb();
  const story = db.prepare('SELECT * FROM ai_stories WHERE id = ? AND child_id = ?')
    .get(req.params.storyId, req.child.id);

  if (!story) return res.status(404).json({ success: false, message: 'Story not found' });

  const pages = db.prepare('SELECT * FROM ai_story_pages WHERE story_id = ? ORDER BY page_index').all(story.id);

  res.json({
    success: true,
    data: {
      id: story.id,
      title: story.title,
      emoji: story.emoji,
      coverScene: story.cover_scene,
      phase: story.phase,
      theme: story.theme,
      acorns: story.acorns,
      pageCount: pages.length,
      aiProvider: story.ai_provider,
      isAiGenerated: true,
      pages: pages.map(p => ({
        index: p.page_index,
        text: p.text,
        scene: p.scene_emoji,
        bgClass: p.bg_class,
        isDark: false,
        targetWords: JSON.parse(p.target_words || '[]'),
      })),
    },
  });
};

// ── GENERATE NEW STORY ────────────────────────────────────────
export const generateAiStory = async (req, res) => {
  const db = getDb();
  const child = req.child;
  const { theme = 'adventure', forceRegenerate = false } = req.body;

  // Validate theme
  if (!THEMES[theme]) {
    return res.status(400).json({ success: false, message: `Unknown theme. Valid: ${Object.keys(THEMES).join(', ')}` });
  }

  // Rate limit: max 5 AI generations per child per day
  const today = new Date().toDateString();
  const todayCount = db.prepare(`
    SELECT COUNT(*) as n FROM ai_stories
    WHERE child_id = ? AND date(created_at) = date('now')
  `).get(child.id).n;

  if (todayCount >= 5 && !forceRegenerate) {
    return res.status(429).json({
      success: false,
      message: 'Daily story limit reached (5 per day). Come back tomorrow for new stories!',
      limitReached: true,
    });
  }

  // Gather personalisation data
  const interests = db.prepare('SELECT interests FROM child_interests WHERE child_id = ?').get(child.id);
  const interestList = JSON.parse(interests?.interests || '[]');

  const struggledWords = db.prepare(`
    SELECT word, phoneme FROM struggled_words
    WHERE child_id = ? ORDER BY fail_count DESC, last_seen DESC LIMIT 8
  `).all(child.id).map(r => r.word);

  const recentTitles = db.prepare(`
    SELECT title FROM ai_stories WHERE child_id = ? ORDER BY created_at DESC LIMIT 5
  `).all(child.id).map(r => r.title);

  // Check recent static story completions for phase-appropriate difficulty hints
  const completedCount = db.prepare(`
    SELECT COUNT(*) as n FROM completed_stories cs
    JOIN stories s ON s.id = cs.story_id
    WHERE cs.child_id = ? AND s.phase = ?
  `).get(child.id, child.phase).n;

  // Generate story
  let storyResult;
  try {
    storyResult = await generateStory({
      childName: child.name,
      phase: child.phase,
      theme,
      interests: interestList,
      struggledWords,
      recentTitles,
    });
  } catch (err) {
    console.error('Story generation error:', err);
    return res.status(500).json({ success: false, message: 'Story generation failed. Please try again.' });
  }

  const { story, provider } = storyResult;

  // Determine acorn reward based on phase
  const phaseAcorns = { 2:15, 3:20, 4:25, 5:30, 6:40 };
  const acorns = phaseAcorns[child.phase] || 20;

  // Collect target phonemes from all pages
  const allTargetWords = story.pages.flatMap(p => p.target_words || []);
  const phonemes = PHASE_PHONICS[child.phase]?.patterns.filter(ph =>
    allTargetWords.some(w => w.toLowerCase().includes(ph.replace('_','').replace('-','')))
  ).slice(0, 5) || [];

  // Store in DB
  const saveStory = db.transaction(() => {
    const storyRow = db.prepare(`
      INSERT INTO ai_stories
        (child_id, title, emoji, cover_scene, phase, theme, target_phonemes, acorns, page_count, ai_provider)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `).get(
      child.id, story.title, story.emoji || '📖',
      story.cover_scene || '🌟✨',
      child.phase, theme,
      JSON.stringify(phonemes), acorns, story.pages.length, provider
    );

    const insertPage = db.prepare(`
      INSERT INTO ai_story_pages (story_id, page_index, text, scene_emoji, bg_class, target_words)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    story.pages.forEach((page, i) => {
      insertPage.run(
        storyRow.id, i,
        page.text,
        page.scene || '🌿',
        page.bg || pickBg(i),
        JSON.stringify(page.target_words || [])
      );
    });

    return storyRow.id;
  });

  const newStoryId = saveStory();

  // Return the full story
  const savedPages = db.prepare('SELECT * FROM ai_story_pages WHERE story_id = ? ORDER BY page_index').all(newStoryId);

  res.status(201).json({
    success: true,
    data: {
      id: newStoryId,
      title: story.title,
      emoji: story.emoji || '📖',
      coverScene: story.cover_scene || '🌟✨',
      phase: child.phase,
      theme,
      acorns,
      pageCount: savedPages.length,
      aiProvider: provider,
      isAiGenerated: true,
      isCompleted: false,
      targetPhonemes: phonemes,
      childName: child.name,
      pages: savedPages.map(p => ({
        index: p.page_index,
        text: p.text,
        scene: p.scene_emoji,
        bgClass: p.bg_class,
        isDark: false,
        targetWords: JSON.parse(p.target_words || '[]'),
      })),
    },
  });
};

// ── DELETE AI STORY ───────────────────────────────────────────
export const deleteAiStory = (req, res) => {
  const db = getDb();
  db.prepare('UPDATE ai_stories SET is_active = 0 WHERE id = ? AND child_id = ?')
    .run(req.params.storyId, req.child.id);
  res.json({ success: true });
};

// ── GET/SET CHILD INTERESTS ───────────────────────────────────
export const getInterests = (req, res) => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM child_interests WHERE child_id = ?').get(req.child.id);
  res.json({
    success: true,
    data: {
      interests: JSON.parse(row?.interests || '[]'),
      favouriteColour: row?.favourite_colour || 'green',
      favouriteAnimal: row?.favourite_animal || 'owl',
    },
  });
};

export const setInterests = (req, res) => {
  const db = getDb();
  const { interests = [], favouriteColour, favouriteAnimal } = req.body;
  const validInterests = interests.filter(i => typeof i === 'string' && i.length < 30).slice(0, 8);
  db.prepare(`
    INSERT INTO child_interests (child_id, interests, favourite_colour, favourite_animal)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(child_id) DO UPDATE SET
      interests = excluded.interests,
      favourite_colour = excluded.favourite_colour,
      favourite_animal = excluded.favourite_animal,
      updated_at = CURRENT_TIMESTAMP
  `).run(req.child.id, JSON.stringify(validInterests), favouriteColour || 'green', favouriteAnimal || 'owl');

  res.json({ success: true, data: { interests: validInterests } });
};

// ── RECORD STRUGGLED WORD ─────────────────────────────────────
export const recordStruggle = (req, res) => {
  const db = getDb();
  const { word, phoneme } = req.body;
  if (!word) return res.status(400).json({ success: false, message: 'word required' });

  db.prepare(`
    INSERT INTO struggled_words (child_id, word, phoneme, fail_count, last_seen)
    VALUES (?, ?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(child_id, word) DO UPDATE SET
      fail_count = fail_count + 1,
      phoneme = excluded.phoneme,
      last_seen = CURRENT_TIMESTAMP
  `).run(req.child.id, word.toLowerCase(), phoneme || null);

  res.json({ success: true });
};

// ── GET STRUGGLED WORDS SUMMARY ───────────────────────────────
export const getStruggles = (req, res) => {
  const db = getDb();
  const words = db.prepare(`
    SELECT word, phoneme, fail_count, last_seen
    FROM struggled_words WHERE child_id = ?
    ORDER BY fail_count DESC, last_seen DESC LIMIT 20
  `).all(req.child.id);
  res.json({ success: true, data: words });
};

// ── GENERATION STATUS (provider check) ───────────────────────
export const getGenerationStatus = (_req, res) => {
  const hasGroq = Boolean(process.env.GROQ_API_KEY);
  const hasGemini    = Boolean(process.env.GEMINI_API_KEY    && process.env.GEMINI_API_KEY    !== 'your-gemini-api-key-here');
  res.json({
    success: true,
    data: {
      available: true,
      provider: hasGemini ? 'gemini' : hasGroq ? 'groq' : 'fallback',
      primaryFree: hasGemini,
      groq: hasGroq,
      gemini: hasGemini,
      fallback: true,
      themes: Object.keys(THEMES),
      dailyLimit: 5,
    },
  });
};
