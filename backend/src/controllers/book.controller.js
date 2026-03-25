
// ── ADMIN: GET BOOK GENERATION LOGS ──────────────────────────
export const getBookLogs = (req, res) => {
  const db   = getDb();
  const book = db.prepare('SELECT id, title, status, error_msg, generation_log, generation_progress, created_at, updated_at FROM story_books WHERE id=?').get(req.params.bookId);
  if (!book) return res.status(404).json({ success: false, message: 'Book not found' });

  let logs = [];
  try { logs = JSON.parse(book.generation_log || '[]'); } catch {}

  res.json({ success: true, data: { ...book, logs } });
};

/**
 * @file        book.controller.js
 * @description Story book controller — create books, manage credits, serve PDF/images, order print
 * @module      Books
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - 1 free credit per user on registration; additional credits via admin grant or purchase
 *   - Book generation is async — POST /books starts it, GET /books/:id polls status
 *   - PDF and images served via signed R2 URLs (1h expiry)
 *   - Print order records shipping address; fulfilment (Gelato/Prodigi) is future work
 */

import getDb             from '../db/database.js';
import { generateBook, getBookDebugLog }  from '../services/book.service.js';
import { r2Url, r2Available } from '../services/r2.service.js';

// ── CREDIT HELPERS ────────────────────────────────────────────
function getCredits(db, userId) {
  return db.prepare('SELECT credits FROM book_credits WHERE user_id=?').get(userId)?.credits ?? 0;
}

function ensureCreditsRow(db, userId) {
  db.prepare(`INSERT OR IGNORE INTO book_credits (user_id, credits) VALUES (?,0)`).run(userId);
}

// ── GET CREDITS ───────────────────────────────────────────────
export const getUserCredits = (req, res) => {
  const db      = getDb();
  const userId  = req.user.userId;
  const credits = getCredits(db, userId);
  const history = db.prepare(`
    SELECT delta, reason, created_at FROM book_credit_transactions
    WHERE user_id=? ORDER BY created_at DESC LIMIT 20
  `).all(userId);
  res.json({ success: true, data: { credits, history } });
};

// ── LIST BOOKS FOR CHILD ──────────────────────────────────────
export const listBooks = (req, res) => {
  const db = getDb();
  const books = db.prepare(`
    SELECT sb.*, ai.title as story_title
    FROM story_books sb
    JOIN ai_stories ai ON ai.id = sb.ai_story_id
    WHERE sb.child_id = ?
    ORDER BY sb.created_at DESC
  `).all(req.params.childId);
  res.json({ success: true, data: books });
};

// ── GET SINGLE BOOK (with pages + signed URLs) ────────────────
export const getBook = async (req, res) => {
  const db   = getDb();
  const book = db.prepare('SELECT * FROM story_books WHERE id=?').get(req.params.bookId);
  if (!book) return res.status(404).json({ success: false, message: 'Book not found' });

  const pages = db.prepare('SELECT * FROM story_book_pages WHERE book_id=? ORDER BY page_num').all(book.id);

  // Generate signed URLs for R2 keys, or pass through direct URLs
  const isUrl = (v) => v && (v.startsWith('http://') || v.startsWith('https://'));

  for (const page of pages) {
    if (page.image_r2_key) {
      if (isUrl(page.image_r2_key)) {
        page.imageSignedUrl = page.image_r2_key;   // already a URL
      } else if (r2Available()) {
        try { page.imageSignedUrl = await r2Url(page.image_r2_key, 3600); } catch {}
      }
    }
    // Always surface image_url as the final fallback
    if (!page.imageSignedUrl && page.image_url) {
      page.imageSignedUrl = page.image_url;
    }
  }

  if (book.pdf_r2_key && !isUrl(book.pdf_r2_key) && r2Available()) {
    try { book.pdfSignedUrl = await r2Url(book.pdf_r2_key, 3600); } catch {}
  }

  if (book.cover_r2_key) {
    if (isUrl(book.cover_r2_key)) {
      book.coverSignedUrl = book.cover_r2_key;    // already a URL
    } else if (r2Available()) {
      try { book.coverSignedUrl = await r2Url(book.cover_r2_key, 3600); } catch {}
    }
  }

  res.json({ success: true, data: { ...book, pages } });
};

