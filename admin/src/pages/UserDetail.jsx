/**
 * @file        UserDetail.jsx
 * @description User detail and edit page — view a parent's children + progress, change subscription plan, toggle admin, delete account
 * @module      Admin Pages
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';

const PLANS = ['free','sprout','forest'];
const PLAN_LABELS = { free:'🌱 Free', sprout:'🌿 Sprout — £3.99/mo', forest:'🌳 Forest — £6.99/mo' };

export default function UserDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [plan, setPlan]       = useState('free');
  const [isAdmin, setIsAdmin] = useState(false);
  const [msg, setMsg]         = useState('');

  useEffect(() => {
    adminAPI.user(id).then(r => {
      if (r.success) {
        setData(r.data);
        setPlan(r.data.subscription?.plan || 'free');
        setIsAdmin(r.data.user.isAdmin);
      }
    }).finally(() => setLoading(false));
  }, [id]);

  const save = async () => {
    setSaving(true); setMsg('');
    try {
      await adminAPI.updateUser(id, { plan, isAdmin });
      setMsg('Saved ✓');
      setTimeout(() => setMsg(''), 2000);
    } catch(e) { setMsg('Error: ' + e.message); }
    finally { setSaving(false); }
  };

  const deleteUser = async () => {
    if (!confirm(`Delete user ${data.user.email}? This is permanent and removes all their data.`)) return;
    await adminAPI.deleteUser(id);
    nav('/users');
  };

  if (loading) return <div style={{ padding:40, color:'var(--muted)' }}>Loading…</div>;
  if (!data)   return <div style={{ padding:40, color:'var(--danger)' }}>User not found</div>;

  const { user, subscription, children, recentSessions } = data;

  return (
    <div style={{ padding:28, maxWidth:900 }}>
      {/* Back */}
      <button className="btn btn-ghost btn-sm" style={{ marginBottom:20 }} onClick={() => nav('/users')}>
        ← Back to Users
      </button>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:800, color: user.isAdmin ? 'var(--accent2)' : 'var(--text)' }}>
            {user.email} {user.isAdmin && <span className="badge badge-amber" style={{ marginLeft:8 }}>Admin</span>}
          </h1>
          <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>
            ID: {user.id} · Joined {new Date(user.createdAt).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}
            {user.oauthProvider && ` · via ${user.oauthProvider}`}
          </div>
        </div>
        <button className="btn btn-danger btn-sm" onClick={deleteUser}>Delete User</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'300px 1fr', gap:20 }}>
        {/* Left: edit panel */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* Plan */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:18 }}>
            <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:12 }}>Subscription Plan</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
              {PLANS.map(p => (
                <label key={p} style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', padding:'8px 10px', borderRadius:'var(--radius)', background: plan===p ? 'rgba(0,229,160,0.08)' : 'transparent', border: `1px solid ${plan===p?'rgba(0,229,160,0.3)':'var(--border2)'}` }}>
                  <input type="radio" name="plan" value={p} checked={plan===p} onChange={()=>setPlan(p)} style={{ width:'auto', accentColor:'var(--accent)' }} />
                  <span style={{ color: plan===p?'var(--accent)':'var(--text)', fontSize:12 }}>{PLAN_LABELS[p]}</span>
                </label>
              ))}
            </div>
            {subscription && (
              <div style={{ fontSize:11, color:'var(--muted)', marginBottom:12 }}>
                Current: <strong style={{ color:'var(--text)' }}>{subscription.plan}</strong> · {subscription.status}
                {subscription.current_period_end && ` · Renews ${new Date(subscription.current_period_end).toLocaleDateString('en-GB')}`}
              </div>
            )}
          </div>

          {/* Admin toggle */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:18 }}>
            <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:12 }}>Permissions</div>
            <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
              <input type="checkbox" checked={isAdmin} onChange={e=>setIsAdmin(e.target.checked)} style={{ width:'auto', accentColor:'var(--accent2)' }} />
              <span style={{ fontSize:12 }}>Admin access</span>
            </label>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:6 }}>Grants full admin panel access</div>
          </div>

          <button className="btn btn-accent" onClick={save} disabled={saving} style={{ width:'100%', justifyContent:'center' }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {msg && <div style={{ fontSize:12, color: msg.startsWith('Error') ? 'var(--danger)' : 'var(--accent)', textAlign:'center' }}>{msg}</div>}
        </div>

        {/* Right: children + sessions */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Children */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8 }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', fontSize:10, color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase' }}>
              Children ({children.length})
            </div>
            <table>
              <thead><tr><th>Name</th><th>Phase</th><th>Age</th><th>Acorns</th><th>Sessions</th><th>AI Done</th><th>Avg Acc</th></tr></thead>
              <tbody>
                {children.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight:600 }}>{c.name}</td>
                    <td><span className="badge badge-blue">P{c.phase}</span></td>
                    <td style={{ color:'var(--muted)' }}>{c.age ?? '–'}</td>
                    <td style={{ color:'var(--accent2)' }}>🌰 {c.acorns}</td>
                    <td style={{ color:'var(--muted)' }}>{c.sessions}</td>
                    <td style={{ color:'var(--purple)' }}>{c.aiCompleted}</td>
                    <td style={{ color: c.avgAccuracy >= 80 ? 'var(--accent)' : c.avgAccuracy >= 60 ? 'var(--accent2)' : 'var(--danger)' }}>
                      {c.avgAccuracy ?? '–'}{c.avgAccuracy ? '%' : ''}
                    </td>
                  </tr>
                ))}
                {children.length === 0 && <tr><td colSpan={7} style={{ textAlign:'center', color:'var(--muted)', padding:16 }}>No children yet</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Recent sessions */}
          <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8 }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', fontSize:10, color:'var(--muted)', letterSpacing:'1.5px', textTransform:'uppercase' }}>
              Recent Sessions
            </div>
            <table>
              <thead><tr><th>Child</th><th>Story</th><th>Type</th><th>Accuracy</th><th>Acorns</th><th>Date</th></tr></thead>
              <tbody>
                {recentSessions.map(s => (
                  <tr key={s.id}>
                    <td>{s.child_name}</td>
                    <td style={{ color:'var(--muted)', fontSize:11 }}>{s.story_title}</td>
                    <td><span className={`badge ${s.story_type==='ai'?'badge-purple':'badge-blue'}`}>{s.story_type}</span></td>
                    <td style={{ color: s.accuracy>=80?'var(--accent)':s.accuracy>=60?'var(--accent2)':'var(--danger)', fontWeight:700 }}>
                      {Math.round(s.accuracy??0)}%
                    </td>
                    <td style={{ color:'var(--accent2)' }}>+{s.acorns_earned}</td>
                    <td style={{ color:'var(--muted)', fontSize:11 }}>{new Date(s.completed_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}</td>
                  </tr>
                ))}
                {recentSessions.length===0 && <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--muted)', padding:16 }}>No sessions yet</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
