/**
 * @file        Stories.jsx
 * @description Stories overview — curriculum story read-counts/accuracy stats and AI story generation analytics by theme and provider
 * @module      Admin Pages
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 */

import { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';

const PHASE_LABEL = { 2:'CVC',3:'Digraphs',4:'Blends',5:'Split Digraphs',6:'Morphology' };

export default function Stories() {
  const [stories,  setStories]  = useState([]);
  const [aiStats,  setAiStats]  = useState(null);
  const [tab,      setTab]      = useState('curriculum');
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([adminAPI.stories(), adminAPI.aiStats()]).then(([r1,r2]) => {
      if (r1.success) setStories(r1.data.stories);
      if (r2.success) setAiStats(r2.data);
    }).finally(() => setLoading(false));
  }, []);

  const phaseColor = { 2:'var(--blue)',3:'var(--accent)',4:'var(--amber)',5:'var(--purple)',6:'var(--danger)' };

  return (
    <div className='page'>
      <div style={{ marginBottom:20 }}>
        <h1>Stories</h1>
        <div style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>Curriculum library & AI generation stats</div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:4, width:'fit-content', marginBottom:20 }}>
        {[['curriculum','📚 Curriculum'],['ai','✨ AI Stories']].map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k)} className="btn btn-sm"
            style={{ background:tab===k?'var(--accent)':'transparent', color:tab===k?'#000':'var(--muted)', border:'none' }}>
            {l}
          </button>
        ))}
      </div>

      {loading ? <div style={{ color:'var(--muted)', padding:40 }}>Loading…</div> : tab==='curriculum' ? (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8 }}>
          <table>
            <thead><tr><th>Story</th><th>Phase</th><th>Acorns</th><th>Pages</th><th>Reads</th><th>Avg Accuracy</th></tr></thead>
            <tbody>
              {stories.map(s => (
                <tr key={s.id}>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:20 }}>{s.emoji}</span>
                      <div>
                        <div style={{ fontWeight:600 }}>{s.title}</div>
                        <div style={{ fontSize:10, color:'var(--muted)' }}>{s.id}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge" style={{ background:`${phaseColor[s.phase]}20`, color:phaseColor[s.phase], border:`1px solid ${phaseColor[s.phase]}40` }}>
                      P{s.phase} · {PHASE_LABEL[s.phase]}
                    </span>
                  </td>
                  <td style={{ color:'var(--amber)' }}>🌰 {s.acorns}</td>
                  <td style={{ color:'var(--muted)' }}>{s.page_count}</td>
                  <td style={{ fontWeight: s.reads>0?600:400, color: s.reads>0?'var(--text)':'var(--muted)' }}>{s.reads}</td>
                  <td>
                    {s.avgAccuracy
                      ? <span style={{ color: s.avgAccuracy>=80?'var(--accent)':s.avgAccuracy>=60?'var(--amber)':'var(--danger)', fontWeight:700 }}>{s.avgAccuracy}%</span>
                      : <span style={{ color:'var(--muted)' }}>–</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : aiStats ? (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* By theme */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8 }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', fontSize:10, color:'var(--muted)', letterSpacing:'0.5px', textTransform:'uppercase' }}>By Theme</div>
            <table>
              <thead><tr><th>Theme</th><th>Generated</th><th>Completed</th><th>Completion %</th><th>Avg Accuracy</th></tr></thead>
              <tbody>
                {aiStats.byTheme.map(t => (
                  <tr key={t.theme}>
                    <td style={{ textTransform:'capitalize', fontWeight:600 }}>{t.theme}</td>
                    <td>{t.total}</td>
                    <td style={{ color:'var(--accent)' }}>{t.completed}</td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:60, height:4, background:'var(--border2)', borderRadius:2, overflow:'hidden' }}>
                          <div style={{ width:`${t.total>0?Math.round(t.completed/t.total*100):0}%`, height:'100%', background:'var(--accent)', borderRadius:2 }} />
                        </div>
                        <span style={{ color:'var(--muted)', fontSize:11 }}>{t.total>0?Math.round(t.completed/t.total*100):0}%</span>
                      </div>
                    </td>
                    <td style={{ color: t.avg_acc>=80?'var(--accent)':t.avg_acc>=60?'var(--amber)':'var(--danger)' }}>
                      {t.avg_acc ? `${t.avg_acc}%` : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* By AI provider */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:20 }}>
            <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:'0.5px', textTransform:'uppercase', marginBottom:14 }}>By AI Provider</div>
            <div style={{ display:'flex', gap:16 }}>
              {aiStats.byProvider.map(p => (
                <div key={p.ai_provider} style={{ background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:8, padding:'14px 20px', minWidth:120 }}>
                  <div style={{ fontSize:20, fontWeight:700, color: p.ai_provider==='gemini'?'var(--blue)':p.ai_provider==='groq'?'var(--purple)':'var(--muted)' }}>{p.total}</div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginTop:3, textTransform:'capitalize' }}>{p.ai_provider}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
