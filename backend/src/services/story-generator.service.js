/**
 * @file        story-generator.service.js
 * @description AI story generation — rich, moralistic phonics stories personalised to
 *              the child. Stories are 6–8 pages, have a full narrative arc, a clear moral,
 *              and use phonics-appropriate vocabulary for the child's phase.
 * @module      Story Generator
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - Stories are 6 pages minimum, 8 pages maximum (was 3 — too short)
 *   - Every story has: Setting → Problem → Journey × 3-4 → Resolution → Moral
 *   - Each page sentence is longer and richer within the phonics phase constraints
 *   - moral field is mandatory — a simple, child-friendly life lesson
 *   - Phase vocabulary lists include richer, more expressive words
 */

// ── PHONICS CURRICULUM ────────────────────────────────────────
export const PHASE_PHONICS = {
  2: {
    label: 'Simple CVC Words',
    patterns: ['s','a','t','p','i','n','m','d','g','o','c','k','ck','e','u','r','h','b','f','l','ff','ll','ss'],
    targetWords: ['sat','pat','tap','map','nap','tin','pin','fin','dot','hot','cut','bug','run','bed','hen','big','red','top','sit','got'],
    sentenceLength: '5–7 words',
    sentenceGuide: 'Simple subject + verb + object. Use "and" to join two short ideas. e.g. "Tom sat on the big mat and grinned."',
    vocab: 'sat, pat, tap, map, ran, pin, dot, hot, cut, bug, bed, red, big, top, got, pig, hat, can, had, him, not, but, men, let, yes, off, win, hug, wet, dip',
    richWords: 'grin, skip, flip, spin, grab, drip, snap, clap, wag, jig, plop, slip, trip, nod, wink',
  },
  3: {
    label: 'Digraphs & Vowel Teams',
    patterns: ['ch','sh','th','ng','ai','ee','igh','oa','oo','ar','or','ur','ow','oi','ear','air'],
    targetWords: ['chat','shop','ship','rain','feet','night','boat','moon','look','park','corn','hurt','roar','shout','light'],
    sentenceLength: '6–9 words',
    sentenceGuide: 'Subject + vivid verb + location/detail. Chain two ideas with "but" or "so". e.g. "She ran through the dark park and heard a shout."',
    vocab: 'sheep, chain, shout, light, coach, tooth, dark, storm, turn, farm, green, street, beach, night, rain, feet, boat, moon, roar, bark, glow, soil, air, hair, fear, cheer, near, hear, boil, join',
    richWords: 'gleam, soar, swoop, dash, creep, prowl, howl, shriek, flash, charge, shield, vow, gleam',
  },
  4: {
    label: 'CCVC & CVCC Blends',
    patterns: ['bl','cl','fl','gl','pl','sl','br','cr','dr','fr','gr','pr','tr','st','sp','sn','sk','lt','lf','mp','nd'],
    targetWords: ['frog','clap','drip','trip','flag','best','grip','plan','stomp','crisp','blend','trust','brave','cliff','stamp'],
    sentenceLength: '7–10 words',
    sentenceGuide: 'Include a blend word as the key action. Add feeling or consequence. e.g. "She gripped the branch and swung across the dark stream."',
    vocab: 'black, clock, flame, globe, plant, slide, brick, crab, dress, frost, stamp, drink, spring, brand, cleft, crisp, drift, flask, grunt, pluck, scalp, strap, swift, trust, grasp',
    richWords: 'prowl, startle, scramble, tremble, stride, grapple, clash, crumble, flinch, brace, grip, glint',
  },
  5: {
    label: 'Split Digraphs & Alternatives',
    patterns: ['a_e','e_e','i_e','o_e','u_e','ay','ea','ie','oe','ue','ew','wh','ph'],
    targetWords: ['cake','slide','home','tune','play','dream','pie','blue','crew','phone','brave','stone','flame','while','pride'],
    sentenceLength: '8–11 words',
    sentenceGuide: 'Use a split digraph word as a key noun or verb. Include an emotional word. e.g. "She felt brave as she slid down the huge stone slope."',
    vocab: 'brave, smile, stone, huge, spray, treat, tried, clue, flew, photo, throne, while, phase, theme, drove, strove, pride, flame, glaze, shade, quite, these, those, grove, kneel',
    richWords: 'gleaming, blazing, soaring, trembling, shining, gliding, fierce, noble, daring, graceful, gentle',
  },
  6: {
    label: 'Prefixes, Suffixes & Morphology',
    patterns: ['un-','re-','dis-','pre-','-ful','-less','-ness','-tion','-sion','-ment','-ly','-ing','-ed','-er'],
    targetWords: ['unhappy','discovery','fearless','wonderful','careful','excitement','remarkable','kindness','invention','protection'],
    sentenceLength: '9–13 words',
    sentenceGuide: 'Use one prefix/suffix word naturally in context. Show a consequence or realisation. e.g. "She was fearless and led the remarkable discovery that changed everything."',
    vocab: 'remarkable, thoughtful, careless, restarted, discovery, invention, happiness, protection, kindness, wonderful, fearless, carefully, excitement, adventure, proudly, gently, suddenly, quickly, brightly',
    richWords: 'determination, courageous, astonishing, boundless, precious, unstoppable, transformation, enlightened, compassionate',
  },
};