// ── CREATE BOOK (deduct credit, start async generation) ───────
export const createBook = (req, res) => {
  const db         = getDb();
  const userId     = req.user.userId;
  const { aiStoryId, childId } = req.body;

  if (!aiStoryId || !childId) {
    return res.status(400).json({ success: false, message: 'aiStoryId and childId required' });
  }

  // Verify child belongs to this user
  const child = db.prepare('SELECT * FROM children WHERE id=? AND user_id=?').get(childId, userId);
  if (!child) return res.status(403).json({ success: false, message: 'Child not found' });

  // Verify AI story exists and belongs to child
  const story = db.prepare('SELECT * FROM ai_stories WHERE id=? AND child_id=?').get(aiStoryId, childId);
  if (!story) return res.status(403).json({ success: false, message: 'Story not found' });

  // Check credits
  ensureCreditsRow(db, userId);
  const credits = getCredits(db, userId);
  if (credits < 1) {
    return res.status(402).json({
      success:    false,
      noCredits:  true,
      message:    'No book credits remaining. Purchase more credits to create additional books.',
    });
  }

  // Deduct credit
  db.prepare(`UPDATE book_credits SET credits=credits-1, updated_at=CURRENT_TIMESTAMP WHERE user_id=?`).run(userId);
  db.prepare(`INSERT INTO book_credit_transactions (user_id, delta, reason) VALUES (?,-1,'book_generated')`).run(userId);

  // Create book record
  const bookId = require_uuid();
  db.prepare(`INSERT INTO story_books (id, child_id, ai_story_id, title, status)
              VALUES (?,?,?,?,?)`).run(bookId, childId, aiStoryId, story.title || `${child.name}'s Story`, 'pending');

  // Create page placeholders
  const pages = db.prepare('SELECT * FROM ai_story_pages WHERE story_id=? ORDER BY page_index').all(aiStoryId);
  for (const page of pages) {
    db.prepare(`INSERT INTO story_book_pages (book_id, page_num, text, image_prompt)
                VALUES (?,?,?,?)`).run(bookId, page.page_index, page.text, page.text);
  }

  // Defer generation to next event loop tick so HTTP response is fully sent first
  // Without this, Node.js may not flush the response until the first async operation yields
  setImmediate(() => {
    generateBook(bookId).catch(e => console.error('[Book] Async generation error:', e.message));
  });

  res.json({ success: true, data: { bookId, status: 'pending', message: 'Book generation started! Check back in ~30 seconds.' } });
};

function require_uuid() {
  return randomHex();
}
function randomHex() {
  const chars = '0123456789abcdef';
  let id = '';
  for (let i = 0; i < 32; i++) id += chars[Math.floor(Math.random() * 16)];
  return id.slice(0,8)+'-'+id.slice(8,12)+'-'+id.slice(12,16)+'-'+id.slice(16,20)+'-'+id.slice(20);
}

