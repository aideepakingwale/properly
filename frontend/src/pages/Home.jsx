import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { storyAPI, aiStoryAPI } from '../services/api';
import { AcornPill, ProgressBar, StarBg, Badge, Spinner, Toast } from '../components/ui';
import StoryForest from '../components/StoryForest';
import ParentGate from '../components/layout/ParentGate';
import { useToast } from '../hooks/useToast';

const PHASE_META = {
  2:{ color:'#10B981', bg:'#D1FAE5', label:'Simple CVC' },
  3:{ color:'#3B82F6', bg:'#DBEAFE', label:'Digraphs'   },
  4:{ color:'#8B5CF6', bg:'#EDE9FE', label:'Blends'     },
  5:{ color:'#F59E0B', bg:'#FEF3C7', label:'Split Digraphs' },
  6:{ color:'#EF4444', bg:'#FEE2E2', label:'Prefixes/Suffixes' },
};

export default function Home() {
  const { child, progress, refreshProgress } = useAuth();
  const [stories, setStories]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState('curriculum');  // 'curriculum' | 'ai'
  const [showGate, setShowGate] = useState(false);
  const { toast, showToast, hideToast } = useToast();
  const nav = useNavigate();

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
    <div style={{ minHeight:'100vh', background:'linear-gradient(180deg,#051A0D 0%,#0D2318 15%,#1B4332 40%,#2D6A4F 65%,#74C69D 85%,#D8F3DC 100%)', position:'relative', overflow:'hidden' }}>
      <StarBg count={14}/>
      {['🌲','🌳','🌲','🌿','🍃','🌲','🌳'].map((t,i)=>(
        <div key={i} style={{ position:'fixed', fontSize:20+i*3, opacity:0.07, top:i%2===0?`${10+i*11}%`:undefined, bottom:i%2!==0?`${i*9}%`:undefined, left:i%3===0?`${i*4}%`:undefined, right:i%3===2?`${i*3}%`:undefined, pointerEvents:'none', animation:`floatSlow ${3+i*0.5}s ease-in-out infinite`, animationDelay:`${i*0.4}s` }}>{t}</div>
      ))}

      {/* TOP NAV */}
      <nav style={{ position:'sticky', top:0, zIndex:50, background:'rgba(5,26,13,0.96)', backdropFilter:'blur(12px)', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
        <div style={{ maxWidth:600, margin:'0 auto', padding:'12px 18px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
            <div style={{ width:38, height:38, borderRadius:'50%', background:'rgba(255,255,255,0.08)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>🦉</div>
            <div style={{ minWidth:0 }}>
              <div style={{ color:'white', fontWeight:900, fontSize:14 }}>Hi, {child?.name}! 👋</div>
              <div style={{ color:'#52B788', fontSize:11, fontWeight:700 }}>Phase {phase} · The Phonics Forest</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
            {(child?.streak||1)>=2 && <div style={{ background:'rgba(239,68,68,0.15)', border:'1.5px solid rgba(239,68,68,0.3)', borderRadius:50, padding:'4px 10px', color:'#FCA5A5', fontWeight:800, fontSize:12 }}>🔥{child.streak}</div>}
            <button onClick={() => nav('/shop')} style={{ background:'rgba(245,158,11,0.12)', border:'1.5px solid rgba(245,158,11,0.3)', borderRadius:50, padding:'5px 12px', color:'#FCD34D', fontWeight:800, fontSize:13, cursor:'pointer', fontFamily:'var(--font-body)' }}>🌰 {child?.acorns||0}</button>
            <button onClick={() => nav('/pricing')} style={{ background:'rgba(45,106,79,0.25)', border:'1.5px solid rgba(45,106,79,0.5)', borderRadius:50, padding:'5px 10px', color:'#52B788', fontWeight:800, fontSize:11, cursor:'pointer', fontFamily:'var(--font-body)' }}>⭐ Plans</button>
            <button onClick={() => nav('/trophies')} style={{ background:'rgba(255,255,255,0.07)', border:'1.5px solid rgba(255,255,255,0.15)', borderRadius:50, padding:'5px 10px', color:'rgba(255,255,255,0.7)', fontWeight:700, fontSize:11, cursor:'pointer', fontFamily:'var(--font-body)' }}>🏆</button>
            <button onClick={() => setShowGate(true)} style={{ background:'rgba(255,255,255,0.07)', border:'1.5px solid rgba(255,255,255,0.15)', borderRadius:50, padding:'5px 10px', color:'rgba(255,255,255,0.7)', fontWeight:700, fontSize:11, cursor:'pointer', fontFamily:'var(--font-body)' }}>👨‍👩‍👧</button>
          </div>
        </div>
      </nav>

      <div style={{ maxWidth:580, margin:'0 auto', padding:'20px 18px 80px', position:'relative', zIndex:1 }}>

        {/* Forest header */}
        <div style={{ background:'rgba(255,255,255,0.07)', backdropFilter:'blur(12px)', borderRadius:24, padding:'18px 20px', marginBottom:16, border:'1px solid rgba(255,255,255,0.10)', textAlign:'center' }}>
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
            <div key={s.l} style={{ background:'rgba(255,255,255,0.08)', borderRadius:16, padding:'12px 8px', textAlign:'center', border:'1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize:22 }}>{s.e}</div>
              <div style={{ color:'white', fontWeight:900, fontSize:18, lineHeight:1.2 }}>{s.v}</div>
              <div style={{ color:'rgba(255,255,255,0.4)', fontSize:10, fontWeight:600 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Tab switcher */}
        <div style={{ display:'flex', background:'rgba(255,255,255,0.08)', borderRadius:14, padding:4, marginBottom:18, gap:4 }}>
          {[
            { k:'curriculum', l:'📚 Curriculum', d:'Structured phonics path' },
            { k:'ai',         l:'✨ My Stories',  d:'AI-personalised just for you' },
          ].map(({ k, l, d }) => (
            <button key={k} onClick={() => setTab(k)}
              style={{ flex:1, padding:'10px 8px', borderRadius:11, border:'none', background:tab===k?'rgba(255,255,255,0.18)':'transparent', cursor:'pointer', fontFamily:'var(--font-body)', transition:'all 0.2s' }}>
              <div style={{ fontWeight:tab===k?800:600, fontSize:12, color:tab===k?'white':'rgba(255,255,255,0.45)' }}>{l}</div>
              <div style={{ fontSize:9, color:tab===k?'rgba(255,255,255,0.6)':'rgba(255,255,255,0.25)', marginTop:2 }}>{d}</div>
            </button>
          ))}
        </div>

        {/* ── CURRICULUM TAB ── */}
        {tab === 'curriculum' && (
          <>
            <p style={{ color:'rgba(255,255,255,0.5)', fontSize:11, fontWeight:800, letterSpacing:'0.8px', marginBottom:12 }}>📚 READING PATH</p>
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
                      style={{ animationDelay:`${i*0.06}s`, background:isUnlocked?'white':'rgba(255,255,255,0.12)', borderRadius:22, padding:'16px 18px', boxShadow:isUnlocked?'var(--shadow-lg)':'none', opacity:isUnlocked?1:0.45, display:'flex', alignItems:'center', gap:14, cursor:isUnlocked?'pointer':'not-allowed', transition:'transform 0.15s, box-shadow 0.15s', border:isComplete?`2px solid ${meta.color}40`:'2px solid transparent' }}
                      onMouseEnter={e => { if(isUnlocked){ e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='var(--shadow-xl)'; }}}
                      onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow=isUnlocked?'var(--shadow-lg)':'none'; }}>
                      <div style={{ width:64, height:64, borderRadius:18, background:isComplete?'linear-gradient(135deg,#D1FAE5,#6EE7B7)':isUnlocked?`linear-gradient(135deg,${meta.bg},${meta.color}25)`:'rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, flexShrink:0, position:'relative' }}>
                        {isUnlocked ? story.emoji : '🔒'}
                        {isComplete && <div style={{ position:'absolute', bottom:-5, right:-5, background:'#10B981', borderRadius:'50%', width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'white', border:'2.5px solid white', fontWeight:900 }}>✓</div>}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:900, fontSize:16, color:isUnlocked?'var(--text)':'rgba(255,255,255,0.5)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{story.title}</div>
                        <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>{story.pageCount} pages</div>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:5, flexWrap:'wrap' }}>
                          <AcornPill count={`+${story.acorns}`}/>
                          {isComplete && <Badge color="#059669">✓ Done</Badge>}
                          {!isUnlocked && i>0 && <span style={{ fontSize:11, color:'rgba(255,255,255,0.35)', fontWeight:600 }}>Finish "{stories[i-1]?.title}" first</span>}
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

        {/* Custom goal */}
        {progress?.customGoal && (
          <div style={{ marginTop:16, background:'linear-gradient(135deg,#FEF3C7,#FDE68A)', borderRadius:20, padding:'14px 18px', border:'1.5px solid rgba(245,158,11,0.3)', boxShadow:'0 8px 24px rgba(245,158,11,0.25)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:30 }}>{progress.customGoal.emoji}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:900, fontSize:14, color:'#92400E', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{progress.customGoal.title}</div>
                <ProgressBar value={Math.min(child?.acorns||0,progress.customGoal.cost)} max={progress.customGoal.cost} color="#F59E0B" height={7}/>
                <div style={{ fontSize:11, color:'#B45309', fontWeight:700, marginTop:4 }}>
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