// ── THEMES ────────────────────────────────────────────────────
export const THEMES = {
  adventure:   { emoji:'🗺️', scenes:['🌋🌿','🏔️⛺','🌊🏄','🧭✨'] },
  animals:     { emoji:'🦁', scenes:['🌿🦋','🌳🦊','🌾🐮','🌊🐬'] },
  space:       { emoji:'🚀', scenes:['🌟⭐','🪐🌌','🚀🌙','☄️✨'] },
  dinosaurs:   { emoji:'🦕', scenes:['🌿🦕','🌋🦖','🏞️🥚','🌊🦴'] },
  magic:       { emoji:'🧙', scenes:['✨🔮','🌈🪄','🏰🦄','🌙⭐'] },
  ocean:       { emoji:'🌊', scenes:['🌊🐠','🐚🌊','🦈⭐','🐙🌿'] },
  farm:        { emoji:'🐄', scenes:['🌻🐔','🌾🐑','🐄🌿','🌅🐓'] },
  forest:      { emoji:'🌲', scenes:['🌲🍄','🌿🦔','🍃🐿️','🌸🦊'] },
  dragons:     { emoji:'🐉', scenes:['🔥🐉','🏰⚔️','🌋🐲','✨🪄'] },
  robots:      { emoji:'🤖', scenes:['⚙️🔧','🤖✨','💡🔩','🚀🤖'] },
  cats:        { emoji:'🐱', scenes:['🐱🌸','🌙🐈','🐟🐱','🌿😺'] },
  pirates:     { emoji:'🏴‍☠️', scenes:['⚓🗺️','🌊🦜','🏝️💎','⛵🌊'] },
  superheroes: { emoji:'🦸', scenes:['💥⚡','🌆🦸','✨🌟','🌈💪'] },
  cooking:     { emoji:'🍳', scenes:['🍳🌿','🎂🍰','🥘🌶️','🧁✨'] },
  friendship:  { emoji:'🤝', scenes:['🤝🌸','🌈👫','💛🌟','🏡🤗'] },
  kindness:    { emoji:'💛', scenes:['💛🌸','🌟🤗','🏡💕','🌈🙏'] },
};

const BG_CLASSES = ['bg-warm','bg-green','bg-blue','bg-pink','bg-purple','bg-orange'];

// ── PRONOUNS ─────────────────────────────────────────────────
function pronouns(gender) {
  if (gender === 'boy')  return { sub:'he',   obj:'him',  pos:'his'  };
  if (gender === 'girl') return { sub:'she',  obj:'her',  pos:'her'  };
  return                        { sub:'they', obj:'them', pos:'their' };
}