// ── RETRY FAILED BOOK ────────────────────────────────────────
export const retryBook = (req, res) => {
  const db     = getDb();
  const userId = req.user.userId;
  const { bookId } = req.params;

  const book = db.prepare(`
    SELECT sb.* FROM story_books sb
    JOIN children c ON c.id = sb.child_id
    WHERE sb.id=? AND c.user_id=?
  `).get(bookId, userId);

  if (!book) return res.status(404).json({ success: false, message: 'Book not found' });
  if (book.status === 'ready') return res.json({ success: true, data: { message: 'Book already ready' } });

  // Reset to pending and re-trigger generation
  db.prepare(`UPDATE story_books SET status='pending', error_msg=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(bookId);

  setImmediate(() => {
    generateBook(bookId).catch(e => console.error('[Book] Retry error:', e.message));
  });

  res.json({ success: true, data: { bookId, status: 'pending', message: 'Retrying book generation…' } });
};

// ── DELETE BOOK ───────────────────────────────────────────────
export const deleteBook = (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM story_books WHERE id=?').run(req.params.bookId);
  res.json({ success: true });
};

// ── ORDER PRINT ───────────────────────────────────────────────
export const orderPrint = (req, res) => {
  const db = getDb();
  const { bookId } = req.params;
  const { name, address1, address2, city, postcode, country } = req.body;

  const book = db.prepare('SELECT * FROM story_books WHERE id=?').get(bookId);
  if (!book)          return res.status(404).json({ success: false, message: 'Book not found' });
  if (book.status !== 'ready')
    return res.status(400).json({ success: false, message: 'Book must be ready before ordering print' });
  if (book.print_ordered)
    return res.status(400).json({ success: false, message: 'Print already ordered for this book' });

  if (!name || !address1 || !city || !postcode || !country) {
    return res.status(400).json({ success: false, message: 'Full shipping address required' });
  }

  const address = JSON.stringify({ name, address1, address2, city, postcode, country });
  db.prepare(`UPDATE story_books SET print_ordered=1, print_address=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(address, bookId);

  // TODO: Submit to Gelato/Prodigi print-on-demand API
  // For now, record the order — admin can see and fulfil manually

  res.json({
    success: true,
    data: {
      message: 'Print order placed! Your book will be printed and shipped within 5-7 business days.',
      orderRef: `BOOK-${bookId.slice(0, 8).toUpperCase()}`,
    },
  });
};

// ── DEBUG LOG (admin only) ────────────────────────────────────
export const getBookDebug = (req, res) => {
  try {
    const data = getBookDebugLog(req.params.bookId);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── ADMIN: GET ALL BOOKS ──────────────────────────────────────
export const adminListBooks = (req, res) => {
  const db    = getDb();
  const limit = parseInt(req.query.limit) || 50;
  const books = db.prepare(`
    SELECT sb.*, c.name as child_name, u.email as parent_email, ai.title as story_title
    FROM story_books sb
    JOIN children c ON c.id = sb.child_id
    JOIN users u    ON u.id = c.user_id
    JOIN ai_stories ai ON ai.id = sb.ai_story_id
    ORDER BY sb.created_at DESC LIMIT ?
  `).all(limit);
  res.json({ success: true, data: books });
};

// ── ADMIN: ADD CREDITS ────────────────────────────────────────
export const adminAddCredits = (req, res) => {
  const db         = getDb();
  const adminId    = req.user.userId;
  const { userId } = req.params;
  const { credits, reason } = req.body;

  if (!credits || credits < 1 || credits > 100) {
    return res.status(400).json({ success: false, message: 'credits must be 1–100' });
  }

  const user = db.prepare('SELECT id, email FROM users WHERE id=?').get(userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  ensureCreditsRow(db, userId);
  db.prepare(`UPDATE book_credits SET credits=credits+?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?`)
    .run(credits, userId);
  db.prepare(`INSERT INTO book_credit_transactions (user_id, delta, reason, admin_id) VALUES (?,?,?,?)`)
    .run(userId, credits, reason || 'admin_grant', adminId);

  const newTotal = getCredits(db, userId);
  res.json({ success: true, data: { userId, newTotal, message: `Added ${credits} credit(s) to ${user.email}` } });
};

// ── ADMIN: GET USER CREDITS ───────────────────────────────────
export const adminGetCredits = (req, res) => {
  const db   = getDb();
  const data = db.prepare(`
    SELECT u.id, u.email, COALESCE(bc.credits,0) as credits
    FROM users u LEFT JOIN book_credits bc ON bc.user_id = u.id
    ORDER BY bc.credits DESC NULLS LAST
    LIMIT 200
  `).all();
  res.json({ success: true, data });
};
