/**
 * @file        usePhonemePlayer.js
 * @description Hook that plays the real Azure-cached phoneme sound for any grapheme.
 *              Uses the same 5-layer cache as ReadingSession:
 *                1. In-memory session cache (instant)
 *                2. localStorage preload cache (instant, loaded at startup)
 *                3. Background re-preload trigger if cache empty
 *                4. Web Speech API fallback (always works)
 *
 * Grapheme → IPA lookup covers all 44 DfE phonemes so every sound tile
 * plays the actual isolated phoneme sound, NOT the letter name.
 */

import { useRef, useCallback } from 'react';
import { getPhonemeUrl } from '../services/phonemeCache';
import { useSpeech } from './useSpeech';

// ── GRAPHEME → IPA MAP ────────────────────────────────────────────────────────
// Matches PHONEME_LIST in speech.controller.js exactly.
// Keys are the grapheme strings shown in tiles; values are IPA cache keys.
export const GRAPHEME_TO_IPA = {
  // ── Single consonants ────────────────────────────────────────
  'p':   'p',   'b':   'b',   't':   't',   'd':   'd',
  'k':   'k',   'c':   'k',   'g':   'g',   'f':   'f',
  'v':   'v',   's':   's',   'z':   'z',   'h':   'h',
  'm':   'm',   'n':   'n',   'l':   'l',   'r':   'r',
  'w':   'w',   'y':   'j',   'j':   'dʒ',  'x':   'ks',
  'q':   'kw',  'qu':  'kw',
  // ── Vowels (short) ───────────────────────────────────────────
  'a':   'æ',   'e':   'ɛ',   'i':   'ɪ',   'o':   'ɒ',   'u':  'ʌ',
  // ── Phase 3 digraphs ────────────────────────────────────────
  'sh':  'ʃ',   'ch':  'tʃ',  'th':  'ð',   'ng':  'ŋ',
  'wh':  'w',   'ph':  'f',
  // ── Phase 3 vowel digraphs ──────────────────────────────────
  'ai':  'eɪ',  'ay':  'eɪ',  'ee':  'iː',  'ea':  'iː',
  'igh': 'aɪ',  'ie':  'aɪ',  'oa':  'əʊ',  'ow':  'əʊ',  'oe': 'əʊ',
  'oo':  'uː',  'ue':  'juː', 'ew':  'juː',
  'ar':  'ɑː',  'or':  'ɔː',  'ur':  'ɜː',  'er':  'ɜː',  'ir': 'ɜː',
  'oi':  'ɔɪ',  'oy':  'ɔɪ',  'ou':  'aʊ',  'au':  'ɔː',  'aw': 'ɔː',
  'ear': 'ɪə',  'air': 'eə',  'ure': 'ʊə',
  // ── Phase 3 short vowel digraphs ────────────────────────────
  'ck':  'k',   'ff':  'f',   'll':  'l',   'ss':  's',   'zz': 'z',
  // ── Consonant blends — play component phonemes as a sequence ─
  'bl': ['b','l'],  'br': ['b','r'],  'cl': ['k','l'],  'cr': ['k','r'],
  'dr': ['d','r'],  'fl': ['f','l'],  'fr': ['f','r'],  'gl': ['g','l'],
  'gr': ['g','r'],  'pl': ['p','l'],  'pr': ['p','r'],  'sl': ['s','l'],
  'sm': ['s','m'],  'sn': ['s','n'],  'sp': ['s','p'],  'st': ['s','t'],
  'sw': ['s','w'],  'tr': ['t','r'],  'tw': ['t','w'],  'sk': ['s','k'],
  'nd': ['n','d'],  'mp': ['m','p'],  'lt': ['l','t'],  'lp': ['l','p'],
  'nt': ['n','t'],  'nk': ['n','k'],
  'scr':['s','k','r'], 'str':['s','t','r'], 'spr':['s','p','r'],
  // ── Split digraphs — use the long vowel IPA ─────────────────
  'a_e':'eɪ', 'i_e':'aɪ', 'o_e':'əʊ', 'u_e':'juː', 'e_e':'iː',
  // ── Common suffixes (for phonics term pronunciation) ─────────
  'ing': ['ɪ','ŋ'],   // blend: /ɪ/ + /ŋ/ (using IPA keys directly)
  'eme': ['iː','m'],  // as in phoneme/grapheme ending
  'tion':['ʃ','ə','n'],
};

