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

import { useState, useEffect, useCallback } from 'react';
import { bookAPI } from '../services/api';

// ── BOOK CARD ─────────────────────────────────────────────────
function BookCard({ book, onOpen }) {
  const statusColour = {
    ready:      '#10B981',
    generating: '#F59E0B',
    pending:    '#6B7280',
    error:      '#EF4444',
  }[book.status] || '#6B7280';

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
      onMouseEnter={e => { if (book.status === 'ready') { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)'; }}}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
    >
      {/* Cover */}
      <div style={{ height: 180, background: 'linear-gradient(135deg,#2D6A4F,#52B788)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {book.coverSignedUrl
          ? <img src={book.coverSignedUrl} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 56 }}>📖</span>
        }
        <div style={{ position: 'absolute', top: 8, right: 8, background: statusColour, color: '#fff', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
          {statusLabel}
        </div>
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

// ── FLIPBOOK VIEWER ───────────────────────────────────────────
function FlipbookViewer({ book, onClose }) {
  const [pageIdx, setPageIdx]     = useState(-1);  // -1 = cover
  const [pollingKey, setPolling]  = useState(0);
  const [bookData, setBookData]   = useState(book);
  const [showOrder, setShowOrder] = useState(false);
  const [orderForm, setOrderForm] = useState({ name:'', address1:'', address2:'', city:'', postcode:'', country:'GB' });
  const [orderMsg, setOrderMsg]   = useState('');
  const [ordering, setOrdering]   = useState(false);

  const pages = bookData.pages || [];
  const isReady = bookData.status === 'ready';

  // Poll while generating
  useEffect(() => {
    if (isReady) return;
    const t = setInterval(async () => {
      try {
        const r = await bookAPI.getBook(bookData.id);
        if (r.success) setBookData(r.data);
      } catch {}
    }, 3000);
    return () => clearInterval(t);
  }, [bookData.id, isReady]);

  const totalPages = pages.length;
  const currentPage = pageIdx === -1 ? null : pages[pageIdx];
  const imgSrc = currentPage?.imageSignedUrl || currentPage?.image_url;

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
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontSize: 14 }}>← Back</button>
        <div style={{ flex: 1, color: '#fff', fontWeight: 700, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bookData.title}</div>
        {isReady && bookData.pdfSignedUrl && (
          <a href={bookData.pdfSignedUrl} download target="_blank" rel="noreferrer"
            style={{ background: '#10B981', color: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            ⬇ Download PDF
          </a>
        )}
        {isReady && !bookData.print_ordered && (
          <button onClick={() => setShowOrder(true)}
            style={{ background: '#F59E0B', color: '#000', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            🖨 Order Print
          </button>
        )}
        {bookData.print_ordered && (
          <span style={{ background: '#6B7280', color: '#fff', borderRadius: 8, padding: '8px 14px', fontSize: 13 }}>🖨 Print Ordered</span>
        )}
      </div>

      {/* Not ready yet */}
      {!isReady && (
        <div style={{ color: '#fff', textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>
            {bookData.status === 'error' ? '❌' : '⏳'}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {bookData.status === 'error'
              ? 'Generation failed: ' + (bookData.error_msg || 'unknown error')
              : bookData.status === 'generating' ? 'Creating your beautiful book…' : 'Book queued for generation…'}
          </div>
          {bookData.status !== 'error' && (
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>
              Generating AI illustrations for each page. This takes about 30–60 seconds.
            </div>
          )}
        </div>
      )}

      {/* Book viewer */}
      {isReady && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: 760, padding: '0 16px' }}>

          {/* Page display */}
          <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', width: '100%', maxWidth: 680 }}>
            {pageIdx === -1 ? (
              // Cover
              <div style={{ background: 'linear-gradient(135deg,#1E3A5F,#2D6A4F)', padding: 40, textAlign: 'center', minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                {bookData.coverSignedUrl
                  ? <img src={bookData.coverSignedUrl} alt="cover" style={{ maxWidth: 300, maxHeight: 250, borderRadius: 12, marginBottom: 24 }} />
                  : <div style={{ fontSize: 80, marginBottom: 24 }}>📖</div>
                }
                <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 8 }}>{bookData.title}</div>
                <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)' }}>Tap → to start reading</div>
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
                <div style={{ padding: '20px 28px 24px', background: ['#F0FFF4','#FFF9F0','#F0F4FF','#FFF0F9'][pageIdx % 4] }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#1E3A5F', lineHeight: 1.5, textAlign: 'center' }}>
                    {currentPage.text}
                  </div>
                </div>
              </div>
            ) : (
              // Back cover
              <div style={{ background: '#2D6A4F', padding: 40, textAlign: 'center', minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ fontSize: 72, marginBottom: 16 }}>🌟</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 8 }}>The End!</div>
                <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.8)' }}>What a brilliant reader you are!</div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 20 }}>
            <button onClick={() => setPageIdx(p => Math.max(-1, p - 1))}
              disabled={pageIdx === -1}
              style={{ background: pageIdx > -1 ? '#2D6A4F' : 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: 10, width: 48, height: 48, fontSize: 22, cursor: pageIdx > -1 ? 'pointer' : 'default' }}>
              ‹
            </button>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, minWidth: 100, textAlign: 'center' }}>
              {pageIdx === -1 ? 'Cover'
                : pageIdx >= totalPages ? 'The End'
                : `Page ${pageIdx + 1} of ${totalPages}`}
            </div>
            <button onClick={() => setPageIdx(p => Math.min(totalPages, p + 1))}
              disabled={pageIdx >= totalPages}
              style={{ background: pageIdx < totalPages ? '#2D6A4F' : 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: 10, width: 48, height: 48, fontSize: 22, cursor: pageIdx < totalPages ? 'pointer' : 'default' }}>
              ›
            </button>
          </div>

          {/* Dot navigation */}
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            {[-1, ...Array(totalPages).fill(0).map((_, i) => i), totalPages].map((p, dotIdx) => (
              <button key={dotIdx} onClick={() => setPageIdx(p)}
                style={{ width: pageIdx === p ? 20 : 8, height: 8, borderRadius: 4, border: 'none', background: pageIdx === p ? '#10B981' : 'rgba(255,255,255,0.3)', cursor: 'pointer', transition: 'all 0.2s', padding: 0 }} />
            ))}
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
              <div style={{ padding: 16, background: orderMsg.startsWith('🎉') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', borderRadius: 8, color: orderMsg.startsWith('🎉') ? '#10B981' : '#EF4444', fontWeight: 600, marginBottom: 16 }}>
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
                  style={{ flex: 2, padding: '10px 0', borderRadius: 8, border: 'none', background: '#F59E0B', color: '#000', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
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
      {viewing && <FlipbookViewer book={viewing} onClose={() => setViewing(null)} />}

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
              style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#2D6A4F', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, opacity: (creating || !selectedStory) ? 0.6 : 1 }}>
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
