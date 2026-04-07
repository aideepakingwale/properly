/**
 * @file        useAzureTTS.js
 * @description Hook for playing arbitrary text through Azure Neural TTS (en-GB-SoniaNeural).
 *              Used for phonics terminology that Web Speech API mispronounces.
 *
 *              Caches blob URLs in memory — repeated calls to the same text are instant.
 *              Falls back to Web Speech API if Azure TTS is unavailable (no key).
 */

import { useRef, useCallback } from 'react';
import { useSpeech } from './useSpeech';

// In-memory cache: text → blob URL
const ttsCache = {};

function getApiBase() {
  const raw = (typeof __API_URL__ !== 'undefined' && __API_URL__) ? __API_URL__ : '/api';
  if (!raw || raw === '/api') return '/api';
  const withProto = raw.startsWith('http') ? raw : 'https://' + raw;
  return withProto.replace(/\/$/, '').replace(/\/api$/, '') + '/api';
}

export function useAzureTTS() {
  const { speak } = useSpeech();
  const activeAudio = useRef(null);

  const sayText = useCallback(async (text, rate = 0.82) => {
    if (!text) return;

    // Stop any currently playing audio
    if (activeAudio.current) {
      activeAudio.current.pause();
      activeAudio.current.currentTime = 0;
    }

    // Check memory cache first
    if (ttsCache[text]) {
      return new Promise((resolve) => {
        const audio = new Audio(ttsCache[text]);
        activeAudio.current = audio;
        audio.playbackRate = rate < 0.9 ? 0.85 : 1.0;
        audio.onended = resolve;
        audio.onerror = resolve;
        audio.play().catch(resolve);
      });
    }

    // Fetch from Azure TTS endpoint
    try {
      const token = localStorage.getItem('properly_token') || '';
      const apiBase = getApiBase();
      const res = await fetch(`${apiBase}/ai/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error(`TTS HTTP ${res.status}`);

      const contentType = res.headers.get('content-type') || '';

      if (contentType.includes('audio')) {
        // Azure returned MP3 audio
        const buf  = await res.arrayBuffer();
        const blob = new Blob([buf], { type: 'audio/mpeg' });
        const url  = URL.createObjectURL(blob);
        ttsCache[text] = url;

        return new Promise((resolve) => {
          const audio = new Audio(url);
          activeAudio.current = audio;
          audio.playbackRate = rate < 0.9 ? 0.85 : 1.0;
          audio.onended = resolve;
          audio.onerror = resolve;
          audio.play().catch(resolve);
        });
      } else {
        // Azure not configured — use Web Speech fallback
        const json = await res.json();
        if (json?.data?.useBrowserTTS) {
          speak(text, { rate });
        }
      }
    } catch {
      // Network error — fall back to Web Speech
      speak(text, { rate });
    }
  }, [speak]);

  const stop = useCallback(() => {
    if (activeAudio.current) {
      activeAudio.current.pause();
      activeAudio.current.currentTime = 0;
    }
  }, []);

  return { sayText, stop };
}
