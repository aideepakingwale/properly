import { useRef, useCallback } from 'react';

const BASE = (typeof __API_URL__!=='undefined' ? __API_URL__ : null)
  || (typeof window!=='undefined' && window.__ENV__?.VITE_API_URL)
  || '/api';

const cache = new Map();

function browserSpeak(text,{rate=0.88,pitch=1.1}={}) {
  const s=window.speechSynthesis; if(!s) return; s.cancel();
  const u=new SpeechSynthesisUtterance(text);
  u.lang='en-GB'; u.rate=rate; u.pitch=pitch;
  const vs=s.getVoices();
  const v=vs.find(v=>v.lang.startsWith('en-GB')&&v.name.toLowerCase().includes('female'))
         ||vs.find(v=>v.lang.startsWith('en-GB'))
         ||vs.find(v=>v.lang.startsWith('en'));
  if(v) u.voice=v;
  s.speak(u);
}

function playBlob(url, audioRef) {
  if(audioRef.current){ audioRef.current.pause(); }
  const a=new Audio(url); audioRef.current=a;
  a.play().catch(()=>{}); 
}

export function useMrsOwl() {
  const audioRef = useRef(null);

  const speak = useCallback(async (text, opts={}) => {
    if(!text) return;
    if(cache.has(text)) { playBlob(cache.get(text),audioRef); return; }
    const token = localStorage.getItem('properly_token');
    try {
      const res = await fetch(`${BASE}/ai/tts`,{
        method:'POST',
        headers:{ 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) },
        body:JSON.stringify({text}),
      });
      const ct = res.headers.get('content-type')||'';
      if(ct.includes('audio/')) {
        const blob=await res.blob();
        const url=URL.createObjectURL(blob);
        if(cache.size>40){ const k=cache.keys().next().value; URL.revokeObjectURL(cache.get(k)); cache.delete(k); }
        cache.set(text,url);
        playBlob(url,audioRef);
      } else {
        const data=await res.json();
        if(data?.data?.useBrowserTTS) browserSpeak(data.data.text||text,opts);
      }
    } catch { browserSpeak(text,opts); }
  },[]);

  const stop = useCallback(()=>{
    audioRef.current?.pause(); audioRef.current=null;
    window.speechSynthesis?.cancel();
  },[]);

  return { speak, stop };
}
