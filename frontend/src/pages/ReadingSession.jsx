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
  const triesRef = useRef(0);

  const { startRecording, stopRecording, isRecording, error: micError } = useAudioRecorder();

  // Browser speech recognition — captures transcript alongside audio
  // Used as fallback scoring when Azure is not configured
  const { start: startRec, stop: stopRec } = useSpeechRecognition({
    onResult: (text) => { transcriptRef.current = text; },
    onError:  () => {},
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
  useEffect(() => { setWordScores([]); setFeedbackData(null); setAzureDetails(null); setDebugInfo(null); triesRef.current = 0; setSpeakingWordIdx(-1); setRevealedCount(0); }, [pageIdx]);

  const page = story?.pages?.[pageIdx];

  // ── CLOUD ASSESSMENT PIPELINE ──────────────────────────────
  const processAudio = useCallback(async (audioBlob, browserTranscript) => {
    if (!page) return;
    setAssessing(true);
    triesRef.current++;

    try {
      // 1. Send audio to backend → Azure Pronunciation Assessment
      const assessRes = await speechAPI.assess(audioBlob, page.text, browserTranscript || null);
      if (!assessRes.success) return;

      const { wordScores, overallAccuracy, overallFluency, overallCompleteness,
              overallProsody, displayText, source, azureAssessed, _debugInfo } = assessRes.data;

      // Store raw Azure debug data if debug mode is on
      if (debugMode && user?.isAdmin && _debugInfo) setDebugInfo(_debugInfo);

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

        setTimeout(async () => {
          if (pageIdx < story.pages.length - 1) {
            setPageIdx(p => p + 1);
          } else {
            // Complete session
            if (sessionId && child) {
              try {
                const cRes = await progressAPI.completeSession(child.id, {
                  sessionId, accuracy: overallAccuracy, acornsEarned: sessionAcorns + earnedThisPage,
                });
                if (cRes.success) {
                  setNewAchievements(cRes.data.newAchievements || []);
                  setStoryBonus(cRes.data.storyBonus || 0);
                  setSessionAcorns(p => p + (cRes.data.storyBonus || 0));
                  updateChildLocally({ acorns: cRes.data.child?.acorns, streak: cRes.data.child?.streak });
                }
              } catch {}
            }
            await speak(`Amazing! You finished ${story.title}!`, {});
            setTimeout(() => setShowComplete(true), 700);
          }
          setFeedbackData(null);
        }, 2400);
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
      stopRec();                          // stop Web Speech recognition
      const blob = await stopRecording(); // stop MediaRecorder, get audio blob
      if (blob && blob.size > 300) {  // 300 bytes minimum — even 0.5s of audio is valid
        await processAudio(blob, transcriptRef.current);
        transcriptRef.current = null;
      } else {
        setFeedbackData({ tip: "I couldn't hear that clearly — try again! 🎙️", source: 'fallback', provider: 'rules' });
      }
      return;
    }
    // Start both audio recorder AND speech recognition simultaneously
    transcriptRef.current = null;
    startRec((evt) => { /* state managed by isRecording below */ });
    await startRecording();
  };

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
          <button onClick={() => {
              const pageWords = page.text.split(' ');
              setSpeakingWordIdx(0);
              pageWords.forEach((_, i) => setTimeout(() => setSpeakingWordIdx(i), i * 380));
              setTimeout(() => setSpeakingWordIdx(-1), pageWords.length * 380 + 500);
              speak(page.text);
            }} style={{ background: 'var(--primary-10)', border: '1.5px solid var(--primary-25)', borderRadius: 50, padding: '7px 18px', color: 'var(--color-info)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)', marginBottom: 8 }}>
            🔊 Hear the sentence first
          </button>
        )}
      </div>

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
        <p style={{ fontSize: 13, fontWeight: 700, color: dark ? 'var(--overlay-60)' : 'var(--text-muted)' }}>
          {assessing ? '⚙️ Analysing your reading…'
           : isRecording ? '🔴 Recording… tap to stop'
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
