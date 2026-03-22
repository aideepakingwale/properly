/**
 * AI Story Generator — Personalised Phonics Stories
 *
 * Generates unique, curriculum-aligned phonics stories for each child using:
 *   - Child's name (woven into the story)
 *   - Current phonics phase (targets correct phoneme patterns)
 *   - Interests set by parent (themes: dinosaurs, space, cats, etc.)
 *   - Struggled words (spaced repetition — reintroduce difficult phonemes)
 *   - Reading history (avoids repeating recent stories)
 *
 * AI provider waterfall (all free):
 *   1. Google Gemini 1.5 Flash  — FREE: 15 req/min, 1,500 req/day
 *      Key: https://aistudio.google.com/app/apikey
 *   2. Groq (Llama 3.1 8B)      — FREE: 30 req/min, 14,400 req/day
 *      Key: https://console.groq.com/keys
 *   3. Deterministic fallback   — always works, zero API cost
 */

// ── PHONICS CURRICULUM DATA ───────────────────────────────────
// Maps each phase to its target phoneme patterns and example words
export const PHASE_PHONICS = {
  2: {
    label: 'Simple CVC Words',
    patterns: ['s','a','t','p','i','n','m','d','g','o','c','k','ck','e','u','r','h','b','f','l','ff','ll','ss'],
    targetWords: ['sat','pat','tap','map','nap','tin','pin','fin','dot','hot','cut','bug','run','bed','hen'],
    sentenceStyle: 'Very short (4-6 words). Only CVC words. One syllable each. No digraphs.',
    vocab: 'cat, dog, pig, hen, fox, cup, mat, hat, pin, fin, dot, hot',
  },
  3: {
    label: 'Digraphs & Vowel Teams',
    patterns: ['ch','sh','th','ng','ai','ee','igh','oa','oo','ar','or','ur','ow','oi','ear','air'],
    targetWords: ['chat','shop','ship','rain','feet','night','boat','moon','look','park','corn','hurt'],
    sentenceStyle: 'Short (5-8 words). Include digraphs naturally. Simple sentences.',
    vocab: 'sheep, chain, shout, light, coach, tooth, dark, storm, turn, farm',
  },
  4: {
    label: 'CCVC & CVCC Blends',
    patterns: ['bl','cl','fl','gl','pl','sl','br','cr','dr','fr','gr','pr','tr','st','sp','sn','sk','lt','lf','lp','lk'],
    targetWords: ['frog','clap','drip','trip','flag','best','grip','plan','snip','stomp','crisp'],
    sentenceStyle: 'Medium (6-9 words). Use consonant blends at start/end of words naturally.',
    vocab: 'black, clock, flame, globe, plant, slide, brick, crab, dress, frost, stamp',
  },
  5: {
    label: 'Split Digraphs & Alternatives',
    patterns: ['a_e','e_e','i_e','o_e','u_e','ay','ea','ie','oe','ue','ew','oi','wh','ph'],
    targetWords: ['cake','slide','home','tune','play','dream','pie','blue','crew','phone'],
    sentenceStyle: 'Medium (7-10 words). Include split digraph words naturally. More varied vocab.',
    vocab: 'brave, smile, stone, huge, spray, treat, tried, clue, flew, photo',
  },
  6: {
    label: 'Prefixes, Suffixes & Morphology',
    patterns: ['un-','re-','dis-','pre-','-ful','-less','-ness','-tion','-sion','-ment','-ly','-ing','-ed'],
    targetWords: ['unhappy','discovery','fearless','wonderful','careful','excitement','remarkable'],
    sentenceStyle: 'Longer (8-12 words). Use morphologically rich words. Complex but clear sentences.',
    vocab: 'remarkable, thoughtful, careless, restarted, discovery, invention, happiness',
  },
};

