/**
 * @file        phonicsAnalyser.js
 * @description Phase-aware grapheme analyser — breaks words DIFFERENTLY based on
 *              the child's current phonics phase, exactly matching DfE Letters and
 *              Sounds 2021 progression.
 *
 *              PHASE 2  → individual letters only (CVC). "chat" = [c][h][a][t]
 *              PHASE 3  → digraphs/trigraphs introduced. "chat" = [ch][a][t]
 *              PHASE 4  → consonant blend groups added. "flat" = [fl][a][t]
 *              PHASE 5  → split digraphs + new vowel spellings. "cake" = [c][a·e][k]
 *              PHASE 6  → morphology: prefixes, suffixes, -tion etc.
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 */

const GRAPHEME_RULES = [
  // Phase 6 suffixes
  { g: 'tion', ph: '/ʃən/', phase: 6, label: 'suffix',        color: '#EC4899' },
  { g: 'sion', ph: '/ʒən/', phase: 6, label: 'suffix',        color: '#EC4899' },
  { g: 'ture', ph: '/tʃə/', phase: 6, label: 'suffix',        color: '#EC4899' },
  { g: 'ous',  ph: '/əs/',  phase: 6, label: 'suffix',        color: '#EC4899' },
  // Phase 3 trigraphs
  { g: 'igh',  ph: '/aɪ/',  phase: 3, label: 'trigraph',      color: '#7C3AED' },
  { g: 'ear',  ph: '/ɪə/',  phase: 3, label: 'trigraph',      color: '#7C3AED' },
  { g: 'air',  ph: '/eə/',  phase: 3, label: 'trigraph',      color: '#7C3AED' },
  { g: 'ure',  ph: '/ʊə/',  phase: 3, label: 'trigraph',      color: '#7C3AED' },
  { g: 'tch',  ph: '/tʃ/',  phase: 3, label: 'trigraph',      color: '#7C3AED' },
  { g: 'dge',  ph: '/dʒ/',  phase: 3, label: 'trigraph',      color: '#7C3AED' },
  // Phase 5 digraphs
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
  { g: 'wh',   ph: '/w/',   phase: 5, label: 'digraph',       color: '#0EA5E9' },
  { g: 'ph',   ph: '/f/',   phase: 5, label: 'digraph',       color: '#0EA5E9' },
  // Phase 3 digraphs
  { g: 'ch',   ph: '/tʃ/',  phase: 3, label: 'digraph',       color: '#8B5CF6' },
  { g: 'sh',   ph: '/ʃ/',   phase: 3, label: 'digraph',       color: '#8B5CF6' },
  { g: 'th',   ph: '/ð/',   phase: 3, label: 'digraph',       color: '#8B5CF6' },
  { g: 'ng',   ph: '/ŋ/',   phase: 3, label: 'digraph',       color: '#8B5CF6' },
  { g: 'qu',   ph: '/kw/',  phase: 3, label: 'digraph',       color: '#8B5CF6' },
  { g: 'nk',   ph: '/ŋk/',  phase: 3, label: 'digraph',       color: '#8B5CF6' },
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
  // Phase 2 doubles
  { g: 'ff',   ph: '/f/',   phase: 2, label: 'double',        color: '#10B981' },
  { g: 'll',   ph: '/l/',   phase: 2, label: 'double',        color: '#10B981' },
  { g: 'ss',   ph: '/s/',   phase: 2, label: 'double',        color: '#10B981' },
  { g: 'zz',   ph: '/z/',   phase: 3, label: 'double',        color: '#10B981' },
  { g: 'ck',   ph: '/k/',   phase: 2, label: 'digraph',       color: '#10B981' },
];

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

const SPLIT_DIGRAPHS = {
  a: { ph: '/eɪ/', label: 'split digraph', color: '#F97316' },
  e: { ph: '/iː/', label: 'split digraph', color: '#F97316' },
  i: { ph: '/aɪ/', label: 'split digraph', color: '#F97316' },
  o: { ph: '/əʊ/', label: 'split digraph', color: '#F97316' },
  u: { ph: '/juː/',label: 'split digraph', color: '#F97316' },
};

// Phase 4 consonant blends — longest first so 'str' matches before 'st' or 'tr'
const BLENDS_INITIAL = ['str','spr','spl','scr','thr','shr','bl','br','cl','cr','dr','fl','fr','gl','gr','pl','pr','sk','sl','sm','sn','sp','st','sw','tr','tw'];
const BLENDS_FINAL   = ['nch','lth','rth','nge','dth','nd','nt','mp','lt','lp','lk','ft','xt','pt','sk','sp','st','lf','lm','lv','rv','rm','rn','ct','ld','nk'];