// ── MORALS BANK (varied per theme) ───────────────────────────
const THEME_MORALS = {
  adventure:   ['Being brave means going even when you are scared.','Every big journey starts with one small step.'],
  animals:     ['All creatures deserve kindness and care.','We can learn something from every living thing.'],
  space:       ['Curiosity leads us to amazing discoveries.','We are never too small to reach for the stars.'],
  dinosaurs:   ['Working together is always stronger than working alone.','Helping others makes the world a better place.'],
  magic:       ['The greatest magic is the kindness inside you.','True power comes from believing in yourself.'],
  ocean:       ['Even small acts of kindness make big waves.','Looking after our world is everyone\'s job.'],
  farm:        ['Hard work and patience bring great rewards.','Every small job matters when we work together.'],
  forest:      ['Nature is a gift — we must care for it.','Even the smallest creature has an important role.'],
  dragons:     ['Courage is not the absence of fear, but choosing to act anyway.','True strength comes from kindness, not force.'],
  robots:      ['It is not what you are made of, but what you do that matters.','Anyone can learn to feel and care for others.'],
  cats:        ['Curiosity and boldness lead to wonderful adventures.','Home is where the people who love you are.'],
  pirates:     ['The greatest treasure is the friends you find along the way.','Honesty and trust are worth more than gold.'],
  superheroes: ['Everyone has the power to help someone today.','The best hero is the one who lifts others up.'],
  cooking:     ['Sharing what you make brings people together.','A little love is the best ingredient.'],
  friendship:  ['A true friend is always there, no matter what.','Kindness to others always comes back to you.'],
  kindness:    ['One small act of kindness can change someone\'s whole day.','We grow stronger by lifting each other up.'],
};

function getMoral(theme) {
  const options = THEME_MORALS[theme] || ['Being kind and brave makes the world brighter.'];
  return options[Math.floor(Math.random() * options.length)];
}

// ── SYSTEM PROMPT ─────────────────────────────────────────────
function buildSystemPrompt(phase) {
  const p = PHASE_PHONICS[phase];
  return `You are an expert UK primary school phonics author writing personalised storybooks for children aged 4–8.

STORY STRUCTURE — every story MUST have exactly these 7 pages:
  Page 1: SETTING    — introduce the world and the main character (the child)
  Page 2: PROBLEM    — something goes wrong or a challenge appears
  Page 3: JOURNEY 1  — the child tries something to solve it
  Page 4: JOURNEY 2  — a twist, helper or obstacle appears
  Page 5: JOURNEY 3  — the child shows courage, kindness or creativity
  Page 6: RESOLUTION — the problem is solved, things are better
  Page 7: MORAL      — a warm, clear life lesson the child takes away

PHONICS RULES — Phase ${phase}: ${p.label}
  • Target patterns: ${p.patterns.slice(0, 16).join(', ')}
  • Example target words: ${p.targetWords.join(', ')}
  • Sentence length per page: ${p.sentenceLength}
  • Sentence writing guide: ${p.sentenceGuide}
  • Core vocabulary: ${p.vocab}
  • Richer expressive words (use sparingly): ${p.richWords}
  • UK English spelling ONLY (colour, mum, programme)
  • NEVER use phonics patterns above Phase ${phase} difficulty
  • Page 7 (moral page) may use slightly richer language — it is read by parent to child

QUALITY RULES:
  • Each sentence must be vivid and engaging — paint a picture with words
  • Include emotions on at least 3 pages (felt, glad, scared, proud, kind, brave, etc.)
  • The child character must DO something active — not just observe
  • The story must feel COMPLETE and SATISFYING — a real story, not a list of events
  • Include at least one other character (animal, friend, creature, helper)
  • The moral on page 7 must be a complete warm sentence the child can remember
  • VARY sentence structure across pages — not all sentences starting with the child's name

OUTPUT FORMAT — return a JSON array of stories, NO markdown fences:
[
  {
    "title": "4–6 word punchy title",
    "emoji": "single emoji",
    "cover_scene": "2–3 emojis",
    "theme": "theme name",
    "moral": "The life lesson in one complete sentence.",
    "target_phonemes": ["ph1","ph2","ph3"],
    "pages": [
      { "text": "Page sentence.", "scene": "2 emojis", "bg": "bg-warm",   "target_words": ["w1","w2"] },
      { "text": "Page sentence.", "scene": "2 emojis", "bg": "bg-green",  "target_words": ["w3"] },
      { "text": "Page sentence.", "scene": "2 emojis", "bg": "bg-blue",   "target_words": ["w4","w5"] },
      { "text": "Page sentence.", "scene": "2 emojis", "bg": "bg-pink",   "target_words": ["w6"] },
      { "text": "Page sentence.", "scene": "2 emojis", "bg": "bg-purple", "target_words": ["w7","w8"] },
      { "text": "Page sentence.", "scene": "2 emojis", "bg": "bg-orange", "target_words": ["w9"] },
      { "text": "Moral sentence — warm and memorable.", "scene": "🌟💛",   "bg": "bg-warm", "target_words": [] }
    ]
  }
]
bg values: bg-warm, bg-green, bg-blue, bg-pink, bg-purple, bg-orange`;
}

