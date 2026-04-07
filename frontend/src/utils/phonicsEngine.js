/**
 * @file        phonicsEngine.js
 * @description Complete phonics engine — single source of truth for all
 *              grapheme → phoneme relationships across DfE Phases 2–6.
 *
 *              Exports:
 *                PHONEME_MAP     — every grapheme → phoneme entry
 *                segmentWord()   — break any word into grapheme chunks
 *                getPhonemeEntry() — lookup a grapheme's phoneme data
 *
 *              Used by:
 *                usePhonemePlayer — plays the correct sound for any grapheme
 *                PhonicsLearn    — displays sound tiles, demos, breakdowns
 *                PhonicsWord     — colours grapheme tiles in reading sessions
 *                phonicsAnalyser — analyses words for phase-appropriate content
 */

// ── PHONEME ENTRY SCHEMA ──────────────────────────────────────────────────────
// Each entry describes one grapheme and its associated phoneme:
//
//   ipa:       IPA symbol(s) — what to pass to Azure SSML ph="..."
//   type:      'consonant' | 'vowel' | 'digraph' | 'trigraph' | 'blend' |
//              'split-digraph' | 'suffix' | 'morpheme'
//   example:   a short word that clearly contains this sound
//   color:     display colour (used in tiles)
//              Vowels → red   Consonants → purple
//              Digraphs → blue  Blends → indigo  Trigraphs → pink
//   phase:     DfE phonics phase where this is introduced (2–6)
//   blendOf:   (blends only) array of component grapheme strings played in sequence
//
// The `ipa` value is sent directly to POST /api/ai/phoneme { ipa, grapheme }
// which generates: <phoneme alphabet="ipa" ph="{ipa}">{grapheme}</phoneme>
// Combined IPA like 'ɪŋ' produces one smooth natural sound from Azure.

