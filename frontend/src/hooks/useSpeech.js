/**
 * @file        useSpeech.js
 * @description Web Speech API hook — captures browser speech recognition transcript alongside audio recording
 * @module      Hooks
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - Transcript used as fallback scoring input when Azure STT is unavailable
 */

import { useRef, useEffect, useCallback } from 'react';
export function useSpeech() {
  const synth  = useRef(typeof window!=='undefined'?window.speechSynthesis:null);
  const voices = useRef([]);
  useEffect(()=>{
    const load=()=>{ voices.current=window.speechSynthesis?.getVoices()||[]; };
    load();
    window.speechSynthesis?.addEventListener('voiceschanged',load);
    return ()=>window.speechSynthesis?.removeEventListener('voiceschanged',load);
  },[]);
  const speak = useCallback((text,{rate=0.88,pitch=1.1,lang='en-GB'}={})=>{
    const s=synth.current; if(!s) return; s.cancel();
    const u=new SpeechSynthesisUtterance(text);
    u.lang=lang; u.rate=rate; u.pitch=pitch;
    const v=voices.current.find(v=>v.lang.startsWith('en-GB')&&v.name.toLowerCase().includes('female'))
           ||voices.current.find(v=>v.lang.startsWith('en-GB'))
           ||voices.current.find(v=>v.lang.startsWith('en'));
    if(v) u.voice=v;
    s.speak(u);
  },[]);
  const stop = useCallback(()=>synth.current?.cancel(),[]);
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
