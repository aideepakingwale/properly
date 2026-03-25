/**
 * @file        pages.jsx
 * @description Parent-facing dashboard pages — Shop and ParentDash with multi-child selector, progress stats, and KidsManager
 * @module      Pages
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - ParentDash viewingId allows switching which child's stats are displayed without changing the active reader
 *   - Recent session history shows both curriculum (📚) and AI (✨) story sessions
 */

import React, { useState, useEffect, useCallback } from 'react';
// ── SHOP PAGE ─────────────────────────────────────────────────
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import KidsManager from '../components/KidsManager';
import StoryBookShelf from '../components/StoryBookShelf';
import { shopAPI, progressAPI, aiStoryAPI } from '../services/api';
import { Button, AcornPill, Spinner, Toast } from '../components/ui';
import { useToast } from '../hooks/useToast';
import InterestsPanel from '../components/InterestsPanel.jsx';

export function Shop() {
  const { child, updateChildLocally } = useAuth();
  const nav = useNavigate();
  const [tab, setTab]         = useState('digital');
  const [items, setItems]     = useState([]);
  const [owned, setOwned]     = useState(new Set());
  const [loading, setLoading] = useState(true);
  const { toast, showToast, hideToast } = useToast();

  useEffect(() => {
    if (!child) return;
    Promise.all([shopAPI.items(), shopAPI.owned(child.id)])
      .then(([iRes, oRes]) => {
        if (iRes.success) setItems(iRes.data);
        if (oRes.success) setOwned(new Set(oRes.data));
      })
      .catch(() => showToast('Could not load shop', '⚠️'))
      .finally(() => setLoading(false));
  }, [child?.id]);

  const buy = async (item) => {
    if ((child?.acorns || 0) < item.cost) { showToast(`Need ${item.cost - child.acorns} more acorns!`, '🌰'); return; }
    try {
      const res = await shopAPI.buy(child.id, item.id);
      if (res.success) {
        setOwned(prev => new Set([...prev, item.id]));
        updateChildLocally({ acorns: res.data.remainingAcorns });
        showToast(`${item.name} unlocked!`, item.emoji);
      }
    } catch (e) { showToast(e.message || 'Purchase failed', '❌'); }
  };

  const TABS = [{ k: 'digital', l: '✨ Digital' }, { k: 'print', l: '📄 Printable' }, { k: 'physical', l: '📦 Physical' }];
  const shown = items.filter(i => i.category === tab);

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#0D0A2A,#1E1050)', fontFamily: 'var(--font-body)', color: 'white' }}>
      <div style={{ maxWidth: 580, margin: '0 auto' }}>
        <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={() => nav('/home')} style={{ background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.15)', borderRadius: 50, padding: '7px 16px', color: 'rgba(255,255,255,0.8)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>← Back</button>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>🏪 Acorn Shop</h2>
          <AcornPill count={child?.acorns || 0} size={14} />
        </div>

        <div style={{ textAlign: 'center', padding: '20px 0 12px' }}>
          <div className="animate-float" style={{ fontSize: 72 }}>🦔</div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>Pippin — dress me up! 🌟</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 8 }}>
            {[...owned].slice(0, 5).map(id => { const it = items.find(i => i.id === id); return it ? <span key={id} style={{ fontSize: 24 }}>{it.emoji}</span> : null; })}
          </div>
        </div>

        <div style={{ padding: '0 18px' }}>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 4, marginBottom: 18 }}>
            {TABS.map(({ k, l }) => (
              <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: '9px 6px', borderRadius: 13, border: 'none', background: tab === k ? 'rgba(255,255,255,0.15)' : 'transparent', fontWeight: tab === k ? 800 : 600, fontSize: 12, color: tab === k ? 'white' : 'rgba(255,255,255,0.45)', cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.2s' }}>{l}</button>
            ))}
          </div>
          {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner color="white" size={36} /></div> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, paddingBottom: 40 }}>
              {shown.map(item => {
                const has = owned.has(item.id);
                const can = (child?.acorns || 0) >= item.cost;
                return (
                  <div key={item.id} style={{ background: has ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)', border: `1.5px solid ${has ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 18, padding: '18px 12px', textAlign: 'center', transition: 'transform 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>{item.emoji}</div>
                    <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 3 }}>{item.name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginBottom: 10, lineHeight: 1.3 }}>{item.description}</div>
                    {has ? <div style={{ color: '#34D399', fontSize: 12, fontWeight: 800 }}>✓ Owned</div>
                      : <button onClick={() => buy(item)} style={{ background: can ? 'linear-gradient(135deg,#F59E0B,#FCD34D)' : 'rgba(255,255,255,0.05)', border: can ? 'none' : '1px solid rgba(255,255,255,0.1)', borderRadius: 50, padding: '6px 16px', color: can ? '#7C2D12' : 'rgba(255,255,255,0.25)', fontWeight: 900, fontSize: 13, cursor: can ? 'pointer' : 'default', fontFamily: 'var(--font-body)' }}>🌰 {item.cost}</button>}
                    {!has && !can && <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>need {item.cost - (child?.acorns || 0)} more</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {toast && <Toast message={toast.message} emoji={toast.emoji} onHide={hideToast} />}
    </div>
  );
}

// ── TROPHIES PAGE ─────────────────────────────────────────────
export function Trophies() {
  const { child, progress } = useAuth();
  const nav = useNavigate();
  const [allAch, setAllAch] = useState([]);
  const earned = new Set(progress?.achievements?.map(a => a.id) || []);

  useEffect(() => {
    import('../services/api').then(({ default: api }) => {
      api.get('/achievements').then(r => { if (r.success) setAllAch(r.data); }).catch(() => {});
    });
    // Fallback: use hardcoded list from progress
    if (progress?.achievements) setAllAch(prev => prev.length ? prev : progress.achievements);
  }, [progress]);

  // Use achievements from progress if API not available
  const BUILT_IN = [
    { id:'first_story', title:'First Steps', emoji:'👣', description:'Complete your first story', xp:50 },
    { id:'five_stories', title:'Bookworm', emoji:'📚', description:'Complete 5 stories', xp:100 },
    { id:'ten_stories', title:'Story Master', emoji:'🎓', description:'Complete 10 stories', xp:200 },
    { id:'phase3_reach', title:'Digraph Detective', emoji:'🔍', description:'Reach Phase 3', xp:75 },
    { id:'phase4_reach', title:'Blend Champion', emoji:'🏅', description:'Reach Phase 4', xp:100 },
    { id:'phase5_reach', title:'Split Digraph Hero', emoji:'⚡', description:'Reach Phase 5', xp:125 },
    { id:'phase6_reach', title:'Phonics Legend', emoji:'👑', description:'Reach Phase 6', xp:200 },
    { id:'streak3', title:'3-Day Streak', emoji:'🔥', description:'Read 3 days in a row', xp:60 },
    { id:'streak7', title:'Week Warrior', emoji:'⚡', description:'Read 7 days in a row', xp:150 },
    { id:'acorns100', title:'Acorn Collector', emoji:'🌰', description:'Earn 100 Golden Acorns', xp:50 },
    { id:'acorns500', title:'Acorn Hoarder', emoji:'🏦', description:'Earn 500 Golden Acorns', xp:100 },
    { id:'words100', title:'Word Wizard', emoji:'✨', description:'Read 100 words', xp:75 },
    { id:'words500', title:'Story Sage', emoji:'🦉', description:'Read 500 words', xp:150 },
    { id:'perfect_page', title:'Perfectionist', emoji:'💎', description:'Score 100% accuracy', xp:100 },
  ];

  const list = allAch.length ? allAch : BUILT_IN;

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#1C1409,#3B2507)', fontFamily: 'var(--font-body)', color: 'white' }}>
      <div style={{ maxWidth: 580, margin: '0 auto', padding: '0 18px' }}>
        <div style={{ padding: '16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => nav('/home')} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 50, padding: '8px 16px', color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>← Back</button>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>🏆 Trophy Room</h2>
          <div style={{ fontSize: 13, color: '#FCD34D', fontWeight: 700 }}>{earned.size}/{list.length}</div>
        </div>
        <div style={{ textAlign: 'center', padding: '10px 0 24px' }}>
          <div className="animate-float" style={{ fontSize: 60 }}>🏆</div>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 6 }}>
            {earned.size === 0 ? 'Complete stories to earn trophies!' : earned.size === list.length ? 'All trophies collected! 🎉' : `${list.length - earned.size} more to collect!`}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 40 }}>
          {list.map(a => {
            const has = earned.has(a.id);
            return (
              <div key={a.id} style={{ background: has ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)', border: `1.5px solid ${has ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 18, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, opacity: has ? 1 : 0.45 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: has ? 'linear-gradient(135deg,#FEF3C7,#FDE68A)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>{a.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 900, fontSize: 15, color: has ? '#FDE68A' : 'rgba(255,255,255,0.4)' }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: has ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)', marginTop: 2 }}>{a.description}</div>
                  {has && <div style={{ fontSize: 11, color: '#F59E0B', fontWeight: 700, marginTop: 4 }}>+{a.xp} XP earned ✨</div>}
                </div>
                {has && <div style={{ fontSize: 20 }}>✅</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── PARENT DASHBOARD ──────────────────────────────────────────
export function ParentDash() {
  const { child: activeChild, children, progress, updateChildLocally, switchChild, logout } = useAuth();
  // Viewing child = the one selected in dashboard (default = active reading child)
  const [viewingId, setViewingId] = useState(activeChild?.id);
  const child = children?.find(c => c.id === viewingId) || activeChild;

  const handleSwitchView = (id) => {
    setViewingId(id);
    switchChild(id); // also switch the active reading child
  };
  const nav = useNavigate();
  const [goalForm, setGoalForm] = useState(false);
  const [gf, setGf]             = useState({ title: '', cost: '', emoji: '🎁' });
  const { toast, showToast, hideToast } = useToast();
  const [savingPhase, setSavingPhase] = useState(false);

  if (!child) return null;
  const done = progress?.completedStories || [];
  const PHASE_META = {
    2: { label: 'Simple CVC Words',      color: '#10B981' },
    3: { label: 'Digraphs & Vowel Teams',color: '#3B82F6' },
    4: { label: 'CCVC/CVCC Blends',      color: '#8B5CF6' },
    5: { label: 'Split Digraphs',        color: '#F59E0B' },
    6: { label: 'Prefixes & Suffixes',   color: '#EF4444' },
  };
  const STORY_COUNTS = { 2: 4, 3: 3, 4: 2, 5: 3, 6: 2 };

  const changePhase = async (p) => {
    setSavingPhase(true);
    try {
      await progressAPI.updateChild(child.id, { phase: parseInt(p) });
      updateChildLocally({ phase: parseInt(p) });
      showToast('Phase updated!', '✅');
    } catch { showToast('Could not update phase', '❌'); }
    finally { setSavingPhase(false); }
  };

  const saveGoal = async () => {
    if (!gf.title || !gf.cost) return;
    try {
      await progressAPI.upsertGoal(child.id, { title: gf.title, emoji: gf.emoji, cost: parseInt(gf.cost) });
      showToast('Goal saved!', '🎯');
      setGoalForm(false);
      window.location.reload();
    } catch { showToast('Could not save goal', '❌'); }
  };

  const deleteGoal = async () => {
    try { await progressAPI.deleteGoal(child.id); showToast('Goal removed', '🗑️'); window.location.reload(); } catch {}
  };

  const stats = [
    { e: '🌰', l: 'Total Acorns',  v: (child.totalAcorns || 0).toLocaleString(), c: '#F59E0B' },
    { e: '💰', l: 'Balance',        v: (child.acorns || 0).toLocaleString(),      c: '#10B981' },
    { e: '📖', l: 'Words Read',     v: (child.wordsRead || 0).toLocaleString(),   c: '#3B82F6' },
    { e: '✨', l: 'AI Stories Done',v: ((progress?.aiStorySummary?.completed) || 0).toLocaleString(), c: '#8B5CF6' },
    { e: '⭐', l: 'Stories Done',   v: done.length,                               c: '#8B5CF6' },
    { e: '🔥', l: 'Streak',         v: `${child.streak || 1}d`,                   c: '#EF4444' },
    { e: '🏆', l: 'Achievements',   v: `${progress?.achievements?.length || 0}`,  c: '#F59E0B' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'var(--font-body)' }}>
      <div style={{ background: 'linear-gradient(135deg,#0D2318,#2D6A4F)', padding: '30px 22px 24px', color: 'white' }}>
        <div style={{ maxWidth: 660, margin: '0 auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: '0.5px', marginBottom: 4 }}>PARENT DASHBOARD</div>
            <h1 style={{ fontSize: 24, fontWeight: 900 }}>{child.name}'s Reading Journey</h1>
            <p style={{ color: '#86EFAC', fontSize: 13, marginTop: 4 }}>Phase {child.phase} · Joined {new Date(child.createdAt || Date.now()).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</p>
            {children && children.length > 1 && (
              <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
                {children.map(c => (
                  <button key={c.id} onClick={() => handleSwitchView(c.id)}
                    style={{ padding:'4px 12px', borderRadius:50, border:`1.5px solid ${c.id===child?.id?'#52B788':'rgba(255,255,255,0.2)'}`, background:c.id===child?.id?'rgba(82,183,136,0.2)':'transparent', color:c.id===child?.id?'#52B788':'rgba(255,255,255,0.6)', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => nav('/home')} style={{ background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 12, padding: '9px 18px', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Back to {child.name}</button>
        </div>
      </div>

      <div style={{ maxWidth: 660, margin: '0 auto', padding: '22px 18px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 22 }}>
          {stats.map(s => (
            <div key={s.l} style={{ background: 'white', borderRadius: 16, padding: '14px 12px', boxShadow: 'var(--shadow-sm)', textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{s.e}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Phase progress */}
        <div style={{ background: 'white', borderRadius: 20, padding: 22, boxShadow: 'var(--shadow-sm)', marginBottom: 16 }}>
          <h3 style={{ fontWeight: 900, fontSize: 16, marginBottom: 16 }}>📚 Progress by Phonics Phase</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(PHASE_META).map(([p, meta]) => {
              const ps = STORY_COUNTS[parseInt(p)] || 0;
              const pd = done.filter(c => c.storyId?.startsWith(`p${p}_`)).length;
              const cur = parseInt(p) === child.phase;
              return (
                <div key={p} style={{ background: cur ? '#F0FDF4' : '#FAFAF9', borderRadius: 12, padding: '12px 14px', border: `1.5px solid ${cur ? '#BBF7D0' : 'transparent'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: 13 }}>Phase {p}</span>
                      {cur && <span style={{ marginLeft: 8, fontSize: 10, background: meta.color, color: 'white', padding: '2px 7px', borderRadius: 50, fontWeight: 800 }}>Current</span>}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{meta.label}</div>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{pd}/{ps}</span>
                  </div>
                  <div style={{ background: '#E5E7EB', borderRadius: 50, height: 6 }}>
                    <div style={{ height: '100%', background: meta.color, borderRadius: 50, width: `${ps > 0 ? Math.round(pd / ps * 100) : 0}%`, transition: 'width 0.5s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Phase control */}
        <div style={{ background: 'white', borderRadius: 20, padding: 22, boxShadow: 'var(--shadow-sm)', marginBottom: 16 }}>
          <h3 style={{ fontWeight: 900, fontSize: 16, marginBottom: 6 }}>⚙️ Change Phonics Phase</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>Move {child.name} to a different level as they progress.</p>
          <select value={child.phase} onChange={e => changePhase(e.target.value)} disabled={savingPhase} style={{ width: '100%', padding: '12px 14px', border: '2px solid var(--border)', borderRadius: 14, fontSize: 14, fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text)', background: '#FAFAF9', cursor: 'pointer', outline: 'none' }}>
            {Object.entries(PHASE_META).map(([p, m]) => <option key={p} value={p}>Phase {p} — {m.label}</option>)}
          </select>
        </div>

        {/* Interests for AI Story Personalisation */}
      {/* Recent reading history */}
      {progress?.recentSessions?.length > 0 && (
        <div style={{ background:'var(--card)', borderRadius:18, padding:'20px', marginBottom:16 }}>
          <h3 style={{ fontSize:15, fontWeight:800, marginBottom:12 }}>Recent Reading</h3>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {progress.recentSessions.slice(0,5).map(s => (
              <div key={s.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'rgba(0,0,0,0.03)', borderRadius:10 }}>
                <span style={{ fontSize:16 }}>{s.storyType==='ai'?'✨':'📚'}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.storyTitle||'Story'}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>{s.storyType==='ai'?'AI story':'Curriculum'} · {Math.round(s.accuracy||0)}% accuracy</div>
                </div>
                <span style={{ fontSize:12, fontWeight:700, color:'#F59E0B' }}>+{s.acornsEarned||0}🌰</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {child && <InterestsPanel childId={child.id} childName={child.name} initialInterests={[]} onSaved={() => {}}/>}
      {/* ── STORY BOOKS ────────────────────────────────────── */}
      {child && (
        <div style={{ background: 'white', borderRadius: 20, padding: 22, boxShadow: 'var(--shadow-sm)', marginBottom: 20 }}>
          <StoryBookShelf child={child} />
        </div>
      )}

      <div style={{ marginTop: 28 }}>
        <KidsManager />
      </div>

      {/* Custom goal */}
        <div style={{ background: 'white', borderRadius: 20, padding: 22, boxShadow: 'var(--shadow-sm)', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ fontWeight: 900, fontSize: 16 }}>🎯 Custom Reward Goal</h3>
            {!progress?.customGoal && !goalForm && <button onClick={() => setGoalForm(true)} style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 50, padding: '6px 14px', color: '#2D6A4F', fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>+ Add</button>}
          </div>
          {goalForm && (
            <div style={{ background: '#F9FAFB', borderRadius: 14, padding: 16, border: '1.5px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {['🎁','🎢','🎮','🦁','🍦','🚂','⚽','🏊'].map(e => <button key={e} onClick={() => setGf(p => ({ ...p, emoji: e }))} style={{ width: 34, height: 34, borderRadius: 8, border: `2px solid ${gf.emoji === e ? '#2D6A4F' : 'var(--border)'}`, background: gf.emoji === e ? '#F0FDF4' : 'white', fontSize: 18, cursor: 'pointer' }}>{e}</button>)}
              </div>
              <input value={gf.title} onChange={e => setGf(p => ({ ...p, title: e.target.value }))} placeholder='e.g. "Trip to the Zoo"' style={{ width: '100%', padding: '10px 12px', border: '2px solid var(--border)', borderRadius: 10, fontSize: 14, marginBottom: 8, fontFamily: 'var(--font-body)', fontWeight: 600, outline: 'none', color: 'var(--text)' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" value={gf.cost} onChange={e => setGf(p => ({ ...p, cost: e.target.value }))} placeholder="Acorn cost e.g. 300" style={{ flex: 1, padding: '10px 12px', border: '2px solid var(--border)', borderRadius: 10, fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', color: 'var(--text)' }} />
                <Button onClick={saveGoal} size="sm">Save</Button>
              </div>
            </div>
          )}
          {progress?.customGoal && (
            <div style={{ background: 'linear-gradient(135deg,#FEF3C7,#FDE68A)', borderRadius: 16, padding: '16px 18px', border: '1.5px solid rgba(245,158,11,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 30 }}>{progress.customGoal.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 15, color: '#92400E' }}>{progress.customGoal.title}</div>
                    <div style={{ fontSize: 12, color: '#B45309' }}>Goal: 🌰{progress.customGoal.cost.toLocaleString()}</div>
                  </div>
                </div>
                <button onClick={deleteGoal} style={{ background: 'transparent', border: 'none', color: '#B45309', fontSize: 18, cursor: 'pointer' }}>×</button>
              </div>
              <div style={{ background: 'rgba(146,64,14,0.15)', borderRadius: 50, height: 10, overflow: 'hidden', marginBottom: 4 }}>
                <div style={{ height: '100%', background: 'linear-gradient(90deg,#D97706,#F59E0B)', borderRadius: 50, width: `${Math.min(100, Math.round((child.acorns || 0) / progress.customGoal.cost * 100))}%`, transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontSize: 11, color: '#B45309', fontWeight: 700 }}>🌰 {Math.min(child.acorns || 0, progress.customGoal.cost)} / {progress.customGoal.cost}</div>
            </div>
          )}
        </div>

        {/* Privacy */}
        <div style={{ background: '#F0FDF4', borderRadius: 16, padding: 18, border: '1.5px solid #BBF7D0', marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>🔒</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: 13, color: '#065F46', marginBottom: 4 }}>Privacy & GDPR</div>
              <p style={{ fontSize: 12, color: '#047857', lineHeight: 1.55 }}>No audio is ever recorded or stored. Speech recognition uses your browser's built-in engine only. All child data is stored securely on your device and our server — never sold or shared. GDPR-K compliant.</p>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <button onClick={() => { logout(); nav('/'); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-body)', padding: 10 }}>Sign out of Properly</button>
        </div>
      </div>
      {toast && <Toast message={toast.message} emoji={toast.emoji} onHide={hideToast} />}
    </div>
  );
}

export default Shop;
