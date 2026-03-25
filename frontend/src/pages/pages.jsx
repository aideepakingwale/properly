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
import { shopAPI, progressAPI, aiStoryAPI, reportAPI, bookAPI } from '../services/api';
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
    <div style={{ minHeight: '100vh', background: 'var(--grad-hero-dark)', fontFamily: 'var(--font-body)', color: 'white' }}>
      <div style={{ maxWidth: 580, margin: '0 auto' }}>
        <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--overlay-8)' }}>
          <button onClick={() => nav('/home')} style={{ background: 'var(--overlay-8)', border: '1.5px solid var(--overlay-15)', borderRadius: 50, padding: '7px 16px', color: 'var(--overlay-80)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>← Back</button>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>🏪 Acorn Shop</h2>
          <AcornPill count={child?.acorns || 0} size={14} />
        </div>

        <div style={{ textAlign: 'center', padding: '20px 0 12px' }}>
          <div className="animate-float" style={{ fontSize: 72 }}>🦔</div>
          <p style={{ color: 'var(--overlay-40)', fontSize: 12, marginTop: 4 }}>Pippin — dress me up! 🌟</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 8 }}>
            {[...owned].slice(0, 5).map(id => { const it = items.find(i => i.id === id); return it ? <span key={id} style={{ fontSize: 24 }}>{it.emoji}</span> : null; })}
          </div>
        </div>

        <div style={{ padding: '0 18px' }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--overlay-6)', borderRadius: 16, padding: 4, marginBottom: 18 }}>
            {TABS.map(({ k, l }) => (
              <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: '9px 6px', borderRadius: 13, border: 'none', background: tab === k ? 'var(--overlay-15)' : 'transparent', fontWeight: tab === k ? 800 : 600, fontSize: 12, color: tab === k ? 'white' : 'var(--overlay-45)', cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.2s' }}>{l}</button>
            ))}
          </div>
          {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spinner color="white" size={36} /></div> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, paddingBottom: 40 }}>
              {shown.map(item => {
                const has = owned.has(item.id);
                const can = (child?.acorns || 0) >= item.cost;
                return (
                  <div key={item.id} style={{ background: has ? 'var(--primary-10)' : 'var(--overlay-5)', border: `1.5px solid ${has ? 'var(--primary-40)' : 'var(--overlay-8)'}`, borderRadius: 18, padding: '18px 12px', textAlign: 'center', transition: 'transform 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>{item.emoji}</div>
                    <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 3 }}>{item.name}</div>
                    <div style={{ color: 'var(--overlay-35)', fontSize: 11, marginBottom: 10, lineHeight: 1.3 }}>{item.description}</div>
                    {has ? <div style={{ color: 'var(--color-success)', fontSize: 12, fontWeight: 800 }}>✓ Owned</div>
                      : <button onClick={() => buy(item)} style={{ background: can ? 'linear-gradient(135deg,var(--brand-accent),var(--color-accent))' : 'var(--overlay-5)', border: can ? 'none' : '1px solid var(--overlay-10)', borderRadius: 50, padding: '6px 16px', color: can ? 'var(--text-warning-dark)' : 'var(--overlay-25)', fontWeight: 900, fontSize: 13, cursor: can ? 'pointer' : 'default', fontFamily: 'var(--font-body)' }}>🌰 {item.cost}</button>}
                    {!has && !can && <div style={{ fontSize: 10, color: 'var(--overlay-20)', marginTop: 4 }}>need {item.cost - (child?.acorns || 0)} more</div>}
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
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,var(--bg-dark-mid),var(--bg-dark))', fontFamily: 'var(--font-body)', color: 'white' }}>
      <div style={{ maxWidth: 580, margin: '0 auto', padding: '0 18px' }}>
        <div style={{ padding: '16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => nav('/home')} style={{ background: 'var(--overlay-10)', border: 'none', borderRadius: 50, padding: '8px 16px', color: 'var(--overlay-70)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>← Back</button>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>🏆 Trophy Room</h2>
          <div style={{ fontSize: 13, color: 'var(--color-accent)', fontWeight: 700 }}>{earned.size}/{list.length}</div>
        </div>
        <div style={{ textAlign: 'center', padding: '10px 0 24px' }}>
          <div className="animate-float" style={{ fontSize: 60 }}>🏆</div>
          <p style={{ color: 'var(--overlay-45)', fontSize: 13, marginTop: 6 }}>
            {earned.size === 0 ? 'Complete stories to earn trophies!' : earned.size === list.length ? 'All trophies collected! 🎉' : `${list.length - earned.size} more to collect!`}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 40 }}>
          {list.map(a => {
            const has = earned.has(a.id);
            return (
              <div key={a.id} style={{ background: has ? 'var(--accent-12)' : 'var(--overlay-4)', border: `1.5px solid ${has ? 'var(--accent-30)' : 'var(--overlay-6)'}`, borderRadius: 18, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, opacity: has ? 1 : 0.45 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: has ? 'var(--grad-goal)' : 'var(--overlay-5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 }}>{a.emoji}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 900, fontSize: 15, color: has ? 'var(--color-accent-pale)' : 'var(--overlay-40)' }}>{a.title}</div>
                  <div style={{ fontSize: 12, color: has ? 'var(--overlay-50)' : 'var(--overlay-20)', marginTop: 2 }}>{a.description}</div>
                  {has && <div style={{ fontSize: 11, color: 'var(--brand-accent)', fontWeight: 700, marginTop: 4 }}>+{a.xp} XP earned ✨</div>}
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
  const [dashTab, setDashTab]         = useState('progress');  // progress | books | reports | settings
  const [myReports, setMyReports]     = useState([]);
  const [reportsLoaded, setReportsLoaded] = useState(false);
  const [bookCredits, setBookCredits] = useState(null);

  const loadReports = () => {
    if (reportsLoaded) return;
    reportAPI.myReports().then(r => { if (r.success) { setMyReports(r.data); setReportsLoaded(true); }}).catch(() => {});
    bookAPI.getCredits().then(r => { if (r.success) setBookCredits(r.data.credits); }).catch(() => {});
  };

  if (!child) return null;
  const done = progress?.completedStories || [];
  const PHASE_META = {
    2: { label: 'Simple CVC Words',      color: 'var(--color-success)' },
    3: { label: 'Digraphs & Vowel Teams',color: 'var(--color-info)' },
    4: { label: 'CCVC/CVCC Blends',      color: 'var(--color-primary-light)' },
    5: { label: 'Split Digraphs',        color: 'var(--brand-accent)' },
    6: { label: 'Prefixes & Suffixes',   color: 'var(--color-danger)' },
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
    { e: '🌰', l: 'Total Acorns',  v: (child.totalAcorns || 0).toLocaleString(), c: 'var(--brand-accent)' },
    { e: '💰', l: 'Balance',        v: (child.acorns || 0).toLocaleString(),      c: 'var(--color-success)' },
    { e: '📖', l: 'Words Read',     v: (child.wordsRead || 0).toLocaleString(),   c: 'var(--color-info)' },
    { e: '✨', l: 'AI Stories Done',v: ((progress?.aiStorySummary?.completed) || 0).toLocaleString(), c: 'var(--color-primary-light)' },
    { e: '⭐', l: 'Stories Done',   v: done.length,                               c: 'var(--color-primary-light)' },
    { e: '🔥', l: 'Streak',         v: `${child.streak || 1}d`,                   c: 'var(--color-danger)' },
    { e: '🏆', l: 'Achievements',   v: `${progress?.achievements?.length || 0}`,  c: 'var(--brand-accent)' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-muted)', fontFamily: 'var(--font-body)' }}>
      <div style={{ background: 'var(--grad-header)', padding: '30px 22px 24px', color: 'white' }}>
        <div style={{ maxWidth: 660, margin: '0 auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--overlay-50)', fontWeight: 700, letterSpacing: '0.5px', marginBottom: 4 }}>PARENT DASHBOARD</div>
            <h1 style={{ fontSize: 24, fontWeight: 900 }}>{child.name}'s Reading Journey</h1>
            <p style={{ color: 'var(--brand-primary-light)', fontSize: 13, marginTop: 4 }}>Phase {child.phase} · Joined {new Date(child.createdAt || Date.now()).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</p>
            {children && children.length > 1 && (
              <div style={{ display:'flex', gap:6, marginTop:8, flexWrap:'wrap' }}>
                {children.map(c => (
                  <button key={c.id} onClick={() => handleSwitchView(c.id)}
                    style={{ padding:'4px 12px', borderRadius:50, border:`1.5px solid ${c.id===child?.id?'var(--brand-primary-light)':'var(--overlay-20)'}`, background:c.id===child?.id?'rgba(167,139,250,0.2)':'transparent', color:c.id===child?.id?'var(--brand-primary-light)':'var(--overlay-60)', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }}>
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => nav('/home')} style={{ background: 'var(--overlay-12)', border: '1.5px solid var(--overlay-20)', borderRadius: 12, padding: '9px 18px', color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Back to {child.name}</button>
        </div>
      </div>

      <div style={{ maxWidth: 660, margin: '0 auto', padding: '16px 18px' }}>

        {/* ── TAB NAV ───────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 3, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 4, marginBottom: 20, boxShadow: 'var(--shadow-sm)' }}>
          {[
            { k:'progress', icon:'📈', label:'Progress' },
            { k:'books',    icon:'📚', label:`Books${bookCredits !== null ? ` (${bookCredits})` : ''}` },
            { k:'reports',  icon:'🚩', label:`My Reports${myReports.length ? ` (${myReports.length})` : ''}` },
            { k:'settings', icon:'⚙️', label:'Settings' },
          ].map(({ k, icon, label }) => (
            <button key={k} onClick={() => { setDashTab(k); if (k==='reports' || k==='books') loadReports(); }}
              style={{ flex:1, padding:'8px 2px', borderRadius:11, border:'none',
                background: dashTab===k ? 'var(--grad-primary)' : 'transparent',
                color: dashTab===k ? '#fff' : 'var(--text-muted)',
                fontWeight: dashTab===k ? 800 : 600, fontSize: 11,
                cursor:'pointer', fontFamily:'var(--font-body)', transition:'all 0.2s',
                display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
              <span style={{ fontSize: 14 }}>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* ── PROGRESS TAB ──────────────────────────────────────── */}
        {dashTab === 'progress' && <>

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
                <div key={p} style={{ background: cur ? 'var(--bg-primary-light)' : 'var(--bg-muted)', borderRadius: 12, padding: '12px 14px', border: `1.5px solid ${cur ? 'var(--color-primary)' : 'transparent'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: 13 }}>Phase {p}</span>
                      {cur && <span style={{ marginLeft: 8, fontSize: 10, background: meta.color, color: 'white', padding: '2px 7px', borderRadius: 50, fontWeight: 800 }}>Current</span>}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{meta.label}</div>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{pd}/{ps}</span>
                  </div>
                  <div style={{ background: 'var(--border)', borderRadius: 50, height: 6 }}>
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
          <select value={child.phase} onChange={e => changePhase(e.target.value)} disabled={savingPhase} style={{ width: '100%', padding: '12px 14px', border: '2px solid var(--border)', borderRadius: 14, fontSize: 14, fontFamily: 'var(--font-body)', fontWeight: 700, color: 'var(--text)', background: 'var(--bg-muted)', cursor: 'pointer', outline: 'none' }}>
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
                <span style={{ fontSize:12, fontWeight:700, color:'var(--brand-accent)' }}>+{s.acornsEarned||0}🌰</span>
              </div>
            ))}
          </div>
        </div>
      )}
      </> /* end progress tab */ }

      {/* ── BOOKS TAB ─────────────────────────────────────────── */}
      {dashTab === 'books' && child && (
        <div style={{ background: 'white', borderRadius: 20, padding: 22, boxShadow: 'var(--shadow-sm)', marginBottom: 20 }}>
          <StoryBookShelf child={child} />
        </div>
      )}

      {/* ── REPORTS TAB ───────────────────────────────────────── */}
      {dashTab === 'reports' && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            Reports you've submitted about AI stories or books. Valid reports may earn you <strong style={{ color: 'var(--color-primary)' }}>bonus credits</strong>!
          </div>
          {myReports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🚩</div>
              <div style={{ fontSize: 14 }}>No reports submitted yet.</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Use the 🚩 flag button on any AI story or book to report an issue.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {myReports.map(r => {
                const statusColour = r.status==='credited' ? 'var(--color-success)' : r.status==='dismissed' ? 'var(--text-muted)' : 'var(--brand-accent)';
                const statusLabel  = r.status==='credited' ? '✅ Credited' : r.status==='dismissed' ? 'Dismissed' : '⏳ Pending';
                return (
                  <div key={r.id} style={{ background: 'white', borderRadius: 14, padding: '14px 16px', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{r.content_title || r.content_type}</div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: statusColour, background: r.status==='pending' ? 'var(--brand-accent-pale)' : r.status==='credited' ? 'var(--bg-success-light)' : 'var(--bg-subtle)', borderRadius: 20, padding: '2px 10px' }}>
                        {statusLabel}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {r.reason.replace(/_/g,' ')} · {new Date(r.created_at).toLocaleDateString('en-GB')}
                    </div>
                    {r.credits_awarded > 0 && (
                      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-success)', fontWeight: 700 }}>
                        🎁 +{r.credits_awarded} {r.credit_type} credit{r.credits_awarded !== 1 ? 's' : ''} awarded!
                        {r.admin_note && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}> — "{r.admin_note}"</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SETTINGS TAB ──────────────────────────────────────── */}
      {dashTab === 'settings' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {child && <InterestsPanel childId={child.id} childName={child.name} initialInterests={[]} onSaved={() => {}}/>}
          <div style={{ marginTop: 4 }}>
            <KidsManager />
          </div>

      {/* Custom goal */}
        <div style={{ background: 'white', borderRadius: 20, padding: 22, boxShadow: 'var(--shadow-sm)', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ fontWeight: 900, fontSize: 16 }}>🎯 Custom Reward Goal</h3>
            {!progress?.customGoal && !goalForm && <button onClick={() => setGoalForm(true)} style={{ background: 'var(--grad-accent)', border: 'none', borderRadius: 50, padding: '6px 14px', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>+ Add</button>}
          </div>
          {goalForm && (
            <div style={{ background: 'var(--bg-muted)', borderRadius: 14, padding: 16, border: '1.5px solid var(--border)' }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                {['🎁','🎢','🎮','🦁','🍦','🚂','⚽','🏊'].map(e => <button key={e} onClick={() => setGf(p => ({ ...p, emoji: e }))} style={{ width: 34, height: 34, borderRadius: 8, border: `2px solid ${gf.emoji === e ? 'var(--color-primary)' : 'var(--border)'}`, background: gf.emoji === e ? 'var(--bg-primary-light)' : 'white', fontSize: 18, cursor: 'pointer' }}>{e}</button>)}
              </div>
              <input value={gf.title} onChange={e => setGf(p => ({ ...p, title: e.target.value }))} placeholder='e.g. "Trip to the Zoo"' style={{ width: '100%', padding: '10px 12px', border: '2px solid var(--border)', borderRadius: 10, fontSize: 14, marginBottom: 8, fontFamily: 'var(--font-body)', fontWeight: 600, outline: 'none', color: 'var(--text)' }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" value={gf.cost} onChange={e => setGf(p => ({ ...p, cost: e.target.value }))} placeholder="Acorn cost e.g. 300" style={{ flex: 1, padding: '10px 12px', border: '2px solid var(--border)', borderRadius: 10, fontSize: 14, fontFamily: 'var(--font-body)', outline: 'none', color: 'var(--text)' }} />
                <Button onClick={saveGoal} size="sm">Save</Button>
              </div>
            </div>
          )}
          {progress?.customGoal && (
            <div style={{ background: 'var(--grad-goal)', borderRadius: 16, padding: '16px 18px', border: '1.5px solid var(--accent-30)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 30 }}>{progress.customGoal.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 15, color: 'var(--text-warning-dark)' }}>{progress.customGoal.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-accent-dark)' }}>Goal: 🌰{progress.customGoal.cost.toLocaleString()}</div>
                  </div>
                </div>
                <button onClick={deleteGoal} style={{ background: 'transparent', border: 'none', color: 'var(--color-accent-dark)', fontSize: 18, cursor: 'pointer' }}>×</button>
              </div>
              <div style={{ background: 'rgba(146,64,14,0.15)', borderRadius: 50, height: 10, overflow: 'hidden', marginBottom: 4 }}>
                <div style={{ height: '100%', background: 'linear-gradient(90deg,var(--color-accent-dark),var(--brand-accent))', borderRadius: 50, width: `${Math.min(100, Math.round((child.acorns || 0) / progress.customGoal.cost * 100))}%`, transition: 'width 0.5s' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-accent-dark)', fontWeight: 700 }}>🌰 {Math.min(child.acorns || 0, progress.customGoal.cost)} / {progress.customGoal.cost}</div>
            </div>
          )}
        </div>

        {/* Privacy */}
        <div style={{ background: 'var(--bg-primary-light)', borderRadius: 16, padding: 18, border: '1.5px solid var(--border-primary-light)', marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>🔒</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: 13, color: 'var(--text-success-dark)', marginBottom: 4 }}>Privacy & GDPR</div>
              <p style={{ fontSize: 12, color: 'var(--text-success-dark)', lineHeight: 1.55 }}>No audio is ever recorded or stored. Speech recognition uses your browser's built-in engine only. All child data is stored securely on your device and our server — never sold or shared. GDPR-K compliant.</p>
            </div>
          </div>
        </div>

          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <button onClick={() => { logout(); nav('/'); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontWeight: 700, cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-body)', padding: 10 }}>Sign out of Properly</button>
          </div>
        </div>  {/* end settings tab content */}
      )}  {/* end settings tab */}
      </div>
      {toast && <Toast message={toast.message} emoji={toast.emoji} onHide={hideToast} />}
    </div>
  );
}

export default Shop;