// ── USER PROMPT ───────────────────────────────────────────────
function buildUserPrompt({ child, interests, struggledWords, recentTitles, themes, count }) {
  const p  = PHASE_PHONICS[child.phase];
  const pr = pronouns(child.gender || 'neutral');
  const age = child.age ? `${child.age} years old` : 'about 5 years old';
  const interestStr = interests?.length ? interests.join(', ') : themes.join(', ');
  const struggled = struggledWords?.length
    ? `\nPhonics words ${child.name} has found tricky — weave 1–2 of these in naturally: ${struggledWords.slice(0,5).join(', ')}`
    : '';
  const avoid = recentTitles?.length
    ? `\nAvoid re-using these recent story titles or themes: ${recentTitles.slice(0,5).join(', ')}`
    : '';

  const storyBriefs = themes.map((theme, i) => {
    const moral = getMoral(theme);
    return `Story ${i+1}: Theme = ${theme.toUpperCase()} ${THEMES[theme]?.emoji || ''}
  Moral to build towards: "${moral}"
  Key emotion to include: ${['pride','courage','kindness','determination','joy','wonder'][i % 6]}`;
  }).join('\n\n');

  return `Write exactly ${count} phonics story/stories for this child.

CHILD PROFILE:
  Name: ${child.name}
  Age: ${age}
  Gender pronouns: ${pr.sub} / ${pr.obj} / ${pr.pos}
  Phonics Phase: ${child.phase} — ${p.label}
  Interests: ${interestStr}
${struggled}${avoid}

STORY BRIEFS (write each story exactly as briefed):
${storyBriefs}

PHONICS REMINDERS:
  • Every page sentence must be ${p.sentenceLength} — ${p.sentenceGuide}
  • Use these phase-appropriate rich words to make sentences vivid: ${p.richWords}
  • Page 7 is the moral page — make it warm, wise, and easy to remember
  • The child (${child.name}) is the HERO — ${pr.sub} must overcome something and grow

Each story MUST have exactly 7 pages following: Setting → Problem → Journey×3 → Resolution → Moral

Return the JSON array of ${count} complete stories now:`;
}

// ── AI CALLS ──────────────────────────────────────────────────
async function callGemini(systemPrompt, userPrompt) {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key || key.includes('your-')) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: {
            maxOutputTokens: 6000,   // increased from 2400 to allow 7-page stories
            temperature: 0.85,
            responseMimeType: 'application/json',
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_LOW_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_LOW_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
          ],
        }),
      }
    );
    if (!res.ok) { console.warn('[story-gen] Gemini HTTP', res.status, await res.text().catch(() => '')); return null; }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (e) { console.warn('[story-gen] Gemini error:', e.message); return null; }
}

async function callGroq(systemPrompt, userPrompt) {
  const key = (process.env.GROQ_API_KEY || '').trim();
  if (!key) return null;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        max_tokens: 6000,
        temperature: 0.85,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt + '\n\nIMPORTANT: Wrap your JSON array in {"stories": [...]}' },
          { role: 'user',   content: userPrompt },
        ],
      }),
    });
    if (!res.ok) { console.warn('[story-gen] Groq HTTP', res.status); return null; }
    const data = await res.json();
    const raw  = data.choices?.[0]?.message?.content?.trim();
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.stories) return JSON.stringify(parsed.stories);
        if (Array.isArray(parsed)) return JSON.stringify(parsed);
      } catch {}
    }
    return raw || null;
  } catch (e) { console.warn('[story-gen] Groq error:', e.message); return null; }
}