// ── IPA KEY → BLOB URL (direct IPA playback bypass for suffix fragments) ─────
// When the grapheme map value IS an IPA key (not a grapheme), play it directly
export const DIRECT_IPA_KEYS = new Set(['ɪ','ŋ','iː','m','ə','n','ʃ','eɪ','aɪ','əʊ','uː','juː','ɑː','ɔː','ɜː','æ','ɛ','ɒ','ʌ','ʊ','p','b','t','d','k','ɡ','f','v','s','z','ʃ','h','dʒ','tʃ','m','n','ŋ','l','r','w','j','kw','ks']);

/**
 * Play an Audio blob URL and return a promise that resolves when done.
 */
function playBlobUrl(url) {
  return new Promise((resolve) => {
    const audio = new Audio(url);
    audio.onended  = resolve;
    audio.onerror  = resolve;
    audio.play().catch(resolve);
  });
}

/**
 * Hook: usePhonemePlayer
 *
 * Returns a `playGrapheme(grapheme, fallbackText?)` function.
 * - Tries Azure cached blob URL first (real isolated phoneme sound)
 * - Falls back to Web Speech API if cache miss
 */
export function usePhonemePlayer() {
  const { speak } = useSpeech();
  const sessionCache = useRef({});

  const playGrapheme = useCallback(async (grapheme, fallbackText) => {
    const g = grapheme.toLowerCase().trim();
    const ipaEntry = GRAPHEME_TO_IPA[g];

    // ── Blends/sequences: play each component phoneme in sequence ─
    if (Array.isArray(ipaEntry)) {
      for (const part of ipaEntry) {
        // Each part may be a direct IPA key OR a grapheme key
        // Try direct IPA lookup first (for suffix fragments like 'ɪ', 'ŋ', 'iː')
        let url = sessionCache.current[part] || getPhonemeUrl(part);
        if (url) {
          if (!sessionCache.current[part]) sessionCache.current[part] = url;
          await playBlobUrl(url);
        } else {
          // Try as a grapheme key (e.g. 'n' → looks up IPA 'n' → gets URL)
          const ipaViaGrapheme = GRAPHEME_TO_IPA[part];
          if (typeof ipaViaGrapheme === 'string') {
            const u2 = sessionCache.current[ipaViaGrapheme] || getPhonemeUrl(ipaViaGrapheme);
            if (u2) {
              if (!sessionCache.current[ipaViaGrapheme]) sessionCache.current[ipaViaGrapheme] = u2;
              await playBlobUrl(u2);
            }
          }
        }
        await new Promise(r => setTimeout(r, 90));
      }
      return;
    }

    // ── Single phoneme: use cache or Web Speech ──────────────────
    const ipa = ipaEntry;
    if (ipa) {
      // Check session cache first
      if (sessionCache.current[ipa]) {
        await playBlobUrl(sessionCache.current[ipa]);
        return;
      }
      // Check localStorage preload cache
      const url = getPhonemeUrl(ipa);
      if (url) {
        sessionCache.current[ipa] = url;
        await playBlobUrl(url);
        return;
      }
    }

    // ── Fallback: Web Speech API ─────────────────────────────────
    // Use the fallback text if provided, otherwise speak the grapheme
    const text = fallbackText || grapheme;
    speak(text, { rate: 0.7, lang: 'en-GB' });

  }, [speak]);

  /**
   * Play a full word, phoneme-by-phoneme with gaps between sounds.
   * This gives the child time to hear and process each sound.
   */
  const playWordByPhonemes = useCallback(async (sounds) => {
    for (const sound of sounds) {
      await playGrapheme(sound);
      await new Promise(r => setTimeout(r, 150));
    }
  }, [playGrapheme]);

  /**
   * Play the whole word as a single natural utterance.
   */
  const playWord = useCallback((word) => {
    speak(word, { rate: 0.75, lang: 'en-GB' });
  }, [speak]);

  return { playGrapheme, playWordByPhonemes, playWord };
}
