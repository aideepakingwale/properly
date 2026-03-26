/**
 * @file        phonicsAnalyser.js
 * @description UK phonics curriculum word analyser — breaks any English word into its
 *              grapheme→phoneme correspondences, tagged with the phase they're taught in.
 *              Used for: pre-reading grapheme display, post-assessment phoneme highlighting,
 *              and coaching tip targeting.
 * @module      Phonics
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   Rules follow the English Letters and Sounds (DfE 2021) progression:
 *   Phase 2: s a t p i n m d g o c k ck e u r h b f ff l ll ss
 *   Phase 3: j v w x y z zz qu ch sh th ng ai ee igh oa oo ar or ur ow oi ear air ure er
 *   Phase 4: adjacent consonant blends (no new GPC, just CCVC/CVCC words)
 *   Phase 5: a-e e-e i-e o-e u-e ay ou ie ea oi ay oy ir ue aw wh ph ew oe au
 *   Phase 6: prefixes/suffixes, -tion, -sion, -ture, homophones, morphology
 */

// ── GRAPHEME RULES ────────────────────────────────────────────
// Order matters: longer patterns checked first (trigraphs before digraphs before single)
// Each rule: { grapheme, phoneme, phase, label, description }
//   grapheme  — the letters written (e.g. 'ch', 'a-e')
//   phoneme   — the sound made in IPA-ish notation (e.g. '/tʃ/', '/eɪ/')
//   phase     — which Letters & Sounds phase introduces it
//   label     — short human-readable name (e.g. 'digraph', 'split digraph')

const GRAPHEME_RULES = [
  // ── TRIGRAPHS & SPECIAL PATTERNS (check first) ─────────────
  { g: 'igh',  ph: '/aɪ/',  phase: 3, label: 'trigraph',      color: '#7C3AED' },
  { g: 'ear',  ph: '/ɪə/',  phase: 3, label: 'trigraph',      color: '#7C3AED' },
  { g: 'air',  ph: '/eə/',  phase: 3, label: 'trigraph',      color: '#7C3AED' },
  { g: 'ure',  ph: '/ʊə/',  phase: 3, label: 'trigraph',      color: '#7C3AED' },
  { g: 'tch',  ph: '/tʃ/',  phase: 3, label: 'trigraph',      color: '#7C3AED' },
  { g: 'dge',  ph: '/dʒ/',  phase: 3, label: 'trigraph',      color: '#7C3AED' },
  { g: 'tion', ph: '/ʃən/', phase: 6, label: 'suffix',        color: '#EC4899' },
  { g: 'sion', ph: '/ʒən/', phase: 6, label: 'suffix',        color: '#EC4899' },
  { g: 'ture', ph: '/tʃə/', phase: 6, label: 'suffix',        color: '#EC4899' },
  { g: 'ous',  ph: '/əs/',  phase: 6, label: 'suffix',        color: '#EC4899' },
  // ── PHASE 5 DIGRAPHS ───────────────────────────────────────
  { g: 'ay',   ph: '/eɪ/',  phase: 5, label: 'vowel digraph', color: '#F97316' },
  { g: 'ou',   ph: '/aʊ/',  phase: 5, label: 'vowel digraph', color: '#F97316' },
  { g: 'ie',   ph: '/aɪ/',  phase: 5, label: 'vowel digraph', color: '#F97316' },
  { g: 'ea',   ph: '/iː/',  phase: 5, label: 'vowel digraph', color: '#F97316' },
  { g: 'oy',   ph: '/ɔɪ/',  phase: 5, label: 'vowel digraph', color: '#F97316' },
  { g: 'ir',   ph: '/ɜː/',  phase: 5, label: 'vowel digraph', color: '#F97316' },
  { g: 'ue',   ph: '/juː/', phase: 5, label: 'vowel digraph', color: '#F97316' },
  { g: 'aw',   ph: '/ɔː/',  phase: 5, label: 'vowel digraph', color: '#F97316' },
  { g: 'ew',   ph: '/juː/', phase: 5, label: 'vowel digraph', color: '#F97316' },
  { g: 'oe',   ph: '/əʊ/',  phase: 5, label: 'vowel digraph', color: '#F97316' },
  { g: 'au',   ph: '/ɔː/',  phase: 5, label: 'vowel digraph', color: '#F97316' },
  { g: 'wh',   ph: '/w/',   phase: 5, label: 'consonant digraph', color: '#0EA5E9' },
  { g: 'ph',   ph: '/f/',   phase: 5, label: 'consonant digraph', color: '#0EA5E9' },
  // ── PHASE 3 DIGRAPHS ───────────────────────────────────────
  { g: 'ch',   ph: '/tʃ/',  phase: 3, label: 'digraph',       color: '#8B5CF6' },
  { g: 'sh',   ph: '/ʃ/',   phase: 3, label: 'digraph',       color: '#8B5CF6' },
  { g: 'th',   ph: '/ð/',   phase: 3, label: 'digraph',       color: '#8B5CF6' },
  { g: 'ng',   ph: '/ŋ/',   phase: 3, label: 'digraph',       color: '#8B5CF6' },
  { g: 'qu',   ph: '/kw/',  phase: 3, label: 'digraph',       color: '#8B5CF6' },
  { g: 'ai',   ph: '/eɪ/',  phase: 3, label: 'vowel digraph', color: '#8B5CF6' },
  { g: 'ee',   ph: '/iː/',  phase: 3, label: 'vowel digraph', color: '#8B5CF6' },
  { g: 'oa',   ph: '/əʊ/',  phase: 3, label: 'vowel digraph', color: '#8B5CF6' },
  { g: 'oo',   ph: '/uː/',  phase: 3, label: 'vowel digraph', color: '#8B5CF6' },
  { g: 'ar',   ph: '/ɑː/',  phase: 3, label: 'vowel digraph', color: '#8B5CF6' },
  { g: 'or',   ph: '/ɔː/',  phase: 3, label: 'vowel digraph', color: '#8B5CF6' },
  { g: 'ur',   ph: '/ɜː/',  phase: 3, label: 'vowel digraph', color: '#8B5CF6' },
  { g: 'ow',   ph: '/aʊ/',  phase: 3, label: 'vowel digraph', color: '#8B5CF6' },
  { g: 'oi',   ph: '/ɔɪ/',  phase: 3, label: 'vowel digraph', color: '#8B5CF6' },
  { g: 'er',   ph: '/ə/',   phase: 3, label: 'vowel digraph', color: '#8B5CF6' },
  // ── PHASE 2 DOUBLE CONSONANTS ──────────────────────────────
  { g: 'ff',   ph: '/f/',   phase: 2, label: 'double',        color: '#10B981' },
  { g: 'll',   ph: '/l/',   phase: 2, label: 'double',        color: '#10B981' },
  { g: 'ss',   ph: '/s/',   phase: 2, label: 'double',        color: '#10B981' },
  { g: 'zz',   ph: '/z/',   phase: 3, label: 'double',        color: '#10B981' },
  { g: 'ck',   ph: '/k/',   phase: 2, label: 'digraph',       color: '#10B981' },
  { g: 'nk',   ph: '/ŋk/',  phase: 3, label: 'digraph',       color: '#10B981' },
];

