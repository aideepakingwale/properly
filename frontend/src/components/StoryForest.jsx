/**
 * StoryForest — AI-Generated Personalised Story Library
 *
 * Features:
 * - Shows AI-generated stories tailored to child's name, phase, and interests
 * - One-tap story generation with theme selector
 * - Shows struggled-word targeting in story cards
 * - Phoneme phase badges on each story
 * - Empty state with quick-generate CTA
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiStoryAPI } from '../services/api';
import { AcornPill, Badge, Spinner } from './ui';

const THEME_META = {
  adventure:   { emoji:'🗺️', label:'Adventure'  },
  animals:     { emoji:'🦁', label:'Animals'     },
  space:       { emoji:'🚀', label:'Space'       },
  dinosaurs:   { emoji:'🦕', label:'Dinosaurs'   },
  magic:       { emoji:'🧙', label:'Magic'       },
  ocean:       { emoji:'🌊', label:'Ocean'       },
  farm:        { emoji:'🐄', label:'Farm'        },
  forest:      { emoji:'🌲', label:'Forest'      },
  dragons:     { emoji:'🐉', label:'Dragons'     },
  robots:      { emoji:'🤖', label:'Robots'      },
  cats:        { emoji:'🐱', label:'Cats'        },
  pirates:     { emoji:'🏴‍☠️', label:'Pirates'    },
  superheroes: { emoji:'🦸', label:'Heroes'      },
  cooking:     { emoji:'🍳', label:'Cooking'     },
};

const PROVIDER_BADGES = {
  gemini:   { label:'Gemini AI',    color:'#0F766E', bg:'#CCFBF1' },  // free
  groq:     { label:'Groq / Llama', color:'#F97316', bg:'#FFF7ED' },  // free
  fallback: { label:'Built-in',     color:'#92400E', bg:'#FEF3C7' },  // always free
};

// ── THEME PICKER ──────────────────────────────────────────────
function ThemePicker({ selected, onSelect, interests = [] }) {
  const themes = Object.entries(THEME_META);
  // Boost interest-matching themes to top
  const sorted = [...themes].sort(([a], [b]) => {
    const aMatch = interests.some(i => i.toLowerCase().includes(a) || a.includes(i.toLowerCase()));
    const bMatch = interests.some(i => i.toLowerCase().includes(b) || b.includes(i.toLowerCase()));
    if (aMatch && !bMatch) return -1;
    if (!aMatch && bMatch) return 1;
    return 0;
  });

  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginBottom:14 }}>
      {sorted.map(([key, meta]) => {
        const isMatch = interests.some(i => i.toLowerCase().includes(key) || key.includes(i.toLowerCase()));
        return (
          <button key={key} onClick={() => onSelect(key)}
            style={{ padding:'7px 12px', borderRadius:50, border:`2px solid ${selected===key?'#2D6A4F':'#E5E7EB'}`, background:selected===key?'#F0FDF4':'white', color:selected===key?'#2D6A4F':'#6B7280', fontSize:12, fontWeight:selected===key?800:600, cursor:'pointer', fontFamily:'var(--font-body)', display:'flex', alignItems:'center', gap:5, transition:'all 0.15s', position:'relative' }}>
            <span style={{ fontSize:14 }}>{meta.emoji}</span>
            {meta.label}
            {isMatch && <span style={{ position:'absolute', top:-4, right:-4, width:10, height:10, borderRadius:'50%', background:'#F59E0B', border:'2px solid white' }} />}
          </button>
        );
      })}
    </div>
  );
}

// ── AI STORY CARD ─────────────────────────────────────────────
function AiStoryCard({ story, onPlay, onDelete, phaseColor, phaseLabel }) {
  const provider = PROVIDER_BADGES[story.aiProvider] || PROVIDER_BADGES.fallback;
  return (
    <div style={{ background:'white', borderRadius:22, padding:'16px 18px', boxShadow:'0 6px 24px rgba(0,0,0,0.1)', display:'flex', alignItems:'center', gap:14, border:story.isCompleted?`2px solid ${phaseColor}40`:'2px solid transparent', transition:'transform 0.15s, box-shadow 0.15s', cursor:'pointer', position:'relative' }}
      onClick={() => onPlay(story)}
      onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 10px 32px rgba(0,0,0,0.16)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='0 6px 24px rgba(0,0,0,0.1)'; }}>

      {/* AI badge — top right */}
      <div style={{ position:'absolute', top:10, right:10, background:provider.bg, color:provider.color, borderRadius:50, padding:'2px 8px', fontSize:9, fontWeight:800 }}>
        ✨ {provider.label}
      </div>

      {/* Cover */}
      <div style={{ width:64, height:64, borderRadius:18, background:story.isCompleted?'linear-gradient(135deg,#D1FAE5,#6EE7B7)':`linear-gradient(135deg,${phaseColor}20,${phaseColor}10)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:30, flexShrink:0, position:'relative', border:`1.5px solid ${phaseColor}30` }}>
        {story.emoji}
        {story.isCompleted && <div style={{ position:'absolute', bottom:-5, right:-5, background:'#10B981', borderRadius:'50%', width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'white', border:'2.5px solid white', fontWeight:900 }}>✓</div>}
      </div>

      {/* Info */}
      <div style={{ flex:1, minWidth:0, paddingRight:24 }}>
        <div style={{ fontWeight:900, fontSize:15, color:'#1C1917', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{story.title}</div>

        <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:3, flexWrap:'wrap' }}>
          <span style={{ fontSize:12, background:`${phaseColor}15`, color:phaseColor, borderRadius:50, padding:'2px 8px', fontWeight:700 }}>
            Phase {story.phase}
          </span>
          {story.theme && <span style={{ fontSize:11, color:'#9CA3AF', fontWeight:600 }}>{THEME_META[story.theme]?.emoji} {story.theme}</span>}
        </div>

        {/* Target phonemes */}
        {story.targetPhonemes?.length > 0 && (
          <div style={{ display:'flex', gap:3, marginTop:5, flexWrap:'wrap' }}>
            {story.targetPhonemes.slice(0,4).map(ph => (
              <span key={ph} style={{ background:'#EDE9FE', color:'#5B21B6', borderRadius:5, padding:'1px 6px', fontSize:10, fontWeight:700 }}>{ph}</span>
            ))}
          </div>
        )}

        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:5 }}>
          <AcornPill count={`+${story.acorns}`} />
          <span style={{ fontSize:11, color:'#D1D5DB' }}>· {story.pageCount} pages</span>
        </div>
      </div>

      {/* CTA */}
      <div style={{ flexShrink:0, display:'flex', flexDirection:'column', gap:5, alignItems:'flex-end', paddingRight:2 }}>
        <div style={{ background:story.isCompleted?`${phaseColor}15`:`linear-gradient(135deg,${phaseColor},${phaseColor}CC)`, color:story.isCompleted?phaseColor:'white', borderRadius:50, padding:'7px 12px', fontSize:11, fontWeight:900, whiteSpace:'nowrap' }}>
          {story.isCompleted ? '↩ Again' : '▶ Read'}
        </div>
        <button onClick={e => { e.stopPropagation(); onDelete(story.id); }}
          style={{ background:'transparent', border:'none', fontSize:14, color:'#D1D5DB', cursor:'pointer', padding:'2px 4px', borderRadius:5 }}
          title="Remove story">🗑</button>
      </div>
    </div>
  );
}

// ── GENERATING ANIMATION ──────────────────────────────────────
function GeneratingCard({ childName, theme }) {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 450);
    return () => clearInterval(t);
  }, []);

  const msgs = [
    `✍️ Writing ${childName}'s story`,
    `🎯 Targeting phonemes`,
    `📖 Crafting sentences`,
    `✨ Adding magic touches`,
    `🦉 Mrs. Owl approves`,
  ];
  const [msgIdx, setMsgIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setMsgIdx(i => (i+1) % msgs.length), 1500);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ background:'linear-gradient(135deg,#1B4332,#2D6A4F)', borderRadius:22, padding:'20px 22px', textAlign:'center', border:'2px solid rgba(255,255,255,0.1)' }}>
      <div style={{ fontSize:48, marginBottom:10 }}>{THEME_META[theme]?.emoji || '📖'}</div>
      <div style={{ color:'white', fontWeight:800, fontSize:14, marginBottom:4 }}>{msgs[msgIdx]}{dots}</div>
      <div style={{ color:'rgba(255,255,255,0.5)', fontSize:11, marginBottom:12 }}>AI is crafting your personalised story</div>
      <div style={{ display:'flex', justifyContent:'center' }}><Spinner color="rgba(255,255,255,0.7)" size={24} /></div>
    </div>
  );
}

