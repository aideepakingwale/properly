/**
 * @file        useSpeech.js
 * @description Web Speech API hook — TTS with word-by-word highlight sync
 * @module      Hooks
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   Word highlighting uses two strategies in parallel:
 *   1. onboundary event (Chrome desktop — precise, fires per word)
 *   2. Timing fallback (Firefox, Safari, iOS — estimates based on word length + speech rate)
 *   The boundary event takes priority whenever it fires; the timer fills the gap otherwise.
 */

import { useRef, useEffect, useCallback } from 'react';

export function useSpeech() {
  const synth  = useRef(typeof window !== 'undefined' ? window.speechSynthesis : null);
  const voices = useRef([]);

  useEffect(() => {
    const load = () => { voices.current = window.speechSynthesis?.getVoices() || []; };
    load();
    window.speechSynthesis?.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', load);
  }, []);

  const speak = useCallback((text, { rate = 0.88, pitch = 1.1, lang = 'en-GB', onWordIdx } = {}) => {
    const s = synth.current;
    if (!s) return;
    s.cancel();

    const u = new SpeechSynthesisUtterance(text);
    u.lang  = lang;
    u.rate  = rate;
    u.pitch = pitch;

    const v = voices.current.find(v => v.lang.startsWith('en-GB') && v.name.toLowerCase().includes('female'))
           || voices.current.find(v => v.lang.startsWith('en-GB'))
           || voices.current.find(v => v.lang.startsWith('en'));
    if (v) u.voice = v;

    if (onWordIdx) {
      const words   = text.trim().split(/\s+/);
      const offsets = [];
      let pos = 0;
      for (const w of words) { offsets.push(pos); pos += w.length + 1; }

      // ── Strategy 1: onboundary (Chrome desktop — most accurate) ──────────
      // Track whether boundary events fire at all (they don't in Firefox/Safari).
      let boundaryFired = false;
      let timers = [];
      let fallbackStarted = false;

      u.onboundary = (e) => {
        if (e.name !== 'word') return;
        boundaryFired = true;

        // Cancel any running fallback timers — boundary is more accurate
        if (fallbackStarted) {
          timers.forEach(clearTimeout);
          timers = [];
          fallbackStarted = false;
        }

        // Find word index from char offset — manual findLastIndex for Safari compat
        let wi = 0;
        for (let i = offsets.length - 1; i >= 0; i--) {
          if (e.charIndex >= offsets[i]) { wi = i; break; }
        }
        onWordIdx(wi);
      };

      // ── Strategy 2: timing fallback (Firefox, Safari, iOS) ───────────────
      // Start this 400ms after speech begins. If onboundary has fired by then,
      // cancel immediately — boundary is more accurate.
      // Word duration estimate: base 250ms + 60ms per character, scaled by speech rate.
      u.onstart = () => {
        const fallbackDelay = setTimeout(() => {
          if (boundaryFired) return;  // boundary is working — don't need fallback
          fallbackStarted = true;

          // Estimate duration of each word based on character count + rate
          const charsPerSec = 12 * rate;  // rough: ~12 chars/sec at normal rate
          let elapsed = 0;

          words.forEach((word, wi) => {
            const wordDuration = Math.max(180, (word.length / charsPerSec) * 1000);
            const t = setTimeout(() => {
              if (!boundaryFired) onWordIdx(wi);
            }, elapsed);
            timers.push(t);
            elapsed += wordDuration;
          });

          // Clear after all words done
          const endTimer = setTimeout(() => {
            if (!boundaryFired) onWordIdx(-1);
          }, elapsed + 200);
          timers.push(endTimer);
        }, 400);
        timers.push(fallbackDelay);
      };

      u.onend = () => {
        timers.forEach(clearTimeout);
        timers = [];
        onWordIdx(-1);
      };
      u.onerror = () => {
        timers.forEach(clearTimeout);
        timers = [];
        onWordIdx(-1);
      };
    }

    s.speak(u);
  }, []);

  const stop = useCallback(() => {
    synth.current?.cancel();
  }, []);

  return { speak, stop };
}

export function useSpeechRecognition({ onResult, onError, lang = 'en-GB' } = {}) {
  const recRef = useRef(null);

  const isSupported = typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  const start = useCallback((cb) => {
    if (!isSupported) { onError?.('not-supported'); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = lang;
    r.continuous = false;
    r.interimResults = false;
    r.maxAlternatives = 1;
    recRef.current = r;

    r.onstart  = () => cb?.('start');
    r.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      cb?.('end');
      onResult?.(transcript, e.results[0][0].confidence);
    };
    r.onerror  = (e) => { cb?.('end'); onError?.(e.error); };
    r.onend    = () => cb?.('end');
    r.start();
  }, [isSupported, lang, onResult, onError]);

  const stop = useCallback(() => { recRef.current?.stop(); }, []);

  return { start, stop, isSupported };
}