// Themes the AI can use — mapped to scene emojis
export const THEMES = {
  adventure:    { emoji:'🗺️', scenes:['🌋🌿','🏔️⛺','🌊🏄','🧭✨'] },
  animals:      { emoji:'🦁', scenes:['🌿🦋','🌳🦊','🌾🐮','🌊🐬'] },
  space:        { emoji:'🚀', scenes:['🌟⭐','🪐🌌','🚀🌙','☄️✨'] },
  dinosaurs:    { emoji:'🦕', scenes:['🌿🦕','🌋🦖','🏞️🥚','🌊🦴'] },
  magic:        { emoji:'🧙', scenes:['✨🔮','🌈🪄','🏰🦄','🌙⭐'] },
  ocean:        { emoji:'🌊', scenes:['🌊🐠','🐚🌊','🦈⭐','🐙🌿'] },
  farm:         { emoji:'🐄', scenes:['🌻🐔','🌾🐑','🐄🌿','🌅🐓'] },
  forest:       { emoji:'🌲', scenes:['🌲🍄','🌿🦔','🍃🐿️','🌸🦊'] },
  dragons:      { emoji:'🐉', scenes:['🔥🐉','🏰⚔️','🌋🐲','✨🪄'] },
  robots:       { emoji:'🤖', scenes:['⚙️🔧','🤖✨','💡🔩','🚀🤖'] },
  cats:         { emoji:'🐱', scenes:['🐱🌸','🌙🐈','🐟🐱','🌿😺'] },
  pirates:      { emoji:'🏴‍☠️', scenes:['⚓🗺️','🌊🦜','🏝️💎','⛵🌊'] },
  superheroes:  { emoji:'🦸', scenes:['💥⚡','🌆🦸','✨🌟','🌈💪'] },
  cooking:      { emoji:'🍳', scenes:['🍳🌿','🎂🍰','🥘🌶️','🧁✨'] },
};

// Background classes (from index.css)
const BG_CLASSES = ['bg-warm','bg-green','bg-blue','bg-pink','bg-purple','bg-orange'];

// ── SYSTEM PROMPT BUILDER ─────────────────────────────────────
function buildSystemPrompt(phase) {
  const p = PHASE_PHONICS[phase];
  return `You are an expert UK primary school phonics teacher creating personalised reading stories for children aged 4-8.

PHONICS CURRICULUM RULES (STRICT — Phase ${phase}: ${p.label}):
- Target phoneme patterns: ${p.patterns.slice(0,12).join(', ')}
- Example target words: ${p.targetWords.slice(0,10).join(', ')}
- Sentence style: ${p.sentenceStyle}
- UK English spelling ONLY (colour not color, mum not mom, programme not program)
- NEVER use words with phoneme patterns above Phase ${phase} difficulty
- Each page sentence must naturally contain 1-2 target phoneme patterns

STORY RULES:
- Exactly 3 pages. Each page = exactly ONE sentence (the reading target).
- The sentence should be between ${phase <= 3 ? '4-7' : phase <= 4 ? '6-9' : '8-12'} words
- Stories must have a clear beginning (page 1), middle (page 2), end (page 3)
- Use the child's name in at least one page
- Make it warm, exciting, and age-appropriate
- Avoid scary, violent, or inappropriate content

OUTPUT FORMAT (JSON only, no markdown, no explanation):
{
  "title": "Story title (3-5 words)",
  "emoji": "single relevant emoji",
  "cover_scene": "2-3 emojis for cover",
  "pages": [
    { "text": "Sentence for page 1.", "scene": "2 emojis", "bg": "bg-warm", "target_words": ["word1","word2"] },
    { "text": "Sentence for page 2.", "scene": "2 emojis", "bg": "bg-green", "target_words": ["word3","word4"] },
    { "text": "Sentence for page 3.", "scene": "2 emojis", "bg": "bg-blue", "target_words": ["word5","word6"] }
  ]
}

bg values must be one of: bg-warm, bg-green, bg-blue, bg-pink, bg-purple, bg-orange`;
}

function buildUserPrompt({ childName, phase, theme, interests, struggledWords, recentTitles }) {
  const p = PHASE_PHONICS[phase];
  const themeData = THEMES[theme] || THEMES.adventure;
  const interestStr = interests?.length ? `Child's interests: ${interests.join(', ')}. ` : '';
  const struggledStr = struggledWords?.length
    ? `Words this child has struggled with recently (try to include 1-2 naturally): ${struggledWords.slice(0,5).join(', ')}. `
    : '';
  const avoidStr = recentTitles?.length
    ? `Avoid these recent story titles/themes: ${recentTitles.slice(0,3).join(', ')}. `
    : '';

  return `Create a Phase ${phase} (${p.label}) phonics story for a child named ${childName}.

Theme: ${theme} ${themeData.emoji}
${interestStr}${struggledStr}${avoidStr}

Requirements:
- Weave "${childName}" naturally into at least one sentence
- Target these Phase ${phase} phonemes: ${p.patterns.slice(0,8).join(', ')}
- Keep all vocabulary at Phase ${phase} level or below
- Make the story about: ${theme} (${interestStr || 'a fun adventure'})

Generate the JSON story now:`;
}

