/**
 * Server-side phonics word analyser — tags which graphemes appear in a word for a given phase.
 * Used when saving AI story pages to extract educationally relevant target words.
 */

const DIGRAPHS = {
  3: ['ch','sh','th','ng','qu','ai','ee','igh','oa','oo','ar','or','ur','ow','oi','ear','air','er'],
  5: ['ay','ou','ie','ea','oy','ir','ue','aw','ew','oe','au','wh','ph'],
  6: ['tion','sion','ture','ous'],
};

export function getPhaseTargetGraphemes(word, phase) {
  const lower = word.toLowerCase().replace(/[^a-z]/g, '');
  const targets = [];
  const allDG = [];
  for (let p = 3; p <= Math.min(phase, 6); p++) {
    if (DIGRAPHS[p]) allDG.push(...DIGRAPHS[p]);
  }
  // Split digraphs (Phase 5): a-e, i-e etc.
  if (phase >= 5) {
    for (const v of ['a','e','i','o','u']) {
      if (lower.includes(v) && lower.endsWith('e')) {
        const vIdx = lower.indexOf(v);
        const eIdx = lower.length - 1;
        if (eIdx - vIdx >= 2) { targets.push(`${v}_e`); break; }
      }
    }
  }
  for (const dg of allDG) {
    if (lower.includes(dg)) targets.push(dg);
  }
  return [...new Set(targets)];
}

export function extractTargetWords(sentence, phase) {
  return sentence.trim().split(/\s+/)
    .map(w => w.replace(/[.,!?;:'"]/g, '').toLowerCase())
    .filter(w => w.length >= 3 && getPhaseTargetGraphemes(w, phase).length > 0);
}