export const PHONEME_MAP = {

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 2 — Simple consonants and short vowels (first sounds taught)
  // ════════════════════════════════════════════════════════════════════════════

  // ── Consonants ──────────────────────────────────────────────────────────────
  's':  { ipa:'s',   type:'consonant', example:'sun',  color:'#7C3AED', phase:2 },
  'a':  { ipa:'æ',   type:'vowel',     example:'cat',  color:'#EF4444', phase:2 },
  't':  { ipa:'t',   type:'consonant', example:'tap',  color:'#7C3AED', phase:2 },
  'p':  { ipa:'p',   type:'consonant', example:'pin',  color:'#7C3AED', phase:2 },
  'i':  { ipa:'ɪ',   type:'vowel',     example:'sit',  color:'#EF4444', phase:2 },
  'n':  { ipa:'n',   type:'consonant', example:'net',  color:'#7C3AED', phase:2 },
  'm':  { ipa:'m',   type:'consonant', example:'map',  color:'#7C3AED', phase:2 },
  'd':  { ipa:'d',   type:'consonant', example:'dog',  color:'#7C3AED', phase:2 },
  'g':  { ipa:'g',   type:'consonant', example:'got',  color:'#7C3AED', phase:2 },
  'o':  { ipa:'ɒ',   type:'vowel',     example:'hot',  color:'#EF4444', phase:2 },
  'c':  { ipa:'k',   type:'consonant', example:'cat',  color:'#7C3AED', phase:2 },
  'k':  { ipa:'k',   type:'consonant', example:'kit',  color:'#7C3AED', phase:2 },
  'e':  { ipa:'ɛ',   type:'vowel',     example:'bed',  color:'#EF4444', phase:2 },
  'u':  { ipa:'ʌ',   type:'vowel',     example:'cup',  color:'#EF4444', phase:2 },
  'r':  { ipa:'r',   type:'consonant', example:'red',  color:'#7C3AED', phase:2 },
  'h':  { ipa:'h',   type:'consonant', example:'hat',  color:'#7C3AED', phase:2 },
  'b':  { ipa:'b',   type:'consonant', example:'bat',  color:'#7C3AED', phase:2 },
  'f':  { ipa:'f',   type:'consonant', example:'fan',  color:'#7C3AED', phase:2 },
  'l':  { ipa:'l',   type:'consonant', example:'lip',  color:'#7C3AED', phase:2 },
  // ── Doubled consonants (same sound, two letters) ────────────────────────────
  'ff': { ipa:'f',   type:'consonant', example:'off',  color:'#7C3AED', phase:2 },
  'll': { ipa:'l',   type:'consonant', example:'ball', color:'#7C3AED', phase:2 },
  'ss': { ipa:'s',   type:'consonant', example:'hiss', color:'#7C3AED', phase:2 },
  'zz': { ipa:'z',   type:'consonant', example:'buzz', color:'#7C3AED', phase:2 },
  'ck': { ipa:'k',   type:'digraph',   example:'duck', color:'#2563EB', phase:2 },

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 2 / 3 — Remaining single consonants
  // ════════════════════════════════════════════════════════════════════════════
  'j':  { ipa:'dʒ',  type:'consonant', example:'jam',  color:'#7C3AED', phase:2 },
  'v':  { ipa:'v',   type:'consonant', example:'van',  color:'#7C3AED', phase:2 },
  'w':  { ipa:'w',   type:'consonant', example:'wet',  color:'#7C3AED', phase:2 },
  'x':  { ipa:'ks',  type:'consonant', example:'fox',  color:'#7C3AED', phase:2 },
  'y':  { ipa:'j',   type:'consonant', example:'yes',  color:'#7C3AED', phase:2 },
  'z':  { ipa:'z',   type:'consonant', example:'zip',  color:'#7C3AED', phase:2 },
  'q':  { ipa:'k',   type:'consonant', example:'quiz', color:'#7C3AED', phase:2 },
  'qu': { ipa:'kw',  type:'digraph',   example:'quiz', color:'#2563EB', phase:2 },

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 3 — Consonant digraphs (two letters, ONE sound)
  // ════════════════════════════════════════════════════════════════════════════
  'sh': { ipa:'ʃ',   type:'digraph',   example:'ship', color:'#2563EB', phase:3 },
  'ch': { ipa:'tʃ',  type:'digraph',   example:'chip', color:'#2563EB', phase:3 },
  'th': { ipa:'ð',   type:'digraph',   example:'the',  color:'#2563EB', phase:3 },
  'ng': { ipa:'ŋ',   type:'digraph',   example:'ring', color:'#2563EB', phase:3 },
  'wh': { ipa:'w',   type:'digraph',   example:'when', color:'#2563EB', phase:3 },
  'ph': { ipa:'f',   type:'digraph',   example:'phone',color:'#2563EB', phase:3 },

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 3 — Vowel digraphs (two letters, ONE long vowel sound)
  // ════════════════════════════════════════════════════════════════════════════
  'ai': { ipa:'eɪ',  type:'digraph',   example:'rain', color:'#2563EB', phase:3 },
  'ee': { ipa:'iː',  type:'digraph',   example:'feet', color:'#2563EB', phase:3 },
  'oa': { ipa:'əʊ',  type:'digraph',   example:'boat', color:'#2563EB', phase:3 },
  'oo': { ipa:'uː',  type:'digraph',   example:'moon', color:'#2563EB', phase:3 },
  'ar': { ipa:'ɑː',  type:'digraph',   example:'car',  color:'#2563EB', phase:3 },
  'or': { ipa:'ɔː',  type:'digraph',   example:'fork', color:'#2563EB', phase:3 },
  'ur': { ipa:'ɜː',  type:'digraph',   example:'turn', color:'#2563EB', phase:3 },
  'ow': { ipa:'aʊ',  type:'digraph',   example:'cow',  color:'#2563EB', phase:3 },
  'oi': { ipa:'ɔɪ',  type:'digraph',   example:'coin', color:'#2563EB', phase:3 },
  'ea': { ipa:'iː',  type:'digraph',   example:'eat',  color:'#2563EB', phase:3 },
  'ou': { ipa:'aʊ',  type:'digraph',   example:'out',  color:'#2563EB', phase:3 },

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 3 — Trigraphs (THREE letters, one sound)
  // ════════════════════════════════════════════════════════════════════════════
  'igh': { ipa:'aɪ',  type:'trigraph',  example:'night',color:'#DB2777', phase:3 },
  'ear': { ipa:'ɪə',  type:'trigraph',  example:'hear', color:'#DB2777', phase:3 },
  'air': { ipa:'eə',  type:'trigraph',  example:'chair',color:'#DB2777', phase:3 },
  'ure': { ipa:'ʊə',  type:'trigraph',  example:'pure', color:'#DB2777', phase:3 },
  'ere': { ipa:'ɪə',  type:'trigraph',  example:'here', color:'#DB2777', phase:3 },

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 4 — Consonant blends (component sounds played quickly in sequence)
  // blendOf arrays contain grapheme strings from this map
  // ════════════════════════════════════════════════════════════════════════════
  'bl':  { ipa:'bl',  type:'blend', example:'black',  color:'#4F46E5', phase:4, blendOf:['b','l'] },
  'br':  { ipa:'br',  type:'blend', example:'bring',  color:'#4F46E5', phase:4, blendOf:['b','r'] },
  'cl':  { ipa:'kl',  type:'blend', example:'clap',   color:'#4F46E5', phase:4, blendOf:['c','l'] },
  'cr':  { ipa:'kr',  type:'blend', example:'crab',   color:'#4F46E5', phase:4, blendOf:['c','r'] },
  'dr':  { ipa:'dr',  type:'blend', example:'drop',   color:'#4F46E5', phase:4, blendOf:['d','r'] },
  'fl':  { ipa:'fl',  type:'blend', example:'flag',   color:'#4F46E5', phase:4, blendOf:['f','l'] },
  'fr':  { ipa:'fr',  type:'blend', example:'frog',   color:'#4F46E5', phase:4, blendOf:['f','r'] },
  'gl':  { ipa:'gl',  type:'blend', example:'glad',   color:'#4F46E5', phase:4, blendOf:['g','l'] },
  'gr':  { ipa:'gr',  type:'blend', example:'grab',   color:'#4F46E5', phase:4, blendOf:['g','r'] },
  'pl':  { ipa:'pl',  type:'blend', example:'play',   color:'#4F46E5', phase:4, blendOf:['p','l'] },
  'pr':  { ipa:'pr',  type:'blend', example:'pram',   color:'#4F46E5', phase:4, blendOf:['p','r'] },
  'sl':  { ipa:'sl',  type:'blend', example:'slip',   color:'#4F46E5', phase:4, blendOf:['s','l'] },
  'sm':  { ipa:'sm',  type:'blend', example:'smile',  color:'#4F46E5', phase:4, blendOf:['s','m'] },
  'sn':  { ipa:'sn',  type:'blend', example:'snap',   color:'#4F46E5', phase:4, blendOf:['s','n'] },
  'sp':  { ipa:'sp',  type:'blend', example:'spin',   color:'#4F46E5', phase:4, blendOf:['s','p'] },
  'st':  { ipa:'st',  type:'blend', example:'step',   color:'#4F46E5', phase:4, blendOf:['s','t'] },
  'sw':  { ipa:'sw',  type:'blend', example:'swim',   color:'#4F46E5', phase:4, blendOf:['s','w'] },
  'tr':  { ipa:'tr',  type:'blend', example:'trip',   color:'#4F46E5', phase:4, blendOf:['t','r'] },
  'tw':  { ipa:'tw',  type:'blend', example:'twin',   color:'#4F46E5', phase:4, blendOf:['t','w'] },
  'sk':  { ipa:'sk',  type:'blend', example:'skip',   color:'#4F46E5', phase:4, blendOf:['s','k'] },
  'nd':  { ipa:'nd',  type:'blend', example:'sand',   color:'#4F46E5', phase:4, blendOf:['n','d'] },
  'mp':  { ipa:'mp',  type:'blend', example:'lamp',   color:'#4F46E5', phase:4, blendOf:['m','p'] },
  'lt':  { ipa:'lt',  type:'blend', example:'belt',   color:'#4F46E5', phase:4, blendOf:['l','t'] },
  'nt':  { ipa:'nt',  type:'blend', example:'tent',   color:'#4F46E5', phase:4, blendOf:['n','t'] },
  'nk':  { ipa:'ŋk',  type:'blend', example:'bank',   color:'#4F46E5', phase:4, blendOf:['n','k'] },
  'lp':  { ipa:'lp',  type:'blend', example:'help',   color:'#4F46E5', phase:4, blendOf:['l','p'] },
  'scr': { ipa:'skr', type:'blend', example:'scrap',  color:'#4F46E5', phase:4, blendOf:['s','c','r'] },
  'str': { ipa:'str', type:'blend', example:'strap',  color:'#4F46E5', phase:4, blendOf:['s','t','r'] },
  'spr': { ipa:'spr', type:'blend', example:'spring', color:'#4F46E5', phase:4, blendOf:['s','p','r'] },
  'spl': { ipa:'spl', type:'blend', example:'split',  color:'#4F46E5', phase:4, blendOf:['s','p','l'] },

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 5 — Alternative spellings & split digraphs
  // ════════════════════════════════════════════════════════════════════════════
  'ay':  { ipa:'eɪ',  type:'digraph',      example:'play',  color:'#2563EB', phase:5 },
  'ey':  { ipa:'eɪ',  type:'digraph',      example:'they',  color:'#2563EB', phase:5 },
  'ie':  { ipa:'aɪ',  type:'digraph',      example:'pie',   color:'#2563EB', phase:5 },
  'ue':  { ipa:'juː', type:'digraph',      example:'blue',  color:'#2563EB', phase:5 },
  'ew':  { ipa:'juː', type:'digraph',      example:'new',   color:'#2563EB', phase:5 },
  'oe':  { ipa:'əʊ',  type:'digraph',      example:'toe',   color:'#2563EB', phase:5 },
  'au':  { ipa:'ɔː',  type:'digraph',      example:'haul',  color:'#2563EB', phase:5 },
  'aw':  { ipa:'ɔː',  type:'digraph',      example:'saw',   color:'#2563EB', phase:5 },
  'er':  { ipa:'ɜː',  type:'digraph',      example:'her',   color:'#2563EB', phase:5 },
  'ir':  { ipa:'ɜː',  type:'digraph',      example:'girl',  color:'#2563EB', phase:5 },
  'oy':  { ipa:'ɔɪ',  type:'digraph',      example:'boy',   color:'#2563EB', phase:5 },
  // Split digraphs (magic e)
  'a_e': { ipa:'eɪ',  type:'split-digraph',example:'cake',  color:'#059669', phase:5 },
  'e_e': { ipa:'iː',  type:'split-digraph',example:'theme', color:'#059669', phase:5 },
  'i_e': { ipa:'aɪ',  type:'split-digraph',example:'bike',  color:'#059669', phase:5 },
  'o_e': { ipa:'əʊ',  type:'split-digraph',example:'home',  color:'#059669', phase:5 },
  'u_e': { ipa:'juː', type:'split-digraph',example:'tune',  color:'#059669', phase:5 },

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE 5/6 — Common suffixes & morphemes (as complete sounds)
  // These are fetched as ONE unit from Azure SSML for natural pronunciation
  // ════════════════════════════════════════════════════════════════════════════
  'ing':  { ipa:'ɪŋ',  type:'suffix',   example:'ring',    color:'#D97706', phase:5 },
  'tion': { ipa:'ʃən', type:'suffix',   example:'nation',  color:'#D97706', phase:6 },
  'sion': { ipa:'ʒən', type:'suffix',   example:'vision',  color:'#D97706', phase:6 },
  'ture': { ipa:'tʃər',type:'suffix',   example:'nature',  color:'#D97706', phase:6 },
  'ous':  { ipa:'əs',  type:'suffix',   example:'famous',  color:'#D97706', phase:6 },
  'ful':  { ipa:'fʊl', type:'suffix',   example:'hopeful', color:'#D97706', phase:6 },
  'less': { ipa:'lɪs', type:'suffix',   example:'careless',color:'#D97706', phase:6 },
  'ness': { ipa:'nɪs', type:'suffix',   example:'sadness', color:'#D97706', phase:6 },
  'ment': { ipa:'mənt',type:'suffix',   example:'moment',  color:'#D97706', phase:6 },
  'ly':   { ipa:'liː', type:'suffix',   example:'quickly', color:'#D97706', phase:6 },
  'er':   { ipa:'ɜː',  type:'suffix',   example:'faster',  color:'#D97706', phase:6 },
  'est':  { ipa:'ɪst', type:'suffix',   example:'fastest', color:'#D97706', phase:6 },
  'ed':   { ipa:'ɪd',  type:'suffix',   example:'wanted',  color:'#D97706', phase:5 },
  'eme':  { ipa:'iːm', type:'suffix',   example:'phoneme', color:'#D97706', phase:6 },
};

