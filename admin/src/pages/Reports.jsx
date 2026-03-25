/**
 * @file        Reports.jsx
 * @description Admin content reports queue — review flagged AI stories and books,
 *              award credits or dismiss reports.
 * @module      Admin Pages
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 */

import { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';

const REASON_LABELS = {
  wrong_words:       '🔤 Wrong/hard words',
  poor_quality:      '📉 Poor quality story',
  image_error:       '🖼️ Image error',
  generation_failed: '⚠️ Generation failed',
  inappropriate:     '🚫 Inappropriate',
  other:             '💬 Other',
};

const STATUS_FILTERS = ['pending','reviewed','credited','dismissed'];

export default function Reports() {
  const [reports,   setReports]   = useState([]);
  const [counts,    setCounts]    = useState({});
  const [status,    setStatus]    = useState('pending');
  const [loading,   setLoading]   = useState(true);
  const [reviewing, setReviewing] = useState(null);   // report being actioned
  const [form,      setForm]      = useState({ credits: 1, creditType: 'story', adminNote: '' });
  const [saving,    setSaving]    = useState(false);
  const [msg,       setMsg]       = useState('');

  const load = (s) => {
    setLoading(true);
    adminAPI.reports(s).then(r => {
      if (r.success) {
        setReports(r.data.reports);
        const c = {};
        r.data.counts.forEach(x => { c[x.status] = x.n; });
        setCounts(c);
      }
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(status); }, [status]);

  const doReview = async (action) => {
    setSaving(true); setMsg('');
    try {
      const r = await adminAPI.reviewReport(reviewing.id, {
        action,
        adminNote:     form.adminNote || null,
        creditsAmount: form.credits,
        creditType:    form.creditType,
      });
      if (r.success) {
        setMsg(r.data.message);
        setTimeout(() => { setReviewing(null); setMsg(''); load(status); }, 1800);
      }
    } catch (e) { setMsg('Error: ' + e.message); }
    finally { setSaving(false); }
  };

  const total = Object.values(counts).reduce((s, n) => s + n, 0);

  return (
    <div style={{ padding: 28, maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>🚩 Content Reports</h1>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
          Review user-flagged AI stories and books. Award credits for valid reports.
        </div>
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', borderRadius: 10, padding: 4, marginBottom: 20, width: 'fit-content', border: '1px solid var(--border)' }}>
        {STATUS_FILTERS.map(s => (
          <button key={s} onClick={() => setStatus(s)}
            style={{ padding: '7px 16px', borderRadius: 7, border: 'none',
              background: status === s ? 'var(--accent)' : 'transparent',
              color: status === s ? '#000' : 'var(--muted)',
              fontWeight: 700, fontSize: 12, cursor: 'pointer', textTransform: 'capitalize' }}>
            {s} {counts[s] ? <span style={{ marginLeft: 5, background: status === s ? 'rgba(0,0,0,0.15)' : 'var(--border2)', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>{counts[s]}</span> : null}
          </button>
        ))}
      </div>

      {loading ? <div style={{ color: 'var(--muted)', padding: 32 }}>Loading…</div> : reports.length === 0 ? (
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
          {status === 'pending' ? '✅ No pending reports — all clear!' : `No ${status} reports`}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {reports.map(r => (
            <div key={r.id} style={{ background: 'var(--surface)', border: `1px solid ${r.status === 'pending' ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`, borderRadius: 12, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <span style={{ fontSize: 11, background: r.content_type === 'ai_story' ? 'rgba(99,102,241,0.12)' : 'rgba(245,158,11,0.12)', color: r.content_type === 'ai_story' ? '#6366F1' : '#D97706', borderRadius: 20, padding: '2px 10px', fontWeight: 700, marginRight: 8 }}>
                    {r.content_type === 'ai_story' ? '📖 AI Story' : '📚 Book'}
                  </span>
                  <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>{r.content_title || r.content_id.slice(0,8)}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {r.status === 'credited' && <span className="badge badge-green">✓ Credited ({r.credits_awarded} {r.credit_type})</span>}
                  {r.status === 'dismissed' && <span className="badge badge-gray">Dismissed</span>}
                  {r.status === 'pending' && (
                    <button onClick={() => { setReviewing(r); setForm({ credits: 1, creditType: r.content_type === 'story_book' ? 'book' : 'story', adminNote: '' }); }}
                      style={{ padding: '5px 14px', borderRadius: 8, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                      Review →
                    </button>
                  )}
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 2 }}>
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{REASON_LABELS[r.reason] || r.reason}</span>
                {r.detail && <span> — "{r.detail}"</span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                From: {r.user_email} · {new Date(r.created_at).toLocaleString('en-GB')}
              </div>
              {r.admin_note && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'var(--accent)', fontStyle: 'italic' }}>
                  Admin note: {r.admin_note}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Review modal */}
      {reviewing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, margin: 16, border: '1px solid var(--border2)' }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', marginBottom: 4 }}>Review Report</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 18 }}>
              {REASON_LABELS[reviewing.reason]} — "{reviewing.content_title}"
              <br/>From: {reviewing.user_email}
              {reviewing.detail && <><br/>Detail: "{reviewing.detail}"</>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Credits to award</div>
                <input type="number" min={1} max={10} value={form.credits}
                  onChange={e => setForm(f => ({ ...f, credits: parseInt(e.target.value) || 1 }))}
                  style={{ width: '100%' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Credit type</div>
                <select value={form.creditType} onChange={e => setForm(f => ({ ...f, creditType: e.target.value }))}>
                  <option value="story">AI Story Credits</option>
                  <option value="book">Book Credits</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Admin note (shown to user)</div>
              <textarea rows={2} value={form.adminNote} onChange={e => setForm(f => ({ ...f, adminNote: e.target.value }))}
                placeholder="e.g. Thanks for the report! We've improved the story generator."
                style={{ width: '100%', resize: 'none' }} />
            </div>

            {msg && <div style={{ fontSize: 12, color: msg.includes('Error') ? 'var(--danger)' : 'var(--accent)', fontWeight: 700, marginBottom: 12 }}>{msg}</div>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setReviewing(null); setMsg(''); }}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--muted)', fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => doReview('dismiss')} disabled={saving}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid var(--border2)', background: 'transparent', color: 'var(--muted)', fontWeight: 700, cursor: 'pointer' }}>
                Dismiss
              </button>
              <button onClick={() => doReview('credit')} disabled={saving}
                style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#000', fontWeight: 800, cursor: 'pointer' }}>
                {saving ? 'Saving…' : `✓ Credit ${form.credits} ${form.creditType}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
