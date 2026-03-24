import { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

function Stat({ label, value, sub, color = 'var(--accent)' }) {
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'16px 20px' }}>
      <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:6 }}>{label}</div>
      <div style={{ fontSize:28, fontWeight:700, fontFamily:'var(--font-ui)', color }}>{value ?? '–'}</div>
      {sub && <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>{sub}</div>}
    </div>
  );
}

const PLAN_COLOR = { free:'var(--muted)', sprout:'var(--accent)', forest:'var(--accent2)' };

export default function Dashboard() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.dashboard().then(r => { if (r.success) setData(r.data); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding:40, color:'var(--muted)' }}>Loading dashboard…</div>;
  if (!data)   return <div style={{ padding:40, color:'var(--danger)' }}>Failed to load</div>;

  const { stats, planBreakdown, weeklySignups, recentUsers, recentSessions } = data;

  return (
    <div style={{ padding:28 }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text)' }}>Dashboard</h1>
        <div style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>System overview — Properly v2.0</div>
      </div>

      {/* Stats grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        <Stat label="Total Users"    value={stats.totalUsers}    sub={`${stats.verifiedUsers} verified`} />
        <Stat label="Children"       value={stats.totalChildren} sub="across all accounts" color="var(--blue)" />
        <Stat label="Sessions"       value={stats.totalSessions} sub={`avg ${stats.avgAccuracy ?? '–'}% accuracy`} color="var(--accent2)" />
        <Stat label="AI Stories"     value={stats.totalAiStories} sub={`${stats.aiCompleted} completed`} color="var(--purple)" />
      </div>

      {/* Charts row */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:16, marginBottom:24 }}>
        {/* Signups chart */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:20 }}>
          <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:16 }}>Signups — Last 7 days</div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={weeklySignups} margin={{ top:0, right:0, left:-20, bottom:0 }}>
              <XAxis dataKey="day" tick={{ fontSize:10, fill:'var(--muted)' }} tickLine={false} axisLine={false} tickFormatter={d=>d.slice(5)} />
              <YAxis tick={{ fontSize:10, fill:'var(--muted)' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background:'var(--surface)', border:'1px solid var(--border2)', borderRadius:4, fontSize:11 }} />
              <Bar dataKey="n" fill="var(--accent)" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Plan breakdown */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:20 }}>
          <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:16 }}>Plan Distribution</div>
          {planBreakdown.map(p => (
            <div key={p.plan} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:8, height:8, borderRadius:'50%', background: PLAN_COLOR[p.plan] || 'var(--muted)' }} />
                <span style={{ textTransform:'capitalize', color:'var(--text)' }}>{p.plan}</span>
              </div>
              <span style={{ fontWeight:700, color: PLAN_COLOR[p.plan] || 'var(--muted)' }}>{p.n}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent tables */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Recent signups */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8 }}>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', fontSize:10, color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase' }}>
            Recent Signups
          </div>
          <table>
            <thead><tr><th>Email</th><th>Plan</th><th>Date</th></tr></thead>
            <tbody>
              {recentUsers.map(u => (
                <tr key={u.id}>
                  <td><span style={{ color: u.isAdmin ? 'var(--accent2)' : 'var(--text)' }}>{u.email}</span></td>
                  <td><span className={`badge badge-${u.plan==='forest'?'amber':u.plan==='sprout'?'green':'gray'}`}>{u.plan}</span></td>
                  <td style={{ color:'var(--muted)' }}>{new Date(u.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recent sessions */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8 }}>
          <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', fontSize:10, color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase' }}>
            Recent Sessions
          </div>
          <table>
            <thead><tr><th>Child</th><th>Story</th><th>Acc</th></tr></thead>
          <tbody>
            {recentSessions.map(s => (
              <tr key={s.id}>
                <td style={{ color:'var(--text)' }}>{s.child_name}</td>
                <td style={{ color:'var(--muted)', fontSize:11, maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {s.story_type === 'ai' ? '✨ ' : '📚 '}{s.story_title}
                </td>
                <td>
                  <span style={{ color: s.accuracy >= 80 ? 'var(--accent)' : s.accuracy >= 60 ? 'var(--accent2)' : 'var(--danger)', fontWeight:700 }}>
                    {Math.round(s.accuracy ?? 0)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