// ── LOOKUP HELPERS ────────────────────────────────────────────────────────────

/** Get the phoneme entry for a grapheme string. Returns undefined if not found. */
export function getPhonemeEntry(grapheme) {
  return PHONEME_MAP[grapheme.toLowerCase()];
}

// Build sorted key list (longest first) for greedy matching
const SORTED_KEYS = Object.keys(PHONEME_MAP)
  .filter(k => !k.includes('_'))  // exclude split-digraph keys from word segmenter
  .sort((a, b) => b.length - a.length || a.localeCompare(b));

// Split-digraph patterns: consonant + vowel letter + consonant(s) + 'e'
const SPLIT_DIGRAPH_VOWELS = { 'a':'a_e','e':'e_e','i':'i_e','o':'o_e','u':'u_e' };

/**
 * Detect split digraphs in a word.
 * Returns array of {start, vowelPos, ePos, vowelLetter} for each split digraph found.
 * e.g. "cake" → [{start:1, vowelPos:1, ePos:3, vowelLetter:'a'}]
 */
function detectSplitDigraphs(word) {
  const w   = word.toLowerCase();
  const len = w.length;
  const hits = [];
  for (let vi = 0; vi < len - 2; vi++) {
    const vowel = w[vi];
    if (!SPLIT_DIGRAPH_VOWELS[vowel]) continue;
    // Must be preceded by a consonant or be first letter
    // Must have 1+ consonants then 'e' at end (or near end)
    for (let ei = vi + 2; ei < len; ei++) {
      if (w[ei] !== 'e') continue;
      // Everything between vowel+1 and ei must be consonants (no vowels)
      const middle = w.slice(vi + 1, ei);
      if (middle.length === 0) continue;
      if (middle.split('').some(c => 'aeiou'.includes(c))) continue;
      // Valid split digraph candidate
      hits.push({ vowelPos: vi, ePos: ei, vowelLetter: vowel });
      break;
    }
  }
  return hits;
}

