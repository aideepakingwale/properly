/**
 * @file        Home.jsx
 * @description Main reading hub — curriculum story list, AI story tab, plan tab, and multi-child switcher
 * @module      Pages
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - Phase-gated curriculum: each story unlocks when the previous one is completed
 *   - Child switcher dropdown appears only when the parent has 2+ children (Forest plan)
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { storyAPI, aiStoryAPI } from '../services/api';
import { AcornPill, ProgressBar, StarBg, Badge, Spinner, Toast } from '../components/ui';
import StoryForest from '../components/StoryForest';
import { PlansSection } from '../components/PlanCard';
import ParentGate from '../components/layout/ParentGate';
import { useToast } from '../hooks/useToast';

const PHASE_META = {
  2:{ color:'var(--color-success)', bg:'var(--bg-success-light)', label:'Simple CVC' },
  3:{ color:'var(--color-info)', bg:'var(--bg-info-light)', label:'Digraphs'   },
  4:{ color:'var(--color-primary-light)', bg:'var(--color-primary-pale)', label:'Blends'     },
  5:{ color:'var(--brand-accent)', bg:'var(--brand-accent-pale)', label:'Split Digraphs' },
  6:{ color:'var(--color-danger)', bg:'#FEE2E2', label:'Prefixes/Suffixes' },
};

export default function Home() {
  const { child, progress, refreshProgress } = useAuth();
  const [stories, setStories]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('curriculum');  // 'curriculum' | 'ai'
  const [showGate, setShowGate] = useState(false);
  const { toast, showToast, hideToast } = useToast();
  const nav = useNavigate();

  // If authenticated but no child profile, redirect to setup
  if (!child) return <Navigate to="/setup-child" replace />;

  const phase  = child?.phase || 2;
  const meta   = PHASE_META[phase] || PHASE_META[2];
  const done   = new Set(progress?.completedStories?.map(c => c.storyId) || []);
  const phaseDone = stories.filter(s => done.has(s.id)).length;

  useEffect(() => {
    if (!child) return;
    (async () => {
      setLoading(true);
      try {
        const res = await storyAPI.list(phase, child.id);
        if (res.success) setStories(res.data);
      } catch { showToast('Could not load stories', '⚠️'); }
      finally { setLoading(false); }
    })();
  }, [phase, child?.id]);

  useEffect(() => { refreshProgress(); }, []);

  // Navigate to reading — works for both static and AI stories
  const playStory = useCallback((story) => {
    if (story.isAiGenerated) {
      nav(`/read/${story.id}?ai=1&childId=${child?.id}`);
    } else {
      nav(`/read/${story.id}`);
    }
  }, [nav, child?.id]);

  return (
    <div style={{ minHeight:'100vh', background:'linear-gradient(180deg,var(--bg-dark) 0%,var(--bg-dark-mid) 15%,var(--brand-primary-darker) 40%,var(--color-primary) 65%,#818CF8 85%,var(--color-primary-pale) 100%)', position:'relative', overflow:'hidden' }}>
      <StarBg count={14}/>
      {['🌲','🌳','🌲','🌿','🍃','🌲','🌳'].map((t,i)=>(
        <div key={i} style={{ position:'fixed', fontSize:20+i*3, opacity:0.07, top:i%2===0?`${10+i*11}%`:undefined, bottom:i%2!==0?`${i*9}%`:undefined, left:i%3===0?`${i*4}%`:undefined, right:i%3===2?`${i*3}%`:undefined, pointerEvents:'none', animation:`floatSlow ${3+i*0.5}s ease-in-out infinite`, animationDelay:`${i*0.4}s` }}>{t}</div>
      ))}

      {/* TOP NAV */}
      <nav style={{ position:'sticky', top:0, zIndex:50, background:'rgba(5,26,13,0.96)', backdropFilter:'blur(12px)', borderBottom:'1px solid var(--overlay-7)' }}>
        <div style={{ maxWidth:600, margin:'0 auto', padding:'12px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
            <div style={{ width:38, height:38, borderRadius:'50%', background:'var(--overlay-8)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>🦉</div>
            <div style={{ minWidth:0 }}>
              <div style={{ color:'white', fontWeight:900, fontSize:14 }}>Hi, {child?.name}! 👋</div>
              <div style={{ color:'var(--brand-primary-light)', fontSize:11, fontWeight:700 }}>Phase {phase} · Properly Phonics 🌟</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
            {(child?.streak||1)>=2 && <div style={{ background:'rgba(239,68,68,0.15)', border:'1.5px solid rgba(239,68,68,0.3)', borderRadius:50, padding:'4px 10px', color:'#FCA5A5', fontWeight:800, fontSize:12 }}>🔥{child.streak}</div>}
            <button onClick={() => nav('/shop')} style={{ background:'var(--accent-12)', border:'1.5px solid var(--accent-30)', borderRadius:50, padding:'5px 12px', color:'var(--color-accent)', fontWeight:800, fontSize:13, cursor:'pointer', fontFamily:'var(--font-body)' }}>🌰 {child?.acorns||0}</button>
            <button onClick={() => nav('/pricing')} style={{ background:'var(--primary-25)', border:'1.5px solid rgba(124,58,237,0.5)', borderRadius:50, padding:'5px 10px', color:'var(--brand-primary-light)', fontWeight:800, fontSize:11, cursor:'pointer', fontFamily:'var(--font-body)' }}>⭐ Plans</button>
            <button onClick={() => nav('/trophies')} style={{ background:'var(--overlay-7)', border:'1.5px solid var(--overlay-15)', borderRadius:50, padding:'5px 10px', color:'var(--overlay-70)', fontWeight:700, fontSize:11, cursor:'pointer', fontFamily:'var(--font-body)' }}>🏆</button>
            <button onClick={() => setShowGate(true)} style={{ background:'var(--overlay-7)', border:'1.5px solid var(--overlay-15)', borderRadius:50, padding:'5px 10px', color:'var(--overlay-70)', fontWeight:700, fontSize:11, cursor:'pointer', fontFamily:'var(--font-body)' }}>👨‍👩‍👧</button>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth:580, margin:'0 auto', padding:'20px 18px 80px', position:'relative', zIndex:1 }}>

        {/* Forest header */}
        <div style={{ background:'var(--overlay-7)', backdropFilter:'blur(12px)', borderRadius:24, padding:'18px 20px', marginBottom:16, border:'1px solid var(--overlay-10)', textAlign:'center' }}>
          <div style={{ fontSize:52, lineHeight:1, marginBottom:8 }}>🌳</div>
          <h2 style={{ color:'white', fontFamily:'var(--font-display)', fontSize:24, marginBottom:4 }}>The Phonics Forest</h2>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:`${meta.color}25`, border:`1.5px solid ${meta.color}40`, borderRadius:50, padding:'4px 12px', color:meta.color, fontWeight:800, fontSize:11, marginBottom:12 }}>
            Phase {phase} · {meta.label}
          </div>
          <ProgressBar value={phaseDone} max={stories.length||1} color={meta.color} height={7} label={`${phaseDone} of ${stories.length} curriculum stories done`}/>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:18 }}>
          {[
            { e:'🔥', v:child?.streak||1,                         l:'day streak'    },
            { e:'📖', v:(child?.wordsRead||0).toLocaleString(),    l:'words read'    },
            { e:'⭐', v:done.size,                                 l:'stories done'  },
          ].map(s => (
            <div key={s.l} style={{ background:'var(--overlay-8)', borderRadius:16, padding:'12px 8px', textAlign:'center', border:'1px solid var(--overlay-8)' }}>
              <div style={{ fontSize:22 }}>{s.e}</div>
              <div style={{ color:'white', fontWeight:900, fontSize:18, lineHeight:1.2 }}>{s.v}</div>
              <div style={{ color:'var(--overlay-40)', fontSize:10, fontWeight:600 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Tab switcher */}
        <div style={{ display:'flex', background:'var(--overlay-8)', borderRadius:14, padding:4, marginBottom:18, gap:4 }}>
          {[
            { k:'curriculum', l:'📚 Curriculum',  d:'Structured phonics path' },
            { k:'ai',         l:'✨ My Stories',   d:'AI-personalised just for you' },
            { k:'plans',      l:'⭐ Plans',         d:'Upgrade for more features' },
          ].map(({ k, l, d }) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ flex:1, padding:'10px 8px', borderRadius:11, border:'none', background:tab===k?'rgba(255,255,255,0.18)':'transparent', cursor:'pointer', fontFamily:'var(--font-body)', transition:'all 0.2s' }}>
              <div style={{ fontWeight:tab===k?800:600, fontSize:12, color:tab===k?'white':'var(--overlay-45)' }}>{l}</div>
              <div style={{ fontSize:9, color:tab===k?'var(--overlay-60)':'var(--overlay-25)', marginTop:2 }}>{d}</div>
            </button>
          ))}
        </div>

        {/* ── CURRICULUM TAB ── */}
        {tab === 'curriculum' && (
          <>
            <p style={{ color:'var(--overlay-50)', fontSize:11, fontWeight:800, letterSpacing:'0.8px', marginBottom:12 }}>📚 READING PATH</p>
            {loading ? (
              <div style={{ display:'flex', justifyContent:'center', padding:40 }}><Spinner color="white" size={36}/></div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {stories.map((story, i) => {
                  const isComplete = done.has(story.id);
                  const isUnlocked = i===0 || done.has(stories[i-1]?.id);
                  return (
                    <div key={story.id} onClick={() => isUnlocked && playStory(story)}
                      className="animate-slide-up"
                      style={{ animationDelay:`${i*0.06}s`, background:isUnlocked?'white':'var(--overlay-12)', borderRadius:22, padding:'16px 18px', boxShadow:isUnlocked?'var(--shadow-lg)':'none', opacity:isUnlocked?1:0.45, display:'flex', alignItems:'center', gap:14, cursor:isUnlocked?'pointer':'not-allowed', transition:'transform 0.15s, box-shadow 0.15s', border:isComplete?`2px solid ${meta.color}40`:'2px solid transparent' }}
                      onMouseEnter={e => { if(isUnlocked){ e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='var(--shadow-xl)'; }}}
                      onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow=isUnlocked?'var(--shadow-lg)':'none'; }}>
                      <div style={{ width:64, height:64, borderRadius:18, background:isComplete?'var(--grad-card-active)':isUnlocked?`linear-gradient(135deg,${meta.bg},${meta.color}25)`:'var(--overlay-10)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, flexShrink:0, position:'relative' }}>
                        {isUnlocked ? story.emoji : '🔒'}
                        {isComplete && <div style={{ position:'absolute', bottom:-5, right:-5, background:'var(--color-success)', borderRadius:'50%', width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'white', border:'2.5px solid white', fontWeight:900 }}>✓</div>}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:900, fontSize:16, color:isUnlocked?'var(--text)':'var(--overlay-50)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{story.title}</div>
                        <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{story.pageCount} pages</div>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:5, flexWrap:'wrap' }}>
                          <AcornPill count={`+${story.acorns}`}/>
                          {isComplete && <Badge color="var(--text-success)">✓ Done</Badge>}
                          {!isUnlocked && i>0 && <span style={{ fontSize:11, color:'var(--overlay-35)', fontWeight:600 }}>Finish "{stories[i-1]?.title}" first</span>}
                        </div>
                      </div>
                      {isUnlocked && (
                        <div style={{ flexShrink:0, background:isComplete?meta.bg:`linear-gradient(135deg,${meta.color},${meta.color}CC)`, color:isComplete?meta.color:'white', borderRadius:50, padding:'8px 14px', fontSize:12, fontWeight:900, boxShadow:isComplete?'none':`0 4px 14px ${meta.color}50`, whiteSpace:'nowrap', minWidth:62, textAlign:'center' }}>
                          {isComplete ? '↩ Again' : '▶ Read'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── AI STORIES TAB ── */}
        {tab === 'ai' && (
          <StoryForest
            child={child}
            progress={progress}
            phaseColor={meta.color}
            phaseLabel={meta.label}
            onPlayStory={playStory}
          />
        )}

        {/* ── PLANS TAB ── */}
        {tab === 'plans' && (
          <div>
            <div style={{ marginBottom:16 }}>
              <p style={{ color:'var(--overlay-50)', fontSize:11, fontWeight:800, letterSpacing:'0.8px', marginBottom:4 }}>⭐ SUBSCRIPTION PLANS</p>
              <p style={{ color:'var(--overlay-35)', fontSize:12 }}>Upgrade to unlock Azure phoneme scoring, all phases, and more AI stories</p>
            </div>
            <PlansSection dark={true} showCTA={true} />
          </div>
        )}

        {/* Custom goal */}
        {progress?.customGoal && (
          <div style={{ marginTop:16, background:'var(--grad-goal)', borderRadius:20, padding:'14px 18px', border:'1.5px solid var(--accent-30)', boxShadow:'0 8px 24px rgba(245,158,11,0.25)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:30 }}>{progress.customGoal.emoji}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:900, fontSize:14, color:'var(--text-warning-dark)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{progress.customGoal.title}</div>
                <ProgressBar value={Math.min(child?.acorns||0,progress.customGoal.cost)} max={progress.customGoal.cost} color="var(--brand-accent)" height={7}/>
                <div style={{ fontSize:11, color:'var(--color-accent-dark)', fontWeight:700, marginTop:4 }}>
                  🌰 {Math.min(child?.acorns||0,progress.customGoal.cost).toLocaleString()} / {progress.customGoal.cost.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showGate && <ParentGate onPass={() => { setShowGate(false); nav('/parent'); }} onClose={() => setShowGate(false)}/>}
      {toast && <Toast message={toast.message} emoji={toast.emoji} onHide={hideToast}/>}
    </div>
  );
}
