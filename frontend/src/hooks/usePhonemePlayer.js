/**
 * @file        usePhonemePlayer.js
 * @description Plays real isolated phoneme sounds for any grapheme.
 *
 * Sound resolution:
 *  1. localStorage preload cache (44 phonemes fetched at login)
 *  2. In-memory session cache (blob URLs built from #1)
 *  3. POST /api/ai/phoneme on-demand (Azure SSML — for cache misses)
 *  4. Web Speech with a context phrase as last resort
 *
 * isCacheReady() → true once all 44 phonemes are available.
 * triggerPreload(token) → call this when Phonics Guide opens to ensure cache is warm.
 */

import { useRef, useCallback } from 'react';
import { getPhonemeUrl, isCacheLoaded, preloadPhonemes } from '../services/phonemeCache';
import { useSpeech } from './useSpeech';

// ── GRAPHEME → IPA MAP ────────────────────────────────────────────────────────
export const GRAPHEME_TO_IPA = {
  // Consonants
  'p':'p','b':'b','t':'t','d':'d','k':'k','c':'k','g':'g','f':'f',
  'v':'v','s':'s','z':'z','h':'h','m':'m','n':'n','l':'l','r':'r',
  'w':'w','y':'j','j':'dʒ','x':'ks','q':'kw','qu':'kw',
  // Short vowels
  'a':'æ','e':'ɛ','i':'ɪ','o':'ɒ','u':'ʌ',
  // Consonant digraphs (single sounds — must be cached as IPA)
  'sh':'ʃ','ch':'tʃ','th':'ð','ng':'ŋ','wh':'w','ph':'f',
  // Doubled consonants
  'ck':'k','ff':'f','ll':'l','ss':'s','zz':'z',
  // Vowel digraphs
  'ai':'eɪ','ay':'eɪ','ee':'iː','ea':'iː','igh':'aɪ','ie':'aɪ',
  'oa':'əʊ','ow':'əʊ','oe':'əʊ','oo':'uː','ue':'juː','ew':'juː',
  'ar':'ɑː','or':'ɔː','ur':'ɜː','er':'ɜː','ir':'ɜː',
  'oi':'ɔɪ','oy':'ɔɪ','ou':'aʊ','au':'ɔː','aw':'ɔː',
  'ear':'ɪə','air':'eə','ure':'ʊə',
  // Consonant blends (array = each component played separately in sequence)
  'bl':['b','l'],'br':['b','r'],'cl':['k','l'],'cr':['k','r'],
  'dr':['d','r'],'fl':['f','l'],'fr':['f','r'],'gl':['g','l'],
  'gr':['g','r'],'pl':['p','l'],'pr':['p','r'],'sl':['s','l'],
  'sm':['s','m'],'sn':['s','n'],'sp':['s','p'],'st':['s','t'],
  'sw':['s','w'],'tr':['t','r'],'tw':['t','w'],'sk':['s','k'],
  'nd':['n','d'],'mp':['m','p'],'lt':['l','t'],'nt':['n','t'],'nk':['n','k'],
  'scr':['s','k','r'],'str':['s','t','r'],'spr':['s','p','r'],
  // Split digraphs
  'a_e':'eɪ','i_e':'aɪ','o_e':'əʊ','u_e':'juː','e_e':'iː',
  // Suffix sequences (each element is an IPA key directly)
  'ing':['ɪ','ŋ'],
  'eme':['iː','m'],
};

// ── CONTEXT PHRASES for Web Speech fallback ───────────────────────────────────
// Uses words that place the phoneme in a clear, audible context.
// Never speaks the bare grapheme text (would say letter names, not sounds).
const FALLBACK_PHRASES = {
  'ʃ':'shh like in shop',    'tʃ':'ch like in chip',   'ð':'th like in the',
  'ŋ':'ng like in ring',     'f':'f like in fan',       'k':'k like in cat',
  'g':'g like in got',       's':'s like in sun',       'z':'z like in zip',
  'p':'p like in pin',       'b':'b like in bat',       't':'t like in tap',
  'd':'d like in dog',       'm':'m like in map',       'n':'n like in net',
  'l':'l like in lip',       'r':'r like in red',       'w':'w like in wet',
  'j':'y like in yes',       'h':'h like in hat',       'v':'v like in van',
  'dʒ':'j like in jam',      'kw':'qu like in quiz',    'ks':'x like in fox',
  'æ':'a like in cat',       'ɛ':'e like in bed',       'ɪ':'i like in sit',
  'ɒ':'o like in hot',       'ʌ':'u like in cup',       'ʊ':'oo like in book',
  'ə':'a like in about',
  'eɪ':'ay like in rain',    'iː':'ee like in feet',    'aɪ':'ie like in night',
  'əʊ':'oa like in boat',    'uː':'oo like in moon',    'aʊ':'ow like in cow',
  'ɔɪ':'oi like in coin',    'ɑː':'ar like in car',     'ɔː':'or like in fork',
  'ɜː':'ur like in turn',    'juː':'ue like in blue',   'ɪə':'ear like in hear',
  'eə':'air like in chair',  'ʊə':'ure like in pure',
};