// ── AI PROVIDER CALLS ─────────────────────────────────────────
// Groq — Llama 3.1 70B for story generation (free tier: 14,400 req/day)
// Key: https://console.groq.com/keys  (instant signup, no billing)
async function generateWithGroq(systemPrompt, userPrompt) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${key}` },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',   // 70B for story quality; use 8b-instant if hitting limits
        max_tokens: 600,
        temperature: 0.85,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { text: data.choices?.[0]?.message?.content?.trim(), provider: 'groq' };
  } catch { return null; }
}

async function generateWithGemini(systemPrompt, userPrompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === 'your-gemini-api-key-here') return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          contents: [{ parts:[{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { maxOutputTokens:600, temperature:0.85, responseMimeType:'application/json' },
          safetySettings: [
            { category:'HARM_CATEGORY_HARASSMENT',        threshold:'BLOCK_LOW_AND_ABOVE' },
            { category:'HARM_CATEGORY_HATE_SPEECH',       threshold:'BLOCK_LOW_AND_ABOVE' },
            { category:'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold:'BLOCK_LOW_AND_ABOVE' },
            { category:'HARM_CATEGORY_DANGEROUS_CONTENT', threshold:'BLOCK_LOW_AND_ABOVE' },
          ],
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return { text: data.candidates?.[0]?.content?.parts?.[0]?.text?.trim(), provider: 'gemini' };
  } catch { return null; }
}

// ── FALLBACK STORY TEMPLATES ──────────────────────────────────
// Used when no AI is configured — still phonics-correct and personalised
const FALLBACK_TEMPLATES = {
  2: (name, theme) => ({
    title: `${name} and the ${theme === 'animals' ? 'Big Cat' : theme === 'space' ? 'Red Dot' : 'Fat Fox'}`,
    emoji: THEMES[theme]?.emoji || '📖',
    cover_scene: THEMES[theme]?.scenes[0] || '🌿✨',
    pages: [
      { text:`${name} sat on the big mat.`,           scene:'🌞🌿', bg:'bg-warm',   target_words:['sat','big','mat'] },
      { text:`A fat fox ran up to ${name}.`,           scene:'🦊🌿', bg:'bg-green',  target_words:['fat','fox','ran'] },
      { text:`${name} and the fox had a nap.`,         scene:'🌙⭐', bg:'bg-purple', target_words:['had','nap'] },
    ],
  }),
  3: (name, theme) => ({
    title: `${name} at the ${theme === 'ocean' ? 'Rock Pool' : theme === 'farm' ? 'Sheep Farm' : 'Deep Wood'}`,
    emoji: THEMES[theme]?.emoji || '📖',
    cover_scene: THEMES[theme]?.scenes[1] || '🌲✨',
    pages: [
      { text:`${name} went out in the bright rain.`,       scene:'🌧️🌿', bg:'bg-blue',   target_words:['went','bright','rain'] },
      { text:`A big snail left a trail on the path.`,      scene:'🐌✨',  bg:'bg-green',  target_words:['snail','trail','path'] },
      { text:`${name} found a shell and took it home.`,    scene:'🐚🏠',  bg:'bg-warm',   target_words:['found','shell','home'] },
    ],
  }),
  4: (name, theme) => ({
    title: `${name} and the ${theme === 'dragons' ? 'Dragon Egg' : theme === 'space' ? 'Space Crash' : 'Best Plan'}`,
    emoji: THEMES[theme]?.emoji || '📖',
    cover_scene: THEMES[theme]?.scenes[2] || '🌟✨',
    pages: [
      { text:`${name} crept up to the steep cliff bank.`,   scene:'🏔️🌿', bg:'bg-green',  target_words:['crept','steep','cliff'] },
      { text:`A frog jumped from a brown branch and swam.`, scene:'🐸🌊', bg:'bg-blue',   target_words:['frog','jumped','branch','swam'] },
      { text:`${name} clapped when the frog found its pond.`,scene:'🌅🌊', bg:'bg-warm',  target_words:['clapped','found','pond'] },
    ],
  }),
  5: (name, theme) => ({
    title: `${name} and the ${theme === 'magic' ? 'Magic Stone' : theme === 'dragons' ? 'Fire Cave' : 'Brave Chase'}`,
    emoji: THEMES[theme]?.emoji || '📖',
    cover_scene: THEMES[theme]?.scenes[0] || '✨🌟',
    pages: [
      { text:`${name} made a huge kite on a fine day.`,         scene:'☀️🌤️', bg:'bg-warm',   target_words:['made','huge','kite','fine'] },
      { text:`The kite rose into the wide blue sky above.`,     scene:'🌈☁️',  bg:'bg-blue',   target_words:['rose','wide','blue','sky'] },
      { text:`${name} smiled as the brave kite came home.`,     scene:'🌅🏠',  bg:'bg-orange', target_words:['smiled','brave','came','home'] },
    ],
  }),
  6: (name, theme) => ({
    title: `${name}'s ${theme === 'space' ? 'Remarkable Discovery' : theme === 'robots' ? 'Thoughtful Invention' : 'Wonderful Quest'}`,
    emoji: THEMES[theme]?.emoji || '📖',
    cover_scene: THEMES[theme]?.scenes[3] || '🌟🏆',
    pages: [
      { text:`The fearless ${name} discovered a completely hidden valley.`, scene:'🏔️🌿', bg:'bg-green',  target_words:['fearless','discovered','completely','hidden'] },
      { text:`She carefully mapped the entirely unfamiliar landscape.`,      scene:'🗺️✏️', bg:'bg-warm',   target_words:['carefully','mapped','entirely','unfamiliar'] },
      { text:`Her remarkable discovery brought worldwide excitement and joy.`,scene:'🌍🎉', bg:'bg-blue',  target_words:['remarkable','discovery','worldwide','excitement'] },
    ],
  }),
};