// ── JSON PARSER ───────────────────────────────────────────────
function parseBatchJSON(raw) {
  if (!raw) return null;
  try {
    const cleaned = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    const parsed  = JSON.parse(cleaned);
    const arr     = Array.isArray(parsed) ? parsed : parsed.stories;
    if (!Array.isArray(arr) || arr.length === 0) return null;

    const valid = arr.filter(s => s.title && Array.isArray(s.pages) && s.pages.length >= 3)
      .map(s => {
        // Ensure exactly 7 pages — pad with a moral page if short, trim if too long
        while (s.pages.length < 7) {
          // Add a moral page if the last page isn't one
          s.pages.push({
            text: s.moral || 'Being kind and brave makes every adventure worth it.',
            scene: '🌟💛',
            bg: 'bg-warm',
            target_words: [],
          });
        }
        s.pages = s.pages.slice(0, 8);  // max 8 pages
        if (!s.moral && s.pages.length >= 7) s.moral = s.pages[6].text;
        return s;
      });

    return valid.length > 0 ? valid : null;
  } catch (e) { console.warn('[story-gen] Parse error:', e.message, raw?.slice(0, 200)); return null; }
}

// ── RICH FALLBACK STORIES ─────────────────────────────────────
function buildFallback(child, themes) {
  const pr = pronouns(child.gender || 'neutral');
  const p  = PHASE_PHONICS[child.phase];
  const He = pr.sub.charAt(0).toUpperCase() + pr.sub.slice(1);
  const n  = child.name;

  return themes.map(theme => {
    const moral = getMoral(theme);
    const bg    = BG_CLASSES;
    return {
      title:           `${n} and the ${theme.charAt(0).toUpperCase() + theme.slice(1)}`,
      emoji:           THEMES[theme]?.emoji || '📖',
      cover_scene:     THEMES[theme]?.scenes[0] || '🌟✨',
      theme,
      moral,
      target_phonemes: p.patterns.slice(0, 4),
      pages: [
        { text: `${n} set off on a ${theme} trip one sunny day.`,                                         scene: THEMES[theme]?.scenes[0] || '🌿✨', bg: bg[0], target_words: [p.targetWords[0] || 'set', 'day'] },
        { text: `${He} spotted a big problem and felt a bit scared.`,                                     scene: '😟🌿', bg: bg[1], target_words: [p.targetWords[1] || 'big', 'felt'] },
        { text: `${n} took a deep breath and decided to try.`,                                            scene: '💭🌟', bg: bg[2], target_words: [p.targetWords[2] || 'try', 'deep'] },
        { text: `A helpful friend appeared and showed ${pr.obj} the way.`,                               scene: '🤝✨', bg: bg[3], target_words: [p.targetWords[3] || 'way', 'friend'] },
        { text: `Together they worked hard and never gave up.`,                                           scene: '💪🌈', bg: bg[4], target_words: [p.targetWords[4] || 'hard', 'gave'] },
        { text: `${n} solved it at last and felt so proud and glad.`,                                     scene: '🎉🌟', bg: bg[5], target_words: [p.targetWords[5] || 'proud', 'glad'] },
        { text: moral,                                                                                    scene: '🌟💛', bg: bg[0], target_words: [] },
      ],
    };
  });
}

// ── THEME SELECTOR ────────────────────────────────────────────
function selectThemes(interests, recentTitles, count) {
  const allThemes    = Object.keys(THEMES);
  const recentThemes = new Set(
    recentTitles.map(t => allThemes.find(k => t.toLowerCase().includes(k))).filter(Boolean)
  );
  const interestThemes = (interests || [])
    .map(i => allThemes.find(k => k.includes(i.toLowerCase()) || i.toLowerCase().includes(k)))
    .filter(Boolean);

  const selected = [];
  const used     = new Set();

  for (const t of interestThemes) {
    if (!used.has(t) && selected.length < count) { selected.push(t); used.add(t); }
  }

  const remaining = allThemes
    .filter(t => !used.has(t) && !recentThemes.has(t))
    .sort(() => Math.random() - 0.5);

  for (const t of remaining) {
    if (selected.length >= count) break;
    selected.push(t); used.add(t);
  }

  for (const t of allThemes) {
    if (selected.length >= count) break;
    if (!used.has(t)) { selected.push(t); used.add(t); }
  }

  return selected.slice(0, count);
}

