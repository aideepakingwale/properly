/**
 * @file        usePhonemePlayer.js
 * @description Plays real Azure SSML phoneme sounds for any grapheme.
 *              Imports all grapheme→IPA data from phonicsEngine.js (single source of truth).
 *
 * Resolution order for each sound:
 *   1. Module-level blob URL cache (instant — survives re-renders)
 *   2. localStorage preload cache (44 phonemes loaded at login)
 *   3. POST /api/ai/phoneme — on-demand Azure SSML synthesis
 *   4. Web Speech API with a context phrase (never speaks bare letter names)
 */

import { useCallback } from 'react';
import { PHONEME_MAP, getIpa, getBlendComponents } from '../utils/phonicsEngine';
import { getPhonemeUrl, isCacheLoaded, preloadPhonemes } from '../services/phonemeCache';
import { useSpeech } from './useSpeech';

// ── CONTEXT PHRASES ────────────────────────────────────────────────────────────
// When Azure is unavailable, speak a phrase that demonstrates the sound in context.
// NEVER speak the bare grapheme text — that produces letter names, not phonemes.
const CONTEXT_PHRASES = {
  'ʃ':'shh as in shop',   'tʃ':'ch as in chip',    'ð':'th as in the',
  'ŋ':'ng as in ring',    'f':'f as in fan',         'k':'k as in cat',
  'g':'g as in got',      's':'sss as in sun',       'z':'zzz as in zip',
  'p':'p as in pin',      'b':'b as in bat',         't':'t as in tap',
  'd':'d as in dog',      'm':'mmm as in map',       'n':'n as in net',
  'l':'l as in lip',      'r':'r as in red',         'w':'w as in wet',
  'j':'y as in yes',      'h':'h as in hat',         'v':'v as in van',
  'dʒ':'j as in jam',     'kw':'qu as in quiz',      'ks':'x as in fox',
  'æ':'a as in cat',      'ɛ':'e as in bed',         'ɪ':'i as in sit',
  'ɒ':'o as in hot',      'ʌ':'u as in cup',         'ʊ':'oo as in book',
  'ə':'a as in about',
  'eɪ':'ay as in rain',   'iː':'ee as in feet',      'aɪ':'ie as in night',
  'əʊ':'oa as in boat',   'uː':'oo as in moon',      'aʊ':'ow as in cow',
  'ɔɪ':'oi as in coin',   'ɑː':'ar as in car',       'ɔː':'or as in fork',
  'ɜː':'ur as in turn',   'juː':'ue as in blue',     'ɪə':'ear as in hear',
  'eə':'air as in chair', 'ʊə':'ure as in pure',
  // Combined suffix sounds
  'ɪŋ':'ing as in ring',  'iːm':'eem as in team',
  'ʃən':'shun as in nation','tʃər':'cher as in teacher',
  'ŋk':'nk as in bank',   'skr':'scr as in scrap',
  'str':'str as in strap', 'spr':'spr as in spring',
};

// ── API ────────────────────────────────────────────────────────────────────────
function apiBase() {
  const raw = (typeof __API_URL__ !== 'undefined' && __API_URL__) ? __API_URL__ : '/api';
  if (!raw || raw === '/api') return '/api';
  const p = raw.startsWith('http') ? raw : 'https://' + raw;
  return p.replace(/\/$/, '').replace(/\/api$/, '') + '/api';
}

// Module-level cache: ipa:grapheme → blob URL
const _cache = {};

async function fetchPhoneme(ipa, grapheme) {
  const key = `${ipa}:${grapheme}`;
  if (_cache[key]) return _cache[key];
  const token = localStorage.getItem('properly_token') || '';
  try {
    const res = await fetch(`${apiBase()}/ai/phoneme`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {}) },
      body: JSON.stringify({ ipa, grapheme, rate: 0.52 }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok || !res.headers.get('content-type')?.includes('audio')) return null;
    const blob = new Blob([await res.arrayBuffer()], { type:'audio/mpeg' });
    const url  = URL.createObjectURL(blob);
    _cache[key] = url;
    return url;
  } catch { return null; }
}

async function resolveIpa(ipa, grapheme) {
  const key = `${ipa}:${grapheme}`;
  if (_cache[key]) return _cache[key];
  // Check preload cache (by IPA key only)
  const preloaded = getPhonemeUrl(ipa);
  if (preloaded) { _cache[key] = preloaded; return preloaded; }
  // On-demand fetch
  return fetchPhoneme(ipa, grapheme);
}

function playUrl(url) {
  return new Promise(r => { const a = new Audio(url); a.onended=r; a.onerror=r; a.play().catch(r); });
}

/** Trigger phoneme preload if cache isn't warm yet. */
export async function triggerPhonicsPreload() {
  if (isCacheLoaded()) return;
  try { await preloadPhonemes(localStorage.getItem('properly_token') || ''); } catch {}
}

// ── HOOK ──────────────────────────────────────────────────────────────────────
export function usePhonemePlayer() {
  const { speak } = useSpeech();

  /**
   * Play the phoneme sound for a grapheme string.
   * Looks up phonicsEngine.js for ipa and blendOf data.
   *
   * - Single phonemes (sh, ng, ai, ee, igh...): fetched as one Azure SSML unit
   * - Blends (bl, gr, fl, str...): each component played in quick sequence (55ms gap)
   * - Combined suffixes (ing, tion, ture...): single SSML fetch → natural sound
   */
  const playGrapheme = useCallback(async (grapheme) => {
    const g     = (grapheme || '').toLowerCase().trim();
    const entry = PHONEME_MAP[g];

    if (!entry) {
      // Not in map — speak a generic description
      speak(`${g} sound`, { rate: 0.75 });
      return;
    }

    const { ipa, blendOf, type } = entry;

    // ── Blends: play each component phoneme in quick sequence ──────────────
    if (type === 'blend' && blendOf && blendOf.length > 0) {
      for (const componentGrapheme of blendOf) {
        const compIpa = getIpa(componentGrapheme);
        if (compIpa) {
          const url = await resolveIpa(compIpa, componentGrapheme);
          if (url) await playUrl(url);
          else speak(CONTEXT_PHRASES[compIpa] || componentGrapheme + ' sound', { rate: 0.78 });
        }
        await new Promise(r => setTimeout(r, 55)); // 55ms gap — quick enough to sound connected
      }
      return;
    }

    // ── Silent letter (split digraph 'e') — no sound ───────────────────────
    if (type === 'split-e' || !ipa) return;

    // ── Single phoneme (digraphs, vowels, consonants, suffixes, trigraphs) ──
    // Combined IPA like 'ɪŋ', 'ʃən', 'eɪ' → fetched as ONE Azure SSML unit
    const url = await resolveIpa(ipa, g);
    if (url) { await playUrl(url); return; }

    // Last resort — context phrase, never bare letter text
    speak(CONTEXT_PHRASES[ipa] || `${entry.example || g} sound`, { rate: 0.78 });
  }, [speak]);

  /**
   * Play phonemes for an array of grapheme strings in sequence.
   */
  const playWordByPhonemes = useCallback(async (graphemes) => {
    for (const g of graphemes) {
      await playGrapheme(g);
      await new Promise(r => setTimeout(r, 180));
    }
  }, [playGrapheme]);

  /**
   * Play a whole word naturally via Web Speech (or use useAzureTTS for better quality).
   */
  const playWord = useCallback((word) => {
    speak(word, { rate: 0.78, lang: 'en-GB' });
  }, [speak]);

  return { playGrapheme, playWordByPhonemes, playWord };
}
