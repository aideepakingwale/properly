/**
 * @file        StoryBookViewer.jsx
 * @description Story Book feature — create illustrated PDF books from AI stories,
 *              view them page-by-page online, download PDF, and order printed copies.
 * @module      Components
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - 1 free book credit per user on registration; more can be purchased or admin-granted
 *   - AI images generated via Pollinations.ai (free, kid-safe, no API key needed)
 *   - PDF stored in Cloudflare R2 with 1-hour signed download URLs
 *   - Print order captures shipping address; fulfilment is manual/Gelato in future
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { bookAPI } from '../services/api';
import ReportButton from './ReportButton';

// ── BOOK CARD ─────────────────────────────────────────────────
function BookCard({ book, onOpen }) {
  const statusColour = {
    ready:      'var(--color-success)',
    generating: 'var(--brand-accent)',
    pending:    'var(--text-muted)',
    error:      'var(--color-danger)',
  }[book.status] || 'var(--text-muted)';

  const statusLabel = {
    ready:      '✅ Ready',
    generating: '⏳ Generating…',
    pending:    '🕐 Queued',
    error:      '❌ Error',
  }[book.status] || book.status;

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden', cursor: book.status === 'ready' ? 'pointer' : 'default',
      transition: 'transform 0.15s, box-shadow 0.15s',
    }}
      onClick={() => book.status === 'ready' && onOpen(book)}
      onMouseEnter={e => { if (book.status === 'ready') { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px var(--dark-20)'; }}}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
    >
      {/* Cover */}
      <div style={{ height: 180, background: 'var(--grad-primary-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {book.coverSignedUrl
          ? <img src={book.coverSignedUrl} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 56 }}>📖</span>
        }
        <div style={{ position: 'absolute', top: 8, right: 8, background: statusColour, color: '#fff', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
          {statusLabel}
        </div>
        {book.status === 'ready' && (
          <div style={{ position: 'absolute', top: 8, left: 8 }} onClick={e => e.stopPropagation()}>
            <ReportButton contentType="story_book" contentId={book.id} contentTitle={book.title || book.story_title} variant="icon-only" />
          </div>
        )}
      </div>
      {/* Info */}
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {book.title || book.story_title || 'My Story Book'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>
          {book.page_count} pages
          {book.print_ordered ? ' · 🖨 Print ordered' : ''}
        </div>
      </div>
    </div>
  );
}

// ── GENERATION PROGRESS ───────────────────────────────────────
// Live log of what's happening during async book generation.
// Polls /books/:id every 3s for status updates + generation_log.
function GenerationProgress({ book, onRetry }) {
  const [logSteps, setLogSteps] = useState([]);
  const [retrying, setRetrying] = useState(false);
  const [showLog, setShowLog]   = useState(false);
  const pollRef = useRef(null);

  // Poll for log updates while not done/error
  useEffect(() => {
    if (book.status === 'ready' || (book.status === 'error' && logSteps.length > 0)) return;

    async function poll() {
      try {
        const r = await bookAPI.getLog(book.id);
        if (r.success) setLogSteps(r.data.logs || []);
      } catch {}
    }
    poll();
    pollRef.current = setInterval(poll, 2500);
    return () => clearInterval(pollRef.current);
  }, [book.id, book.status]);

  const isError = book.status === 'error';
  const icon    = isError ? '❌' : book.status === 'generating' ? '🎨' : '⏳';

  const STATUS_LABELS = {
    pending:    'Queued — generation will start shortly…',
    generating: 'Creating your illustrated book…',
    error:      book.error_msg || 'Generation failed. Tap retry to try again.',
  };

  const STEP_ICONS = { ok: '✅', warn: '⚠️', error: '❌', info: '🔵' };

  return (
    <div style={{ color: '#fff', textAlign: 'center', padding: '32px 24px', maxWidth: 560, margin: '0 auto' }}>
      <div style={{ fontSize: 52, marginBottom: 12, animation: isError ? 'none' : 'bounce 1.5s ease infinite' }}>
        {icon}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
        {STATUS_LABELS[book.status] || 'Working…'}
      </div>

      {!isError && (
        <div style={{ fontSize: 13, color: 'var(--overlay-60)', marginBottom: 16 }}>
          AI illustrations take 30–60 seconds. You can close this and come back later.
        </div>
      )}

      {/* Step progress bar */}
      {logSteps.length > 0 && (() => {
        const total  = 10;  // cover + pages + pdf ≈ 10 steps
        const done   = logSteps.filter(s => s.status === 'ok').length;
        const pct    = Math.min(100, Math.round((done / total) * 100));
        return (
          <div style={{ width: '100%', height: 6, background: 'var(--overlay-15)', borderRadius: 3, marginBottom: 14, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: isError ? 'var(--color-danger)' : 'var(--color-success)', borderRadius: 3, transition: 'width 0.5s' }} />
          </div>
        );
      })()}

      {/* Last step hint */}
      {logSteps.length > 0 && !showLog && (
        <div style={{ fontSize: 12, color: 'var(--overlay-50)', marginBottom: 10, fontFamily: 'monospace' }}>
          {STEP_ICONS[logSteps[logSteps.length-1]?.status] || '•'} {logSteps[logSteps.length-1]?.step}
          {logSteps[logSteps.length-1]?.detail && ` — ${logSteps[logSteps.length-1].detail.slice(0,50)}`}
        </div>
      )}

      {/* Expand full log */}
      {logSteps.length > 0 && (
        <button onClick={() => setShowLog(v => !v)}
          style={{ background: 'var(--overlay-10)', border: '1px solid var(--overlay-20)', color: 'var(--overlay-70)', borderRadius: 8, padding: '5px 14px', fontSize: 11, cursor: 'pointer', marginBottom: showLog ? 0 : 12 }}>
          {showLog ? '▲ Hide log' : '▼ Show generation log'}
        </button>
      )}

      {showLog && (
        <div style={{ background: '#0A0718', borderRadius: 10, padding: '10px 14px', marginTop: 8, marginBottom: 14, textAlign: 'left', maxHeight: 220, overflowY: 'auto', fontFamily: 'monospace', fontSize: 10 }}>
          {logSteps.map((step, i) => (
            <div key={i} style={{ marginBottom: 4, color: step.status === 'ok' ? '#6EE7B7' : step.status === 'error' ? '#FCA5A5' : step.status === 'warn' ? '#FCD34D' : '#93C5FD' }}>
              {STEP_ICONS[step.status] || '•'} <strong>{step.step}</strong>
              {step.detail && <span style={{ color: '#64748B' }}> — {step.detail.slice(0,80)}</span>}
            </div>
          ))}
          {!isError && <div style={{ color: '#475569' }}>⏳ Still generating…</div>}
        </div>
      )}

      {/* Retry button */}
      {isError && (
        <button onClick={async () => { setRetrying(true); await onRetry(); setRetrying(false); }}
          disabled={retrying}
          style={{ background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>
          {retrying ? '⏳ Retrying…' : '↺ Retry Generation'}
        </button>
      )}

      <style>{`@keyframes bounce { 0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)} }`}</style>
    </div>
  );
}

// ── FLIPBOOK VIEWER ───────────────────────────────────────────
function FlipbookViewer({ book, onClose }) {
  const [pageIdx, setPageIdx]     = useState(-1);  // -1 = cover
  const [pollingKey, setPolling]  = useState(0);
  const [bookData, setBookData]   = useState(book);
  const [genLog, setGenLog]       = useState([]);   // persists even after book is ready
  const [showGenLog, setShowGenLog] = useState(false);
  const [showOrder, setShowOrder]     = useState(false);
  const [orderForm, setOrderForm]     = useState({ name:'', address1:'', address2:'', city:'', postcode:'', country:'GB' });
  const [orderMsg, setOrderMsg]       = useState('');
  const [ordering, setOrdering]       = useState(false);
  const [showReport, setShowReport]   = useState(false);
  const [reportMsg, setReportMsg]     = useState('');
  const [reportNote, setReportNote]   = useState('');
  const [reporting, setReporting]     = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting]       = useState(false);

  const pages = bookData.pages || [];
  const isReady = bookData.status === 'ready';

  // Poll book status + fetch generation log. Log persists after book is ready.
  useEffect(() => {
    async function fetchLog() {
      try {
        const r = await bookAPI.getLog(bookData.id);
        if (r.success && r.data?.logs?.length > 0) setGenLog(r.data.logs);
      } catch {}
    }
    fetchLog(); // fetch immediately when viewer opens

    if (isReady) return; // stop polling status once ready
    const t = setInterval(async () => {
      try {
        const r = await bookAPI.getBook(bookData.id);
        if (r.success) { setBookData(r.data); fetchLog(); }
      } catch {}
    }, 3000);
    return () => clearInterval(t);
  }, [bookData.id, isReady]);

  const totalPages = pages.length;
  const currentPage = pageIdx === -1 ? null : pages[pageIdx];
  const imgSrc = currentPage?.imageSignedUrl || currentPage?.image_url;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await bookAPI.deleteBook(bookData.id);
      onClose('deleted', bookData.id);
    } catch (e) {
      alert('Delete failed: ' + (e.message || 'unknown error'));
    } finally { setDeleting(false); }
  };

  const submitReport = async () => {
    setReporting(true);
    try {
      // Attach the full generation log to the report for admin diagnosis
      const logText = genLog.map(s =>
        `[${s.ts?.slice(11,19)||''}] ${s.status === 'ok' ? '✅' : s.status === 'error' ? '❌' : '⚠️'} ${s.step}: ${s.detail||''}`
      ).join('\n');
      const detail  = (reportNote ? reportNote + '\n\n' : '') + 'GENERATION LOG:\n' + logText;
      await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('properly_token') || '') },
        body: JSON.stringify({
          contentType:  'story_book',
          contentId:    bookData.id,
          contentTitle: bookData.title || 'My Book',
          reason:       'generation_error',
          detail,
        }),
      });
      setReportMsg('✅ Report sent! Admin will investigate and may issue a credit.');
    } catch (e) {
      setReportMsg('❌ Failed to send report. Please try again.');
    } finally { setReporting(false); }
  };

  const submitOrder = async () => {
    setOrdering(true);
    try {
      const r = await bookAPI.orderPrint(bookData.id, orderForm);
      if (r.success) {
        setOrderMsg('🎉 ' + r.data.message + ' Ref: ' + r.data.orderRef);
        setBookData(bd => ({ ...bd, print_ordered: 1 }));
      }
    } catch (e) { setOrderMsg('❌ ' + (e.message || 'Order failed')); }
    finally { setOrdering(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, width: '100%', maxWidth: 760, padding: '0 16px' }}>
        <button onClick={onClose} style={{ background: 'var(--overlay-10)', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 14 }}>← Back</button>
        <div style={{ flex: 1, color: '#fff', fontWeight: 700, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bookData.title}</div>
        {/* Generation log button — always available after creation */}
        {genLog.length > 0 && (
          <button onClick={() => setShowGenLog(v => !v)}
            style={{ background: 'var(--overlay-10)', border: '1px solid var(--overlay-20)', color: '#93C5FD', borderRadius: 8, padding: '8px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'monospace' }}>
            {showGenLog ? '▲' : '▼'} Gen log ({genLog.length} steps)
          </button>
        )}
        {isReady && bookData.pdfSignedUrl && (
          <a href={bookData.pdfSignedUrl} download target="_blank" rel="noreferrer"
            style={{ background: 'var(--color-success)', color: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            ⬇ Download PDF
          </a>
        )}
        {isReady && !bookData.print_ordered && (
          <button onClick={() => setShowOrder(true)}
            style={{ background: 'var(--brand-accent)', color: '#000', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            🖨 Order Print
          </button>
        )}
        {bookData.print_ordered && (
          <span style={{ background: 'var(--text-muted)', color: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: 13 }}>🖨 Print Ordered</span>
        )}
        {/* Report issue button */}
        <button onClick={() => { setShowReport(true); setReportMsg(''); }}
          title="Report a problem with this book"
          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', borderRadius: 8, padding: '8px 10px', fontSize: 12, cursor: 'pointer' }}>
          🚩 Report
        </button>
        {/* Delete book button */}
        <button onClick={() => setShowDeleteConfirm(true)}
          title="Delete this book"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#FCA5A5', borderRadius: 8, padding: '8px 10px', fontSize: 14, cursor: 'pointer' }}>
          🗑
        </button>
      </div>

      {/* Generation log drawer — shown when user expands it */}
      {showGenLog && genLog.length > 0 && (
        <div style={{ background: '#0A0718', padding: '10px 16px', maxHeight: 260, overflowY: 'auto', fontFamily: 'monospace', fontSize: 10, width: '100%', maxWidth: 760, margin: '0 auto', boxSizing: 'border-box' }}>
          <div style={{ color: '#64748B', marginBottom: 6, fontSize: 9 }}>
            GENERATION LOG — {genLog.length} steps
            {genLog.some(s => s.status === 'warn') ? '  ⚠️ has warnings' : ''}
            {genLog.some(s => s.status === 'error') ? '  ❌ has errors' : ''}
          </div>
          {genLog.map((step, i) => (
            <div key={i} style={{ marginBottom: 3, color:
              step.status === 'ok'    ? '#6EE7B7' :
              step.status === 'error' ? '#FCA5A5' :
              step.status === 'warn'  ? '#FCD34D' : '#93C5FD' }}>
              {step.status === 'ok' ? '✅' : step.status === 'error' ? '❌' : step.status === 'warn' ? '⚠️' : '🔵'}
              {' '}<strong>{step.step}</strong>
              {step.detail ? <span style={{ color: '#475569' }}> — {step.detail}</span> : null}
              {step.ts ? <span style={{ color: '#1E293B', marginLeft: 6 }}>{step.ts.slice(11,19)}</span> : null}
            </div>
          ))}
        </div>
      )}

      {/* Not ready yet — with live generation log */}
      {!isReady && (
        <GenerationProgress book={bookData} onRetry={async () => {
          try {
            await bookAPI.retryBook(bookData.id);
            setBookData(b => ({ ...b, status: 'pending', error_msg: null }));
          } catch {}
        }} />
      )}

      {/* Book viewer */}
      {isReady && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 760, padding: '0 16px' }}>

          {/* Page display */}
          <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', width: '100%', maxWidth: 680 }}>
            {pageIdx === -1 ? (
              // Cover
              <div style={{ background: 'var(--grad-primary-dark)', padding: 40, textAlign: 'center', minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                {bookData.coverSignedUrl
                  ? <img src={bookData.coverSignedUrl} alt="cover" style={{ maxWidth: 300, maxHeight: 250, borderRadius: 12, marginBottom: 24 }} />
                  : <div style={{ fontSize: 80, marginBottom: 24 }}>📖</div>
                }
                <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 8 }}>{bookData.title}</div>
                <div style={{ fontSize: 16, color: 'var(--overlay-70)' }}>Tap → to start reading</div>
              </div>
            ) : currentPage ? (
              // Story page
              <div>
                {imgSrc && (
                  <img src={imgSrc} alt={`Page ${pageIdx + 1}`}
                    style={{ width: '100%', height: 340, objectFit: 'cover', display: 'block' }}
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                )}
                <div style={{ padding: '20px 28px 24px', background: ['var(--page-bg-1)','var(--page-bg-2)','var(--page-bg-3)','var(--page-bg-4)'][pageIdx % 4] }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--story-text-dark)', lineHeight: 1.5, textAlign: 'center' }}>
                    {currentPage.text}
                  </div>
                </div>
              </div>
            ) : (
              // Back cover
              <div style={{ background: 'var(--color-primary)', padding: 40, textAlign: 'center', minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 72, marginBottom: 16 }}>🌟</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 8 }}>The End!</div>
                <div style={{ fontSize: 16, color: 'var(--overlay-80)' }}>What a brilliant reader you are!</div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 20 }}>
            <button onClick={() => setPageIdx(p => Math.max(-1, p - 1))}
              disabled={pageIdx === -1}
              style={{ background: pageIdx > -1 ? 'var(--color-primary)' : 'var(--overlay-10)', color: '#fff', border: 'none', borderRadius: 10, width: 48, height: 48, fontSize: 22, cursor: pageIdx > -1 ? 'pointer' : 'default' }}>
              ‹
            </button>
            <div style={{ color: 'var(--overlay-70)', fontSize: 14, minWidth: 100, textAlign: 'center' }}>
              {pageIdx === -1 ? 'Cover'
                : pageIdx >= totalPages ? 'The End'
                : `Page ${pageIdx + 1} of ${totalPages}`}
            </div>
            <button onClick={() => setPageIdx(p => Math.min(totalPages, p + 1))}
              disabled={pageIdx >= totalPages}
              style={{ background: pageIdx < totalPages ? 'var(--color-primary)' : 'var(--overlay-10)', color: '#fff', border: 'none', borderRadius: 10, width: 48, height: 48, fontSize: 22, cursor: pageIdx < totalPages ? 'pointer' : 'default' }}>
              ›
            </button>
          </div>

          {/* Dot navigation */}
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            {[-1, ...Array(totalPages).fill(0).map((_, i) => i), totalPages].map((p, dotIdx) => (
              <button key={dotIdx} onClick={() => setPageIdx(p)}
                style={{ width: pageIdx === p ? 20 : 8, height: 8, borderRadius: 4, border: 'none', background: pageIdx === p ? 'var(--color-success)' : 'var(--overlay-30)', cursor: 'pointer', transition: 'all 0.2s', padding: 0 }} />
            ))}
          </div>
        </div>
      )}

      {/* ── REPORT ISSUE MODAL ── */}
      {showReport && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:1100, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'var(--surface)', borderRadius:16, padding:28, width:'100%', maxWidth:480, margin:16 }}>
            <div style={{ fontSize:18, fontWeight:800, color:'var(--text)', marginBottom:4 }}>🚩 Report Book Issue</div>
            <div style={{ fontSize:12, color:'var(--muted)', marginBottom:14 }}>
              The generation log will be automatically attached. Admin will investigate and may issue a replacement credit.
            </div>
            {reportMsg ? (
              <div style={{ padding:14, borderRadius:10, background: reportMsg.startsWith('✅') ? 'var(--bg-success-light)' : 'rgba(239,68,68,0.1)', color: reportMsg.startsWith('✅') ? 'var(--text-success-dark)' : 'var(--color-danger)', fontWeight:600, marginBottom:16 }}>
                {reportMsg}
              </div>
            ) : (
              <>
                <textarea
                  value={reportNote}
                  onChange={e => setReportNote(e.target.value)}
                  placeholder="Describe the issue (e.g. wrong images, SVG placeholders, missing pages)…"
                  rows={4}
                  style={{ width:'100%', padding:'10px 12px', borderRadius:10, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:13, resize:'vertical', boxSizing:'border-box', fontFamily:'var(--font-body)' }}
                />
                <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:6, marginBottom:14, fontFamily:'monospace' }}>
                  📎 Generation log ({genLog.length} steps) will be attached automatically
                </div>
              </>
            )}
            <div style={{ display:'flex', gap:10, marginTop:8 }}>
              <button onClick={() => { setShowReport(false); setReportNote(''); setReportMsg(''); }}
                style={{ flex:1, padding:'10px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text)', cursor:'pointer', fontWeight:600 }}>
                {reportMsg ? 'Close' : 'Cancel'}
              </button>
              {!reportMsg && (
                <button onClick={submitReport} disabled={reporting}
                  style={{ flex:2, padding:'10px', borderRadius:8, border:'none', background:'var(--color-danger)', color:'#fff', cursor:'pointer', fontWeight:700, opacity: reporting ? 0.7 : 1 }}>
                  {reporting ? 'Sending…' : '🚩 Send Report'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ── */}
      {showDeleteConfirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:1100, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'var(--surface)', borderRadius:16, padding:28, width:'100%', maxWidth:400, margin:16, textAlign:'center' }}>
            <div style={{ fontSize:48, marginBottom:8 }}>🗑️</div>
            <div style={{ fontSize:18, fontWeight:800, color:'var(--text)', marginBottom:8 }}>Delete this book?</div>
            <div style={{ fontSize:13, color:'var(--muted)', marginBottom:20 }}>
              This will permanently delete <strong>{bookData.title}</strong> and remove all images from storage. Your book credit will <em>not</em> be refunded.
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setShowDeleteConfirm(false)}
                style={{ flex:1, padding:'12px', borderRadius:8, border:'1px solid var(--border)', background:'transparent', color:'var(--text)', cursor:'pointer', fontWeight:600 }}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                style={{ flex:1, padding:'12px', borderRadius:8, border:'none', background:'var(--color-danger)', color:'#fff', cursor:'pointer', fontWeight:700, opacity: deleting ? 0.7 : 1 }}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Print Order Modal */}
      {showOrder && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, margin: 16 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>🖨 Order Printed Book</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>Your story will be professionally printed and shipped in 5–7 business days.</div>

            {orderMsg ? (
              <div style={{ padding: 16, background: orderMsg.startsWith('🎉') ? 'var(--primary-10)' : 'rgba(239,68,68,0.1)', borderRadius: 8, color: orderMsg.startsWith('🎉') ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600, marginBottom: 16 }}>
                {orderMsg}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[['Full Name', 'name', 'text'], ['Address Line 1', 'address1', 'text'], ['Address Line 2 (optional)', 'address2', 'text'], ['City', 'city', 'text'], ['Postcode / ZIP', 'postcode', 'text'], ['Country', 'country', 'text']].map(([label, key]) => (
                  <div key={key}>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 3 }}>{label}</div>
                    <input value={orderForm[key]} onChange={e => setOrderForm(f => ({ ...f, [key]: e.target.value }))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => { setShowOrder(false); setOrderMsg(''); }}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }}>
                {orderMsg ? 'Close' : 'Cancel'}
              </button>
              {!orderMsg && (
                <button onClick={submitOrder} disabled={ordering}
                  style={{ flex: 2, padding: '10px 0', borderRadius: 8, border: 'none', background: 'var(--brand-accent)', color: '#000', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
                  {ordering ? 'Placing order…' : 'Place Order →'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── BOOK SHELF (main exported component) ─────────────────────
export default function StoryBookShelf({ child }) {
  const [books,   setBooks]   = useState([]);
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewing, setViewing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState('');
  const [selectedStory, setSelectedStory] = useState('');
  const [stories, setStories] = useState([]);

  useEffect(() => {
    if (!child?.id) return;
    Promise.all([
      bookAPI.listForChild(child.id),
      bookAPI.getCredits(),
    ]).then(([booksRes, creditsRes]) => {
      if (booksRes.success) setBooks(booksRes.data);
      if (creditsRes.success) setCredits(creditsRes.data.credits);
    }).catch(() => {}).finally(() => setLoading(false));

    // Load AI stories for this child to pick from
    import('../services/api').then(({ aiStoryAPI }) => {
      aiStoryAPI.list(child.id).then(r => {
        // aiStoryAPI.list returns { stories: [] } — show all available stories
        // Response shape: { data: { stories: [], summary: {} } }
        const list = r.data?.stories || [];
        setStories(list);
      }).catch(() => {});
    });
  }, [child?.id]);

  const handleCreateBook = async () => {
    if (!selectedStory) { setCreateMsg('Please select a story first'); return; }
    setCreating(true); setCreateMsg('');
    try {
      const r = await bookAPI.createBook(selectedStory, child.id);
      if (r.success) {
        setCreateMsg('✅ ' + r.data.message);
        setCredits(c => Math.max(0, (c || 0) - 1));
        // Reload books list
        const br = await bookAPI.listForChild(child.id);
        if (br.success) setBooks(br.data);
        // Fetch full book object so viewer has id + pages for polling
        const bookRes = await bookAPI.getBook(r.data.bookId);
        setViewing(bookRes.success ? bookRes.data : { id: r.data.bookId, status: 'pending', title: '', pages: [] });
      } else if (r.noCredits) {
        setCreateMsg('❌ No book credits remaining. Ask your admin to add more, or purchase additional credits.');
      }
    } catch (e) {
      setCreateMsg('❌ ' + (e.message || 'Failed to create book'));
    } finally { setCreating(false); }
  };

  const openBook = async (bookSummary) => {
    try {
      const r = await bookAPI.getBook(bookSummary.id);
      if (r.success) setViewing(r.data);
    } catch {}
  };

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)', textAlign: 'center' }}>Loading books…</div>;

  return (
    <div>
      {/* Viewer overlay */}
      {viewing && (
        <FlipbookViewer
          book={viewing}
          onClose={(action, bookId) => {
            setViewing(null);
            if (action === 'deleted' && bookId) {
              setBooks(prev => prev.filter(b => b.id !== bookId));
            }
          }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>📚 Story Books</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            {credits !== null ? (
              <span>
                <strong style={{ color: credits > 0 ? 'var(--accent)' : 'var(--danger)' }}>{credits} credit{credits !== 1 ? 's' : ''}</strong> remaining
                {credits === 0 ? ' — contact admin for more' : ''}
              </span>
            ) : '…'}
          </div>
        </div>
      </div>

      {/* Create new book */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Create a New Book</div>
        {credits === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--danger)', padding: '10px 0' }}>
            No book credits remaining. Your first book is free — contact your admin or purchase additional credits.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={selectedStory} onChange={e => setSelectedStory(e.target.value)}
              style={{ flex: 1, minWidth: 200, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 13 }}>
              <option value="">— Select an AI story ({stories.length} available) —</option>
              {stories.map(s => (
                <option key={s.id} value={s.id}>
                  {s.title || 'Untitled Story'} {s.times_read > 0 ? `(read ${s.times_read}×)` : '(unread)'}
                </option>
              ))}
            </select>
            <button onClick={handleCreateBook} disabled={creating || !selectedStory || credits === 0}
              style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, opacity: (creating || !selectedStory) ? 0.6 : 1 }}>
              {creating ? '⏳ Creating…' : '✨ Create Book (1 credit)'}
            </button>
          </div>
        )}
        {createMsg && (
          <div style={{ marginTop: 10, fontSize: 13, color: createMsg.startsWith('✅') ? 'var(--accent)' : 'var(--danger)', fontWeight: 600 }}>
            {createMsg}
          </div>
        )}
      </div>

      {/* Book grid */}
      {books.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📖</div>
          <div style={{ fontSize: 16 }}>No books yet — create your first one above!</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Every new account gets 1 free book credit.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
          {books.map(b => (
            <BookCard key={b.id} book={b} onOpen={openBook} />
          ))}
        </div>
      )}
    </div>
  );
}
