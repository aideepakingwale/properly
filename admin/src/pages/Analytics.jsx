/**
 * @file        Analytics.jsx
 * @description Platform analytics — 30-day session trend, accuracy distribution buckets, phase breakdown, acorns chart, top readers leaderboard
 * @module      Admin Pages
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 */

import { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function Analytics() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.analytics().then(r => { if (r.success) setData(r.data); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding:40, color:'var(--muted)' }}>Loading…</div>;
  if (!data)   return <div style={{ padding:40, color:'var(--danger)' }}>Failed to load</div>;

  const { sessionsByDay, phaseDistribution, topReaders, accuracyBuckets } = data;
  const totalBucket = Object.values(accuracyBuckets).reduce((a,b)=>a+(b||0), 0);

  const buckets = [
    { label:'Excellent (90%+)', key:'excellent', color:'var(--accent)' },
    { label:'Good (70–89%)',    key:'good',      color:'var(--blue)' },
    { label:'Fair (50–69%)',    key:'fair',      color:'var(--accent2)' },
    { label:'Needs work (<50%)',key:'needs_work',color:'var(--danger)' },
  ];

  return (
    <div style={{ padding:28 }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:800 }}>Analytics</h1>
        <div style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>Reading performance — last 30 days</div>
      </div>

      {/* Sessions over time */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:20, marginBottom:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
          <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase' }}>Daily Sessions</div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={sessionsByDay} margin={{ top:4, right:0, left:-20, bottom:0 }}>
            <XAxis dataKey="day" tick={{ fontSize:9, fill:'var(--muted)' }} tickLine={false} axisLine={false} tickFormatter={d=>d.slice(5)} interval={4} />
            <YAxis tick={{ fontSize:9, fill:'var(--muted)' }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ background:'var(--surface)', border:'1px solid var(--border2)', borderRadius:4, fontSize:11 }}
              formatter={(v,n) => [v, n==='sessions'?'Sessions':'Avg Acc %']} />
            <Line type="monotone" dataKey="sessions" stroke="var(--accent)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="avg_accuracy" stroke="var(--blue)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
        <div style={{ display:'flex', gap:16, marginTop:8, justifyContent:'center' }}>
          {[['Sessions','var(--accent)','solid'],['Avg Accuracy','var(--blue)','dashed']].map(([l,c,d]) => (
            <div key={l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:'var(--muted)' }}>
              <div style={{ width:16, height:2, background:c, borderRadius:1, borderTop: d==='dashed'?`2px dashed ${c}`:`2px solid ${c}`, background:'transparent' }} />
              {l}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:16, marginBottom:20 }}>
        {/* Accuracy distribution */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:20 }}>
          <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:16 }}>Accuracy Distribution</div>
          {buckets.map(b => {
            const pct = totalBucket>0 ? Math.round((accuracyBuckets[b.key]||0)/totalBucket*100) : 0;
            return (
              <div key={b.key} style={{ marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ fontSize:11, color:'var(--muted)' }}>{b.label}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:b.color }}>{pct}%</span>
                </div>
                <div style={{ height:4, background:'var(--border2)', borderRadius:2 }}>
                  <div style={{ width:`${pct}%`, height:'100%', background:b.color, borderRadius:2, transition:'width 0.5s' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Phase distribution */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:20 }}>
          <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:16 }}>Children by Phase</div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={phaseDistribution} margin={{ top:0, right:0, left:-20, bottom:0 }}>
              <XAxis dataKey="phase" tick={{ fontSize:10, fill:'var(--muted)' }} tickLine={false} axisLine={false} tickFormatter={p=>`P${p}`} />
              <YAxis tick={{ fontSize:10, fill:'var(--muted)' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background:'var(--surface)', border:'1px solid var(--border2)', borderRadius:4, fontSize:11 }} />
              <Bar dataKey="children" fill="var(--purple)" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Acorns awarded */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:20 }}>
          <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:16 }}>Acorns Awarded / Day</div>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={sessionsByDay} margin={{ top:0, right:0, left:-20, bottom:0 }}>
              <XAxis dataKey="day" tick={{ fontSize:9, fill:'var(--muted)' }} tickLine={false} axisLine={false} tickFormatter={d=>d.slice(5)} interval={6} />
              <YAxis tick={{ fontSize:10, fill:'var(--muted)' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background:'var(--surface)', border:'1px solid var(--border2)', borderRadius:4, fontSize:11 }} />
              <Bar dataKey="acorns_awarded" fill="var(--accent2)" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top readers */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8 }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', fontSize:10, color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase' }}>
          Top Readers (by total acorns)
        </div>
        <table>
          <thead><tr><th>#</th><th>Child</th><th>Parent</th><th>Phase</th><th>Acorns</th><th>Words Read</th><th>Sessions</th></tr></thead>
          <tbody>
            {topReaders.map((r, i) => (
              <tr key={i}>
                <td style={{ color:'var(--muted)', fontWeight:700 }}>#{i+1}</td>
                <td style={{ fontWeight:700 }}>{r.name}</td>
                <td style={{ color:'var(--muted)', fontSize:11 }}>{r.email}</td>
                <td><span className="badge badge-blue">P{r.phase}</span></td>
                <td style={{ color:'var(--accent2)', fontWeight:700 }}>🌰 {(r.total_acorns||0).toLocaleString()}</td>
                <td style={{ color:'var(--muted)' }}>{(r.words_read||0).toLocaleString()}</td>
                <td style={{ color:'var(--muted)' }}>{r.sessions}</td>
              </tr>
            ))}
            {topReaders.length===0 && <tr><td colSpan={7} style={{ textAlign:'center', color:'var(--muted)', padding:24 }}>No data yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
