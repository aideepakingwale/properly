/**
 * @file        usePhonemePlayer.js
 * @description Plays real isolated phoneme sounds (Azure Neural TTS SSML) for any grapheme.
 *
 * Sound resolution order:
 *  1. In-memory session cache (instant blob URL)
 *  2. localStorage preload cache (loaded at app startup)
 *  3. POST /api/ai/phoneme  (on-demand from Azure — correct SSML synthesis)
 *  4. Web Speech API with a demonstration phrase (last resort)
 *
 * This ensures 'sh' always plays /ʃ/, 'ph' plays /f/, 'ng' plays /ŋ/, etc.
 * even on first load before the bulk preload has run.
 */

import { useRef, useCallback } from 'react';
import { getPhonemeUrl } from '../services/phonemeCache';
import { useSpeech } from './useSpeech';

// ── GRAPHEME → IPA MAP ────────────────────────────────────────────────────────
// Maps every grapheme tile string to the IPA key used in the Azure phoneme cache.
// Blends = array of component IPA keys (played in sequence with a short gap).
export const GRAPHEME_TO_IPA = {
  // ── Single consonants ───────────────────────────────────────────────────────
  'p':'p', 'b':'b', 't':'t', 'd':'d',
  'k':'k', 'c':'k', 'g':'g', 'f':'f',
  'v':'v', 's':'s', 'z':'z', 'h':'h',
  'm':'m', 'n':'n', 'l':'l', 'r':'r',
  'w':'w', 'y':'j', 'j':'dʒ', 'x':'ks',
  'q':'kw', 'qu':'kw',
  // ── Short vowels ────────────────────────────────────────────────────────────
  'a':'æ', 'e':'ɛ', 'i':'ɪ', 'o':'ɒ', 'u':'ʌ',
  // ── Phase 3 consonant digraphs ──────────────────────────────────────────────
  'sh':'ʃ', 'ch':'tʃ', 'th':'ð', 'ng':'ŋ', 'wh':'w', 'ph':'f',
  // ── Phase 3 vowel digraphs ──────────────────────────────────────────────────
  'ai':'eɪ', 'ay':'eɪ', 'ee':'iː', 'ea':'iː',
  'igh':'aɪ', 'ie':'aɪ', 'oa':'əʊ', 'ow':'əʊ', 'oe':'əʊ',
  'oo':'uː', 'ue':'juː', 'ew':'juː',
  'ar':'ɑː', 'or':'ɔː', 'ur':'ɜː', 'er':'ɜː', 'ir':'ɜː',
  'oi':'ɔɪ', 'oy':'ɔɪ', 'ou':'aʊ', 'au':'ɔː', 'aw':'ɔː',
  'ear':'ɪə', 'air':'eə', 'ure':'ʊə',
  // ── Doubled consonants ──────────────────────────────────────────────────────
  'ck':'k', 'ff':'f', 'll':'l', 'ss':'s', 'zz':'z',
  // ── Consonant blends — IPA keys played in sequence ──────────────────────────
  'bl':['b','l'], 'br':['b','r'], 'cl':['k','l'], 'cr':['k','r'],
  'dr':['d','r'], 'fl':['f','l'], 'fr':['f','r'], 'gl':['g','l'],
  'gr':['g','r'], 'pl':['p','l'], 'pr':['p','r'], 'sl':['s','l'],
  'sm':['s','m'], 'sn':['s','n'], 'sp':['s','p'], 'st':['s','t'],
  'sw':['s','w'], 'tr':['t','r'], 'tw':['t','w'], 'sk':['s','k'],
  'nd':['n','d'], 'mp':['m','p'], 'lt':['l','t'], 'lp':['l','p'],
  'nt':['n','t'], 'nk':['n','k'],
  'scr':['s','k','r'], 'str':['s','t','r'], 'spr':['s','p','r'],
  // ── Split digraphs ──────────────────────────────────────────────────────────
  'a_e':'eɪ', 'i_e':'aɪ', 'o_e':'əʊ', 'u_e':'juː', 'e_e':'iː',
  // ── Suffix fragments (used in phonics term breakdowns) ──────────────────────
  'ing':['ɪ','ŋ'],
  'eme':['iː','m'],
};

// ── FALLBACK PHRASES for Web Speech ──────────────────────────────────────────
// When all Azure paths fail, speak a phrase that demonstrates the sound in context.
const FALLBACK_PHRASES = {
  'ʃ':  'sh as in shop',   'tʃ': 'ch as in chip',  'ð':  'th as in the',
  'ŋ':  'ng as in ring',   'w':  'w as in wet',     'f':  'f as in fan',
  'æ':  'a as in cat',     'ɛ':  'e as in bed',     'ɪ':  'i as in sit',
  'ɒ':  'o as in hot',     'ʌ':  'u as in cup',     'ʊ':  'oo as in book',
  'ə':  'a as in about',   'eɪ': 'ai as in rain',   'iː': 'ee as in feet',
  'aɪ': 'igh as in night', 'əʊ': 'oa as in boat',   'uː': 'oo as in moon',
  'aʊ': 'ow as in cow',    'ɔɪ': 'oi as in coin',   'ɑː': 'ar as in car',
  'ɔː': 'or as in fork',   'ɜː': 'ur as in turn',   'juː':'ue as in blue',
  'ɪə': 'ear as in hear',  'eə': 'air as in chair', 'ʊə': 'ure as in pure',
  'dʒ': 'j as in jam',     'kw': 'qu as in quiz',   'ks': 'x as in fox',
};