// Single-letter phoneme map (Phase 2 + Phase 3 singles)
const SINGLE_LETTER = {
  a: { ph: '/æ/',  phase: 2, color: '#10B981' },
  b: { ph: '/b/',  phase: 2, color: '#10B981' },
  c: { ph: '/k/',  phase: 2, color: '#10B981' },
  d: { ph: '/d/',  phase: 2, color: '#10B981' },
  e: { ph: '/ɛ/',  phase: 2, color: '#10B981' },
  f: { ph: '/f/',  phase: 2, color: '#10B981' },
  g: { ph: '/g/',  phase: 2, color: '#10B981' },
  h: { ph: '/h/',  phase: 2, color: '#10B981' },
  i: { ph: '/ɪ/',  phase: 2, color: '#10B981' },
  j: { ph: '/dʒ/', phase: 3, color: '#8B5CF6' },
  k: { ph: '/k/',  phase: 2, color: '#10B981' },
  l: { ph: '/l/',  phase: 2, color: '#10B981' },
  m: { ph: '/m/',  phase: 2, color: '#10B981' },
  n: { ph: '/n/',  phase: 2, color: '#10B981' },
  o: { ph: '/ɒ/',  phase: 2, color: '#10B981' },
  p: { ph: '/p/',  phase: 2, color: '#10B981' },
  r: { ph: '/r/',  phase: 2, color: '#10B981' },
  s: { ph: '/s/',  phase: 2, color: '#10B981' },
  t: { ph: '/t/',  phase: 2, color: '#10B981' },
  u: { ph: '/ʌ/',  phase: 2, color: '#10B981' },
  v: { ph: '/v/',  phase: 3, color: '#8B5CF6' },
  w: { ph: '/w/',  phase: 3, color: '#8B5CF6' },
  x: { ph: '/ks/', phase: 3, color: '#8B5CF6' },
  y: { ph: '/j/',  phase: 3, color: '#8B5CF6' },
  z: { ph: '/z/',  phase: 3, color: '#8B5CF6' },
  q: { ph: '/k/',  phase: 3, color: '#8B5CF6' },
};

