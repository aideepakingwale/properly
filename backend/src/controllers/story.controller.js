import getDb from '../db/database.js';

export const getStories = (req, res) => {
  const { phase, childId } = req.query;
  const db = getDb();

  let stories;
  if (phase) {
    stories = db.prepare('SELECT * FROM stories WHERE phase = ? ORDER BY sort_order').all(parseInt(phase));
  } else {
    stories = db.prepare('SELECT * FROM stories ORDER BY phase, sort_order').all();
  }

  // Attach completed status if childId provided
  let completedSet = new Set();
  if (childId) {
    const rows = db.prepare("SELECT story_id FROM completed_stories WHERE child_id=? AND story_type='static'").all(childId);
    completedSet = new Set(rows.map(r => r.story_id));
  }

  res.json({
    success: true,
    data: stories.map(s => ({
      ...formatStory(s),
      isCompleted: completedSet.has(s.id),
    })),
  });
};

export const getStory = (req, res) => {
  const db = getDb();
  const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(req.params.id);
  if (!story) return res.status(404).json({ success: false, message: 'Story not found' });

  const pages = db.prepare('SELECT * FROM story_pages WHERE story_id = ? ORDER BY page_index').all(story.id);
  res.json({ success: true, data: { ...formatStory(story), pages: pages.map(formatPage) } });
};

export const getPhases = (_req, res) => {
  const phases = {
    2: { label: 'Simple CVC Words',         desc: 'cat, dog, sit, hop',              color: '#10B981', bg: '#D1FAE5' },
    3: { label: 'Digraphs & Vowel Teams',    desc: 'rain, feet, shop, chat',          color: '#3B82F6', bg: '#DBEAFE' },
    4: { label: 'CCVC/CVCC Blends',         desc: 'frog, best, crept, stamp',        color: '#8B5CF6', bg: '#EDE9FE' },
    5: { label: 'Split Digraphs',            desc: 'cake, kite, home, tube',          color: '#F59E0B', bg: '#FEF3C7' },
    6: { label: 'Prefixes & Suffixes',       desc: 'unhappy, careful, discovery',     color: '#EF4444', bg: '#FEE2E2' },
  };
  res.json({ success: true, data: phases });
};

function formatStory(s) {
  return { id: s.id, phase: s.phase, title: s.title, emoji: s.emoji, cover: s.cover, acorns: s.acorns, pageCount: s.page_count };
}
function formatPage(p) {
  return { index: p.page_index, text: p.text, scene: p.scene, bgClass: p.bg_class, isDark: Boolean(p.is_dark) };
}
