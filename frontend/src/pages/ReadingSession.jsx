/**
 * @file        ReadingSession.jsx
 * @description Core reading session page — word-by-word TTS animation, microphone recording, Azure pronunciation assessment and Mrs Owl coaching feedback
 * @module      Pages
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - speakingWordIdx highlights current TTS word at ~380ms/word cadence
 *   - revealedCount staggers pronunciation score reveal at 180ms/word after assessment
 *   - Supports both static curriculum stories and AI-generated stories via isAiStory flag
 *   - Session lifecycle: startSession → submitPage × N → completeSession
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { storyAPI, progressAPI, aiAPI, speechAPI, aiStoryAPI } from '../services/api';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useSpeechRecognition } from '../hooks/useSpeech';
import { useMrsOwl } from '../hooks/useMrsOwl';
import { getWordColor } from '../utils/scoring';
import { AcornPill, Modal, Confetti, ProgressBar, Button, Spinner } from '../components/ui';
import PhonicsWord from '../components/PhonicsWord';
import { analyseWord, getPhonemeHint } from '../utils/phonicsAnalyser';
import { getPhonemeUrl, isCacheLoaded, getCacheStats } from '../services/phonemeCache';
import { assessWithSDK } from '../services/azureSpeechSDK';

// Colour coding for Azure error types
function getErrorBadge(errorType) {
  if (!errorType || errorType === 'None') return null;
  const map = {
    Omission:        { label: 'missed', color: 'var(--color-danger-dark)' },
    Insertion:       { label: 'extra word', color: 'var(--color-accent-dark)' },
    Mispronunciation:{ label: 'try again', color: 'var(--color-danger-dark)' },
  };
  return map[errorType] || null;
}

// ── DEBUG PANEL HELPERS ──────────────────────────────────────
function Section({ label, color = '#FCD34D', children }) {
  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '6px 0 2px' }}>
      <div style={{ padding: '2px 12px 4px', color, fontWeight: 700, fontSize: 9, letterSpacing: '0.08em' }}>
        ── {label} ──
      </div>
      {children}
    </div>
  );
}
function Row({ label, val, ok, critical }) {
  const color = critical ? '#FCA5A5' : ok === true ? '#6EE7B7' : ok === false ? '#FCA5A5' : '#93C5FD';
  return (
    <div style={{ display: 'flex', gap: 8, padding: '1px 12px', alignItems: 'flex-start' }}>
      <span style={{ color: '#64748B', minWidth: 160, flexShrink: 0 }}>{label}:</span>
      <span style={{ color, wordBreak: 'break-all' }}>{val === undefined || val === null ? <span style={{ opacity: 0.4 }}>—</span> : String(val)}</span>
    </div>
  );
}

// AI provider pill
function ProviderPill({ provider, source }) {
  if (source === 'cache') return null;
  const labels = { gemini: '♊ Gemini', groq: '⚡ Groq/Llama', static: '📚 Cache', rules: '📚 Rules', fallback: '📚 Rules' };
  return (
    <span style={{ fontSize: 10, background: 'var(--dark-8)', borderRadius: 50, padding: '2px 7px', color: 'var(--text-muted)', fontWeight: 600, marginLeft: 6 }}>
      {labels[provider] || provider}
    </span>
  );
}

export default function ReadingSession() {
  const { storyId } = useParams();
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const isAiStory    = searchParams.get('ai') === '1';
  const aiChildId    = searchParams.get('childId');
  const { child, user, refreshProgress, updateChildLocally } = useAuth();
  const nav                      = useNavigate();
  const { speak, stop }          = useMrsOwl();

  const [story, setStory]        = useState(null);
  const [pageIdx, setPageIdx]    = useState(0);
  const [showNextButton, setShowNextButton] = useState(false);  // shown after good score
  const [wordScores, setWordScores] = useState([]);
  const [feedbackData, setFeedbackData] = useState(null); // { tip, source, provider }
  const [loadingFb, setLoadingFb]= useState(false);
  const [assessing, setAssessing]= useState(false);
  const [azureDetails, setAzureDetails] = useState(null); // fluency, completeness etc.
  const [sessionAcorns, setSessionAcorns] = useState(0);
  const [sessionId, setSessionId]= useState(null);
  const [showComplete, setShowComplete] = useState(false);
  const [newAchievements, setNewAchievements] = useState([]);
  const [storyBonus, setStoryBonus] = useState(0);
  const [confetti, setConfetti]  = useState(false);
  const [scoringMode, setScoringMode] = useState(null); // 'azure' | 'text-comparison' | 'no-transcript'
  const [loading, setLoading]    = useState(true);
  const [error, setError]        = useState('');
  const [debugMode, setDebugMode] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);  // raw Azure data when debug on
  const [speakingWordIdx, setSpeakingWordIdx] = useState(-1);  // word lit up during TTS playback
  const [revealedCount, setRevealedCount]     = useState(0);   // scores revealed progressively after assessment
  const [providerInfo, setProviderInfo] = useState(null);
  const [lastDebug, setLastDebug]     = useState(null);  // always-visible debug panel
  const [showDebug, setShowDebug]     = useState(false); // debug panel open/closed
  const [lastAudioUrl, setLastAudioUrl] = useState(null);  // blob URL of last recording
  const [lastAudioMime, setLastAudioMime] = useState(null);
  const [lastAudioKB, setLastAudioKB]   = useState(null);
  const triesRef = useRef(0);
  const [phonicsHearMode, setPhonicsHearMode] = useState(false);  // toggle: full sentence vs phoneme-by-phoneme
  const [speakingChunkKey, setSpeakingChunkKey] = useState(null); // 'wordIdx-chunkIdx' currently playing

  const { startRecording, stopRecording, isRecording, error: micError } = useAudioRecorder();

  // Browser speech recognition — captures transcript alongside audio recording.
  // PRIMARY ROLE: quality gate before Azure — if browser can't hear it, Azure won't either.
  // SECONDARY ROLE: fallback scoring when Azure not configured.
  const [localTranscript, setLocalTranscript] = useState('');
  const [recordingSeconds, setRecordingSeconds] = useState(0);  // elapsed seconds while recording
  const recordingTimerRef = useRef(null);   // interval for countdown
  const autoStopTimerRef  = useRef(null);   // timeout for forced auto-stop
  const isRecordingRef    = useRef(false);   // mirrors isRecording without stale closure risk
  const processingRef     = useRef(false);   // lock: prevents concurrent processAudio calls
  const allWordsCapturedRef = useRef(false); // true when browser has heard all ref words
  const [localConfidence, setLocalConfidence] = useState(0);

  // Promise-based transcript capture — resolves when onresult/onerror fires
  // This eliminates the race condition where we check the ref before onresult fires
  const transcriptResolveRef = useRef(null);

  const { start: startRec, stop: stopRec } = useSpeechRecognition({
    onResult: (text, confidence = 0.8) => {
      transcriptRef.current = text;
      setLocalTranscript(text);
      setLocalConfidence(confidence);
      transcriptResolveRef.current?.({ text, confidence });  // resolve the waiting promise
      transcriptResolveRef.current = null;
    },
    onError: (err) => {
      setLocalTranscript('');
    setSdkLog([]);
    setShowNextButton(false);
      setLocalConfidence(0);
      transcriptResolveRef.current?.({ text: '', confidence: 0, error: err });
      transcriptResolveRef.current = null;
    },
  });

  // Returns a promise that resolves with { text, confidence } when Web Speech fires
  // Times out after maxMs (default 2500ms) so we never hang
  const waitForTranscript = (maxMs = 2500) => new Promise(resolve => {
    // If transcript already arrived (fast device), resolve immediately
    if (transcriptRef.current != null) {
      resolve({ text: transcriptRef.current, confidence: localConfidence });
      return;
    }
    const timer = setTimeout(() => {
      transcriptResolveRef.current = null;
      resolve({ text: transcriptRef.current || '', confidence: 0, timedOut: true });
    }, maxMs);
    transcriptResolveRef.current = (result) => {
      clearTimeout(timer);
      resolve(result);
    };
  });

  // Load story + provider status
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Use child.id from context as fallback if URL param missing
        const resolvedChildId = aiChildId || child?.id;
        const storyLoader = isAiStory && resolvedChildId
          ? aiStoryAPI.get(resolvedChildId, storyId)
          : storyAPI.get(storyId);
        const [storyRes, statusRes, debugRes] = await Promise.allSettled([
          storyLoader,
          speechAPI.status(),
          // Only fetch debug mode for admin users — never expose to regular parents/children
          (user?.isAdmin
            ? fetch('/api/debug-mode').then(r => r.json())
            : Promise.resolve({ data: { enabled: false } })
          ).catch(() => ({ data: { enabled: false } })),
        ]);
        if (debugRes.status === 'fulfilled') {
          setDebugMode(user?.isAdmin && debugRes.value?.data?.enabled === true);
        }
        if (storyRes.status === 'fulfilled' && storyRes.value.success) {
          const s = storyRes.value.data;

          // Normalise page shape:
          // Curriculum pages: { index, text, scene, bgClass, isDark }
          // AI story pages:   { index, text, scene, bg, targetWords, ... }
          // Reading session always reads page.bgClass, page.scene, page.isDark
          // so we normalise AI story pages to the same shape here.
          if (s.pages?.length) {
            s.pages = s.pages.map((p, i) => ({
              ...p,
              bgClass:  p.bgClass || p.bg || 'bg-warm',   // AI uses 'bg', curriculum uses 'bgClass'
              isDark:   p.isDark   || false,
              scene:    p.scene    || '🌿',
              index:    p.index    ?? i,
            }));
          }

          setStory({ ...s, isAiGenerated: s.isAiGenerated ?? isAiStory });
        } else {
          if (isAiStory) { setError('AI story not found — it may have been deleted.'); }
          else           { setError('Story not found'); }
        }
        if (statusRes.status === 'fulfilled' && statusRes.value.success) setProviderInfo(statusRes.value.data);
      } catch { setError('Could not load story. Is the server running?'); }
      finally { setLoading(false); }
    })();
  }, [storyId]);

  // Start backend session
  useEffect(() => {
    if (!story || !child || sessionId) return;
    // Pass story type so backend inserts into correct table
    progressAPI.startSession(child.id, story.id, story.isAiGenerated ? 'ai' : 'static')
      .then(r => { if (r.success) setSessionId(r.data.sessionId); }).catch(() => {});
  }, [story, child]);

  // Reset on page change
  useEffect(() => {
    setWordScores([]);
    setFeedbackData(null);
    setAzureDetails(null);
    setDebugInfo(null);
    setLastDebug(null);           // clear stale debug from previous page
    setShowDebug(false);          // collapse debug panel on page change
    if (lastAudioUrl) { URL.revokeObjectURL(lastAudioUrl); setLastAudioUrl(null); }
    setLastAudioMime(null);
    setLastAudioKB(null);
    setLocalTranscript('');
    setLocalConfidence(0);
    triesRef.current       = 0;
    setSpeakingWordIdx(-1);
    setRevealedCount(0);
    transcriptRef.current  = null;
    isRecordingRef.current = false;
    processingRef.current   = false;
    clearInterval(recordingTimerRef.current);
    clearTimeout(autoStopTimerRef.current);
    setRecordingSeconds(0);
    // Cancel any pending transcript promise from previous page
    transcriptResolveRef.current?.({ text: '', confidence: 0, cancelled: true });
    transcriptResolveRef.current = null;
  }, [pageIdx]);

  const page    = story?.pages?.[pageIdx];
  const pageRef = useRef(null);
  pageRef.current = page;  // set synchronously every render — always current, no useEffect needed

  // ── PHONICS SOUND PLAYBACK ──────────────────────────────────
  // Reads each grapheme's phoneme sound in sequence, lighting up the chunk as it speaks.
  // Uses Web Speech API (no Azure cost) with careful timing so each grapheme tile
  // highlights exactly when its sound is spoken.
  // ── PHONEME AUDIO ENGINE ─────────────────────────────────────
  // Uses Azure TTS with SSML <phoneme alphabet="ipa"> for exact sounds.
  // Falls back to Web Speech with carefully chosen English key words.
  // Each key word is the shortest common word that STARTS with that phoneme.

  const phonemeAudioCache    = useRef({});
  const phonemeAudioRef      = useRef(null);
  const _reloadingPhonemes   = useRef(false);  // prevent multiple simultaneous preload calls
  const [phonemeDebugLog, setPhonemeDebugLog] = useState([]);
  const [sdkLog, setSdkLog]             = useState([]);
  const [loadingChunkKey, setLoadingChunkKey] = useState(null); // shows spinner on tapped chunk // [{ipa, grapheme, method, status, ms}]
  const [showPhonemeDebug, setShowPhonemeDebug] = useState(false);
  const addPhonemeLog = (entry) => setPhonemeDebugLog(prev => [entry, ...prev].slice(0, 30));

  const fetchPhonemeAudio = useCallback(async (ipa, grapheme) => {
    // 1. Check in-memory session cache (fastest — already a blob URL)
    if (phonemeAudioCache.current[ipa]) {
      addPhonemeLog({ ipa, grapheme, method: 'session-cache', status: '✅ instant', ms: 0 });
      return phonemeAudioCache.current[ipa];
    }

    // 2. Check localStorage preload cache (loaded at startup — instant base64 → blob URL)
    const preloadUrl = getPhonemeUrl(ipa);
    if (preloadUrl) {
      phonemeAudioCache.current[ipa] = preloadUrl;  // also store in session cache
      addPhonemeLog({ ipa, grapheme, method: 'preload-cache', status: '✅ localStorage hit', ms: 0 });
      return preloadUrl;
    }

    // 3. Cache miss — trigger a background re-preload (non-blocking) and return null
    //    so WebSpeech fallback plays immediately.
    //    The re-preload will populate localStorage for all future phonemes this session.
    if (!_reloadingPhonemes.current) {
      _reloadingPhonemes.current = true;
      const token = localStorage.getItem('properly_token');
      addPhonemeLog({ ipa, grapheme, method: 'preload-retry', status: '⏳ cache empty — re-fetching all phonemes…', ms: 0 });
      import('../services/phonemeCache').then(({ preloadPhonemes }) => {
        preloadPhonemes(token).then(r => {
          addPhonemeLog({ ipa: '—', grapheme: '—', method: 'preload-retry', status: r.loaded > 0 ? `✅ ${r.loaded} phonemes loaded — future sounds will use Azure` : `❌ preload failed: ${r.error || 'unknown'}`, ms: 0 });
          _reloadingPhonemes.current = false;
        });
      });
    }
    return null;  // WebSpeech fallback will play while preload runs in background
  }, []);

  const playAudioUrl = (url) => new Promise(resolve => {
    if (phonemeAudioRef.current) phonemeAudioRef.current.pause();
    const a = new Audio(url);
    phonemeAudioRef.current = a;
    a.onended = resolve;
    a.onerror = resolve;
    a.play().catch(resolve);
  });

  // Key words: shortest common English word that STARTS with (or clearly contains) the phoneme
  // Spoken at rate 0.5 — child hears the sound at the word boundary
  // ── PHONEME SOUNDS ────────────────────────────────────────────
  // Web Speech CANNOT isolate a phoneme from a whole word.
  // "cat" → TTS reads "cat". We need just the /k/ onset.
  //
  // Trick: feed Web Speech a CVC syllable using only the target phoneme
  // + a neutral "uh" vowel. The schwa "uh" is the most neutral English vowel.
  // Spoken at rate 0.5, only the onset consonant is perceptible.
  //
  // For VOWELS: feed just the vowel sound written phonetically.
  // /æ/ → "ah" (not "aaa", not "ant") — "ah" as in "ah yes"
  // /ɛ/ → "eh" (not "egg")
  //
  // When Azure is configured: always use SSML <phoneme> tags for exact IPA sound.

  const PHONEME_SPEECH = {
    // ── CONSONANT STOPS — short schwa syllable, cut off after onset ──
    '/p/': 'puh',    '/b/': 'buh',    '/t/': 'tuh',    '/d/': 'duh',
    '/k/': 'kuh',    '/g/': 'guh',
    // ── FRICATIVES — continuous sounds, written to extend naturally ──
    '/f/': 'fffff',  '/v/': 'vvvvv',  '/s/': 'sss',    '/z/': 'zzz',
    '/ʃ/': 'shh',    '/h/': 'huh',    '/ð/': 'thuh',   '/θ/': 'thh',
    // ── AFFRICATES ─────────────────────────────────────────────────
    '/tʃ/': 'chuh',  '/dʒ/': 'juh',
    // ── NASALS & APPROXIMANTS ───────────────────────────────────────
    '/m/': 'mmm',    '/n/': 'nnn',    '/ŋ/': 'nng',    '/ŋk/': 'ngk',
    '/l/': 'lll',    '/r/': 'rr',     '/w/': 'wuh',    '/j/': 'yuh',
    '/kw/': 'kwuh',  '/ks/': 'ks',
    // ── SHORT VOWELS — pure vowel sound, no surrounding consonants ──
    '/æ/': 'ah',     '/ɛ/': 'eh',     '/ɪ/': 'ih',     '/ɒ/': 'oh',
    '/ʌ/': 'uh',     '/ʊ/': 'oo',     '/ə/': 'uh',
    // ── LONG VOWELS & DIPHTHONGS ────────────────────────────────────
    '/eɪ/': 'ay',    '/iː/': 'ee',    '/aɪ/': 'eye',   '/əʊ/': 'oh',
    '/uː/': 'oo',    '/aʊ/': 'ow',    '/ɔɪ/': 'oy',
    '/ɑː/': 'ah',    '/ɔː/': 'aw',    '/ɜː/': 'ur',    '/juː/': 'yoo',
    '/ɪə/': 'ear',   '/eə/': 'air',   '/ʊə/': 'oor',
  };

  function getPhonemeConfig(phoneme, grapheme) {
    return { ipa: phoneme.replace(/^\/|\/$/g, ''), grapheme, speech: PHONEME_SPEECH[phoneme] || grapheme };
  }

  const playPhoneme = useCallback(async (phoneme, grapheme, chunkKey = null) => {
    const ipaClean = phoneme.replace(/^\/|\/$/g, '');

    // Fetch audio (may hit cache instantly)
    const url = await fetchPhonemeAudio(ipaClean, grapheme);
    if (url) {
      // Set highlight exactly when audio STARTS playing (not when fetch returns)
      if (chunkKey) {
        const origPlay = phonemeAudioRef.current;
        const a = new Audio(url);
        phonemeAudioRef.current = a;
        await new Promise(resolve => {
          a.onplay   = () => setSpeakingChunkKey(chunkKey);  // sync highlight to audio start
          a.onended  = resolve;
          a.onerror  = resolve;
          a.play().catch(resolve);
        });
      } else {
        await playAudioUrl(url);
      }
      return;
    }

    // Fallback: Web Speech — set highlight on onstart
    const speech = PHONEME_SPEECH[phoneme] || grapheme;
    addPhonemeLog({ ipa: ipaClean, grapheme, method: 'web-speech', status: `▶ "${speech}"`, ms: 0 });
    if (chunkKey) {
      await sayWord(speech, 0.5, 1.1, () => setSpeakingChunkKey(chunkKey));
    } else {
      await sayWord(speech, 0.5, 1.1);
    }
  }, [fetchPhonemeAudio]);

  // Promise-based speech — waits for onend before resolving
  function sayWord(text, rate = 0.78, pitch = 1.08, onStart) {
    return new Promise(resolve => {
      const synth = window.speechSynthesis;
      if (!synth) { onStart?.(); setTimeout(resolve, 400); return; }
      const u = new SpeechSynthesisUtterance(text);
      u.lang  = 'en-GB';
      u.rate  = rate;
      u.pitch = pitch;
      const voices = synth.getVoices();
      const v = voices.find(v => v.lang === 'en-GB' && v.name.toLowerCase().includes('female'))
              || voices.find(v => v.lang.startsWith('en-GB'))
              || voices.find(v => v.lang.startsWith('en-US'))
              || voices[0];
      if (v) u.voice = v;
      u.onstart = () => onStart?.();  // fires when audio actually starts playing
      u.onend   = resolve;
      u.onerror = resolve;
      synth.speak(u);
    });
  }
  function sayWith(text, rate = 0.78, pitch = 1.08) { return sayWord(text, rate, pitch); }

  // Running flag so we can cancel mid-playback
  const phonicsPlayingRef = useRef(false);

  const speakPhonics = useCallback(async () => {
    if (!page) return;
    stop();
    window.speechSynthesis?.cancel();
    phonicsPlayingRef.current = true;

    const phase     = child?.phase || 2;
    const pageWords = page.text.trim().split(/\s+/);

    // Helper: pause without speech
    const pause = (ms) => new Promise(r => setTimeout(r, ms));

    for (let wi = 0; wi < pageWords.length; wi++) {
      if (!phonicsPlayingRef.current) break;
      const rawWord = pageWords[wi];
      const clean   = rawWord.replace(/[.,!?;:'"]/g, '');
      if (!clean) continue;

      const chunks = analyseWord(clean, phase).filter(c => !c.isSilent);

      // ── STEP 1: Sound out each grapheme ──────────────────────
      for (let ci = 0; ci < chunks.length; ci++) {
        if (!phonicsPlayingRef.current) break;
        const chunk = chunks[ci];
        const cfg   = getPhonemeConfig(chunk.phoneme, chunk.grapheme);

        setSpeakingWordIdx(-1);
        setSpeakingChunkKey(`${wi}-${ci}`);

        await playPhoneme(chunk.phoneme, chunk.grapheme);
        // Brief gap between phonemes so sounds don't blur together
        await pause(chunk.grapheme.length >= 2 ? 180 : 100);
      }

      if (!phonicsPlayingRef.current) break;

      // ── STEP 2: Blending pause (chunk highlight cleared) ─────
      setSpeakingChunkKey(null);
      await pause(300);

      // ── STEP 3: Say the whole blended word ───────────────────
      setSpeakingWordIdx(wi);
      await sayWord(clean, 0.82, 1.05);
      await pause(350);  // gap between words
      setSpeakingWordIdx(-1);
    }

    setSpeakingChunkKey(null);
    setSpeakingWordIdx(-1);
    phonicsPlayingRef.current = false;
  }, [page, child, stop]);

  // ── CLOUD ASSESSMENT PIPELINE ──────────────────────────────
  // ── CHUNK TAP: play individual phoneme ─────────────────────────────────
  const handleChunkTap = useCallback(async (chunk, chunkIdx, wIdx) => {
    if (!chunk?.phoneme || chunk.isSilent) return;
    const key = `${wIdx}-${chunkIdx}`;
    setLoadingChunkKey(key);
    setSpeakingChunkKey(null);
    try {
      await playPhoneme(chunk.phoneme, chunk.grapheme, key);
    } finally {
      setLoadingChunkKey(null);
      // Clear the chunk highlight after a short delay
      setTimeout(() => setSpeakingChunkKey(null), 400);
    }
  }, [playPhoneme]);

  // ── WORD TAP: play full word via useSpeech hook (has voice loading) ──────
  const handleWordTap = useCallback(async (word, wIdx) => {
    const clean = word.replace(/[.,!?;:'"]/g, '');
    if (!clean) return;
    setSpeakingChunkKey(null);
    setSpeakingWordIdx(wIdx);   // highlight word immediately
    // Use speak() from useSpeech which already has loaded voices and en-GB selection
    await new Promise(resolve => {
      const synth = window.speechSynthesis;
      if (!synth) { setTimeout(resolve, 600); return; }
      synth.cancel();  // stop any ongoing speech
      const voices = window.speechSynthesis.getVoices();
      const u = new SpeechSynthesisUtterance(clean);
      u.lang  = 'en-GB';
      u.rate  = 0.72;
      u.pitch = 1.1;
      const v = voices.find(v => v.lang.startsWith('en-GB') && v.name.toLowerCase().includes('female'))
             || voices.find(v => v.lang.startsWith('en-GB'))
             || voices.find(v => v.lang.startsWith('en'));
      if (v) u.voice = v;
      u.onend   = () => { setSpeakingWordIdx(-1); resolve(); };
      u.onerror = () => { setSpeakingWordIdx(-1); resolve(); };
      // Small delay so voices are ready (some browsers need 1 tick)
      setTimeout(() => synth.speak(u), 50);
    });
  }, []);

  const processAudio = useCallback(async (audioBlob, browserTranscript) => {
    if (!page) return;
    setAssessing(true);
    triesRef.current++;

    try {
      // 1. Send audio to backend → Azure Pronunciation Assessment
      const blobKB = (audioBlob?.size / 1024).toFixed(1);
      setLastDebug({ stage: 'sending', blobKB, mime: audioBlob?.type, ref: pageRef.current?.text || page?.text });
      const currentPage = pageRef.current;
      const refText     = currentPage?.text || page?.text || '';
      const jwtToken    = localStorage.getItem('properly_token');

      // ── AZURE SPEECH SDK (primary path — WebSocket, 100% reliable PA) ──
      // Try SDK first. Falls back to REST API if SDK fails (SDK load error, etc.)
      let assessRes = null;
      let sdkUsed   = false;

      if (providerInfo?.azure?.available) {
        try {
          setSdkLog(['🔄 Loading Azure Speech SDK…']);
          const sdkResult = await assessWithSDK(
            audioBlob, refText, jwtToken,
            (msg) => setSdkLog(prev => [...prev.slice(-4), msg])
          );
          if (sdkResult) {
            // SDK returned PA scores — wrap in assessRes shape
            assessRes  = { success: true, data: { ...sdkResult, _debugInfo: sdkResult._debug } };
            sdkUsed    = true;
            setSdkLog(prev => [...prev, `✅ PA: ${sdkResult.overallAccuracy}% accuracy`]);
          } else {
            setSdkLog(prev => [...prev, '⚠️ SDK: no speech detected — falling back to REST']);
          }
        } catch (sdkErr) {
          setSdkLog(prev => [...prev, `❌ SDK failed: ${sdkErr.message} — falling back to REST`]);
          console.warn('[processAudio] SDK failed:', sdkErr.message);
        }
      }

      // ── REST API fallback (Groq Whisper / text-comparison) ───────────────
      if (!assessRes) {
        assessRes = await speechAPI.assess(audioBlob, refText, browserTranscript || null);
      }
      if (!assessRes.success) return;

      const { wordScores, overallAccuracy, overallFluency, overallCompleteness,
              overallProsody, displayText, source, azureAssessed, _debugInfo,
              wrongSentence, sentenceSimilarity } = assessRes.data;

      // Always store last assessment debug info for the on-screen panel
      const debug = {
        ...(_debugInfo || {}),
        source, azureAssessed, overallAccuracy, overallFluency,
        displayText, wordCount: wordScores?.length,
        blobKB: (audioBlob?.size / 1024).toFixed(1),
        mime: audioBlob?.type,
        wordScores,
        recognized: assessRes.data?.displayText,
        wrongSentence,
        sentenceSimilarity,
      };
      setDebugInfo(debug);
      setLastDebug({ stage: 'done', ...debug });

      setRevealedCount(0);
      setWordScores(wordScores);
      // Reveal scores word by word with a stagger effect
      wordScores.forEach((_, i) => {
        setTimeout(() => setRevealedCount(i + 1), 120 + i * 180);
      });
      setScoringMode(azureAssessed ? 'azure' : source === 'groq-whisper' ? 'groq-whisper' : source === 'no-transcript' ? 'no-transcript' : 'text-comparison');
      if (azureAssessed || source === 'groq-whisper') {
        setAzureDetails({
          fluency: overallFluency, completeness: overallCompleteness,
          prosody: overallProsody,
          source: azureAssessed ? 'azure' : 'groq-whisper',
        });
      }

      // Wrong sentence detection — tell the child clearly
      if (wrongSentence) {
        setFeedbackData({
          tip: `Hmm, that sounded like a different sentence! Let's try again — look at the words on screen and read THIS sentence. 👀`,
          source: 'rules',
          provider: 'rules',
        });
        setWordScores(wordScores);
        setRevealedCount(wordScores.length);
        setAssessing(false);
        return;
      }

      // Submit page to backend
      const earnedThisPage = Math.max(1, Math.round(overallAccuracy / 20));
      if (sessionId && child) {
        progressAPI.submitPage(child.id, {
          sessionId, pageIndex: pageIdx, spokenText: displayText,
          accuracy: overallAccuracy, wordScores, acornsEarned: earnedThisPage,
        }).catch(() => {});
      }
      updateChildLocally({ wordsRead: (child?.wordsRead || 0) + page.text.split(/\s+/).length });

      // 2. Handle no-assessment case (Azure not configured, no browser transcript)
      if (assessRes.data?.noAssessment) {
        setFeedbackData({
          tip: "I couldn't hear you! Check your microphone is allowed, then try again. 🎙️",
          source: 'fallback', provider: 'rules',
        });
        return;
      }

      // 3. Detect all-zeros: Azure ran but got silence/corrupt audio
      //    All 0% = recording failure, NOT actual pronunciation errors.
      //    Show a "couldn't hear" prompt rather than random coaching for random words.
      const allZero = wordScores.length > 0 && wordScores.every(w => w.score === 0);
      if (allZero) {
        setFeedbackData({
          tip: "Hmm, I couldn't catch that! Try speaking louder and closer to the microphone. 🎙️",
          source: 'fallback', provider: 'rules',
        });
        return;
      }

      // 4. Identify worst word for coaching
      const isRealAssessment = source === 'azure' || azureAssessed;
      const threshold = isRealAssessment ? 70 : 50;
      const poor = wordScores.filter(w => w.score < threshold);
      if (poor.length > 0) {
        const worst = [...poor].sort((a, b) => a.score - b.score)[0];
        const cleanWord = worst.word.replace(/[.,!?;:'"]/g, '');

        // Find the worst-scoring phoneme from Azure's phoneme-level data
        // This lets the static cache target the RIGHT sound, not just scan the spelling
        let worstPhoneme = null;
        if (worst.phonemes?.length > 0) {
          const lowestPhoneme = [...worst.phonemes].sort((a, b) => a.score - b.score)[0];
          if (lowestPhoneme.score < 60) worstPhoneme = lowestPhoneme.phoneme;
        }

        // Record the actual struggle for AI story personalisation
        if (child) {
          aiStoryAPI.struggles.record(child.id, {
            word:    cleanWord,
            phoneme: worstPhoneme,
          }).catch(() => {});
        }

        setLoadingFb(true); setFeedbackData(null);
        try {
          const fbRes = await aiAPI.feedback(
            cleanWord,
            page.text,
            child?.phase,
            worstPhoneme   // pass Azure's identified phoneme for precise static-cache lookup
          );
          if (fbRes.success) {
            setFeedbackData(fbRes.data);
            await speak(fbRes.data.tip);
          }
        } catch {
          const fb = { tip: `Try saying "${cleanWord}" slowly — one sound at a time! 🦉`, source: 'fallback', provider: 'rules' };
          setFeedbackData(fb); speak(fb.tip);
        } finally { setLoadingFb(false); }

      } else {
        // All words good — celebrate and advance
        setSessionAcorns(p => p + earnedThisPage);
        if (overallAccuracy === 100) { setConfetti(true); setTimeout(() => setConfetti(false), 3000); }
        const msg = overallAccuracy === 100 ? 'Perfect reading! Every single word! ⭐'
                  : overallAccuracy >= 80   ? 'Brilliant! Well done! 🌟'
                  : 'Great effort! Keep going! 💪';
        await speak(msg);

        // Show Next button — user taps when ready (don't auto-advance)
        setShowNextButton(true);

        // If last page, complete session in background now (result shown when user taps Next)
        if (pageIdx >= story.pages.length - 1 && sessionId && child) {
          progressAPI.completeSession(child.id, {
            sessionId, accuracy: overallAccuracy, acornsEarned: sessionAcorns + earnedThisPage,
          }).then(cRes => {
            if (cRes.success) {
              setNewAchievements(cRes.data.newAchievements || []);
              setStoryBonus(cRes.data.storyBonus || 0);
              setSessionAcorns(p => p + (cRes.data.storyBonus || 0));
              updateChildLocally({ acorns: cRes.data.child?.acorns, streak: cRes.data.child?.streak });
            }
          }).catch(() => {});
        }
      }
    } finally { setAssessing(false); }
  }, [page, pageIdx, story, sessionAcorns, sessionId, child, speak, updateChildLocally]);

  // ── MIC TOGGLE ─────────────────────────────────────────────
  // Captures BOTH:
  //  - Raw audio blob → sent to Azure for phoneme-level scoring (when key set)
  //  - Browser Web Speech transcript → used as fallback when Azure not configured
  const transcriptRef = useRef(null);

  const handleMic = async () => {
    if (isRecording) {
      // Prevent double-invocation from race between auto-stop and manual stop
      if (processingRef.current) return;
      processingRef.current = true;
      // Clear all auto-stop timers — user pressed stop manually (or auto-stop fired)
      isRecordingRef.current = false;
      clearInterval(recordingTimerRef.current);
      clearTimeout(autoStopTimerRef.current);
      clearInterval(recordingTimerRef._checkInterval);
      setRecordingSeconds(0);
      // Stop both simultaneously
      stopRec();
      const blob = await stopRecording();

      if (!blob || blob.size < 300) {
        setFeedbackData({ tip: "I couldn't hear anything — tap 🎙️ and try again!", source: 'fallback', provider: 'rules' });
        processingRef.current = false;
        return;
      }

      // Save blob URL for debug panel playback
      if (lastAudioUrl) URL.revokeObjectURL(lastAudioUrl);
      const audioUrl = URL.createObjectURL(blob);
      setLastAudioUrl(audioUrl);
      setLastAudioMime(blob.type);
      setLastAudioKB((blob.size / 1024).toFixed(1));

      // ── QUALITY GATE: wait for Web Speech transcript, then gate Azure ────
      // Web Speech API fired onresult ASYNCHRONOUSLY after stopRec().
      // We MUST await it — checking transcriptRef.current immediately after
      // stopRecording() is a race condition (it arrives 100-300ms later).
      const { text: browserText, confidence: browserConf, timedOut } = await waitForTranscript(2500);
      const browserHeard = browserText.trim().length > 0;

      if (!browserHeard) {
        setLocalTranscript('');
        setFeedbackData({
          tip: timedOut
            ? "Hmm, the microphone took too long to respond 🎙️ — try again!"
            : "Hmm, I didn't catch that! Try speaking a bit louder and closer to your microphone, then tap 🎙️ again.",
          source: 'fallback',
          provider: 'rules',
        });
        setLastDebug({ stage: 'no-speech', blobKB: (blob.size/1024).toFixed(1), mime: blob.type, browserText: timedOut ? '(timed out)' : '(empty)', ref: pageRef.current?.text });
        transcriptRef.current = null;
        processingRef.current = false;
        return;
      }

      // ── VALIDATE: ensure transcript is about the current page ────────────
      // Guard against stale transcripts (previous page's onresult firing late).
      // Check at least 1 content word (len > 2) overlaps between transcript and reference.
      const currentRef  = (pageRef.current?.text || '').toLowerCase().replace(/[.,!?]/g, '');
      const refWords    = new Set(currentRef.split(/\s+/).filter(w => w.length > 2));
      const heardWords  = browserText.toLowerCase().replace(/[.,!?]/g, '').split(/\s+/).filter(w => w.length > 2);
      const overlap     = heardWords.filter(w => refWords.has(w)).length;
      const overlapPct  = refWords.size > 0 ? overlap / refWords.size : 0;

      if (overlapPct === 0 && refWords.size > 2) {
        // Transcript shares zero content words with current page — likely stale
        console.warn('[Gate] Transcript appears stale — no overlap with current page. Discarding.');
        setLocalTranscript('');
        setFeedbackData({
          tip: "Let me listen again — tap 🎙️ and read the sentence on screen.",
          source: 'fallback',
          provider: 'rules',
        });
        transcriptRef.current = null;
        processingRef.current = false;
        return;
      }

      // ── GATE PASSED: browser confirmed speech about current page → Azure ──
      setLocalTranscript(browserText);
      setLocalConfidence(browserConf);
      transcriptRef.current = browserText;

      await processAudio(blob, browserText);
      transcriptRef.current = null;
      processingRef.current = false;
      return;
    }

    // ── START RECORDING ──────────────────────────────────────────────────────
    phonicsPlayingRef.current = false;
    window.speechSynthesis?.cancel();
    setSpeakingChunkKey(null);
    setSpeakingWordIdx(-1);

    // Reset all state
    setLocalTranscript('');
    setLocalConfidence(0);
    setRecordingSeconds(0);
    allWordsCapturedRef.current = false;
    transcriptRef.current = null;
    transcriptResolveRef.current?.({ text: '', confidence: 0, cancelled: true });
    transcriptResolveRef.current = null;

    // Clear any previous timers
    clearInterval(recordingTimerRef.current);
    clearTimeout(autoStopTimerRef.current);

    await startRecording();
    startRec((evt) => { /* state managed by isRecording */ });
    isRecordingRef.current = true;

    // ── COUNTDOWN TIMER (shows elapsed seconds in UI) ─────────────────
    let elapsed = 0;
    recordingTimerRef.current = setInterval(() => {
      elapsed++;
      setRecordingSeconds(elapsed);
    }, 1000);

    // ── AUTO-STOP: check if browser has captured all reference words ──
    // Poll every 400ms. If transcript covers all content words → auto-stop.
    const MAX_DURATION_MS = 15000;  // hard cap — never record more than 15s
    const refText    = pageRef.current?.text || '';
    const refWordSet = new Set(
      refText.toLowerCase().replace(/[.,!?;:'"]/g, '').split(/\s+/).filter(w => w.length > 1)
    );

    const checkAllWordsCaptured = setInterval(() => {
      const t = (transcriptRef.current || '').toLowerCase().replace(/[.,!?;:'"]/g, '');
      const heardSet = new Set(t.split(/\s+/).filter(w => w.length > 1));
      const covered  = [...refWordSet].filter(w => heardSet.has(w)).length;
      const pct      = refWordSet.size > 0 ? covered / refWordSet.size : 0;

      if (pct >= 0.85 && !allWordsCapturedRef.current) {
        allWordsCapturedRef.current = true;
        clearInterval(checkAllWordsCaptured);
        // Small grace period so the last word finishes speaking
        setTimeout(() => {
          if (isRecordingRef.current) handleMic();
        }, 600);
      }
    }, 400);

    // ── AUTO-STOP: hard timeout ───────────────────────────────────────
    autoStopTimerRef.current = setTimeout(() => {
      clearInterval(checkAllWordsCaptured);
      if (isRecordingRef.current) handleMic();
    }, MAX_DURATION_MS);

    // Store cleanup refs so the stop-branch can clear them
    recordingTimerRef._checkInterval = checkAllWordsCaptured;
  };

  // Clean up timers on unmount
  useEffect(() => () => {
    clearInterval(recordingTimerRef.current);
    clearTimeout(autoStopTimerRef.current);
    clearInterval(recordingTimerRef._checkInterval);
    transcriptResolveRef.current?.({ text: '', confidence: 0, cancelled: true });
  }, []);

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <Spinner size={40} /><p style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Loading story…</p>
    </div>
  );
  if (error) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24, textAlign: 'center' }}>
      <span style={{ fontSize: 56 }}>😕</span><h2>{error}</h2><Button onClick={() => nav('/home')}>← Back</Button>
    </div>
  );
  if (!page) return null;

  const dark = page.isDark;
  const textCol  = dark ? 'rgba(255,255,255,0.92)' : 'var(--text)';
  const mutedCol = dark ? 'var(--overlay-50)'  : 'var(--text-muted)';
  const words     = page.text.trim().split(/\s+/);
  // Last page of an AI story is the moral/lesson page — special gentle display
  const isMoralPage = isAiStory && story?.pages && pageIdx === story.pages.length - 1;
  const overallAcc = wordScores.length ? Math.round(wordScores.reduce((a, b) => a + b.score, 0) / wordScores.length) : null;

  return (
    <div className={page.bgClass} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', transition: 'background 0.5s' }}>
      <Confetti active={confetti} />

      {/* ── COMPLETION MODAL ── */}
      {showComplete && (
        <Modal onClose={() => {}}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 72, lineHeight: 1, marginBottom: 8 }}>🎉</div>
            <h2 style={{ fontSize: 26, fontWeight: 900, marginBottom: 4 }}>Story Complete!</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 15, marginBottom: 20 }}>You finished <strong>"{story.title}"</strong>!</p>
            <div style={{ background: 'var(--grad-goal)', borderRadius: 20, padding: '18px 24px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              <span style={{ fontSize: 48 }}>🌰</span>
              <div>
                <div style={{ fontSize: 38, fontWeight: 900, color: 'var(--text-warning-dark)' }}>+{sessionAcorns}</div>
                <div style={{ fontSize: 13, color: 'var(--color-accent-dark)', fontWeight: 700 }}>Golden Acorns earned!</div>
                {storyBonus > 0 && <div style={{ fontSize: 11, color: 'var(--color-accent-dark)' }}>includes +{storyBonus} story bonus 🌰</div>}
              </div>
            </div>
            {newAchievements.map(a => (
              <div key={a.id} className="animate-pop-in" style={{ background: 'var(--brand-accent-pale)', borderRadius: 16, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10, border: '1.5px solid var(--accent-30)' }}>
                <span style={{ fontSize: 28 }}>{a.emoji}</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 900, fontSize: 13, color: 'var(--text-warning-dark)' }}>🏆 New Achievement!</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-accent-dark)' }}>{a.title}</div>
                </div>
              </div>
            ))}
            <Button fullWidth onClick={async () => { stop(); await refreshProgress(); nav('/home'); }}>🌳 Back to the Forest</Button>
          </div>
        </Modal>
      )}

      {/* ── HEADER ── */}
      <div style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: dark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${dark ? 'var(--overlay-10)' : 'rgba(0,0,0,0.06)'}`, position: 'sticky', top: 0, zIndex: 20 }}>
        <button onClick={() => { stop(); nav('/home'); }} style={{ background: dark ? 'var(--overlay-12)' : 'rgba(0,0,0,0.07)', border: 'none', borderRadius: 50, width: 36, height: 36, fontSize: 17, cursor: 'pointer', color: textCol, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 900, fontSize: 14, color: textCol }}>{story.emoji} {story.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', marginTop: 4 }}>
            {story.pages.map((_, i) => (
              <div key={i} style={{
                height:     4,
                width:      i === pageIdx ? 20 : 7,
                borderRadius: 50,
                background: i === pageIdx
                  ? 'var(--color-accent)'
                  : i < pageIdx
                    ? 'var(--color-primary)'
                    : dark ? 'var(--overlay-20)' : 'rgba(0,0,0,0.12)',
                transition: 'all 0.3s',
              }} />
            ))}
          </div>
        </div>
        <AcornPill count={`+${sessionAcorns}`} />
      </div>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 18px 12px', maxWidth: 560, margin: '0 auto', width: '100%' }}>

        {/* Provider status chip — shows which scoring engine is active */}
        {providerInfo && (
          <div style={{ display: 'flex', gap: 5, marginBottom: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            {providerInfo.azure?.available
              ? <span style={{ fontSize: 11, background: 'var(--bg-info-light)', color: 'var(--color-info)', borderRadius: 50, padding: '3px 10px', fontWeight: 700 }}>☁️ Azure Pronunciation AI</span>
              : providerInfo.groq?.available
              ? <span style={{ fontSize: 11, background: 'var(--bg-primary-light)', color: 'var(--color-primary)', borderRadius: 50, padding: '3px 10px', fontWeight: 700 }}>🟢 Groq Whisper (free)</span>
              : <span style={{ fontSize: 11, background: 'var(--bg-warning-light)', color: 'var(--text-warning)', borderRadius: 50, padding: '3px 10px', fontWeight: 700 }}>📱 Browser only</span>
            }
            {providerInfo.gemini?.available && (
              <span style={{ fontSize: 11, background: 'var(--provider-gemini-bg)', color: 'var(--provider-gemini)', borderRadius: 50, padding: '3px 10px', fontWeight: 700 }}>♊ Gemini (free)</span>
            )}
            {providerInfo.groq?.available && (
              <span style={{ fontSize: 11, background: 'var(--brand-accent-pale)', color: 'var(--brand-pop1)', borderRadius: 50, padding: '3px 10px', fontWeight: 700 }}>⚡ Groq/Llama (free)</span>
            )}
            {!providerInfo.azure?.available && (
              <span style={{ fontSize: 11, background: 'var(--brand-accent-pale)', color: 'var(--text-warning-dark)', borderRadius: 50, padding: '3px 10px', fontWeight: 700 }}>📱 Browser STT mode</span>
            )}
          </div>
        )}

        <style>{`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: translateY(0);   }
          }
        `}</style>
        <div className="animate-float" style={{ fontSize: 72, lineHeight: 1, marginBottom: 20, textAlign: 'center' }}>{page.scene}</div>

        {/* ── PHONICS WORD DISPLAY ── */}
        {/* Before assessment: each word split into grapheme tiles with phoneme labels */}
        {/* After assessment:  each grapheme tile colour-coded green/amber/red by score */}
        <div style={{
          background: dark ? 'var(--overlay-10)' : 'white',
          backdropFilter: dark ? 'blur(10px)' : 'none',
          borderRadius: 24,
          padding: '28px 20px 20px',
          boxShadow: dark ? 'none' : 'var(--shadow-lg)',
          width: '100%', marginBottom: 16,
          border: dark ? '1px solid var(--overlay-15)' : '1px solid var(--border)',
          minHeight: 100, position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexWrap: 'wrap', gap: '20px 10px',
        }}>
          {wordScores.length === 0 && (
            <div style={{ position: 'absolute', top: 8, right: 12, display: 'flex', gap: 5, alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: dark ? 'var(--overlay-40)' : 'var(--text-muted)', fontWeight: 700 }}>PHONICS</span>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: 'var(--color-success)' }} />
              <span style={{ fontSize: 9, color: dark ? 'var(--overlay-40)' : 'var(--text-muted)' }}>known</span>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: 'var(--brand-pop1)' }} />
              <span style={{ fontSize: 9, color: dark ? 'var(--overlay-40)' : 'var(--text-muted)' }}>⭐ new</span>
            </div>
          )}
          {words.map((word, i) => (
            <PhonicsWord
              key={i}
              word={word}
              phase={child?.phase || 2}
              score={i < revealedCount && wordScores[i] ? wordScores[i].score : null}
              azurePhonemes={wordScores[i]?.phonemes || []}
              isSpeaking={i === speakingWordIdx}
              isRevealed={i < revealedCount && wordScores.length > 0}
              dark={dark}
              compact={words.length > 8}
              speakingChunkKey={speakingChunkKey}
              wordIdx={i}
              onChunkTap={!isRecording && !assessing ? handleChunkTap : null}
              onWordTap={!isRecording && !assessing ? handleWordTap : null}
              loadingChunkKey={loadingChunkKey}
            />
          ))}
        </div>

        {/* ── AZURE DETAILED SCORES ── */}
        {azureDetails && (
          <div className="animate-slide-up" style={{ width: '100%', marginBottom: 12, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
            {[
              { l: 'Accuracy', v: Math.round(wordScores.reduce((a, b) => a + b.score, 0) / wordScores.length || 0) },
              { l: 'Fluency', v: azureDetails.fluency },
              { l: 'Complete', v: azureDetails.completeness },
              { l: 'Prosody', v: azureDetails.prosody },
            ].map(({ l, v }) => (
              <div key={l} style={{ background: dark ? 'var(--overlay-10)' : 'white', borderRadius: 10, padding: '8px 6px', textAlign: 'center', boxShadow: dark ? 'none' : 'var(--shadow-sm)' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: v >= 80 ? 'var(--text-success)' : v >= 60 ? 'var(--color-accent-dark)' : 'var(--color-danger-dark)' }}>{v}<span style={{ fontSize: 10 }}>%</span></div>
                <div style={{ fontSize: 9, color: mutedCol, fontWeight: 700, marginTop: 1 }}>{l}</div>
              </div>
            ))}
          </div>
        )}

        {/* Simple accuracy bar (non-Azure mode) */}
        {overallAcc !== null && !azureDetails && (
          <div className="animate-slide-up" style={{ width: '100%', marginBottom: 12 }}>
            <ProgressBar value={overallAcc} max={100} height={7} showPct color={overallAcc >= 80 ? 'var(--color-success)' : overallAcc >= 60 ? 'var(--brand-accent)' : 'var(--color-danger)'} label="Accuracy" />
          </div>
        )}

        {/* ── MRS. OWL FEEDBACK ── */}
        {(feedbackData || loadingFb) && (
          <div className="animate-slide-down" style={{ background: dark ? 'var(--overlay-10)' : 'var(--grad-card-active)', backdropFilter: dark ? 'blur(10px)' : 'none', borderRadius: 20, padding: '14px 18px', width: '100%', marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 12, border: dark ? '1.5px solid var(--overlay-15)' : '2px solid var(--brand-primary-light)' }}>
            <span style={{ fontSize: 30, flexShrink: 0, lineHeight: 1 }}>🦉</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 10, letterSpacing: '0.5px', color: dark ? 'var(--overlay-50)' : 'var(--text-success-dark)', marginBottom: 4, display: 'flex', alignItems: 'center' }}>
                MRS. OWL SAYS:
                {feedbackData && <ProviderPill source={feedbackData.source} provider={feedbackData.provider} />}
              </div>
              {loadingFb
                ? <div style={{ display: 'flex', gap: 5 }}>{[0,1,2].map(j => <div key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-success)', animation: `float ${0.5+j*0.15}s ease-in-out infinite`, animationDelay: `${j*0.12}s` }} />)}</div>
                : <p style={{ fontSize: 14, fontWeight: 700, color: dark ? 'rgba(255,255,255,0.85)' : 'var(--text-success-dark)', lineHeight: 1.45, margin: 0 }}>{feedbackData?.tip}</p>}
            </div>
            {feedbackData && <button onClick={() => speak(feedbackData.tip)} style={{ background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', opacity: 0.7 }}>🔊</button>}
          </div>
        )}

        {/* Colour legend */}
        {wordScores.length > 0 && !feedbackData && !loadingFb && (
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 8 }}>
            {[{ c: 'var(--text-success)', l: 'Great!' }, { c: 'var(--color-accent-dark)', l: 'Almost' }, { c: 'var(--color-danger-dark)', l: 'Try again' }].map(({ c, l }) => (
              <span key={l} style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: c, display: 'inline-block' }} /> {l}
              </span>
            ))}
          </div>
        )}

        {/* Mic error */}
        {micError && <p style={{ color: 'var(--red)', fontWeight: 700, fontSize: 13, textAlign: 'center', background: 'var(--bg-danger-light)', borderRadius: 10, padding: '8px 14px', marginBottom: 8, width: '100%' }}>⚠️ {micError}</p>}

        {/* Moral page banner */}
        {isMoralPage && (
          <div style={{ width:'100%', background:'linear-gradient(135deg,var(--accent-12),var(--primary-12))', border:'1.5px solid var(--accent-30)', borderRadius:14, padding:'12px 16px', marginBottom:14, textAlign:'center' }}>
            <div style={{ fontSize:22, marginBottom:4 }}>🌟</div>
            <div style={{ fontSize:12, fontWeight:800, color:'var(--brand-accent)', letterSpacing:'0.5px', textTransform:'uppercase' }}>The Moral of the Story</div>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>Read this wise message together</div>
          </div>
        )}

        {/* Hear sentence */}
        {/* ── DEBUG PANEL — only shown when admin has enabled debug mode ── */}
        {debugMode && user?.isAdmin && (
          <div style={{ width:'100%', marginBottom:12 }}>
            <details style={{ background:'rgba(245,158,11,0.08)', border:'1.5px solid var(--accent-30)', borderRadius:12, padding:'10px 14px' }}>
              <summary style={{ cursor:'pointer', fontSize:12, fontWeight:700, color:'var(--brand-accent)', userSelect:'none' }}>
                🐛 Debug — Azure Pronunciation Assessment {debugInfo ? '(data received)' : '(waiting for assessment…)'}
              </summary>
              {debugInfo ? (
                <div style={{ marginTop:10, fontSize:11, fontFamily:'monospace' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                    <div style={{ background:'var(--dark-20)', borderRadius:6, padding:'8px 10px' }}>
                      <div style={{ color:'var(--brand-primary-light)', fontWeight:700, marginBottom:4 }}>REQUEST</div>
                      <div style={{ color:'var(--overlay-70)', lineHeight:1.8 }}>
                        <div>Audio: {debugInfo.audioSizeKb} KB ({debugInfo.audioMime})</div>
                        <div>Original ref: "{debugInfo.originalRefText}"</div>
                        {debugInfo.sanitisedRefText !== debugInfo.originalRefText && (
                          <div style={{ color:'var(--color-accent)' }}>Sent to Azure: "{debugInfo.sanitisedRefText}"</div>
                        )}
                        {debugInfo.properNounsReplaced?.length > 0 && (
                          <div style={{ color:'var(--brand-primary-light)' }}>
                            Proper nouns (phonetic): {debugInfo.properNounsReplaced.join(' | ')}
                          </div>
                        )}
                        <div>Region: {debugInfo.endpoint?.split('.')[0]?.replace('https://', '')}</div>
                        <div>Time: {debugInfo.requestedAt}</div>
                        <div style={{ marginTop:6, color:'var(--debug-text)' }}>Pronunciation Config:</div>
                        <pre style={{ margin:0, color:'var(--debug-text)', whiteSpace:'pre-wrap', wordBreak:'break-all' }}>
                          {JSON.stringify(debugInfo.pronConfig, null, 2)}
                        </pre>
                      </div>
                    </div>
                    <div style={{ background:'var(--dark-20)', borderRadius:6, padding:'8px 10px' }}>
                      <div style={{ color:'var(--brand-primary-light)', fontWeight:700, marginBottom:4 }}>RESPONSE — NBest[0]</div>
                      <div style={{ color:'var(--overlay-70)', lineHeight:1.8 }}>
                        {debugInfo.azureRawResponse?.NBest?.[0] ? (
                          <>
                            <div>RecognizedText: "{debugInfo.azureRawResponse.NBest[0].Display}"</div>
                            <div>Accuracy: {debugInfo.azureRawResponse.NBest[0].PronunciationAssessment?.AccuracyScore}%</div>
                            <div>Fluency: {debugInfo.azureRawResponse.NBest[0].PronunciationAssessment?.FluencyScore}%</div>
                            <div style={{ marginTop:6, color:'var(--danger-light)' }}>Raw Words ({debugInfo.azureRawResponse.NBest[0].Words?.length}):</div>
                            <div style={{ maxHeight:180, overflow:'auto' }}>
                              {debugInfo.azureRawResponse.NBest[0].Words?.map((w, i) => (
                                <div key={i} style={{ color: w.PronunciationAssessment?.ErrorType === 'Insertion' ? 'var(--text-light)' : w.PronunciationAssessment?.AccuracyScore < 60 ? 'var(--danger-light)' : 'var(--brand-primary-light)', marginBottom:2 }}>
                                  [{w.PronunciationAssessment?.ErrorType || 'None'}] "{w.Word}" → {Math.round(w.PronunciationAssessment?.AccuracyScore ?? 0)}%
                                  {w.PronunciationAssessment?.ErrorType === 'Insertion' ? ' (extra — filtered)' : ''}
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <pre style={{ margin:0, color:'var(--danger-light)', whiteSpace:'pre-wrap', wordBreak:'break-all', maxHeight:200, overflow:'auto' }}>
                            {JSON.stringify(debugInfo.azureRawResponse, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop:8, color:'var(--overlay-40)', fontSize:11 }}>Record your voice to see Azure API data here.</div>
              )}
            </details>
          </div>
        )}

        {wordScores.length === 0 && !isRecording && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 8 }}>

            {/* Toggle: Sentence mode vs Phonics mode */}
            <div style={{ display: 'flex', background: dark ? 'var(--overlay-12)' : 'var(--bg-subtle)', borderRadius: 50, padding: 3, gap: 2 }}>
              <button
                onClick={() => setPhonicsHearMode(false)}
                style={{ borderRadius: 50, padding: '4px 14px', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 11, background: !phonicsHearMode ? 'var(--grad-primary)' : 'transparent', color: !phonicsHearMode ? 'white' : (dark ? 'var(--overlay-50)' : 'var(--text-muted)'), transition: 'all 0.2s' }}>
                🔊 Full Sentence
              </button>
              <button
                onClick={() => setPhonicsHearMode(true)}
                style={{ borderRadius: 50, padding: '4px 14px', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 11, background: phonicsHearMode ? 'var(--grad-primary)' : 'transparent', color: phonicsHearMode ? 'white' : (dark ? 'var(--overlay-50)' : 'var(--text-muted)'), transition: 'all 0.2s' }}>
                🔤 Phonics Sounds
              </button>
            </div>

            {/* Mode description */}
            <div style={{ fontSize: 11, color: dark ? 'var(--overlay-40)' : 'var(--text-muted)', textAlign: 'center' }}>
              {phonicsHearMode
                ? 'Each sound played one by one — watch the tiles light up!'
                : 'Listen to the full sentence, then try reading it yourself'}
            </div>

            {/* The hear button */}
            <button
              onClick={() => {
                if (phonicsHearMode) {
                  speakPhonics();
                } else {
                  // Use onboundary for precise word sync — highlights fire when TTS actually speaks each word
                  speak(page.text, {
                    onWordIdx: (wi) => setSpeakingWordIdx(wi),
                  });
                }
              }}
              style={{
                background: phonicsHearMode ? 'var(--grad-accent)' : 'var(--primary-10)',
                border: `1.5px solid ${phonicsHearMode ? 'var(--brand-accent)' : 'var(--primary-25)'}`,
                borderRadius: 50, padding: '8px 22px',
                color: phonicsHearMode ? '#fff' : 'var(--color-info)',
                fontWeight: 800, fontSize: 13, cursor: 'pointer',
                fontFamily: 'var(--font-body)',
                boxShadow: phonicsHearMode ? 'var(--shadow-accent)' : 'none',
                transition: 'all 0.2s',
              }}>
              {phonicsHearMode ? '🔤 Hear the Phonics Sounds' : '🔊 Hear the Sentence First'}
            </button>
          </div>
        )}
      </div>

      {/* ── DEBUG PANEL (always visible, full detail when debugMode on) ── */}
      {lastDebug && (
        <div style={{ margin: '0 0 8px', borderRadius: 14, overflow: 'hidden', border: `1.5px solid ${lastDebug.overallAccuracy > 0 ? 'var(--color-success)' : 'var(--color-danger)'}`, fontSize: 11 }}>
          <button
            onClick={() => setShowDebug(v => !v)}
            style={{ width: '100%', padding: '8px 14px', background: lastDebug.overallAccuracy > 0 ? 'var(--bg-success-light)' : 'var(--bg-danger-muted)', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 11 }}>
            <span>
              {lastDebug.wrongSentence ? '⚠️ WRONG SENTENCE' : lastDebug.overallAccuracy > 0 ? '✅' : '❌'} {lastDebug.overallAccuracy ?? '?'}% · {lastDebug.azureAssessed ? '☁️ Azure' : lastDebug.groqAssessed ? '🟢 Groq' : `Source: ${lastDebug.source || '?'}`} · Audio: {lastDebug.audioKB || lastDebug.blobKB || '?'}KB · PA: {lastDebug.nBestPAPresent ? '✅ present' : '❌ MISSING'}
              {lastDebug.wrongSentence && <span style={{ color: '#FCA5A5' }}> · Similarity: {lastDebug.sentenceSimilarity}%</span>}
            </span>
            <span style={{ whiteSpace: 'nowrap', marginLeft: 8 }}>{showDebug ? '▲' : '▼'} {debugMode ? 'Full Debug' : 'Details'}</span>
          </button>
          {showDebug && (() => {
            const nb   = lastDebug.responseBody?.NBest?.[0] || lastDebug.azureRawResponse?.NBest?.[0];
            const pa   = nb?.PronunciationAssessment;
            const w0   = nb?.Words?.[0];
            const w0pa = w0?.PronunciationAssessment;
            return (
              <div style={{ background: '#0B0F1A', color: '#93C5FD', fontFamily: 'monospace', fontSize: 10, maxHeight: 520, overflowY: 'auto' }}>

                {/* ── SECTION: RESULT SUMMARY ── */}
                <Section label="ASSESSMENT RESULT" color="#FCD34D">
                  <Row label="status"       val={`${lastDebug.overallAccuracy > 0 ? '✅' : '❌'} ${lastDebug.overallAccuracy ?? '?'}%`} ok={lastDebug.overallAccuracy > 0} />
                  <Row label="source"       val={lastDebug.source || lastDebug.stage || '?'} />
                  <Row label="azureAssessed" val={String(lastDebug.azureAssessed)} ok={lastDebug.azureAssessed} />
                  <Row label="browser heard" val={`"${localTranscript || '(nothing)'}"`} ok={!!localTranscript} critical={!localTranscript} />
                  <Row label="azure heard"   val={`"${lastDebug.displayText || nb?.Display || nb?.Lexical || '(nothing)'}"`} ok={!!(lastDebug.displayText || nb?.Display)} />
                  <Row label="reference (sent to backend)" val={`"${lastDebug.referenceText || lastDebug.refText || lastDebug.sanitised || page?.text}"`} ok={!!lastDebug.referenceText} critical={!lastDebug.referenceText} />
                  <Row label="current page.text"     val={`"${page?.text}"`} ok={page?.text === (lastDebug.referenceText || lastDebug.refText)} critical={page?.text !== (lastDebug.referenceText || lastDebug.refText)} />
                  <Row label="recognitionStatus" val={lastDebug.recognitionStatus || nb?.RecognitionStatus || lastDebug.responseBody?.RecognitionStatus || '?'} ok={lastDebug.recognitionStatus === 'Success'} />
                  {lastDebug.wrongSentence && <Row label="⚠️ WRONG SENTENCE" val={`Similarity ${lastDebug.sentenceSimilarity}% — child read a different sentence`} critical />}
                  <Row label="PA present"   val={String(!!pa)} ok={!!pa} critical={!pa} />
                  {pa && <>
                    <Row label="AccuracyScore"    val={pa.AccuracyScore} ok={pa.AccuracyScore > 0} />
                    <Row label="FluencyScore"     val={pa.FluencyScore} />
                    <Row label="CompletenessScore" val={pa.CompletenessScore} />
                    <Row label="ProsodyScore"     val={pa.PronScore} />
                  </>}
                </Section>

                {/* ── SECTION: REQUEST HEADERS ── */}
                {debugMode && lastDebug.requestHeaders && (
                  <Section label="REQUEST HEADERS" color="#A78BFA">
                    <Row label="URL"          val={lastDebug.requestUrl} />
                    <Row label="Content-Type" val={lastDebug.requestHeaders['Content-Type']} ok={lastDebug.requestHeaders['Content-Type']?.includes('samplerate')} critical={!lastDebug.requestHeaders['Content-Type']?.includes('samplerate')} />
                    <Row label="API Key"      val={lastDebug.requestHeaders['Ocp-Apim-Subscription-Key']} ok={!!lastDebug.requestHeaders['Ocp-Apim-Subscription-Key']} />
                    <Row label="PA Header len" val={lastDebug.pronConfigB64Length} ok={lastDebug.pronConfigB64Length > 10} />
                    <Row label="PA Header hasNewline" val={String(lastDebug.pronConfigB64HasNewline)} ok={!lastDebug.pronConfigB64HasNewline} critical={lastDebug.pronConfigB64HasNewline} />
                    {lastDebug.requestHeaders['Pronunciation-Assessment'] && (
                      <div style={{ padding: '2px 12px', wordBreak: 'break-all', color: '#C4B5FD', opacity: 0.7 }}>
                        Pronunciation-Assessment: {lastDebug.requestHeaders['Pronunciation-Assessment']}
                      </div>
                    )}
                  </Section>
                )}

                {/* ── SECTION: PRON CONFIG DECODED ── */}
                {debugMode && lastDebug.pronConfigDecoded && (
                  <Section label="PRONUNCIATION CONFIG (decoded)" color="#6EE7B7">
                    <div style={{ padding: '4px 12px', whiteSpace: 'pre', color: '#6EE7B7' }}>
                      {JSON.stringify(lastDebug.pronConfigDecoded, null, 2)}
                    </div>
                  </Section>
                )}

                {/* ── SECTION: RESPONSE HEADERS ── */}
                {debugMode && lastDebug.responseHeaders && (
                  <Section label="RESPONSE HEADERS" color="#FBBF24">
                    <Row label="HTTP Status" val={lastDebug.responseStatus} ok={lastDebug.responseStatus === 200} />
                    {Object.entries(lastDebug.responseHeaders).map(([k, v]) => (
                      <Row key={k} label={k} val={v} />
                    ))}
                  </Section>
                )}

                {/* ── SECTION: FULL RESPONSE BODY ── */}
                <Section label={debugMode ? 'FULL RESPONSE BODY (Azure JSON)' : 'AZURE RESPONSE'} color="#FB923C">
                  <Row label="RecognitionStatus" val={lastDebug.responseBody?.RecognitionStatus} ok={lastDebug.responseBody?.RecognitionStatus === 'Success'} />
                  <Row label="DisplayText"       val={`"${lastDebug.responseBody?.DisplayText || ''}"`} />
                  <Row label="NBest[0].PA present" val={String(!!pa)} ok={!!pa} critical={!pa} />
                  {w0 && <>
                    <Row label={`Words[0] "${w0.Word}"`} val={w0pa ? `score=${w0pa.AccuracyScore} err=${w0pa.ErrorType}` : '❌ NO PronunciationAssessment'} ok={!!w0pa} critical={!w0pa} />
                    {w0.Phonemes?.length > 0 && <Row label="Phonemes count" val={w0.Phonemes.length} ok />}
                  </>}
                  {debugMode && (
                    <div style={{ padding: '4px 12px', whiteSpace: 'pre', wordBreak: 'break-all', color: '#FED7AA', opacity: 0.85, maxHeight: 200, overflowY: 'auto' }}>
                      {JSON.stringify(lastDebug.responseBody || lastDebug.azureRawResponse, null, 2)}
                    </div>
                  )}
                </Section>

                {/* ── SECTION: AUDIO ── */}
                {/* ── SDK LOG ── */}
                {sdkLog.length > 0 && (
                  <Section label="AZURE SPEECH SDK LOG" color="#A78BFA">
                    {sdkLog.map((l, i) => (
                      <div key={i} style={{ padding: '1px 12px', fontFamily: 'monospace', fontSize: 10, color: l.startsWith('✅') ? '#6EE7B7' : l.startsWith('❌') ? '#FCA5A5' : '#C4B5FD' }}>{l}</div>
                    ))}
                  </Section>
                )}

                <Section label="AUDIO" color="#34D399">
                  <Row label="sent to Azure" val={`${lastDebug.audioKB} KB`} ok={parseFloat(lastDebug.audioKB) > 2} critical={parseFloat(lastDebug.audioKB) < 2} />
                  <Row label="converted (ffmpeg)" val={String(lastDebug.converted)} ok={lastDebug.converted} />
                  <Row label="mime in"       val={lastDebug.mimeIn} />
                  <Row label="recorded"      val={lastAudioKB ? `${lastAudioKB} KB (${lastAudioMime?.split(';')[0]})` : '—'} />
                </Section>

                {/* ── SECTION: RECORDED AUDIO PLAYER ── */}
                {lastAudioUrl && (
                  <Section label="RECORDED AUDIO — PLAYBACK & DOWNLOAD" color="#FB923C">
                    <div style={{ padding: '8px 12px' }}>
                      {/* Native HTML5 audio player */}
                      <audio
                        controls
                        src={lastAudioUrl}
                        style={{ width: '100%', height: 36, borderRadius: 8, outline: 'none', filter: 'invert(1) hue-rotate(180deg)' }}
                      />
                      <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                        {/* Download raw recorded file */}
                        <a
                          href={lastAudioUrl}
                          download={`properly-recording-${Date.now()}.webm`}
                          style={{ background: '#1E293B', color: '#93C5FD', borderRadius: 6, padding: '4px 12px', fontSize: 10, fontWeight: 700, textDecoration: 'none', fontFamily: 'monospace', border: '1px solid #334155', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          ⬇ Download ({lastAudioMime?.split(';')[0] || 'webm'}, {lastAudioKB}KB)
                        </a>
                        {/* Info about the file */}
                        <span style={{ fontSize: 9, color: '#64748B', alignSelf: 'center', fontFamily: 'monospace' }}>
                          This is what was sent to ffmpeg → Azure. If it plays correctly here, the mic recording worked.
                        </span>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 9, color: '#475569', fontFamily: 'monospace' }}>
                        💡 Play this back — if you can hear your voice clearly, ffmpeg conversion is the potential issue.{' '}
                        If silent/garbled, the browser microphone capture failed.
                      </div>
                    </div>
                  </Section>
                )}

                {/* ── SECTION: WORD SCORES ── */}
                {lastDebug.wordScores?.length > 0 && (
                  <Section label="WORD SCORES" color="#60A5FA">
                    {lastDebug.wordScores.map((w, i) => (
                      <div key={i} style={{ padding: '2px 12px', color: w.score >= 70 ? '#6EE7B7' : w.score >= 40 ? '#FCD34D' : '#FCA5A5' }}>
                        {w.score >= 70 ? '✅' : w.score >= 40 ? '⚠️' : '❌'} "{w.word}": {w.score}% ({w.errorType})
                        {w.phonemes?.length > 0 && <span style={{ color: '#94A3B8', marginLeft: 6 }}>
                          [{w.phonemes.map(p => `${p.phoneme}:${p.score}%`).join(' ')}]
                        </span>}
                      </div>
                    ))}
                  </Section>
                )}

                {/* ── SECTION: PROPER NOUNS ── */}
                {lastDebug.properNouns?.length > 0 && (
                  <Section label="PROPER NOUNS" color="#F472B6">
                    {lastDebug.properNouns.map((p, i) => <div key={i} style={{ padding: '2px 12px' }}>{p}</div>)}
                  </Section>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── PHONEME TTS DEBUG PANEL ── */}
      {(phonemeDebugLog.length > 0 || showPhonemeDebug) && (
        <div style={{ margin: '0 0 8px', borderRadius: 14, overflow: 'hidden', border: '1.5px solid var(--brand-accent)', fontSize: 11 }}>
          <button
            onClick={() => setShowPhonemeDebug(v => !v)}
            style={{ width: '100%', padding: '7px 14px', background: 'rgba(251,191,36,0.12)', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 11 }}>
            <span>
              🔤 Phoneme Debug — {phonemeDebugLog.length} calls
              {(() => {
                const stats = getCacheStats();
                return <span style={{ fontWeight: 400, color: stats.inMemory >= 30 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  {' '}· Cache: {stats.inMemory}/{stats.total} loaded
                  {stats.generatedAt ? ` · built ${new Date(stats.generatedAt).toLocaleDateString()}` : ' · NOT preloaded'}
                </span>;
              })()}
            </span>
            <span>{showPhonemeDebug ? '▲' : '▼'}</span>
          </button>

          {showPhonemeDebug && (
            <div style={{ background: '#0B0F1A', padding: '8px 0', maxHeight: 300, overflowY: 'auto' }}>
              {/* Header row */}
              <div style={{ display: 'grid', gridTemplateColumns: '60px 60px 90px 1fr 50px', gap: 4, padding: '2px 12px 6px', borderBottom: '1px solid rgba(255,255,255,0.08)', fontFamily: 'monospace', fontSize: 9, color: '#FCD34D', fontWeight: 700 }}>
                <span>IPA</span><span>grapheme</span><span>method</span><span>status</span><span>ms</span>
              </div>
              {phonemeDebugLog.length === 0 ? (
                <div style={{ padding: '10px 12px', color: '#64748B', fontFamily: 'monospace', fontSize: 10 }}>
                  No phoneme calls yet — tap "🔤 Hear the Phonics Sounds" to test
                </div>
              ) : phonemeDebugLog.map((entry, i) => (
                <div key={i} style={{ padding: '3px 12px', fontFamily: 'monospace', fontSize: 10, borderBottom: '1px solid rgba(255,255,255,0.04)', color: entry.status?.startsWith('✅') ? '#6EE7B7' : entry.status?.startsWith('❌') ? '#FCA5A5' : '#93C5FD' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '60px 60px 90px 1fr 50px', gap: 4 }}>
                    <span style={{ fontWeight: 700 }}>/{entry.ipa}/</span>
                    <span style={{ color: '#FCD34D' }}>{entry.grapheme}</span>
                    <span style={{ color:
                        entry.method === 'azure-api'     ? '#A78BFA' :
                        entry.method === 'session-cache' ? '#34D399'  :
                        entry.method === 'preload-cache' ? '#34D399'  :
                        entry.method === 'preload-retry' ? '#FCD34D'  :
                        entry.method === 'web-speech'    ? '#F97316'  : '#94A3B8' }}>
                      {entry.method === 'azure-api'     ? '☁️ Azure'     :
                       entry.method === 'session-cache' ? '⚡ session'   :
                       entry.method === 'preload-cache' ? '💾 preloaded' :
                       entry.method === 'preload-retry' ? '🔄 re-fetch'  :
                       entry.method === 'web-speech'    ? '📱 WebSpeech' : entry.method}
                    </span>
                    <span style={{ wordBreak: 'break-all' }}>{entry.status}</span>
                    <span style={{ color: '#64748B', textAlign: 'right' }}>{entry.ms > 0 ? `${entry.ms}ms` : '—'}</span>
                  </div>
                  {entry.endpoint && (
                    <div style={{ color: '#475569', fontSize: 9, marginTop: 1, wordBreak: 'break-all' }}>
                      → {entry.endpoint}
                    </div>
                  )}
                </div>
              ))}
              {/* Summary */}
              {phonemeDebugLog.length > 0 && (() => {
                const azureCalls  = phonemeDebugLog.filter(l => l.method === 'azure-api');
                const azureOk     = azureCalls.filter(l => l.status?.startsWith('✅'));
                const azureFail   = azureCalls.filter(l => l.status?.startsWith('❌'));
                const webSpeech   = phonemeDebugLog.filter(l => l.method === 'web-speech');
                const preloaded   = phonemeDebugLog.filter(l => l.method === 'preload-cache' || l.method === 'session-cache');
                const avgMs       = azureOk.length ? Math.round(azureOk.reduce((a,b)=>a+(b.ms||0),0)/azureOk.length) : 0;
                return (
                  <div style={{ padding: '6px 12px', borderTop: '1px solid rgba(255,255,255,0.1)', fontFamily: 'monospace', fontSize: 10, color: '#94A3B8', marginTop: 4 }}>
                    ⚡/💾 Instant (preloaded/session): {preloaded.length}
                    {' · '}☁️ Azure API: {azureOk.length} ok / {azureFail.length} failed{azureOk.length ? ` (avg ${avgMs}ms)` : ''}
                    {' · '}📱 Web Speech fallback: {webSpeech.length}
                    {azureFail.length > 0 && (
                      <div style={{ color: '#FCA5A5', marginTop: 4 }}>
                        ❌ First error: {azureFail[azureFail.length-1]?.status}
                      </div>
                    )}
                    <button onClick={() => setPhonemeDebugLog([])} style={{ float: 'right', background: 'none', border: '1px solid #334155', borderRadius: 4, color: '#64748B', cursor: 'pointer', fontSize: 9, padding: '1px 6px' }}>Clear</button>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* ── MIC CONTROLS ── */}
      <div style={{ padding: '12px 18px 32px', textAlign: 'center', background: dark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.82)', backdropFilter: 'blur(10px)', borderTop: `1px solid ${dark ? 'var(--overlay-8)' : 'rgba(0,0,0,0.06)'}`, position: 'sticky', bottom: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            {isRecording && <>
              <div style={{ position: 'absolute', inset: -10, borderRadius: '50%', border: '3px solid rgba(239,68,68,0.4)', animation: 'pulseRing 1s ease-out infinite' }} />
              <div style={{ position: 'absolute', inset: -20, borderRadius: '50%', border: '2px solid rgba(239,68,68,0.2)', animation: 'pulseRing 1s ease-out infinite', animationDelay: '0.3s' }} />
            </>}
            <button onClick={handleMic} disabled={assessing}
              className={isRecording ? 'animate-breathe' : ''}
              style={{ width: 78, height: 78, borderRadius: '50%', border: 'none', background: assessing ? 'var(--text-light)' : isRecording ? 'var(--grad-danger)' : 'var(--grad-primary)', color: 'white', fontSize: 30, cursor: assessing ? 'default' : 'pointer', boxShadow: isRecording ? 'var(--shadow-danger)' : assessing ? 'none' : '0 8px 28px rgba(124,58,237,0.5)', transition: 'all 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {assessing ? <Spinner size={28} color="white" /> : isRecording ? '⏹' : '🎙️'}
            </button>
          </div>
        </div>
        {/* Recording progress bar — fills red as time runs out */}
        {isRecording && (
          <div style={{ width: '100%', maxWidth: 280, height: 4, background: 'var(--overlay-8)', borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, (recordingSeconds / 15) * 100)}%`,
              background: recordingSeconds >= 12
                ? 'linear-gradient(90deg, var(--color-warning), var(--color-danger))'
                : 'linear-gradient(90deg, var(--color-primary), var(--color-info))',
              borderRadius: 2,
              transition: 'width 1s linear, background 0.3s',
            }} />
          </div>
        )}

        <p style={{ fontSize: 13, fontWeight: 700, color: dark ? 'var(--overlay-60)' : 'var(--text-muted)' }}>
          {assessing
            ? (localTranscript
                ? <>⚙️ Scoring… I heard: <em>"{localTranscript}"</em></>
                : '⚙️ Analysing your reading…')
            : isRecording
            ? <span style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                <span>🔴 Recording…</span>
                <span style={{
                  background: recordingSeconds >= 12 ? 'var(--color-danger)' : 'var(--overlay-12)',
                  color: recordingSeconds >= 12 ? 'white' : 'var(--text-muted)',
                  borderRadius: 50, padding: '1px 8px', fontSize: 11, fontWeight: 800,
                  transition: 'all 0.3s',
                }}>{recordingSeconds}s</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                  {recordingSeconds >= 12 ? '⚠️ stopping soon…' : 'tap ⏹ to stop'}
                </span>
              </span>
            : 'Tap 🎙️ and read the sentence aloud!'}
        </p>
        <p style={{ fontSize: 11, color: dark ? 'var(--overlay-25)' : 'var(--border-2)', marginTop: 2 }}>
          {scoringMode === 'azure'
            ? '☁️ Azure Pronunciation Assessment — phoneme-level scoring'
            : scoringMode === 'groq-whisper'
            ? '🟢 Groq Whisper — word-level scoring (free)'
            : scoringMode === 'text-comparison'
            ? '📱 Browser speech — basic word matching'
            : providerInfo?.azure?.available || providerInfo?.groq?.available
            ? 'Ready — tap 🎙️ to record'
            : '⚠️ Add AZURE_SPEECH_KEY or GROQ_API_KEY for phonics scoring'}
        </p>

        {/* ── PAGE NAVIGATION ────────────────────────────────── */}
        {/* ── NEXT PAGE PROMPT — shown after successful reading ── */}
        {showNextButton && (
          <div style={{ padding: '10px 18px 4px', display: 'flex', justifyContent: 'center' }}>
            {pageIdx < (story?.pages?.length ?? 1) - 1 ? (
              <button
                onClick={() => { setShowNextButton(false); stop(); setPageIdx(p => p + 1); }}
                style={{
                  background: 'var(--grad-primary)', color: 'white', border: 'none',
                  borderRadius: 50, padding: '10px 28px', fontFamily: 'var(--font-body)',
                  fontWeight: 800, fontSize: 15, cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(124,58,237,0.45)',
                  display: 'flex', alignItems: 'center', gap: 8,
                  animation: 'fadeInUp 0.4s ease',
                }}>
                Next Page ➡️
              </button>
            ) : (
              <button
                onClick={async () => {
                  setShowNextButton(false);
                  await speak(`Amazing! You finished ${story?.title}!`, {});
                  setTimeout(() => setShowComplete(true), 700);
                }}
                style={{
                  background: 'var(--grad-accent)', color: 'white', border: 'none',
                  borderRadius: 50, padding: '10px 28px', fontFamily: 'var(--font-body)',
                  fontWeight: 800, fontSize: 15, cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(251,191,36,0.5)',
                  display: 'flex', alignItems: 'center', gap: 8,
                  animation: 'fadeInUp 0.4s ease',
                }}>
                🎉 Finish Story!
              </button>
            )}
          </div>
        )}

        {/* Page dot strip — tap any dot to jump directly to that page */}
        <div style={{ width: '100%', marginTop: 14 }}>
          {/* Clickable page dots — each shows completion state */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {story.pages.map((p, i) => {
              const isActive    = i === pageIdx;
              const isCompleted = i < pageIdx;                 // visited pages
              const isMoral     = isAiStory && i === story.pages.length - 1;
              return (
                <button
                  key={i}
                  onClick={() => { if (!assessing && !isRecording) { stop(); setPageIdx(i); } }}
                  disabled={assessing || isRecording}
                  title={`Page ${i + 1}${isCompleted ? ' ✓' : ''}`}
                  style={{
                    width:        isActive ? 32 : 10,
                    height:       10,
                    borderRadius: 50,
                    border:       'none',
                    cursor:       assessing || isRecording ? 'default' : 'pointer',
                    background:   isActive
                      ? 'var(--color-accent)'
                      : isCompleted
                        ? 'var(--color-primary)'
                        : dark ? 'var(--overlay-20)' : 'var(--border)',
                    opacity:      assessing || isRecording ? 0.5 : 1,
                    transition:   'all 0.25s ease',
                    padding:      0,
                  }}
                />
              );
            })}
          </div>

          {/* Previous / counter / next row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <button
              onClick={() => { stop(); setPageIdx(p => Math.max(0, p - 1)); }}
              disabled={pageIdx === 0 || assessing || isRecording}
              style={{
                background:   pageIdx === 0 ? 'transparent' : (dark ? 'var(--overlay-10)' : 'var(--bg-subtle)'),
                border:       `1.5px solid ${pageIdx === 0 ? (dark ? 'var(--overlay-10)' : 'var(--border)') : (dark ? 'var(--overlay-25)' : 'var(--border-2)')}`,
                borderRadius: 50, width: 38, height: 38, fontSize: 18,
                cursor:       pageIdx === 0 || assessing || isRecording ? 'default' : 'pointer',
                color:        pageIdx === 0 ? (dark ? 'var(--overlay-20)' : 'var(--border-2)') : (dark ? 'var(--overlay-80)' : 'var(--text)'),
                display:      'flex', alignItems: 'center', justifyContent: 'center',
                transition:   'all 0.2s',
              }}>
              ‹
            </button>

            <div style={{ textAlign: 'center', minWidth: 90 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: dark ? 'var(--overlay-80)' : 'var(--text)' }}>
                Page {pageIdx + 1} <span style={{ fontWeight: 400, color: dark ? 'var(--overlay-45)' : 'var(--text-muted)' }}>of {story.pages.length}</span>
              </div>
              {/* Show score for current page if assessed */}
              {overallAcc !== null && (
                <div style={{
                  fontSize: 11, fontWeight: 700, marginTop: 2,
                  color: overallAcc >= 80 ? 'var(--text-success)' : overallAcc >= 55 ? 'var(--color-accent-dark)' : 'var(--color-danger)',
                }}>
                  {overallAcc >= 80 ? '⭐' : overallAcc >= 55 ? '👍' : '🔄'} {overallAcc}% this page
                </div>
              )}
            </div>

            <button
              onClick={() => {
                stop();
                if (story && pageIdx < story.pages.length - 1) {
                  setPageIdx(p => p + 1);
                } else if (story && pageIdx === story.pages.length - 1) {
                  nav('/home');
                }
              }}
              disabled={assessing || isRecording}
              style={{
                background:   dark ? 'var(--overlay-10)' : 'var(--bg-subtle)',
                border:       `1.5px solid ${dark ? 'var(--overlay-25)' : 'var(--border-2)'}`,
                borderRadius: 50, width: 38, height: 38, fontSize: 18,
                cursor:       assessing || isRecording ? 'default' : 'pointer',
                color:        dark ? 'var(--overlay-80)' : 'var(--text)',
                display:      'flex', alignItems: 'center', justifyContent: 'center',
                transition:   'all 0.2s',
              }}>
              {story && pageIdx === story.pages.length - 1 ? '🏠' : '›'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