/**
 * Segment a word into grapheme chunks.
 *
 * Returns an array of objects, each representing one grapheme chunk:
 * {
 *   grapheme: 'sh',         // the grapheme string
 *   original: 'Sh',         // original case from input word
 *   ipa: 'ʃ',               // IPA for display
 *   type: 'digraph',        // phoneme type
 *   example: 'ship',        // example word
 *   color: '#2563EB',       // display colour
 *   phase: 3,               // DfE phase
 *   blendOf: undefined,     // (blends only) component graphemes
 * }
 *
 * Handles: simple graphemes, digraphs, trigraphs, blends, split digraphs, suffixes.
 * Uses greedy longest-match algorithm.
 */
export function segmentWord(word) {
  if (!word) return [];

  const clean  = word.replace(/[^a-zA-Z]/g, '');
  const lower  = clean.toLowerCase();
  const result = [];

  // Find split digraphs first so we can annotate them
  const splitHits = detectSplitDigraphs(lower);
  const splitVowelPositions = new Set(splitHits.map(h => h.vowelPos));
  const splitEPositions     = new Set(splitHits.map(h => h.ePos));
  // Build a map: vowelPos → split-digraph key
  const splitMap = {};
  splitHits.forEach(h => { splitMap[h.vowelPos] = h; });

  let i = 0;
  while (i < lower.length) {
    // Check if this position is a split-digraph vowel
    if (splitMap[i]) {
      const hit  = splitMap[i];
      const key  = SPLIT_DIGRAPH_VOWELS[hit.vowelLetter];
      const entry = PHONEME_MAP[key];
      if (entry) {
        // Mark the vowel position
        result.push({
          grapheme: key,
          original: clean[i],
          ...entry,
          splitVowelIdx: i,
          splitEIdx: hit.ePos,
        });
        i++;
        continue;
      }
    }

    // Check if this position is the silent 'e' of a split digraph
    if (splitEPositions.has(i)) {
      result.push({
        grapheme: 'e',
        original: clean[i],
        ipa: '',
        type: 'split-e',
        example: '',
        color: '#9CA3AF',
        phase: 5,
        silent: true,
      });
      i++;
      continue;
    }

    // Greedy longest-match (3 chars → 2 chars → 1 char)
    let matched = false;
    for (const key of SORTED_KEYS) {
      if (i + key.length > lower.length) continue;
      if (lower.slice(i, i + key.length) === key) {
        const entry = PHONEME_MAP[key];
        result.push({
          grapheme: key,
          original: clean.slice(i, i + key.length),
          ...entry,
        });
        i += key.length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Unknown character — pass through
      result.push({
        grapheme: lower[i],
        original: clean[i],
        ipa: lower[i],
        type: 'unknown',
        example: '',
        color: '#6B7280',
        phase: 2,
      });
      i++;
    }
  }

  return result;
}

// ── BACKWARDS COMPAT: simple IPA lookup for usePhonemePlayer ─────────────────
/** Get just the IPA string for a grapheme. Returns undefined if not found. */
export function getIpa(grapheme) {
  return PHONEME_MAP[grapheme.toLowerCase()]?.ipa;
}

/** Get just the blendOf array for blend graphemes. Returns undefined if not a blend. */
export function getBlendComponents(grapheme) {
  return PHONEME_MAP[grapheme.toLowerCase()]?.blendOf;
}