// ── SPLIT DIGRAPH DETECTOR ────────────────────────────────────
// Phase 5: a-e, e-e, i-e, o-e, u-e patterns (magic-e / VCe)
const SPLIT_DIGRAPHS = {
  'a': { ph: '/eɪ/', label: 'split digraph', color: '#F97316' },
  'e': { ph: '/iː/', label: 'split digraph', color: '#F97316' },
  'i': { ph: '/aɪ/', label: 'split digraph', color: '#F97316' },
  'o': { ph: '/əʊ/', label: 'split digraph', color: '#F97316' },
  'u': { ph: '/juː/', label: 'split digraph', color: '#F97316' },
};

/**
 * Detect split digraph (VCe) pattern in a word.
 * Returns an array of split digraph positions: [{ vowelIdx, eIdx, vowel }]
 * e.g. "cake" → [{ vowelIdx: 1, eIdx: 3, vowel: 'a' }]
 */
function detectSplitDigraphs(lower) {
  const results = [];
  const vowels  = 'aeiou';
  for (let i = 0; i < lower.length - 2; i++) {
    const v = lower[i];
    if (!SPLIT_DIGRAPHS[v]) continue;
    const cons = lower[i + 1];
    if (vowels.includes(cons)) continue;             // must be consonant in middle
    if (lower[i + 2] !== 'e') continue;              // must end in silent 'e'
    if (i + 2 !== lower.length - 1) continue;        // 'e' must be the LAST letter
    results.push({ vowelIdx: i, eIdx: i + 2, vowel: v });
  }
  return results;
}

// ── MAIN ANALYSER ─────────────────────────────────────────────
/**
 * Break a word into grapheme chunks with phoneme labels.
 *
 * @param {string} word  - The word to analyse (e.g. "chain", "cake", "night")
 * @param {number} phase - Child's current phonics phase (2-6)
 * @returns {GraphemeChunk[]}
 *
 * @typedef {Object} GraphemeChunk
 * @property {string}  grapheme  - The written letters (e.g. "ch", "ai", "n")
 * @property {string}  phoneme   - The sound (e.g. "/tʃ/", "/eɪ/", "/n/")
 * @property {number}  phase     - Phase that introduces this grapheme
 * @property {string}  label     - e.g. "digraph", "split digraph", "letter"
 * @property {string}  color     - Display colour based on phase/type
 * @property {boolean} isNew     - true if this grapheme is AT or ABOVE child's phase
 * @property {boolean} isSilent  - true for silent letters (e.g. the 'e' in cake)
 * @property {number}  startIdx  - character index in original word
 */