function buildFallbackStory(childName, phase, theme) {
  const templateFn = FALLBACK_TEMPLATES[phase] || FALLBACK_TEMPLATES[3];
  return { story: templateFn(childName, theme), provider: 'fallback' };
}

// ── JSON PARSER (tolerant) ────────────────────────────────────
function parseStoryJSON(raw) {
  if (!raw) return null;
  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```json\n?/,'').replace(/\n?```$/,'').trim();
    const parsed = JSON.parse(cleaned);
    // Validate required shape
    if (!parsed.title || !Array.isArray(parsed.pages) || parsed.pages.length < 2) return null;
    // Ensure 3 pages
    while (parsed.pages.length < 3) parsed.pages.push(parsed.pages[parsed.pages.length - 1]);
    return parsed;
  } catch { return null; }
}

// ── MAIN EXPORT: generateStory ────────────────────────────────
/**
 * Generate a personalised phonics story for a child.
 *
 * @param {object} opts
 * @param {string}   opts.childName       - Child's first name
 * @param {number}   opts.phase           - Phonics phase (2-6)
 * @param {string}   opts.theme           - Story theme key (adventure, space, etc.)
 * @param {string[]} opts.interests       - Parent-set interests
 * @param {string[]} opts.struggledWords  - Words child recently got wrong
 * @param {string[]} opts.recentTitles    - Recent story titles to avoid repeating
 * @returns {Promise<{story, provider}>}
 */
export async function generateStory(opts) {
  const { childName, phase, theme = 'adventure', interests = [], struggledWords = [], recentTitles = [] } = opts;
  const systemPrompt = buildSystemPrompt(phase);
  const userPrompt   = buildUserPrompt({ childName, phase, theme, interests, struggledWords, recentTitles });

  // 1. Google Gemini Flash — primary free AI (1,500 req/day)
  const geminiRaw = await generateWithGemini(systemPrompt, userPrompt);
  if (geminiRaw?.text) {
    const parsed = parseStoryJSON(geminiRaw.text);
    if (parsed) return { story: parsed, provider: 'gemini' };
  }

  // 2. Groq (Llama 3.1 70B) — secondary free AI (14,400 req/day)
  const groqRaw = await generateWithGroq(systemPrompt, userPrompt);
  if (groqRaw?.text) {
    const parsed = parseStoryJSON(groqRaw.text);
    if (parsed) return { story: parsed, provider: 'groq' };
  }

  // Deterministic fallback — always works
  return buildFallbackStory(childName, phase, theme);
}

