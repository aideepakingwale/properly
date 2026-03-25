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

// Colour coding for Azure error types
function getErrorBadge(errorType) {
  if (!errorType || errorType === 'None') return null;
  const map = {
    Omission:        { label: 'missed', color: '#DC2626' },
    Insertion:       { label: 'extra word', color: '#D97706' },
    Mispronunciation:{ label: 'try again', color: '#DC2626' },
  };
  return map[errorType] || null;
}

// AI provider pill
function ProviderPill({ provider, source }) {
  if (source === 'cache') return null;
  const labels = { gemini: '♊ Gemini', groq: '⚡ Groq/Llama', static: '📚 Cache', rules: '📚 Rules', fallback: '📚 Rules' };
  return (
    <span style={{ fontSize: 10, background: 'rgba(0,0,0,0.08)', borderRadius: 50, padding: '2px 7px', color: '#6B7280', fontWeight: 600, marginLeft: 6 }}>
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
      setScoringMode(azureAssessed ? 'azure' : source === 'no-transcript' ? 'no-transcript' : 'text-comparison');
      if (azureAssessed) {
        setAzureDetails({ fluency: overallFluency, completeness: overallCompleteness, prosody: overallProsody, source: 'azure' });
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

      // 2. Identify worst word for coaching
      // Only fire feedback when Azure actually assessed the audio (not text-comparison fallback)
      // Text-comparison gives every word 75-100% which isn't meaningful for coaching
      const isRealAssessment = source === 'azure' || azureAssessed;
      const threshold = isRealAssessment ? 70 : 40; // stricter threshold for fallback scoring
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
      if (blob && blob.size > 1000) {
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
  const mutedCol = dark ? 'rgba(255,255,255,0.5)'  : 'var(--text-muted)';
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
            <div style={{ background: 'linear-gradient(135deg,#FEF3C7,#FDE68A)', borderRadius: 20, padding: '18px 24px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              <span style={{ fontSize: 48 }}>🌰</span>
              <div>
                <div style={{ fontSize: 38, fontWeight: 900, color: '#92400E' }}>+{sessionAcorns}</div>
                <div style={{ fontSize: 13, color: '#B45309', fontWeight: 700 }}>Golden Acorns earned!</div>
                {storyBonus > 0 && <div style={{ fontSize: 11, color: '#B45309' }}>includes +{storyBonus} story bonus 🌰</div>}
              </div>
            </div>
            {newAchievements.map(a => (
              <div key={a.id} className="animate-pop-in" style={{ background: '#FEF3C7', borderRadius: 16, padding: '12px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10, border: '1.5px solid rgba(245,158,11,0.3)' }}>
                <span style={{ fontSize: 28 }}>{a.emoji}</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 900, fontSize: 13, color: '#92400E' }}>🏆 New Achievement!</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#B45309' }}>{a.title}</div>
                </div>
              </div>
            ))}
            <Button fullWidth onClick={async () => { stop(); await refreshProgress(); nav('/home'); }}>🌳 Back to the Forest</Button>
          </div>
        </Modal>
      )}

      {/* ── HEADER ── */}
      <div style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: dark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'}`, position: 'sticky', top: 0, zIndex: 20 }}>
        <button onClick={() => { stop(); nav('/home'); }} style={{ background: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)', border: 'none', borderRadius: 50, width: 36, height: 36, fontSize: 17, cursor: 'pointer', color: textCol, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 900, fontSize: 14, color: textCol }}>{story.emoji} {story.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center', marginTop: 3 }}>
            {story.pages.map((_, i) => <div key={i} style={{ height: 5, width: i === pageIdx ? 24 : 8, borderRadius: 50, background: i === pageIdx ? '#2D6A4F' : i < pageIdx ? '#86EFAC' : 'rgba(0,0,0,0.15)', transition: 'all 0.3s' }} />)}
          </div>
        </div>
        <AcornPill count={`+${sessionAcorns}`} />
      </div>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 18px 12px', maxWidth: 560, margin: '0 auto', width: '100%' }}>

        {/* Provider status chip */}
        {providerInfo && (
          <div style={{ display: 'flex', gap: 5, marginBottom: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            {providerInfo.azure?.available && (
              <span style={{ fontSize: 11, background: '#DBEAFE', color: '#1E40AF', borderRadius: 50, padding: '3px 10px', fontWeight: 700 }}>☁️ Azure Pronunciation AI</span>
            )}
            {providerInfo.gemini?.available && (
              <span style={{ fontSize: 11, background: '#CCFBF1', color: '#0F766E', borderRadius: 50, padding: '3px 10px', fontWeight: 700 }}>♊ Gemini (free)</span>
            )}
            {providerInfo.groq?.available && (
              <span style={{ fontSize: 11, background: '#FFF7ED', color: '#C2410C', borderRadius: 50, padding: '3px 10px', fontWeight: 700 }}>⚡ Groq/Llama (free)</span>
            )}
            {!providerInfo.azure?.available && (
              <span style={{ fontSize: 11, background: '#FEF3C7', color: '#92400E', borderRadius: 50, padding: '3px 10px', fontWeight: 700 }}>📱 Browser STT mode</span>
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

        {/* ── WORD DISPLAY ── */}
        <div style={{ background: dark ? 'rgba(255,255,255,0.10)' : 'white', backdropFilter: dark ? 'blur(10px)' : 'none', borderRadius: 24, padding: '26px 24px', boxShadow: dark ? 'none' : 'var(--shadow-lg)', width: '100%', marginBottom: 16, border: dark ? '1px solid rgba(255,255,255,0.15)' : 'none', minHeight: 88, display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '12px 8px' }}>
          {words.map((word, i) => {
            const sc = wordScores[i]?.score ?? null;
            const errorType = wordScores[i]?.errorType;
            const punctMatch = word.match(/([.,!?;:]+)$/);
            const punct = punctMatch ? punctMatch[0] : '';
            const clean = word.slice(0, word.length - punct.length);
            const colors = getWordColor(sc);
            const badge = getErrorBadge(errorType);
            const isRevealed   = i < revealedCount;          // score shown
            const isSpeaking   = i === speakingWordIdx;         // TTS is on this word
            const showScore    = isRevealed && wordScores.length > 0;
            const scoreVal     = showScore ? wordScores[i]?.score ?? null : null;
            const revealColors = showScore ? getWordColor(scoreVal) : null;
            const revealBadge  = showScore ? getErrorBadge(wordScores[i]?.errorType) : null;

            return (
              <span key={i} style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
                transform: isSpeaking ? 'scale(1.18) translateY(-3px)' : isRevealed && scoreVal !== null ? 'scale(1.0)' : 'scale(1)',
                transition: 'transform 0.18s ease, opacity 0.25s ease',
              }}>
                {/* Score badge — shown above word after reveal */}
                {showScore && scoreVal !== null && (
                  <span style={{ position: 'absolute', top: -18, fontSize: 10, fontWeight: 900,
                    color: scoreVal >= 80 ? '#059669' : scoreVal >= 60 ? '#D97706' : '#DC2626',
                    animation: 'fadeInUp 0.25s ease',
                    whiteSpace: 'nowrap' }}>
                    {Math.round(scoreVal)}%
                  </span>
                )}
                <span style={{
                  fontSize: 'clamp(22px,5vw,32px)', fontWeight: 800,
                  color: isSpeaking ? '#1E40AF' : revealColors ? revealColors.text : textCol,
                  background: isSpeaking ? '#DBEAFE' : revealColors ? revealColors.bg : 'transparent',
                  padding: (isSpeaking || revealColors) ? '3px 10px' : '2px 4px',
                  borderRadius: 10,
                  border: isSpeaking ? '2px solid #3B82F6' : revealColors ? `1.5px solid ${revealColors.border}` : 'none',
                  boxShadow: isSpeaking ? '0 0 12px rgba(59,130,246,0.4)' : 'none',
                  transition: 'all 0.25s ease',
                  lineHeight: 1.5, display: 'inline-block',
                }}>{clean}</span>
                {punct && <span style={{ fontSize: 'clamp(22px,5vw,32px)', fontWeight: 800, color: mutedCol }}>{punct}</span>}
                {revealBadge && (
                  <span style={{ position: 'absolute', top: -16, fontSize: 9, background: revealBadge.color, color: 'white', borderRadius: 50, padding: '1px 5px', fontWeight: 800, whiteSpace: 'nowrap' }}>
                    {revealBadge.label}
                  </span>
                )}
                {/* Phoneme detail row — shown after reveal if Azure returned them */}
                {showScore && wordScores[i]?.phonemes?.length > 0 && (
                  <span style={{ fontSize: 8, color: revealColors?.text || mutedCol, marginTop: 3, display: 'flex', gap: 2 }}>
                    {wordScores[i].phonemes.slice(0, 6).map((p, j) => (
                      <span key={j} style={{
                        background: getWordColor(p.score)?.bg || 'transparent',
                        color: getWordColor(p.score)?.text || mutedCol,
                        borderRadius: 3, padding: '0 3px', fontWeight: 700,
                        fontSize: 8,
                      }}>{p.phoneme}</span>
                    ))}
                  </span>
                )}
              </span>
            );
          })}
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
              <div key={l} style={{ background: dark ? 'rgba(255,255,255,0.1)' : 'white', borderRadius: 10, padding: '8px 6px', textAlign: 'center', boxShadow: dark ? 'none' : 'var(--shadow-sm)' }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: v >= 80 ? '#059669' : v >= 60 ? '#D97706' : '#DC2626' }}>{v}<span style={{ fontSize: 10 }}>%</span></div>
                <div style={{ fontSize: 9, color: mutedCol, fontWeight: 700, marginTop: 1 }}>{l}</div>
              </div>
            ))}
          </div>
        )}

        {/* Simple accuracy bar (non-Azure mode) */}
        {overallAcc !== null && !azureDetails && (
          <div className="animate-slide-up" style={{ width: '100%', marginBottom: 12 }}>
            <ProgressBar value={overallAcc} max={100} height={7} showPct color={overallAcc >= 80 ? '#10B981' : overallAcc >= 60 ? '#F59E0B' : '#EF4444'} label="Accuracy" />
          </div>
        )}

        {/* ── MRS. OWL FEEDBACK ── */}
        {(feedbackData || loadingFb) && (
          <div className="animate-slide-down" style={{ background: dark ? 'rgba(255,255,255,0.10)' : 'linear-gradient(135deg,#ECFDF5,#D1FAE5)', backdropFilter: dark ? 'blur(10px)' : 'none', borderRadius: 20, padding: '14px 18px', width: '100%', marginBottom: 14, display: 'flex', alignItems: 'flex-start', gap: 12, border: dark ? '1.5px solid rgba(255,255,255,0.15)' : '2px solid #6EE7B7' }}>
            <span style={{ fontSize: 30, flexShrink: 0, lineHeight: 1 }}>🦉</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 900, fontSize: 10, letterSpacing: '0.5px', color: dark ? 'rgba(255,255,255,0.5)' : '#065F46', marginBottom: 4, display: 'flex', alignItems: 'center' }}>
                MRS. OWL SAYS:
                {feedbackData && <ProviderPill source={feedbackData.source} provider={feedbackData.provider} />}
              </div>
              {loadingFb
                ? <div style={{ display: 'flex', gap: 5 }}>{[0,1,2].map(j => <div key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: '#34D399', animation: `float ${0.5+j*0.15}s ease-in-out infinite`, animationDelay: `${j*0.12}s` }} />)}</div>
                : <p style={{ fontSize: 14, fontWeight: 700, color: dark ? 'rgba(255,255,255,0.85)' : '#065F46', lineHeight: 1.45, margin: 0 }}>{feedbackData?.tip}</p>}
            </div>
            {feedbackData && <button onClick={() => speak(feedbackData.tip)} style={{ background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer', opacity: 0.7 }}>🔊</button>}
          </div>
        )}

        {/* Colour legend */}
        {wordScores.length > 0 && !feedbackData && !loadingFb && (
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 8 }}>
            {[{ c: '#059669', l: 'Great!' }, { c: '#D97706', l: 'Almost' }, { c: '#DC2626', l: 'Try again' }].map(({ c, l }) => (
              <span key={l} style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: c, display: 'inline-block' }} /> {l}
              </span>
            ))}
          </div>
        )}

        {/* Mic error */}
        {micError && <p style={{ color: 'var(--red)', fontWeight: 700, fontSize: 13, textAlign: 'center', background: '#FEF2F2', borderRadius: 10, padding: '8px 14px', marginBottom: 8, width: '100%' }}>⚠️ {micError}</p>}

        {/* Moral page banner */}
        {isMoralPage && (
          <div style={{ width:'100%', background:'linear-gradient(135deg,rgba(245,158,11,0.12),rgba(16,185,129,0.12))', border:'1.5px solid rgba(245,158,11,0.3)', borderRadius:14, padding:'12px 16px', marginBottom:14, textAlign:'center' }}>
            <div style={{ fontSize:22, marginBottom:4 }}>🌟</div>
            <div style={{ fontSize:12, fontWeight:800, color:'#F59E0B', letterSpacing:'0.5px', textTransform:'uppercase' }}>The Moral of the Story</div>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>Read this wise message together</div>
          </div>
        )}

        {/* Hear sentence */}
        {/* ── DEBUG PANEL — only shown when admin has enabled debug mode ── */}
        {debugMode && user?.isAdmin && (
          <div style={{ width:'100%', marginBottom:12 }}>
            <details style={{ background:'rgba(245,158,11,0.08)', border:'1.5px solid rgba(245,158,11,0.3)', borderRadius:12, padding:'10px 14px' }}>
              <summary style={{ cursor:'pointer', fontSize:12, fontWeight:700, color:'#F59E0B', userSelect:'none' }}>
                🐛 Debug — Azure Pronunciation Assessment {debugInfo ? '(data received)' : '(waiting for assessment…)'}
              </summary>
              {debugInfo ? (
                <div style={{ marginTop:10, fontSize:11, fontFamily:'monospace' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                    <div style={{ background:'rgba(0,0,0,0.2)', borderRadius:6, padding:'8px 10px' }}>
                      <div style={{ color:'#86EFAC', fontWeight:700, marginBottom:4 }}>REQUEST</div>
                      <div style={{ color:'rgba(255,255,255,0.7)', lineHeight:1.8 }}>
                        <div>Audio: {debugInfo.audioSizeKb} KB ({debugInfo.audioMime})</div>
                        <div>Original ref: "{debugInfo.originalRefText}"</div>
                        {debugInfo.sanitisedRefText !== debugInfo.originalRefText && (
                          <div style={{ color:'#FCD34D' }}>Sent to Azure: "{debugInfo.sanitisedRefText}"</div>
                        )}
                        {debugInfo.properNounsReplaced?.length > 0 && (
                          <div style={{ color:'#86EFAC' }}>
                            Proper nouns (phonetic): {debugInfo.properNounsReplaced.join(' | ')}
                          </div>
                        )}
                        <div>Region: {debugInfo.endpoint?.split('.')[0]?.replace('https://', '')}</div>
                        <div>Time: {debugInfo.requestedAt}</div>
                        <div style={{ marginTop:6, color:'#93C5FD' }}>Pronunciation Config:</div>
                        <pre style={{ margin:0, color:'#93C5FD', whiteSpace:'pre-wrap', wordBreak:'break-all' }}>
                          {JSON.stringify(debugInfo.pronConfig, null, 2)}
                        </pre>
                      </div>
                    </div>
                    <div style={{ background:'rgba(0,0,0,0.2)', borderRadius:6, padding:'8px 10px' }}>
                      <div style={{ color:'#86EFAC', fontWeight:700, marginBottom:4 }}>RESPONSE — NBest[0]</div>
                      <div style={{ color:'rgba(255,255,255,0.7)', lineHeight:1.8 }}>
                        {debugInfo.azureRawResponse?.NBest?.[0] ? (
                          <>
                            <div>RecognizedText: "{debugInfo.azureRawResponse.NBest[0].Display}"</div>
                            <div>Accuracy: {debugInfo.azureRawResponse.NBest[0].PronunciationAssessment?.AccuracyScore}%</div>
                            <div>Fluency: {debugInfo.azureRawResponse.NBest[0].PronunciationAssessment?.FluencyScore}%</div>
                            <div style={{ marginTop:6, color:'#FCA5A5' }}>Raw Words ({debugInfo.azureRawResponse.NBest[0].Words?.length}):</div>
                            <div style={{ maxHeight:180, overflow:'auto' }}>
                              {debugInfo.azureRawResponse.NBest[0].Words?.map((w, i) => (
                                <div key={i} style={{ color: w.PronunciationAssessment?.ErrorType === 'Insertion' ? '#9CA3AF' : w.PronunciationAssessment?.AccuracyScore < 60 ? '#FCA5A5' : '#86EFAC', marginBottom:2 }}>
                                  [{w.PronunciationAssessment?.ErrorType || 'None'}] "{w.Word}" → {Math.round(w.PronunciationAssessment?.AccuracyScore ?? 0)}%
                                  {w.PronunciationAssessment?.ErrorType === 'Insertion' ? ' (extra — filtered)' : ''}
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <pre style={{ margin:0, color:'#FCA5A5', whiteSpace:'pre-wrap', wordBreak:'break-all', maxHeight:200, overflow:'auto' }}>
                            {JSON.stringify(debugInfo.azureRawResponse, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop:8, color:'rgba(255,255,255,0.4)', fontSize:11 }}>Record your voice to see Azure API data here.</div>
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
            }} style={{ background: 'rgba(59,130,246,0.1)', border: '1.5px solid rgba(59,130,246,0.25)', borderRadius: 50, padding: '7px 18px', color: '#2563EB', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)', marginBottom: 8 }}>
            🔊 Hear the sentence first
          </button>
        )}
      </div>

      {/* ── MIC CONTROLS ── */}
      <div style={{ padding: '12px 18px 32px', textAlign: 'center', background: dark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.82)', backdropFilter: 'blur(10px)', borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`, position: 'sticky', bottom: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            {isRecording && <>
              <div style={{ position: 'absolute', inset: -10, borderRadius: '50%', border: '3px solid rgba(239,68,68,0.4)', animation: 'pulseRing 1s ease-out infinite' }} />
              <div style={{ position: 'absolute', inset: -20, borderRadius: '50%', border: '2px solid rgba(239,68,68,0.2)', animation: 'pulseRing 1s ease-out infinite', animationDelay: '0.3s' }} />
            </>}
            <button onClick={handleMic} disabled={assessing}
              className={isRecording ? 'animate-breathe' : ''}
              style={{ width: 78, height: 78, borderRadius: '50%', border: 'none', background: assessing ? '#9CA3AF' : isRecording ? 'linear-gradient(135deg,#EF4444,#DC2626)' : 'linear-gradient(135deg,#2D6A4F,#1B4332)', color: 'white', fontSize: 30, cursor: assessing ? 'default' : 'pointer', boxShadow: isRecording ? '0 8px 28px rgba(239,68,68,0.5)' : assessing ? 'none' : '0 8px 28px rgba(45,106,79,0.5)', transition: 'all 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {assessing ? <Spinner size={28} color="white" /> : isRecording ? '⏹' : '🎙️'}
            </button>
          </div>
        </div>
        <p style={{ fontSize: 13, fontWeight: 700, color: dark ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)' }}>
          {assessing ? '⚙️ Analysing your reading…'
           : isRecording ? '🔴 Recording… tap to stop'
           : 'Tap 🎙️ and read the sentence aloud!'}
        </p>
        <p style={{ fontSize: 11, color: dark ? 'rgba(255,255,255,0.25)' : '#D1D5DB', marginTop: 2 }}>
          {providerInfo?.azure?.available ? '☁️ Azure Pronunciation Assessment active' : '📱 Browser mic mode (add Azure key for full scoring)'}
        </p>
      </div>
    </div>
  );
}
