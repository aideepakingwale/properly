/**
 * @file        ai.service.js
 * @description AI inference service — coaching tips via Gemini Flash → Groq Llama → static cache fallback chain; Neural TTS via Azure → browser fallback
 * @module      AI Service
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - Tip pipeline: (1) static phoneme cache, (2) Gemini Flash, (3) Groq/Llama, (4) rule-based fallback
 *   - Azure TTS session flag (_azureTtsFailing) suppresses repeated 401 log noise
 *   - All AI calls are fire-and-forget from the client perspective — errors never block the reading session
 */

import { synthesizeSpeech, azureAvailable } from './azure-speech.service.js';

// ── STATIC PHONEME COACHING CACHE ───────────────────────────
// Fires instantly before any API call — covers the most common errors
const PHONEME_TIPS = {
  'b':   { tip: 'Press your lips, then pop them apart — "buh"!',         emoji: '🐝' },
  'd':   { tip: 'Tongue touches the roof, then drops — "duh"!',          emoji: '🥁' },
  'p':   { tip: 'Lips together, then a puff of air — "puh"!',            emoji: '💨' },
  'f':   { tip: 'Top teeth on bottom lip, then blow — "fff"!',           emoji: '🦷' },
  'v':   { tip: 'Like "f" but add your humming voice — "vvv"!',          emoji: '🎻' },
  'th':  { tip: 'Peek your tongue between your teeth and blow — "th"!',  emoji: '👅' },
  'sh':  { tip: 'Shhh! Push your lips forward like a secret!',           emoji: '🤫' },
  'ch':  { tip: 'Choo-choo train sounds — "ch-ch-ch"!',                 emoji: '🚂' },
  'wh':  { tip: 'Make your lips into a round O, then blow — "wh"!',     emoji: '💨' },
  'ph':  { tip: '"Ph" sounds just like "f" — phone starts with f!',     emoji: '📞' },
  'ng':  { tip: 'Say "n" then hum at the back of your mouth — "ng"!',   emoji: '🎵' },
  'nk':  { tip: 'Say "ng" then add a "k" — "ngk"!',                     emoji: '⚓' },
  'ai':  { tip: 'Open your mouth wide and say "ay" — like "say"!',      emoji: '🌈' },
  'ay':  { tip: '"Ay" — rhymes with "day"!',                             emoji: '☀️' },
  'ee':  { tip: 'Smile wide and hold "eeeee"!',                          emoji: '😁' },
  'ea':  { tip: '"Ea" sounds like "ee" — easy peasy!',                   emoji: '🍃' },
  'oa':  { tip: 'Round your lips and say "oh" — like a surprised "oh"!', emoji: '⛵' },
  'oo':  { tip: 'Make your lips into a tight little circle — "oooo"!',   emoji: '⭕' },
  'ow':  { tip: '"Ow" can say "oh" — like snow!',                        emoji: '❄️' },
  'oi':  { tip: '"Oi!" — like calling out to a friend!',                 emoji: '📣' },
  'ou':  { tip: '"Ou" makes an "ow" sound — think "ouch"!',             emoji: '🤕' },
  'igh': { tip: '"Igh" sounds like "eye" — try winking as you say it!',  emoji: '👁️' },
  'ue':  { tip: '"Ue" says "you" — like "blue"!',                        emoji: '💙' },
  'ew':  { tip: '"Ew" sounds like "you" or "oo"!',                       emoji: '🌊' },
  'ie':  { tip: '"Ie" can say "eye" or "ee"!',                           emoji: '🥧' },
  'un':  { tip: '"Un" means not — like "unhappy"!',                      emoji: '🔄' },
  're':  { tip: '"Re" means again — like "redo"!',                       emoji: '🔁' },
  'dis': { tip: '"Dis" means not — like "dislike"!',                     emoji: '❌' },
  'ful': { tip: '"Ful" means full of — like "careful"!',                 emoji: '💝' },
  'tion':{ tip: '"Tion" sounds like "shun"!',                            emoji: '🔊' },
  'ing': { tip: '"Ing" means doing — like "running"!',                   emoji: '🏃' },
};

function findStaticTip(word) {
  const lw = word.toLowerCase().replace(/[^a-z]/g, '');
  const sorted = Object.keys(PHONEME_TIPS).sort((a, b) => b.length - a.length);
  const key = sorted.find(k => lw.includes(k));
  if (!key) return null;
  const { tip, emoji } = PHONEME_TIPS[key];
  return `The "${key}" in "${word}" — ${tip} ${emoji}`;
}

// ── GOOGLE GEMINI FLASH (PRIMARY FREE AI) ────────────────────
// Free: 15 req/min · 1,500 req/day · no billing needed
// Key:  https://aistudio.google.com/app/apikey
async function askGemini(word, sentence, phase) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text:
            `You are Mrs. Owl, a warm UK phonics tutor for children aged 4-7 (Phase ${phase || 2}).
Give ONE short playful phonics tip (max 12 words) to help a child say "${word}" from: "${sentence}".
Use a rhyme, body action, or animal sound. End with one emoji.
Reply ONLY with the tip — nothing else.`
          }] }],
          generationConfig: { maxOutputTokens: 60, temperature: 0.75 },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_LOW_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_LOW_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_LOW_AND_ABOVE' },
          ],
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch { return null; }
}