// ── MAIN COMPONENT ────────────────────────────────────────────
export default function StoryForest({ child, progress, phaseColor, phaseLabel, onPlayStory }) {
  const [aiStories, setAiStories]       = useState([]);
  const [generating, setGenerating]     = useState(false);
  const [selectedTheme, setSelectedTheme] = useState('adventure');
  const [showGenerator, setShowGenerator] = useState(false);
  const [interests, setInterests]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [dailyLeft, setDailyLeft]       = useState(5);
  const [error, setError]               = useState('');
  const [providerInfo, setProviderInfo] = useState(null);

  const loadData = useCallback(async () => {
    if (!child?.id) return;
    setLoading(true);
    try {
      const [storiesRes, interestsRes, statusRes] = await Promise.allSettled([
        aiStoryAPI.list(child.id),
        aiStoryAPI.interests.get(child.id),
        aiStoryAPI.status(),
      ]);
      if (storiesRes.status==='fulfilled' && storiesRes.value.success) {
        setAiStories(storiesRes.value.data);
        // Calculate daily remaining
        const todayCount = storiesRes.value.data.filter(s => {
          const d = new Date(s.createdAt);
          return d.toDateString() === new Date().toDateString();
        }).length;
        setDailyLeft(Math.max(0, 5 - todayCount));
      }
      if (interestsRes.status==='fulfilled' && interestsRes.value.success) {
        setInterests(interestsRes.value.data.interests || []);
        // Set default theme based on first interest
        const firstInterest = interestsRes.value.data.interests?.[0];
        if (firstInterest && THEME_META[firstInterest]) setSelectedTheme(firstInterest);
      }
      if (statusRes.status==='fulfilled' && statusRes.value.success) {
        setProviderInfo(statusRes.value.data);
      }
    } catch {}
    finally { setLoading(false); }
  }, [child?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleGenerate = async () => {
    if (dailyLeft <= 0) { setError('Daily limit reached (5 stories/day). Come back tomorrow!'); return; }
    setError('');
    setGenerating(true);
    setShowGenerator(false);
    try {
      const res = await aiStoryAPI.generate(child.id, { theme: selectedTheme });
      if (res.success) {
        setAiStories(prev => [res.data, ...prev]);
        setDailyLeft(d => Math.max(0, d-1));
      }
    } catch (e) {
      setError(e.message || 'Generation failed. Please try again.');
    } finally { setGenerating(false); }
  };

  const handleDelete = async (storyId) => {
    await aiStoryAPI.remove(child.id, storyId).catch(() => {});
    setAiStories(prev => prev.filter(s => s.id !== storyId));
  };

  if (loading) return <div style={{ display:'flex', justifyContent:'center', padding:32 }}><Spinner color={phaseColor} size={32} /></div>;

  return (
    <div>
      {/* ── SECTION HEADER ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <div>
          <p style={{ color:'rgba(255,255,255,0.5)', fontSize:11, fontWeight:800, letterSpacing:'0.8px' }}>✨ YOUR AI STORIES</p>
          <p style={{ color:'rgba(255,255,255,0.35)', fontSize:10, marginTop:1 }}>
            Personalised for {child?.name} · Phase {child?.phase}
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {/* Daily counter */}
          <span style={{ fontSize:10, color:dailyLeft>0?'rgba(255,255,255,0.4)':'#F87171', fontWeight:600 }}>
            {dailyLeft}/5 today
          </span>
          <button onClick={() => setShowGenerator(s => !s)} disabled={generating || dailyLeft<=0}
            style={{ background:dailyLeft>0?`linear-gradient(135deg,${phaseColor},${phaseColor}CC)`:'rgba(255,255,255,0.08)', border:'none', borderRadius:50, padding:'7px 14px', color:dailyLeft>0?'white':'rgba(255,255,255,0.3)', fontWeight:800, fontSize:12, cursor:dailyLeft>0?'pointer':'default', fontFamily:'var(--font-body)', display:'flex', alignItems:'center', gap:5, boxShadow:dailyLeft>0?`0 4px 14px ${phaseColor}60`:'none' }}>
            ✨ {generating ? 'Creating…' : 'New Story'}
          </button>
        </div>
      </div>

      {/* ── AI PROVIDER CHIP ── */}
      {providerInfo && (
        <div style={{ marginBottom:10, display:'flex', gap:5, flexWrap:'wrap' }}>
          <span style={{ fontSize:10, background:providerInfo.gemini?'rgba(20,184,166,0.2)':providerInfo.groq?'rgba(249,115,22,0.15)':'rgba(245,158,11,0.2)', color:providerInfo.gemini?'#0F766E':providerInfo.groq?'#C2410C':'#FCD34D', borderRadius:50, padding:'3px 9px', fontWeight:700 }}>
            {providerInfo.gemini ? '♊ Gemini AI (free)' : providerInfo.groq ? '⚡ Groq/Llama (free)' : '📚 Built-in templates'}
          </span>
          {interests.length > 0 && (
            <span style={{ fontSize:10, background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.5)', borderRadius:50, padding:'3px 9px', fontWeight:600 }}>
              🎯 Matched to: {interests.slice(0,2).join(', ')}
            </span>
          )}
        </div>
      )}

      {/* ── THEME GENERATOR PANEL ── */}
      {showGenerator && !generating && (
        <div className="animate-slide-down" style={{ background:'rgba(255,255,255,0.08)', backdropFilter:'blur(10px)', borderRadius:20, padding:'16px', marginBottom:14, border:'1px solid rgba(255,255,255,0.12)' }}>
          <p style={{ color:'white', fontWeight:800, fontSize:13, marginBottom:3 }}>Choose a story theme</p>
          <p style={{ color:'rgba(255,255,255,0.45)', fontSize:11, marginBottom:12 }}>
            AI will write a phonics-perfect story just for {child?.name}
            {interests.length > 0 && ` (⭐ = matches ${child?.name}'s interests)`}
          </p>
          <ThemePicker selected={selectedTheme} onSelect={setSelectedTheme} interests={interests} />
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setShowGenerator(false)} style={{ flex:1, padding:'10px', borderRadius:50, background:'rgba(255,255,255,0.08)', border:'1.5px solid rgba(255,255,255,0.15)', color:'rgba(255,255,255,0.7)', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'var(--font-body)' }}>Cancel</button>
            <button onClick={handleGenerate} style={{ flex:2, padding:'10px', borderRadius:50, background:`linear-gradient(135deg,${phaseColor},${phaseColor}CC)`, border:'none', color:'white', fontWeight:900, fontSize:13, cursor:'pointer', fontFamily:'var(--font-body)', boxShadow:`0 4px 14px ${phaseColor}50` }}>
              ✨ Generate "{THEME_META[selectedTheme]?.label}" Story
            </button>
          </div>
        </div>
      )}

      {/* ── ERROR ── */}
      {error && (
        <div style={{ background:'rgba(239,68,68,0.15)', border:'1.5px solid rgba(239,68,68,0.3)', borderRadius:14, padding:'10px 14px', marginBottom:12, fontSize:13, color:'#FCA5A5', fontWeight:600 }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── STORIES LIST ── */}
      {generating && <GeneratingCard childName={child?.name} theme={selectedTheme} />}

      {!generating && aiStories.length === 0 && (
        <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:20, padding:'28px 20px', textAlign:'center', border:'1.5px dashed rgba(255,255,255,0.15)' }}>
          <div style={{ fontSize:52, marginBottom:12 }}>✨</div>
          <p style={{ color:'white', fontWeight:800, fontSize:15, marginBottom:6 }}>No AI stories yet!</p>
          <p style={{ color:'rgba(255,255,255,0.45)', fontSize:12, marginBottom:16, lineHeight:1.5 }}>
            Tap "New Story" to generate a personalised phonics story<br />just for {child?.name} — targeting their exact Phase {child?.phase} sounds.
          </p>
          <button onClick={() => setShowGenerator(true)} style={{ background:`linear-gradient(135deg,${phaseColor},${phaseColor}BB)`, border:'none', borderRadius:50, padding:'10px 22px', color:'white', fontWeight:800, fontSize:13, cursor:'pointer', fontFamily:'var(--font-body)' }}>
            ✨ Generate First Story
          </button>
        </div>
      )}

      {!generating && aiStories.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {aiStories.map((story, i) => (
            <div key={story.id} className="animate-slide-up" style={{ animationDelay:`${i*0.05}s` }}>
              <AiStoryCard
                story={story}
                onPlay={onPlayStory}
                onDelete={handleDelete}
                phaseColor={phaseColor}
                phaseLabel={phaseLabel}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