function detectSplitDigraphs(lower) {
  const results = [];
  const vowels = 'aeiou';
  for (let i = 0; i < lower.length - 2; i++) {
    const v = lower[i];
    if (!SPLIT_DIGRAPHS[v]) continue;
    const cons = lower[i + 1];
    if (vowels.includes(cons)) continue;
    if (lower[i + 2] !== 'e') continue;
    if (i + 2 !== lower.length - 1) continue;
    results.push({ vowelIdx: i, eIdx: i + 2, vowel: v });
  }
  return results;
}

export function analyseWord(word, phase = 2) {
  const clean = word.replace(/[.,!?;:'"]/g, '').toLowerCase();
  if (!clean) return [];

  const activeRules = GRAPHEME_RULES.filter(r => r.phase <= phase);

  // Phase 5+: split digraphs
  const splitMatches  = phase >= 5 ? detectSplitDigraphs(clean) : [];
  const splitVowelIdx = new Set(splitMatches.map(s => s.vowelIdx));
  const splitEIdx     = new Set(splitMatches.map(s => s.eIdx));

  // Phase 4+: find blends
  // blendRanges: Set of character indices that are part of a blend
  const blendRanges = new Map(); // charIdx → { blend, pos, len }
  if (phase >= 4) {
    // Initial blends at position 0
    for (const blend of BLENDS_INITIAL) {
      if (clean.startsWith(blend)) {
        for (let bi = 0; bi < blend.length; bi++) {
          blendRanges.set(bi, { blend, pos: bi, len: blend.length });
        }
        break;
      }
    }
    // Final blends — find the last consonant cluster before end (or before silent-e)
    const endsWithSilentE = splitMatches.length > 0;
    const searchEnd = endsWithSilentE ? clean.length - 1 : clean.length;
    for (const blend of BLENDS_FINAL) {
      const blendStart = searchEnd - blend.length;
      if (blendStart > 0 && clean.slice(blendStart, searchEnd) === blend) {
        // Don't double-count if already in initial blend range
        let alreadyCovered = false;
        for (let bi = 0; bi < blend.length; bi++) {
          if (blendRanges.has(blendStart + bi)) { alreadyCovered = true; break; }
        }
        if (!alreadyCovered) {
          for (let bi = 0; bi < blend.length; bi++) {
            blendRanges.set(blendStart + bi, { blend, pos: bi, len: blend.length });
          }
        }
        break;
      }
    }
  }

  const chunks = [];
  let i = 0;

  while (i < clean.length) {
    // Split digraph vowel?
    const splitMatch = splitMatches.find(s => s.vowelIdx === i);
    if (splitMatch) {
      const sd = SPLIT_DIGRAPHS[splitMatch.vowel];
      chunks.push({ grapheme: splitMatch.vowel, phoneme: sd.ph, phase: 5, label: 'split digraph', color: sd.color, isNew: false, isSilent: false, startIdx: i, pairIdx: splitMatch.eIdx });
      i++; continue;
    }
    // Silent e?
    if (splitEIdx.has(i)) {
      chunks.push({ grapheme: 'e', phoneme: '(silent)', phase: 5, label: 'silent e', color: '#F97316', isNew: false, isSilent: true, startIdx: i });
      i++; continue;
    }
    // Blend letter?
    if (blendRanges.has(i)) {
      const br = blendRanges.get(i);
      const letter = clean[i];
      const single = SINGLE_LETTER[letter];
      chunks.push({
        grapheme:   letter,
        phoneme:    single?.ph || `/${letter}/`,
        phase:      4,
        label:      'blend',
        color:      '#0EA5E9',
        isNew:      false,
        isSilent:   false,
        startIdx:   i,
        blendGroup: br.blend,
        blendPos:   br.pos,
        blendLen:   br.len,
      });
      i++; continue;
    }
    // Multi-letter grapheme rule?
    let matched = false;
    for (const rule of activeRules) {
      if (clean.slice(i, i + rule.g.length) === rule.g) {
        chunks.push({ grapheme: rule.g, phoneme: rule.ph, phase: rule.phase, label: rule.label, color: rule.color, isNew: false, isSilent: false, startIdx: i });
        i += rule.g.length; matched = true; break;
      }
    }
    if (matched) continue;
    // Single letter
    const letter = clean[i];
    const single = SINGLE_LETTER[letter];
    chunks.push({ grapheme: letter, phoneme: single?.ph || `/${letter}/`, phase: single?.phase || 2, label: 'letter', color: single?.color || '#6B7280', isNew: false, isSilent: false, startIdx: i });
    i++;
  }

  return chunks;
}

export function getBlendGroups(chunks) {
  const groups = [];
  const seen = new Set();
  chunks.forEach((c, idx) => {
    if (c.blendGroup && c.blendPos === 0 && !seen.has(c.blendGroup + c.startIdx)) {
      seen.add(c.blendGroup + c.startIdx);
      groups.push({ blendGroup: c.blendGroup, startChunkIdx: idx, length: c.blendLen });
    }
  });
  return groups;
}

export function phaseDescription(phase) {
  return {
    2: 'Sounding out single letters (s, a, t, p…)',
    3: 'Learning digraphs — two letters, one sound (sh, ch, ee…)',
    4: 'Blending consonant clusters (fl, st, nd…)',
    5: 'Split digraphs and new vowel spellings (a-e, ay, ea…)',
    6: 'Word endings and prefixes (-tion, -ture, un-, re-…)',
  }[phase] || '';
}

export function mergePhonemeScores(chunks, azurePhonemes) {
  if (!azurePhonemes?.length) return chunks;
  let azPtr = 0;
  return chunks.map(chunk => {
    if (chunk.isSilent) return { ...chunk, score: null };
    const phonemeCount = chunk.phoneme.replace(/[^a-z\u00C0-\u024F\u1E00-\u1EFF]/gi, '').length || 1;
    const phScores = azurePhonemes.slice(azPtr, azPtr + phonemeCount).map(p => p.score ?? 0);
    azPtr += phonemeCount;
    const avgScore = phScores.length ? Math.round(phScores.reduce((a, b) => a + b, 0) / phScores.length) : null;
    return { ...chunk, score: avgScore, azurePhonemes: phScores };
  });
}

export function getPhonemeHint(grapheme, phoneme) {
  const hints = {
    'ch':{ emoji:'🚂', hint:'ch sounds like a train — say "ch-ch-ch"!' },
    'sh':{ emoji:'🤫', hint:'sh is a quiet sound — like you\'re whispering "shh"!' },
    'th':{ emoji:'👅', hint:'th — put your tongue between your teeth and blow!' },
    'ng':{ emoji:'🎵', hint:'ng is a humming sound in your nose — like "sing-ing"!' },
    'ai':{ emoji:'🌂', hint:'ai says its name — like in "rain" and "tail"!' },
    'ee':{ emoji:'😁', hint:'ee — make a big smile and say "eeee"!' },
    'oa':{ emoji:'🚣', hint:'oa makes an "oh" sound — like in "boat"!' },
    'oo':{ emoji:'🌙', hint:'oo — make your lips round like an "O" and say "ooo"!' },
    'ar':{ emoji:'🏴\u200d☠️', hint:'ar — like a pirate saying "ar me hearties"!' },
    'or':{ emoji:'⚓', hint:'or — say "aw" with your mouth wide!' },
    'igh':{ emoji:'🌟', hint:'igh says the letter "i" — like in "night" and "light"!' },
    'ear':{ emoji:'👂', hint:'ear sounds like "ear" — touch your ear!' },
    'ow':{ emoji:'😮', hint:'ow — like you bumped your toe and said "ow"!' },
    'oi':{ emoji:'🎯', hint:'oi says "oy" — like in "coin" and "boy"!' },
    'ay':{ emoji:'🌈', hint:'ay says the letter "a" — like in "play" and "day"!' },
    'ph':{ emoji:'📞', hint:'ph sounds like "f" — like in "phone"!' },
    'wh':{ emoji:'💨', hint:'wh sounds like "w" — blow softly!' },
    'ck':{ emoji:'🔑', hint:'ck makes a "k" click sound at the end of words!' },
  };
  return hints[grapheme] || { emoji:'🔤', hint:`Try saying "${grapheme}" again slowly — it makes the sound ${phoneme}!` };
}

export function analyseSentence(sentence, phase = 2) {
  return sentence.trim().split(/\s+/).map(word => ({ word, clean: word.replace(/[.,!?;:'"]/g, ''), graphemes: analyseWord(word, phase) }));
}

export function graphemeScoreColor(score) {
  if (score === null || score === undefined) return null;
  if (score >= 80) return { bg: 'rgba(16,185,129,0.15)',  border: '#10B981', text: '#065F46' };
  if (score >= 55) return { bg: 'rgba(245,158,11,0.15)',  border: '#F59E0B', text: '#92400E' };
  return               { bg: 'rgba(239,68,68,0.18)',   border: '#EF4444', text: '#7F1D1D' };
}
