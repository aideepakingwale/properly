/**
 * @file        scoring.js
 * @description Client-side pronunciation scoring utilities — word colour coding and error badge helpers
 * @module      Utils
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - getWordColor maps score 0-100 to green/amber/red palette
 *   - getErrorBadge maps Azure ErrorType to human-readable badge label
 */

// Function words that speech recognition often varies on — give generous floor
const FUNCTION_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with',
  'is','it','its','was','are','were','be','been','has','had','have',
  'i','he','she','they','we','you','my','his','her','their','our','your',
  'this','that','these','those','there','here',
]);

export function scoreWords(spoken, target) {
  if (!spoken || !spoken.trim()) {
    // No transcript at all — return neutral scores (75) so child can progress
    return target.trim().split(/\s+/).map(word => ({
      word, score: 75, errorType: 'None', phonemes: []
    }));
  }

  const sp = spoken.toLowerCase().replace(/[.,!?;:'"]/g,'').trim().split(/\s+/);

  return target.trim().split(/\s+/).map((word, i) => {
    const clean = word.replace(/[.,!?;:'"]/g,'').toLowerCase();
    const said  = (sp[i] || '').toLowerCase();

    if (!said) return { word, score: 0, errorType: 'Omission', phonemes: [] };
    if (said === clean) return { word, score: 100, errorType: 'None', phonemes: [] };

    // Character overlap score
    let match = 0;
    const len = Math.max(said.length, clean.length, 1);
    for (let j = 0; j < Math.min(said.length, clean.length); j++) {
      if (said[j] === clean[j]) match++;
    }

    let score;
    if (clean.includes(said) || said.includes(clean)) {
      score = Math.round(65 + (match / len) * 35);
    } else {
      score = Math.round((match / len) * 100);
    }

    // Give function words a generous floor — 
    // speech recognition often transcribes "the" as "da" or "uh" etc.
    if (FUNCTION_WORDS.has(clean)) {
      score = Math.max(score, 70);
    }

    return {
      word,
      score,
      errorType: score >= 60 ? 'None' : 'Mispronunciation',
      phonemes: [],
    };
  });
}

export function computeAccuracy(scores) {
  if (!scores.length) return 0;
  return Math.round(scores.reduce((a, b) => a + b.score, 0) / scores.length);
}

export function getWordColor(score) {
  if (score === null || score === undefined) return null;
  if (score >= 80) return { text:'var(--text-success)', bg:'rgba(5,150,105,0.10)',  border:'rgba(5,150,105,0.25)' };
  if (score >= 60) return { text:'var(--color-accent-dark)', bg:'rgba(217,119,6,0.10)', border:'rgba(217,119,6,0.25)' };
  return           { text:'var(--color-danger-dark)', bg:'rgba(220,38,38,0.10)',  border:'rgba(220,38,38,0.25)' };
}