export function analyseWord(word, phase = 2) {
  const clean = word.replace(/[.,!?;:'"]/g, '').toLowerCase();
  if (!clean) return [];

  // Check for split digraph first (whole-word pattern)
  const splitMatches = detectSplitDigraphs(clean);
  const splitVowelIdxs = new Set(splitMatches.map(s => s.vowelIdx));
  const splitEIdxs     = new Set(splitMatches.map(s => s.eIdx));

  const chunks = [];
  let i = 0;

  while (i < clean.length) {
    // Is this a split digraph vowel position?
    const splitMatch = splitMatches.find(s => s.vowelIdx === i);
    if (splitMatch) {
      const sd = SPLIT_DIGRAPHS[splitMatch.vowel];
      // Add vowel chunk (with note that it pairs with final 'e')
      chunks.push({
        grapheme: splitMatch.vowel,
        phoneme:  sd.ph,
        phase:    5,
        label:    'split digraph',
        color:    sd.color,
        isNew:    phase <= 5,
        isSilent: false,
        startIdx: i,
        pairIdx:  splitMatch.eIdx,  // index of the paired 'e'
      });
      i++;
      continue;
    }

    // Is this the silent 'e' of a split digraph?
    if (splitEIdxs.has(i)) {
      chunks.push({
        grapheme: 'e',
        phoneme:  '(silent)',
        phase:    5,
        label:    'silent e',
        color:    '#F97316',
        isNew:    phase <= 5,
        isSilent: true,
        startIdx: i,
      });
      i++;
      continue;
    }

    // Try longest grapheme match first (trigraphs → digraphs → single)
    let matched = false;
    for (const rule of GRAPHEME_RULES) {
      const g = rule.g;
      if (clean.slice(i, i + g.length) === g) {
        chunks.push({
          grapheme: g,
          phoneme:  rule.ph,
          phase:    rule.phase,
          label:    rule.label,
          color:    rule.color,
          isNew:    phase < rule.phase,
          isSilent: false,
          startIdx: i,
        });
        i += g.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    // Single letter fallback
    const letter = clean[i];
    const single = SINGLE_LETTER[letter];
    chunks.push({
      grapheme: letter,
      phoneme:  single?.ph || `/${letter}/`,
      phase:    single?.phase || 2,
      label:    'letter',
      color:    single?.color || '#6B7280',
      isNew:    false,
      isSilent: false,
      startIdx: i,
    });
    i++;
  }

  return chunks;
}

/**
 * Merge Azure IPA phoneme scores into the grapheme chunks.
 * Maps Azure's phoneme-level assessment data onto our grapheme breakdown
 * so we can colour each grapheme chunk by its actual pronunciation score.
 *
 * @param {GraphemeChunk[]} chunks  - from analyseWord()
 * @param {Array}           azurePhonemes - from Azure: [{ phoneme, score }]
 * @returns {GraphemeChunk[]} chunks with .score added
 */
export function mergePhonemeScores(chunks, azurePhonemes) {
  if (!azurePhonemes?.length) return chunks;

  // Build a flat list of expected phonemes from chunks
  let azPtr = 0;
  return chunks.map(chunk => {
    if (chunk.isSilent) return { ...chunk, score: null };
    // Count how many phonemes this grapheme contributes
    // digraphs like /tʃ/ are ONE phoneme; /ks/ (x) are TWO
    const phonemeCount = chunk.phoneme.replace(/[^a-zæɑɒɔəɛɪʊʌðŋʃθʒ]/g, '').length || 1;
    const phScores = azurePhonemes.slice(azPtr, azPtr + phonemeCount).map(p => p.score ?? 0);
    azPtr += phonemeCount;
    const avgScore = phScores.length ? Math.round(phScores.reduce((a, b) => a + b, 0) / phScores.length) : null;
    return { ...chunk, score: avgScore, azurePhonemes: phScores };
  });
}

/**
 * Get a child-friendly description of a phoneme for coaching.
 * Used by Mrs Owl to explain exactly what sound was wrong.
 */
export function getPhonemeHint(grapheme, phoneme) {
  const hints = {
    'ch':  { emoji: '🚂', hint: 'ch sounds like a train — say "ch-ch-ch"!' },
    'sh':  { emoji: '🤫', hint: 'sh is a quiet sound — like you\'re whispering "shh"!' },
    'th':  { emoji: '👅', hint: 'th — put your tongue between your teeth and blow!' },
    'ng':  { emoji: '🎵', hint: 'ng is a humming sound in your nose — like "sing-ing"!' },
    'ai':  { emoji: '🌂', hint: 'ai says its name — like in "rain" and "tail"!' },
    'ee':  { emoji: '😁', hint: 'ee — make a big smile and say "eeee"!' },
    'oa':  { emoji: '🚣', hint: 'oa makes an "oh" sound — like in "boat"!' },
    'oo':  { emoji: '🌙', hint: 'oo — make your lips round like an "O" and say "ooo"!' },
    'ar':  { emoji: '🏴‍☠️', hint: 'ar — like a pirate saying "ar me hearties"!' },
    'or':  { emoji: '⚓', hint: 'or — say "aw" with your mouth wide!' },
    'igh': { emoji: '🌟', hint: 'igh says the letter "i" — like in "night" and "light"!' },
    'ear': { emoji: '👂', hint: 'ear sounds like "ear" — touch your ear!' },
    'ow':  { emoji: '😮', hint: 'ow — like you bumped your toe and said "ow"!' },
    'oi':  { emoji: '🎯', hint: 'oi says "oy" — like in "coin" and "boy"!' },
    'ay':  { emoji: '🌈', hint: 'ay says the letter "a" — like in "play" and "day"!' },
    'ph':  { emoji: '📞', hint: 'ph sounds like "f" — like in "phone"!' },
    'wh':  { emoji: '💨', hint: 'wh sounds like "w" — blow softly!' },
    'ck':  { emoji: '🔑', hint: 'ck makes a "k" click sound at the end of words!' },
  };
  return hints[grapheme] || {
    emoji: '🔤',
    hint: `Try saying "${grapheme}" again slowly — it makes the sound ${phoneme}!`,
  };
}

/**
 * Analyse a full sentence — returns per-word grapheme breakdowns.
 * Used to pre-process story pages when they're generated.
 */
export function analyseSentence(sentence, phase = 2) {
  return sentence.trim().split(/\s+/).map(word => ({
    word,
    clean: word.replace(/[.,!?;:'"]/g, ''),
    graphemes: analyseWord(word, phase),
  }));
}

/** Score colour based on 0–100 assessment score */
export function graphemeScoreColor(score) {
  if (score === null || score === undefined) return null;
  if (score >= 80) return { bg: 'rgba(16,185,129,0.15)', border: '#10B981', text: '#065F46' };
  if (score >= 55) return { bg: 'rgba(245,158,11,0.15)', border: '#F59E0B', text: '#92400E' };
  return              { bg: 'rgba(239,68,68,0.18)',  border: '#EF4444', text: '#7F1D1D' };
}