// ── MAIN EXPORT ───────────────────────────────────────────────
export async function generateBatch(opts) {
  const {
    child,
    interests      = [],
    struggledWords = [],
    recentTitles   = [],
    count          = 5,
    forceThemes    = null,
    onProgress     = null,   // optional callback: (step) => void for SSE/debug
  } = opts;

  const log = (step, data = {}) => {
    const msg = { step, ts: new Date().toISOString(), ...data };
    console.log(`[story-gen]`, JSON.stringify(msg));
    onProgress?.(msg);
  };

  const themes       = forceThemes || selectThemes(interests, recentTitles, count);
  const systemPrompt = buildSystemPrompt(child.phase);
  const userPrompt   = buildUserPrompt({ child, interests, struggledWords, recentTitles, themes, count: themes.length });

  log('start', {
    child: child.name, phase: child.phase, themes, count: themes.length,
    geminiKey: !!process.env.GEMINI_API_KEY,
    groqKey:   !!process.env.GROQ_API_KEY,
    interests, struggledWords: struggledWords.slice(0,4),
  });

  // 1. Gemini
  log('trying_gemini');
  const geminiRaw = await callGemini(systemPrompt, userPrompt);
  if (geminiRaw) {
    log('gemini_raw', { chars: geminiRaw.length, preview: geminiRaw.slice(0, 120) });
    const parsed = parseBatchJSON(geminiRaw);
    if (parsed) {
      parsed.forEach((s, i) => { if (!s.theme || !THEMES[s.theme]) s.theme = themes[i] || 'adventure'; });
      log('done', { provider: 'gemini', stories: parsed.length, pages: parsed[0]?.pages?.length });
      return { stories: parsed, provider: 'gemini', themes, _debug: { provider: 'gemini', raw: geminiRaw.slice(0,500) } };
    }
    log('gemini_parse_failed', { raw: geminiRaw.slice(0, 300) });
  } else {
    log('gemini_failed', { keySet: !!process.env.GEMINI_API_KEY });
  }

  // 2. Groq
  log('trying_groq');
  const groqRaw = await callGroq(systemPrompt, userPrompt);
  if (groqRaw) {
    log('groq_raw', { chars: groqRaw.length, preview: groqRaw.slice(0, 120) });
    const parsed = parseBatchJSON(groqRaw);
    if (parsed) {
      parsed.forEach((s, i) => { if (!s.theme || !THEMES[s.theme]) s.theme = themes[i] || 'adventure'; });
      log('done', { provider: 'groq', stories: parsed.length, pages: parsed[0]?.pages?.length });
      return { stories: parsed, provider: 'groq', themes, _debug: { provider: 'groq', raw: groqRaw.slice(0,500) } };
    }
    log('groq_parse_failed', { raw: groqRaw.slice(0, 300) });
  } else {
    log('groq_failed', { keySet: !!process.env.GROQ_API_KEY });
  }

  // 3. Fallback
  log('using_fallback', { reason: 'both AI providers failed or returned unparseable JSON' });
  return { stories: buildFallback(child, themes), provider: 'fallback', themes, _debug: { provider: 'fallback' } };
}

// Backwards compat single story
export async function generateStory(opts) {
  const { childName, phase, theme = 'adventure', interests = [], struggledWords = [], recentTitles = [] } = opts;
  const result = await generateBatch({
    child: { name: childName, phase, age: null, gender: 'neutral' },
    interests, struggledWords, recentTitles,
    count: 1,
    forceThemes: [theme],
  });
  return { story: result.stories[0], provider: result.provider };
}
