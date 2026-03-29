/**
 * @file        Users.jsx
 * @description User management list — searchable, filterable table of all registered parent accounts with pagination
 * @module      Admin Pages
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';

const PLANS = ['', 'free', 'sprout', 'forest'];

export default function Users() {
  const [data, setData]       = useState({ users:[], total:0, pages:1 });
  const [search, setSearch]   = useState('');
  const [plan, setPlan]       = useState('');
  const [page, setPage]       = useState(1);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    adminAPI.users({ search, plan, page, limit:25 })
      .then(r => { if (r.success) setData(r.data); })
      .finally(() => setLoading(false));
  }, [search, plan, page]);

  useEffect(() => { load(); }, [load]);

  const planBadge = p => {
    const map = { forest:'badge-amber', sprout:'badge-green', free:'badge-gray' };
    return <span className={`badge ${map[p]||'badge-gray'}`}>{p}</span>;
  };

  return (
    <div className='page'>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
        <div>
          <h1>Users</h1>
          <div style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>{data.total} total registered accounts</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:18 }}>
        <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}
          placeholder="Search by email or ID…" style={{ maxWidth:280 }} />
        <select value={plan} onChange={e=>{setPlan(e.target.value);setPage(1);}} style={{ maxWidth:140 }}>
          {PLANS.map(p => <option key={p} value={p}>{p || 'All plans'}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={load}>↻ Refresh</button>
      </div>

      {/* Table */}
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8 }}>
        <table>
          <thead>
            <tr>
              <th>Email</th><th>Plan</th><th>Verified</th><th>Children</th><th>Sessions</th><th>Admin</th><th>Joined</th><th></th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? <tr><td colSpan={8} style={{ textAlign:'center', padding:32, color:'var(--muted)' className='text-muted' }}>Loading…</td></tr>
              : data.users.map(u => (
              <tr key={u.id} style={{ cursor:'pointer' }} onClick={() => nav(`/users/${u.id}`)}>
                <td>
                  <span style={{ color: u.isAdmin ? 'var(--amber)' : 'var(--text)', fontWeight: u.isAdmin ? 700 : 400 }}>
                    {u.email}
                  </span>
                </td>
                <td>{planBadge(u.plan)}</td>
                <td>
                  <span style={{ color: u.verified ? 'var(--accent)' : 'var(--danger)' }}>
                    {u.verified ? '✓' : '✗'}
                  </span>
                </td>
                <td style={{ color:'var(--muted)' }}>{u.childCount}</td>
                <td style={{ color:'var(--muted)' }}>{u.sessionCount}</td>
                <td>{u.isAdmin ? <span className="badge badge-amber">Admin</span> : null}</td>
                <td style={{ color:'var(--muted)' }}>{new Date(u.createdAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</td>
                <td><span style={{ color:'var(--muted)' }}>→</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data.pages > 1 && (
        <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:16 }}>
          <button className="btn btn-ghost btn-sm" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>← Prev</button>
          <span style={{ padding:'4px 12px', color:'var(--muted)', fontSize:12 }}>Page {page} / {data.pages}</span>
          <button className="btn btn-ghost btn-sm" disabled={page>=data.pages} onClick={()=>setPage(p=>p+1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
