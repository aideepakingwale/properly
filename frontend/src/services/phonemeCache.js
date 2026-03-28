/**
 * @file        phonemeCache.js
 * @description Phoneme audio preloader — fetches all 44 IPA phonemes from Azure TTS
 *              once at app startup, stores as base64 MP3 in localStorage.
 *              During reading sessions every phoneme plays instantly, zero API calls.
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * Storage key: properly_phonemes_v1
 * Format:      { generatedAt: ISO, phonemes: { 'k': '<base64 mp3>', ... } }
 * TTL:         30 days (phonemes never change — re-fetch only on version bump)
 */

const CACHE_KEY     = 'properly_phonemes_v1';
const CACHE_TTL_MS  = 30 * 24 * 60 * 60 * 1000;  // 30 days

// In-memory blob URL map for instant playback (avoids base64 decode on every play)
const blobUrlMap = {};

/** Get the API base URL */
function getApiBase() {
  const raw = (typeof __API_URL__ !== 'undefined' && __API_URL__) ? __API_URL__ : '/api';
  if (!raw || raw === '/api') return '/api';
  const withProto = raw.startsWith('http') ? raw : 'https://' + raw;
  const clean     = withProto.replace(/\/$/, '');
  return clean.endsWith('/api') ? clean : clean + '/api';
}

/** Load cached phonemes from localStorage */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data?.generatedAt || !data?.phonemes) return null;
    // Check TTL
    if (Date.now() - new Date(data.generatedAt).getTime() > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/** Save phonemes to localStorage */
function saveToStorage(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    // localStorage full — clear old data and retry
    console.warn('[PhonemeCache] Storage full, clearing:', e.message);
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      return true;
    } catch { return false; }
  }
}

/** Convert base64 MP3 → blob URL and cache in memory */
function base64ToBlobUrl(base64) {
  const bytes  = atob(base64);
  const arr    = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  const blob   = new Blob([arr], { type: 'audio/mpeg' });
  return URL.createObjectURL(blob);
}

/** Hydrate in-memory blob URLs from stored base64 */
function hydrateMemory(phonemes) {
  for (const [ipa, b64] of Object.entries(phonemes)) {
    if (!blobUrlMap[ipa]) {
      try { blobUrlMap[ipa] = base64ToBlobUrl(b64); } catch {}
    }
  }
}

/**
 * Get a blob URL for a phoneme — instant if cached, null if not available.
 * @param {string} ipa  - IPA symbol without slashes e.g. 'k', 'tʃ', 'æ'
 */
export function getPhonemeUrl(ipa) {
  return blobUrlMap[ipa] || null;
}

/** True if the phoneme cache has been loaded */
export function isCacheLoaded() {
  return Object.keys(blobUrlMap).length > 0;
}

/** How many phonemes are cached */
export function getCacheStats() {
  const stored  = loadFromStorage();
  const inMemory = Object.keys(blobUrlMap).length;
  return {
    inMemory,
    stored:       stored ? Object.keys(stored.phonemes || {}).length : 0,
    generatedAt:  stored?.generatedAt || null,
    total:        47,  // total unique IPA phonemes in Letters & Sounds
  };
}

/** Clear the cache (force re-fetch on next preload) */
export function clearPhonemeCache() {
  localStorage.removeItem(CACHE_KEY);
  Object.keys(blobUrlMap).forEach(k => {
    URL.revokeObjectURL(blobUrlMap[k]);
    delete blobUrlMap[k];
  });
}

/**
 * Preload all phonemes — call once at app startup.
 * - Checks localStorage first (instant on repeat visits)
 * - If not cached or expired, fetches from backend (one API call, ~3-5 seconds)
 * - Stores result in localStorage for 30 days
 *
 * @param {string} token  - JWT auth token
 * @param {function} onProgress  - Called with { loaded, total, ipa }
 * @returns {{ loaded, total, fromCache }}
 */
export async function preloadPhonemes(token, onProgress) {
  // 1. Check localStorage cache
  const stored = loadFromStorage();
  if (stored?.phonemes && Object.keys(stored.phonemes).length > 30) {
    hydrateMemory(stored.phonemes);
    const count = Object.keys(blobUrlMap).length;
    console.log(`[PhonemeCache] Loaded ${count} phonemes from localStorage (${stored.generatedAt})`);
    onProgress?.({ loaded: count, total: count, fromCache: true });
    return { loaded: count, total: count, fromCache: true };
  }

  // 2. Fetch from backend
  console.log('[PhonemeCache] Fetching from Azure TTS…');
  try {
    const apiBase = getApiBase();
    const res = await fetch(`${apiBase}/ai/phonemes/preload`, {
      method:  'GET',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });

    if (!res.ok) {
      console.warn('[PhonemeCache] Preload failed:', res.status, await res.text().catch(()=>''));
      return { loaded: 0, total: 47, fromCache: false, error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    if (!data.success || !data.data?.phonemes) {
      return { loaded: 0, total: 47, fromCache: false, error: data.message || 'No phoneme data' };
    }

    const { phonemes, count, generatedAt } = data.data;

    // 3. Save to localStorage
    saveToStorage({ generatedAt, phonemes });

    // 4. Hydrate in-memory blob URLs
    hydrateMemory(phonemes);

    const loaded = Object.keys(blobUrlMap).length;
    console.log(`[PhonemeCache] Preloaded ${loaded} phonemes from Azure TTS`);
    onProgress?.({ loaded, total: 47, fromCache: false });
    return { loaded, total: 47, fromCache: false };

  } catch (e) {
    console.warn('[PhonemeCache] Network error:', e.message);
    return { loaded: 0, total: 47, fromCache: false, error: e.message };
  }
}
