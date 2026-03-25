/**
 * @file        ReportButton.jsx
 * @description Floating report button — lets users flag AI stories or story books
 *              for admin review. If report is accepted, user may receive credits.
 * @module      Components
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 */

import { useState } from 'react';
import api from '../services/api';

const REASONS = [
  { value: 'wrong_words',       label: '🔤 Wrong or hard words for this level' },
  { value: 'poor_quality',      label: '📉 Story doesn\'t make sense' },
  { value: 'image_error',       label: '🖼️ Image is missing or wrong' },
  { value: 'generation_failed', label: '⚠️ Generation seems incomplete' },
  { value: 'inappropriate',     label: '🚫 Inappropriate content' },
  { value: 'other',             label: '💬 Something else' },
];

/**
 * ReportButton — small flag icon that opens a modal to report content.
 *
 * @param {string} contentType - 'ai_story' or 'story_book'
 * @param {string} contentId   - ID of the story or book
 * @param {string} contentTitle - Display name for confirmation
 * @param {string} [childId]   - Optional child context
 * @param {string} [variant]   - 'inline' (default) | 'icon-only'
 */
export default function ReportButton({ contentType, contentId, contentTitle, childId, variant = 'inline' }) {
  const [open,    setOpen]    = useState(false);
  const [reason,  setReason]  = useState('');
  const [detail,  setDetail]  = useState('');
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState('');
  const [error,   setError]   = useState('');

  const submit = async () => {
    if (!reason) { setError('Please choose a reason'); return; }
    setLoading(true); setError('');
    try {
      const r = await api.post('/reports', { contentType, contentId, reason, detail, childId });
      if (r.data.success) {
        setDone(r.data.data.message);
      } else {
        setError(r.data.message || 'Could not submit report');
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Could not submit report');
    } finally { setLoading(false); }
  };

  const close = () => { setOpen(false); setDone(''); setError(''); setReason(''); setDetail(''); };

  const triggerStyle = variant === 'icon-only'
    ? { background: 'transparent', border: 'none', padding: 6, color: 'rgba(0,0,0,0.25)', fontSize: 15, cursor: 'pointer', borderRadius: 8, transition: 'color 0.15s', lineHeight: 1 }
    : { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'transparent', border: '1px solid var(--dark-10)', borderRadius: 20, padding: '4px 10px', fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' };

  return (
    <>
      <button onClick={() => setOpen(true)} style={triggerStyle}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-danger)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = variant === 'icon-only' ? 'rgba(0,0,0,0.25)' : 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--dark-10)'; }}
        title="Report an issue with this content">
        🚩 {variant !== 'icon-only' && 'Report'}
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 24px 64px var(--dark-20)' }}>

            {done ? (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text-success-dark)', marginBottom: 8 }}>Report Submitted!</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>{done}</div>
                <button onClick={close} style={{ background: 'var(--violet,var(--color-primary))', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 28px', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                  Done
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--bg-dark-mid)' }}>🚩 Report an Issue</div>
                    {contentTitle && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>"{contentTitle}"</div>}
                  </div>
                  <button onClick={close} style={{ color: 'var(--text-light)', fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, background: 'var(--bg-primary-light)', borderRadius: 10, padding: '10px 12px', lineHeight: 1.6 }}>
                  💡 If your report helps us improve, you may receive <strong style={{ color: 'var(--color-primary)' }}>bonus story or book credits</strong> as a thank-you!
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>What's the issue?</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {REASONS.map(r => (
                      <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, border: `2px solid ${reason === r.value ? 'var(--violet,var(--color-primary))' : 'var(--border)'}`, background: reason === r.value ? 'var(--bg-primary-light)' : '#fff', cursor: 'pointer', fontSize: 13, fontWeight: reason === r.value ? 700 : 500 }}>
                        <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} style={{ accentColor: 'var(--color-primary)' }} />
                        {r.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6 }}>Extra details (optional)</div>
                  <textarea value={detail} onChange={e => setDetail(e.target.value)} rows={2} placeholder="Tell us more about what went wrong…"
                    style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--border)', borderRadius: 10, fontSize: 13, resize: 'none', fontFamily: 'var(--font-body,Nunito)', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                {error && <div style={{ color: 'var(--color-danger)', fontSize: 12, marginBottom: 12, fontWeight: 600 }}>{error}</div>}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={close} style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                    Cancel
                  </button>
                  <button onClick={submit} disabled={loading || !reason}
                    style={{ flex: 2, padding: '10px 0', borderRadius: 12, border: 'none', background: loading || !reason ? 'var(--border-2)' : 'var(--violet,var(--color-primary))', color: '#fff', fontWeight: 800, fontSize: 14, cursor: loading || !reason ? 'default' : 'pointer' }}>
                    {loading ? 'Submitting…' : '🚩 Submit Report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