// ── API helper ────────────────────────────────────────────────────────────────
function getApiBase() {
  const raw = (typeof __API_URL__ !== 'undefined' && __API_URL__) ? __API_URL__ : '/api';
  if (!raw || raw === '/api') return '/api';
  const withProto = raw.startsWith('http') ? raw : 'https://' + raw;
  return withProto.replace(/\/$/, '').replace(/\/api$/, '') + '/api';
}

// In-memory cache for on-demand fetched phonemes (IPA key → blob URL)
const onDemandCache = {};

/**
 * Fetch phoneme audio from /api/ai/phoneme, cache and return blob URL.
 * Returns null on failure.
 */
async function fetchPhonemeOnDemand(ipa, grapheme) {
  const cacheKey = `${ipa}:${grapheme}`;
  if (onDemandCache[cacheKey]) return onDemandCache[cacheKey];

  try {
    const token = localStorage.getItem('properly_token') || '';
    const res = await fetch(`${getApiBase()}/ai/phoneme`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ipa, grapheme, rate: 0.55 }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const buf  = await res.arrayBuffer();
    const blob = new Blob([buf], { type: 'audio/mpeg' });
    const url  = URL.createObjectURL(blob);
    onDemandCache[cacheKey] = url;
    return url;
  } catch {
    return null;
  }
}

/** Play a blob URL, resolves when done. */
function playBlobUrl(url) {
  return new Promise((resolve) => {
    const a = new Audio(url);
    a.onended = resolve;
    a.onerror = resolve;
    a.play().catch(resolve);
  });
}

// ── HOOK ─────────────────────────────────────────────────────────────────────
export function usePhonemePlayer() {
  const { speak } = useSpeech();
  const sessionCache = useRef({});

  /**
   * Resolve a single IPA key to a blob URL using all available sources.
   * Returns null only if every source fails.
   */
  const resolveIpa = useCallback(async (ipa, graphemeFallback) => {
    // 1. Session memory
    if (sessionCache.current[ipa]) return sessionCache.current[ipa];

    // 2. localStorage preload cache
    const preloaded = getPhonemeUrl(ipa);
    if (preloaded) {
      sessionCache.current[ipa] = preloaded;
      return preloaded;
    }

    // 3. On-demand fetch from /api/ai/phoneme (Azure SSML — correct isolation)
    const fetched = await fetchPhonemeOnDemand(ipa, graphemeFallback || ipa);
    if (fetched) {
      sessionCache.current[ipa] = fetched;
      return fetched;
    }

    return null;
  }, []);

  /**
   * Play the phoneme sound for a grapheme string.
   * e.g. playGrapheme('sh') → plays /ʃ/ (not "ess-aitch")
   *      playGrapheme('gr') → plays /g/ then /r/ (not "gee-ar")
   */
  const playGrapheme = useCallback(async (grapheme) => {
    const g = (grapheme || '').toLowerCase().trim();
    const entry = GRAPHEME_TO_IPA[g];

    if (!entry) {
      // Unknown grapheme — best effort: speak the example word
      speak(g, { rate: 0.7 });
      return;
    }

    // ── Array = blend or suffix sequence ──────────────────────────────────────
    if (Array.isArray(entry)) {
      for (const ipaKey of entry) {
        // Each ipaKey may be a direct IPA symbol OR a grapheme key
        let ipa = ipaKey;
        let gph = ipaKey;
        // If it's in GRAPHEME_TO_IPA as a simple string, resolve via that
        if (GRAPHEME_TO_IPA[ipaKey] && typeof GRAPHEME_TO_IPA[ipaKey] === 'string') {
          ipa = GRAPHEME_TO_IPA[ipaKey];
          gph = ipaKey;
        }
        const url = await resolveIpa(ipa, gph);
        if (url) {
          await playBlobUrl(url);
        } else {
          const phrase = FALLBACK_PHRASES[ipa];
          if (phrase) speak(phrase, { rate: 0.75 });
        }
        await new Promise(r => setTimeout(r, 100));
      }
      return;
    }

    // ── Single IPA key ────────────────────────────────────────────────────────
    const ipa = entry;
    const url = await resolveIpa(ipa, g);
    if (url) {
      await playBlobUrl(url);
      return;
    }

    // Last resort: speak a meaningful phrase (never the bare grapheme text)
    const phrase = FALLBACK_PHRASES[ipa];
    speak(phrase || `${g} sound`, { rate: 0.75 });
  }, [resolveIpa, speak]);

  /**
   * Play each phoneme in an array of grapheme strings in sequence.
   */
  const playWordByPhonemes = useCallback(async (sounds) => {
    for (const sound of sounds) {
      await playGrapheme(sound);
      await new Promise(r => setTimeout(r, 160));
    }
  }, [playGrapheme]);

  /**
   * Play a whole word naturally at slow rate.
   */
  const playWord = useCallback((word) => {
    speak(word, { rate: 0.78, lang: 'en-GB' });
  }, [speak]);

  return { playGrapheme, playWordByPhonemes, playWord };
}
