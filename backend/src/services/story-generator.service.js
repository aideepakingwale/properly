/**
 * @file        story-generator.service.js
 * @description AI story generation service — creates phonics-appropriate stories personalised to child name, age, phase, interests and struggled words
 * @module      Story Generator
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - Tries Gemini Flash first, falls back to Groq Llama 3.1 on failure
 *   - Phase-appropriate vocabulary lists constrain word selection per story page
 *   - Theme rotation prevents repetition across a child's story history
 */

// ── PHONICS CURRICULUM ────────────────────────────────────────
export const PHASE_PHONICS = {
  2: {
    label: 'Simple CVC Words',
    patterns: ['s','a','t','p','i','n','m','d','g','o','c','k','ck','e','u','r','h','b','f','l','ff','ll','ss'],
    targetWords: ['sat','pat','tap','map','nap','tin','pin','fin','dot','hot','cut','bug','run','bed','hen'],
    sentenceLength: '4–6 words',
    vocab: 'cat, dog, pig, hen, fox, cup, mat, hat, pin, fin, dot, hot, big, red, top, sit, run, get, put, cap',
  },
  3: {
    label: 'Digraphs & Vowel Teams',
    patterns: ['ch','sh','th','ng','ai','ee','igh','oa','oo','ar','or','ur','ow','oi','ear','air'],
    targetWords: ['chat','shop','ship','rain','feet','night','boat','moon','look','park','corn','hurt'],
    sentenceLength: '5–8 words',
    vocab: 'sheep, chain, shout, light, coach, tooth, dark, storm, turn, farm, green, street, beach',
  },
  4: {
    label: 'CCVC & CVCC Blends',
    patterns: ['bl','cl','fl','gl','pl','sl','br','cr','dr','fr','gr','pr','tr','st','sp','sn','sk','lt','lf'],
    targetWords: ['frog','clap','drip','trip','flag','best','grip','plan','snip','stomp','crisp'],
    sentenceLength: '6–9 words',
    vocab: 'black, clock, flame, globe, plant, slide, brick, crab, dress, frost, stamp, drink, spring',
  },
  5: {
    label: 'Split Digraphs & Alternatives',
    patterns: ['a_e','e_e','i_e','o_e','u_e','ay','ea','ie','oe','ue','ew','wh','ph'],
    targetWords: ['cake','slide','home','tune','play','dream','pie','blue','crew','phone'],
    sentenceLength: '7–10 words',
    vocab: 'brave, smile, stone, huge, spray, treat, tried, clue, flew, photo, throne, while',
  },
  6: {
    label: 'Prefixes, Suffixes & Morphology',
    patterns: ['un-','re-','dis-','pre-','-ful','-less','-ness','-tion','-sion','-ment','-ly','-ing','-ed'],
    targetWords: ['unhappy','discovery','fearless','wonderful','careful','excitement','remarkable'],
    sentenceLength: '8–12 words',
    vocab: 'remarkable, thoughtful, careless, restarted, discovery, invention, happiness, protection',
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
};

const BG_CLASSES = ['bg-warm','bg-green','bg-blue','bg-pink','bg-purple','bg-orange'];

// ── PRONOUN HELPER ────────────────────────────────────────────
function pronouns(gender) {
  if (gender === 'boy')    return { sub:'he',   obj:'him',  pos:'his'  };
  if (gender === 'girl')   return { sub:'she',  obj:'her',  pos:'her'  };
  return                          { sub:'they', obj:'them', pos:'their' };
}

// ── THEME-AWARE VOCABULARY ────────────────────────────────────
const THEME_VOCAB = {
  superheroes: 'cape, mask, fly, jump, run, zip, zap, big, fast, win, snap, cop, hero, top, tip',
  space:       'ship, star, sun, hot, red, jet, fly, rock, map, dot, pod, moon, beam, zoom',
  dinosaurs:   'dig, big, run, egg, pit, mud, hot, lap, tap, rock, snap, stomp, tail, claw',
  dragons:     'fly, big, hot, red, snap, egg, top, zip, run, sit, pit, wing, roar, cave',
  magic:       'wand, pop, zip, tap, spin, wish, glow, gem, bag, hum, orb, dust, ring',
  pirates:     'ship, map, dig, flag, sand, rock, run, bag, cap, dot, mast, gold, gem',
  robots:      'zap, spin, run, zip, big, top, tin, cog, tap, click, bolt, arm, pod',
  ocean:       'fish, swim, fin, crab, shell, wave, dip, pop, wet, net, blue, deep, reef',
  forest:      'log, ant, bug, fox, den, nest, nut, mud, run, hop, sit, dig, tap, bark',
  farm:        'hen, pig, mud, egg, dog, cat, moo, run, hop, pat, fat, pen, oat, crop',
  animals:     'cat, dog, pig, hen, fox, ant, bug, bee, pup, cub, kit, run, hop, lap',
  cooking:     'mix, stir, pot, pan, hot, bake, melt, cup, tip, add, pop, stew, tart',
  adventure:   'run, jump, hide, find, big, fast, go, map, bag, bold, trek, cliff, path',
  cats:        'paw, purr, lap, sit, nap, bat, hiss, pad, fur, flap, pounce, stretch',
};

// ── BATCH SYSTEM PROMPT ───────────────────────────────────────
function buildBatchSystemPrompt(phase) {
  const p = PHASE_PHONICS[phase];
  return `You are an expert UK primary school phonics teacher creating personalised reading stories for children aged 4–8.

You will generate MULTIPLE complete stories in one response as a JSON array.

PHONICS CURRICULUM — Phase ${phase}: ${p.label}
- Target phoneme patterns: ${p.patterns.slice(0,14).join(', ')}
- Example target words: ${p.targetWords.join(', ')}
- Sentence length per page: ${p.sentenceLength}
- UK English spelling ONLY (colour, mum, programme, behaviour)
- NEVER use phoneme patterns above Phase ${phase} difficulty

STORY RULES:
- Each story = exactly 3 pages. Each page = exactly ONE sentence (the reading target).
- Clear beginning (page 1), middle (page 2), end (page 3) narrative arc.
- Use the child's name AND correct pronouns in at least one page of each story.
- Age-appropriate, warm, exciting. No scary/violent content.
- Each story must have a DIFFERENT theme from the others in the same batch.

OUTPUT FORMAT — JSON array only, no markdown:
[
  {
    "title": "3–5 word title",
    "emoji": "single emoji",
    "cover_scene": "2–3 emojis",
    "theme": "theme name",
    "target_phonemes": ["phoneme1","phoneme2"],
    "pages": [
      { "text": "Sentence.", "scene": "2 emojis", "bg": "bg-warm", "target_words": ["word1","word2"] },
      { "text": "Sentence.", "scene": "2 emojis", "bg": "bg-green", "target_words": ["word3"] },
      { "text": "Sentence.", "scene": "2 emojis", "bg": "bg-blue", "target_words": ["word4","word5"] }
    ]
  }
]

bg values: bg-warm, bg-green, bg-blue, bg-pink, bg-purple, bg-orange`;
}

// ── BATCH USER PROMPT ─────────────────────────────────────────
function buildBatchUserPrompt({ child, interests, struggledWords, recentTitles, themes, count }) {
  const p = PHASE_PHONICS[child.phase];
  const pr = pronouns(child.gender || 'neutral');
  const age = child.age ? `${child.age} years old` : 'young child';
  const themeList = themes.join(', ');
  const vocabHints = themes.map(t => `${t}: ${THEME_VOCAB[t] || THEME_VOCAB.adventure}`).join('\n  ');
  const interestStr = interests?.length ? interests.join(', ') : themes.join(', ');
  const struggledStr = struggledWords?.length
    ? `\nStruggledWords to reintroduce (include 1–2 naturally across the batch): ${struggledWords.slice(0,6).join(', ')}`
    : '';
  const avoidStr = recentTitles?.length
    ? `\nAvoid repeating these recent titles/themes: ${recentTitles.slice(0,5).join(', ')}`
    : '';

  return `Generate exactly ${count} phonics stories for this child:

STUDENT PROFILE:
  Name: ${child.name}
  Age: ${age}
  Gender: ${child.gender || 'neutral'} (use pronouns: ${pr.sub}/${pr.obj}/${pr.pos})
  Phonics phase: Phase ${child.phase} (${p.label})
  Interests: ${interestStr}

STORY THEMES FOR THIS BATCH (one story per theme, in this order):
  ${themes.map((t, i) => `Story ${i+1}: ${t.toUpperCase()} ${THEMES[t]?.emoji || ''}`).join('\n  ')}

THEME VOCABULARY (phase-appropriate words you can use per theme):
  ${vocabHints}
${struggledStr}
${avoidStr}

MANDATORY RULES:
1. Every story MUST be set firmly in its assigned theme world — characters, setting, objects
2. Use "${child.name}" and ${pr.sub}/${pr.obj}/${pr.pos} pronouns in each story
3. All sentences MUST be Phase ${child.phase} phonics level (${p.sentenceLength})
4. If theme words don't fit phonics perfectly, keep theme SETTING and simplify vocabulary
5. Each story must feel complete with a satisfying ending

Generate the JSON array of ${count} stories now:`;
}

// ── AI PROVIDER CALLS ─────────────────────────────────────────
async function callGemini(systemPrompt, userPrompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.includes('your-')) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          contents: [{ parts:[{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { maxOutputTokens:2400, temperature:0.82, responseMimeType:'application/json' },
          safetySettings: [
            { category:'HARM_CATEGORY_HARASSMENT',        threshold:'BLOCK_LOW_AND_ABOVE' },
            { category:'HARM_CATEGORY_HATE_SPEECH',       threshold:'BLOCK_LOW_AND_ABOVE' },
            { category:'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold:'BLOCK_LOW_AND_ABOVE' },
            { category:'HARM_CATEGORY_DANGEROUS_CONTENT', threshold:'BLOCK_LOW_AND_ABOVE' },
          ],
        }),
      }
    );
    if (!res.ok) { console.warn('Gemini HTTP', res.status); return null; }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch (e) { console.warn('Gemini error:', e.message); return null; }
}

async function callGroq(systemPrompt, userPrompt) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${key}` },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        max_tokens: 2400,
        temperature: 0.82,
        response_format: { type: 'json_object' },
        messages: [
          { role:'system', content: systemPrompt + '\n\nIMPORTANT: Your response must be a JSON object with a "stories" array key containing the array.' },
          { role:'user',   content: userPrompt },
        ],
      }),
    });
    if (!res.ok) { console.warn('Groq HTTP', res.status); return null; }
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content?.trim();
    // Groq wraps in object due to json_object mode — unwrap
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.stories) return JSON.stringify(parsed.stories);
        // If it returned an array directly somehow
        if (Array.isArray(parsed)) return JSON.stringify(parsed);
      } catch {}
    }
    return raw || null;
  } catch (e) { console.warn('Groq error:', e.message); return null; }
}

// ── JSON PARSER ───────────────────────────────────────────────
function parseBatchJSON(raw, expectedCount) {
  if (!raw) return null;
  try {
    const cleaned = raw.replace(/^```json\n?/,'').replace(/\n?```$/,'').trim();
    const parsed = JSON.parse(cleaned);
    const arr = Array.isArray(parsed) ? parsed : parsed.stories;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    // Validate each story has required shape
    const valid = arr.filter(s =>
      s.title && Array.isArray(s.pages) && s.pages.length >= 2
    ).map(s => {
      // Ensure 3 pages
      while (s.pages.length < 3) s.pages.push(s.pages[s.pages.length-1]);
      s.pages = s.pages.slice(0, 3);
      return s;
    });
    return valid.length > 0 ? valid : null;
  } catch (e) { console.warn('Parse error:', e.message); return null; }
}

// ── FALLBACK BATCH ────────────────────────────────────────────
const FALLBACK_STORIES = {
  superheroes: {
    2: (n, pr) => ({ title:`${n} the Big Hero`, emoji:'🦸', cover_scene:'💥⚡', theme:'superheroes', target_phonemes:['s','a','t','p'], pages:[
      {text:`${n} put on a big red cap.`,scene:'🦸💥',bg:'bg-warm',target_words:['big','red','cap']},
      {text:`${pr.sub.charAt(0).toUpperCase()+pr.sub.slice(1)} ran fast to stop the bad van.`,scene:'💨🦸',bg:'bg-blue',target_words:['ran','fast','bad']},
      {text:`${n} got the map and all was well.`,scene:'🌟🦸',bg:'bg-purple',target_words:['got','map','well']}]}),
    3: (n, pr) => ({ title:`${n} Saves the Town`, emoji:'🦸', cover_scene:'🌆🦸', theme:'superheroes', target_phonemes:['ch','sh','ai'], pages:[
      {text:`${n} put on ${pr.pos} shining cape and flew.`,scene:'🦸✨',bg:'bg-blue',target_words:['shining','cape','flew']},
      {text:`A shout rang out and ${pr.sub} rushed in.`,scene:'💥🌙',bg:'bg-purple',target_words:['shout','rushed']},
      {text:`The crowd cheered as ${n} saved the day.`,scene:'🌟👏',bg:'bg-warm',target_words:['crowd','cheered','saved']}]}),
  },
  space: {
    2: (n, pr) => ({ title:`${n} in Space`, emoji:'🚀', cover_scene:'🌟🚀', theme:'space', target_phonemes:['s','p','a','t'], pages:[
      {text:`${n} sat in the big red pod.`,scene:'🚀⭐',bg:'bg-purple',target_words:['sat','big','red','pod']},
      {text:`The pod shot up and up!`,scene:'🌙🚀',bg:'bg-blue',target_words:['shot','up']},
      {text:`${n} saw a big dot of sun.`,scene:'⭐🌟',bg:'bg-warm',target_words:['saw','big','dot','sun']}]}),
    3: (n, pr) => ({ title:`${n} on the Moon`, emoji:'🌙', cover_scene:'🌙🚀', theme:'space', target_phonemes:['igh','oo','ar'], pages:[
      {text:`${n} took off in a bright rocket ship.`,scene:'🚀✨',bg:'bg-purple',target_words:['bright','rocket','ship']},
      {text:`The moon was white and cool that night.`,scene:'🌙⭐',bg:'bg-blue',target_words:['white','cool','night']},
      {text:`${n} found a moon rock and took it home.`,scene:'🪨🏠',bg:'bg-warm',target_words:['found','rock','home']}]}),
  },
  dinosaurs: {
    2: (n, pr) => ({ title:`${n} and the Big Egg`, emoji:'🦕', cover_scene:'🌿🦕', theme:'dinosaurs', target_phonemes:['d','i','g','e'], pages:[
      {text:`${n} dug in the mud and hit a big egg.`,scene:'🌿🥚',bg:'bg-green',target_words:['dug','mud','big','egg']},
      {text:`The egg had a tap, tap, tap.`,scene:'🥚💥',bg:'bg-warm',target_words:['tap']},
      {text:`A big red dino sat with ${n}.`,scene:'🦕🌿',bg:'bg-purple',target_words:['big','red','dino','sat']}]}),
  },
};

function buildFallbackBatch(child, themes) {
  const pr = pronouns(child.gender || 'neutral');
  const stories = themes.map(theme => {
    const themeTemplates = FALLBACK_STORIES[theme];
    const phaseTemplates = themeTemplates || FALLBACK_STORIES.space;
    const templateFn = (phaseTemplates[child.phase] || phaseTemplates[2] || phaseTemplates[3]);
    if (templateFn) return templateFn(child.name, pr);
    // Generic fallback
    return {
      title:`${child.name} and the ${theme}`, emoji: THEMES[theme]?.emoji||'📖',
      cover_scene: THEMES[theme]?.scenes[0]||'🌿✨', theme,
      target_phonemes: PHASE_PHONICS[child.phase]?.patterns.slice(0,4)||['s','a','t'],
      pages:[
        {text:`${child.name} went on a ${theme} trip.`,scene:'🌿✨',bg:'bg-warm',target_words:['went']},
        {text:`${pr.sub.charAt(0).toUpperCase()+pr.sub.slice(1)} saw something big and red.`,scene:'💥🌿',bg:'bg-green',target_words:['big','red']},
        {text:`${child.name} got home and felt glad.`,scene:'🏠🌟',bg:'bg-blue',target_words:['got','home','glad']},
      ],
    };
  });
  return stories;
}

// ── THEME SELECTOR ────────────────────────────────────────────
// Pick themes for the batch — prioritise the child's interests,
// ensure variety, fill remaining slots from defaults
function selectThemes(interests, recentTitles, count) {
  const allThemes = Object.keys(THEMES);
  const recentThemes = new Set(
    recentTitles.map(t => allThemes.find(k => t.toLowerCase().includes(k))).filter(Boolean)
  );

  // Normalise interests to valid theme keys
  const interestThemes = (interests || [])
    .map(i => allThemes.find(k => k.includes(i.toLowerCase()) || i.toLowerCase().includes(k)))
    .filter(Boolean);

  const selected = [];
  const used = new Set();

  // First: all interest-matched themes (no repeats)
  for (const t of interestThemes) {
    if (!used.has(t) && selected.length < count) { selected.push(t); used.add(t); }
  }

  // Fill: non-recent themes in a shuffled order
  const remaining = allThemes
    .filter(t => !used.has(t) && !recentThemes.has(t))
    .sort(() => Math.random() - 0.5);

  for (const t of remaining) {
    if (selected.length >= count) break;
    selected.push(t); used.add(t);
  }

  // Last resort: anything not already used
  for (const t of allThemes) {
    if (selected.length >= count) break;
    if (!used.has(t)) { selected.push(t); used.add(t); }
  }

  return selected.slice(0, count);
}

// ── MAIN EXPORT: generateBatch ────────────────────────────────
/**
 * Generate a batch of personalised phonics stories for a child.
 *
 * @param {object} opts
 * @param {object}   opts.child          - Full child record { id, name, phase, age, gender }
 * @param {string[]} opts.interests      - Parent-set interest keywords
 * @param {string[]} opts.struggledWords - Recently failed words for spaced repetition
 * @param {string[]} opts.recentTitles   - Recent story titles to avoid repeating
 * @param {number}   opts.count          - Number of stories to generate (3–5)
 * @param {string[]} [opts.forceThemes]  - Override theme selection (optional)
 * @returns {Promise<{ stories: object[], provider: string, themes: string[] }>}
 */
export async function generateBatch(opts) {
  const {
    child,
    interests     = [],
    struggledWords = [],
    recentTitles  = [],
    count         = 5,
    forceThemes   = null,
  } = opts;

  const themes = forceThemes || selectThemes(interests, recentTitles, count);
  const systemPrompt = buildBatchSystemPrompt(child.phase);
  const userPrompt   = buildBatchUserPrompt({ child, interests, struggledWords, recentTitles, themes, count: themes.length });

  console.log(`[story-gen] Generating batch of ${themes.length} stories for ${child.name} (Phase ${child.phase})`);
  console.log(`[story-gen] Themes: ${themes.join(', ')}`);

  // 1. Gemini
  const geminiRaw = await callGemini(systemPrompt, userPrompt);
  if (geminiRaw) {
    const parsed = parseBatchJSON(geminiRaw, themes.length);
    if (parsed) {
      // Stamp theme from our selection if AI didn't set it correctly
      parsed.forEach((s, i) => { if (!s.theme || !THEMES[s.theme]) s.theme = themes[i] || 'adventure'; });
      console.log(`[story-gen] Gemini generated ${parsed.length} stories`);
      return { stories: parsed, provider: 'gemini', themes };
    }
  }

  // 2. Groq
  const groqRaw = await callGroq(systemPrompt, userPrompt);
  if (groqRaw) {
    const parsed = parseBatchJSON(groqRaw, themes.length);
    if (parsed) {
      parsed.forEach((s, i) => { if (!s.theme || !THEMES[s.theme]) s.theme = themes[i] || 'adventure'; });
      console.log(`[story-gen] Groq generated ${parsed.length} stories`);
      return { stories: parsed, provider: 'groq', themes };
    }
  }

  // 3. Deterministic fallback
  console.log(`[story-gen] Using deterministic fallback for ${themes.length} stories`);
  return { stories: buildFallbackBatch(child, themes), provider: 'fallback', themes };
}

// Keep single-story export for backwards compat
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