// ── API ───────────────────────────────────────────────────────────────────────
function apiBase() {
  const raw = (typeof __API_URL__ !== 'undefined' && __API_URL__) ? __API_URL__ : '/api';
  if (!raw || raw === '/api') return '/api';
  const p = raw.startsWith('http') ? raw : 'https://' + raw;
  return p.replace(/\/$/, '').replace(/\/api$/, '') + '/api';
}

// Module-level cache: IPA → blob URL (survives re-renders)
const _blobCache = {};

/** Fetch one phoneme from the backend SSML synthesis endpoint. */
async function fetchIpa(ipa, grapheme) {
  if (_blobCache[ipa]) return _blobCache[ipa];
  const token = localStorage.getItem('properly_token') || '';
  try {
    const res = await fetch(`${apiBase()}/ai/phoneme`, {
      method:'POST',
      headers:{ 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) },
      body: JSON.stringify({ ipa, grapheme: grapheme || ipa, rate: 0.52 }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('audio')) return null;
    const blob = new Blob([await res.arrayBuffer()], { type:'audio/mpeg' });
    const url  = URL.createObjectURL(blob);
    _blobCache[ipa] = url;
    return url;
  } catch { return null; }
}

/** Resolve IPA → blob URL. Tries preload cache first, then on-demand. */
async function resolveIpa(ipa, graphemeFallback) {
  if (_blobCache[ipa]) return _blobCache[ipa];
  // localStorage preload cache (44 phonemes from app startup)
  const preloaded = getPhonemeUrl(ipa);
  if (preloaded) { _blobCache[ipa] = preloaded; return preloaded; }
  // On-demand: call Azure SSML synthesis directly
  return fetchIpa(ipa, graphemeFallback);
}

function playUrl(url) {
  return new Promise(resolve => {
    const a = new Audio(url);
    a.onended = resolve; a.onerror = resolve;
    a.play().catch(resolve);
  });
}

// ── TRIGGER PRELOAD (call when Phonics Guide opens) ───────────────────────────
export async function triggerPhonicsPreload() {
  if (isCacheLoaded()) return;
  const token = localStorage.getItem('properly_token') || '';
  try { await preloadPhonemes(token); } catch {}
}

// ── HOOK ─────────────────────────────────────────────────────────────────────
export function usePhonemePlayer() {
  const { speak } = useSpeech();

  const playGrapheme = useCallback(async (grapheme) => {
    const g = (grapheme || '').toLowerCase().trim();
    const entry = GRAPHEME_TO_IPA[g];

    if (!entry) {
      speak(g, { rate:0.7 }); return;
    }

    // ── Blend / suffix sequence ────────────────────────────────────────────
    if (Array.isArray(entry)) {
      for (const part of entry) {
        // part is either a direct IPA symbol ('ɪ','ŋ') or a grapheme key ('b','l')
        const ipa = GRAPHEME_TO_IPA[part] ?? part; // resolve grapheme → IPA if needed
        if (typeof ipa !== 'string') { continue; } // skip nested arrays

        const url = await resolveIpa(ipa, part);
        if (url) {
          await playUrl(url);
        } else {
          speak(FALLBACK_PHRASES[ipa] || part, { rate:0.78 });
        }
        await new Promise(r => setTimeout(r, 110));
      }
      return;
    }

    // ── Single phoneme (digraphs, vowels, consonants) ──────────────────────
    const ipa = entry;
    const url = await resolveIpa(ipa, g);
    if (url) { await playUrl(url); return; }
    speak(FALLBACK_PHRASES[ipa] || `${g} sound`, { rate:0.78 });

  }, [speak]);

  const playWordByPhonemes = useCallback(async (sounds) => {
    for (const s of sounds) { await playGrapheme(s); await new Promise(r => setTimeout(r,170)); }
  }, [playGrapheme]);

  const playWord = useCallback((word) => {
    speak(word, { rate:0.78, lang:'en-GB' });
  }, [speak]);

  return { playGrapheme, playWordByPhonemes, playWord };
}
