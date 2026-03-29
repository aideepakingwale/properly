/**
 * @file        Books.jsx
 * @description Admin Books management — view all generated books, manage user credits,
 *              add credits to users, view print orders.
 * @module      Admin Pages
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - Admin can add credits to any user manually from this page
 *   - 1 credit = 1 book (first free on registration)
 *   - Print order address visible in expanded book row
 *   - Book status: pending | generating | ready | error
 */

import { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';

export default function BooksAdmin() {
  const [books,    setBooks]    = useState([]);
  const [credits,  setCredits]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState('books');
  const [expanded, setExpanded] = useState(null);
  const [debugLog, setDebugLog]   = useState(null);
  const [loadingDebug, setLoadingDebug] = useState(false);
  const [logs,     setLogs]     = useState(null);    // generation log for expanded book
  const [logsLoading, setLogsLoading] = useState(false);
  const [adding,   setAdding]   = useState(null);   // userId being credited
  const [addForm,  setAddForm]  = useState({ credits: 1, reason: 'admin_grant' });
  const [addMsg,   setAddMsg]   = useState('');

  useEffect(() => {
    Promise.all([adminAPI.books(), adminAPI.bookCredits()])
      .then(([br, cr]) => {
        if (br.success)  setBooks(br.data);
        if (cr.success)  setCredits(cr.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fetchLogs = async (bookId) => {
    if (expanded === bookId && logs) { setExpanded(null); setLogs(null); return; }
    setExpanded(bookId);
    setLogsLoading(true);
    try {
      const r = await adminAPI.bookLogs(bookId);
      if (r.success) setLogs(r.data);
    } catch {} finally { setLogsLoading(false); }
  };

  const loadDebug = async (bookId) => {
    setDebugLog(null); setLoadingDebug(true);
    try {
      const r = await adminAPI.bookDebugLog(bookId);
      if (r.success) setDebugLog(r.data);
    } catch (e) { setDebugLog({ error: e.message }); }
    finally { setLoadingDebug(false); }
  };

  const submitCredits = async (userId) => {
    setAddMsg('');
    try {
      const r = await adminAPI.addBookCredits(userId, addForm.credits, addForm.reason);
      if (r.success) {
        setAddMsg('✅ ' + r.data.message);
        // Update credits list
        setCredits(prev => prev.map(u => u.id === userId ? { ...u, credits: r.data.newTotal } : u));
        setTimeout(() => { setAdding(null); setAddMsg(''); }, 2000);
      }
    } catch (e) { setAddMsg('❌ ' + (e.message || 'Failed')); }
  };

  const statusBadge = (status) => {
    const map = {
      ready:      { bg: 'rgba(16,185,129,0.12)', color: '#10B981', label: '✅ Ready' },
      generating: { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', label: '⏳ Generating' },
      pending:    { bg: 'rgba(107,114,128,0.12)', color: '#6B7280', label: '🕐 Queued' },
      error:      { bg: 'rgba(239,68,68,0.12)',  color: '#EF4444', label: '❌ Error' },
    };
    const s = map[status] || map.pending;
    return (
      <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
        {s.label}
      </span>
    );
  };

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)' }}>Loading…</div>;

  const printOrders = books.filter(b => b.print_ordered);
  const totalBooks  = books.length;
  const readyBooks  = books.filter(b => b.status === 'ready').length;

  return (
    <div style={{ padding: 28, maxWidth: 1000 }}>
      <h1>📚 Story Books</h1>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 24 }}>
        Manage AI-generated storybooks, book credits and print orders.
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total Books',    value: totalBooks,          color: '#3B82F6', icon: '📚' },
          { label: 'Ready',          value: readyBooks,          color: '#10B981', icon: '✅' },
          { label: 'Print Orders',   value: printOrders.length,  color: '#F59E0B', icon: '🖨' },
          { label: 'Users w/ Credits', value: credits.filter(u => u.credits > 0).length, color: '#8B5CF6', icon: '🎫' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color, margin: '4px 0' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 10, padding: 4, marginBottom: 20, width: 'fit-content', border: '1px solid var(--border)' }}>
        {[['books', '📚 Books'], ['credits', '🎫 Credits'], ['print', '🖨 Print Orders']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: tab === k ? 'var(--accent)' : 'transparent',
              color: tab === k ? '#000' : 'var(--muted)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            {l}
          </button>
        ))}
      </div>

      {/* ── BOOKS TAB ──────────────────────────────────────────── */}
      {tab === 'books' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Title', 'Child', 'Parent', 'Pages', 'Status', 'Created', ''].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {books.map(b => (
                <>
                  <tr key={b.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                    onClick={() => fetchLogs(b.id)}>
                    <td style={{ padding: '11px 14px', fontWeight: 600, color: 'var(--text)' }}>
                      {b.title || b.story_title || 'Untitled'}
                    </td>
                    <td style={{ padding: '11px 14px', color: 'var(--muted)' }}>{b.child_name}</td>
                    <td style={{ padding: '11px 14px', color: 'var(--muted)', fontSize: 11 }}>{b.parent_email}</td>
                    <td style={{ padding: '11px 14px', color: 'var(--muted)' }}>{b.page_count || '—'}</td>
                    <td style={{ padding: '11px 14px' }}>{statusBadge(b.status)}</td>
                    <td style={{ padding: '11px 14px', color: 'var(--muted)', fontSize: 11 }}>
                      {new Date(b.created_at).toLocaleDateString('en-GB')}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 16 }}>
                      {expanded === b.id ? '▲' : '▼'}
                    </td>
                  </tr>
                  {expanded === b.id && (
                    <tr key={b.id + '-exp'}>
                      <td colSpan={7} style={{ padding: '16px 18px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                        {logsLoading ? (
                          <div style={{ color: 'var(--muted)', fontSize: 12 }}>Loading generation logs…</div>
                        ) : logs && logs.id === b.id ? (
                          <div>
                            {/* Basic info */}
                            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10, fontFamily: 'var(--font-mono)' }}>
                              ID: {b.id} | Story: {b.ai_story_id}
                              {b.error_msg && <span style={{ color: 'var(--danger)', marginLeft: 12 }}>❌ {b.error_msg}</span>}
                            </div>

                            {/* Generation log steps */}
                            <div style={{ fontSize: 11, fontFamily: 'monospace' }}>
                              <div style={{ fontWeight: 700, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Generation Log</div>
                              {(logs.logs || []).length === 0 ? (
                                <div style={{ color: 'var(--muted)' }}>No log entries yet</div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                  {(logs.logs || []).map((entry, i) => (
                                    <div key={i} style={{
                                      display: 'grid', gridTemplateColumns: '120px 32px 1fr 120px', gap: 8, alignItems: 'start',
                                      padding: '4px 8px', borderRadius: 5,
                                      background: entry.status === 'error' ? 'rgba(239,68,68,0.08)' : entry.status === 'warn' ? 'rgba(245,158,11,0.06)' : 'rgba(16,185,129,0.05)'
                                    }}>
                                      <span style={{ color: 'var(--amber)', fontWeight: 600 }}>{entry.step}</span>
                                      <span>{entry.status === 'ok' ? '✅' : entry.status === 'warn' ? '⚠️' : '❌'}</span>
                                      <span style={{ color: entry.status === 'error' ? 'var(--danger)' : 'var(--text)', wordBreak: 'break-all' }}>{entry.detail}</span>
                                      <span style={{ color: 'var(--muted)', fontSize: 10, textAlign: 'right' }}>{new Date(entry.ts).toLocaleTimeString()}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div style={{ color: 'var(--muted)', fontSize: 12 }}>Click row to load generation logs</div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {books.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>No books yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── CREDITS TAB ───────────────────────────────────────── */}
      {tab === 'credits' && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
            Every user receives 1 free book credit on registration. Add more here.
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['User', 'Credits', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {credits.map(u => (
                  <>
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '11px 14px', color: 'var(--text)', fontWeight: 600 }}>{u.email}</td>
                      <td style={{ padding: '11px 14px' }}>
                        <span style={{ background: u.credits > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(107,114,128,0.1)', color: u.credits > 0 ? '#10B981' : 'var(--muted)', borderRadius: 20, padding: '3px 12px', fontSize: 13, fontWeight: 700 }}>
                          {u.credits} credit{u.credits !== 1 ? 's' : ''}
                        </span>
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        <button onClick={() => { setAdding(adding === u.id ? null : u.id); setAddMsg(''); }}
                          className="btn btn-ghost btn-sm">
                          {adding === u.id ? 'Cancel' : '+ Add Credits'}
                        </button>
                      </td>
                    </tr>
                    {adding === u.id && (
                      <tr key={u.id + '-add'}>
                        <td colSpan={3} style={{ padding: '12px 18px', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div>
                              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Credits to add</div>
                              <input type="number" min={1} max={100} value={addForm.credits}
                                onChange={e => setAddForm(f => ({ ...f, credits: parseInt(e.target.value) || 1 }))}
                                style={{ width: 80, padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14 }} />
                            </div>
                            <div style={{ flex: 1, minWidth: 160 }}>
                              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Reason</div>
                              <select value={addForm.reason} onChange={e => setAddForm(f => ({ ...f, reason: e.target.value }))}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }}>
                                <option value="admin_grant">Admin Grant</option>
                                <option value="compensation">Compensation</option>
                                <option value="promotion">Promotion</option>
                                <option value="purchase">Manual Purchase</option>
                              </select>
                            </div>
                            <div style={{ marginTop: 18 }}>
                              <button onClick={() => submitCredits(u.id)}
                                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#000', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                                Add Credits
                              </button>
                            </div>
                          </div>
                          {addMsg && <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: addMsg.startsWith('✅') ? 'var(--accent)' : 'var(--danger)' }}>{addMsg}</div>}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {credits.length === 0 && (
                  <tr><td colSpan={3} style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>No users</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PRINT ORDERS TAB ──────────────────────────────────── */}
      {tab === 'print' && (
        <div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
            Print orders are fulfilled via Gelato/Prodigi (future integration). Current orders listed for manual fulfilment.
          </div>
          {printOrders.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
              No print orders yet
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {printOrders.map(b => {
                let addr = {};
                try { addr = JSON.parse(b.print_address); } catch {}
                return (
                  <div key={b.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>{b.title || b.story_title}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{b.child_name} · {b.parent_email}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right' }}>Order ref</div>
                        <code style={{ fontSize: 12, color: 'var(--accent)' }}>BOOK-{b.id.slice(0,8).toUpperCase()}</code>
                      </div>
                    </div>
                    <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px', fontSize: 12, lineHeight: 1.9, color: 'var(--text)' }}>
                      <div>📦 <strong>{addr.name}</strong></div>
                      <div>{addr.address1}{addr.address2 ? ', ' + addr.address2 : ''}</div>
                      <div>{addr.city}, {addr.postcode}, {addr.country}</div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
                      {b.page_count} pages · Created {new Date(b.created_at).toLocaleDateString('en-GB')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