// ── GROQ — LLAMA 3.1 8B (SECONDARY FREE AI) ─────────────────
// Free: 30 req/min · 14,400 req/day · no billing needed
// Key:  https://console.groq.com/keys  (sign up, instant key)
// Model: llama-3.1-8b-instant — fast, high quality, free
async function askGroq(word, sentence, phase) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 60,
        temperature: 0.75,
        messages: [
          {
            role: 'system',
            content: `You are Mrs. Owl, a warm UK phonics tutor for children aged 4-7 at Phase ${phase || 2}. Give ONE short playful phonics tip (max 12 words) using a rhyme, body action, or animal sound. End with one emoji. Reply ONLY with the tip.`,
          },
          {
            role: 'user',
            content: `Child struggled with "${word}" in: "${sentence}". Give a phonics tip.`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch { return null; }
}

// ── RULE-BASED FALLBACK ──────────────────────────────────────
const FALLBACKS = [
  (w) => `Clap out each part of "${w}" — how many claps? 👏`,
  (w) => `Say "${w}" like a sleepy snail — nice and slow! 🐌`,
  (w) => `Break "${w}" into little sounds, then blend them! 🎯`,
  (w) => `Listen again, then copy — you can do it! 🌟`,
];

// ── EXPORTED CONTROLLERS ─────────────────────────────────────

/**
 * POST /api/ai/feedback
 * Returns a phonics coaching tip for a word the child struggled with.
 *
 * Pipeline (in order):
 *   1. Gemini Flash   — primary AI, contextual tip
 *   2. Groq/Llama     — secondary AI
 *   3. Static cache   — phoneme lookup (last resort, uses worstPhoneme if supplied by Azure)
 *   4. Rule-based     — always works
 *
 * NOTE: Static cache is intentionally LAST so it only fires when AI is unavailable.
 * Putting it first caused the same cached tip ("sh in Devansh") to appear for every
 * word containing that phoneme, regardless of what the child actually struggled with.
 *
 * @param {string} word         - The word the child scored lowest on
 * @param {string} sentence     - Full sentence context
 * @param {number} phase        - Child's phonics phase (2-6)
 * @param {string} worstPhoneme - Specific phoneme Azure identified as worst (optional)
 *                                When supplied, static cache targets this phoneme exactly
 *                                instead of guessing from the word spelling
 */
export const getFeedback = async (req, res) => {
  const { word, sentence, phase, worstPhoneme } = req.body;
  if (!word || !sentence) {
    return res.status(400).json({ success: false, message: 'word and sentence are required' });
  }

  // 1. Google Gemini Flash — primary free AI (contextual, personalised)
  const geminiTip = await askGemini(word, sentence, phase);
  if (geminiTip) {
    return res.json({ success: true, data: { tip: geminiTip, source: 'ai', provider: 'gemini' } });
  }

  // 2. Groq (Llama 3.1) — secondary free AI
  const groqTip = await askGroq(word, sentence, phase);
  if (groqTip) {
    return res.json({ success: true, data: { tip: groqTip, source: 'ai', provider: 'groq' } });
  }

  // 3. Static phoneme cache — uses Azure's identified phoneme if available,
  //    otherwise falls back to scanning the word spelling (last resort only)
  const lookupWord  = worstPhoneme || word;
  const staticTip   = findStaticTip(lookupWord);
  if (staticTip) {
    // If we used a specific phoneme, format tip differently so it makes sense
    const tip = worstPhoneme
      ? staticTip.replace(`The "${lookupWord}" in "${lookupWord}"`, `The "${worstPhoneme}" sound`)
      : staticTip;
    return res.json({ success: true, data: { tip, source: 'cache', provider: 'static' } });
  }

  // 4. Rule-based fallback — always works
  const tip = FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)](word);
  return res.json({ success: true, data: { tip, source: 'fallback', provider: 'rules' } });
};

/**
 * POST /api/ai/tts
 * Azure Neural TTS → browser SpeechSynthesis fallback.
 */
export const getTTS = async (req, res) => {
  const { text } = req.body;
  if (!text || text.length > 500) {
    return res.status(400).json({ success: false, message: 'text required (max 500 chars)' });
  }
  if (!azureAvailable()) {
    return res.json({ success: true, data: { useBrowserTTS: true, text } });
  }
  try {
    const audioBuffer = await synthesizeSpeech(text, 'en-GB-SoniaNeural');
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Length', audioBuffer.length);
    res.set('Cache-Control', 'private, max-age=86400');
    return res.send(audioBuffer);
  } catch (e) {
    console.error('Azure TTS error:', e.message);
    return res.json({ success: true, data: { useBrowserTTS: true, text } });
  }
};
