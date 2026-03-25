/**
 * @file        report.controller.js
 * @description Content report system — users flag AI stories/books for review;
 *              admin reviews and optionally awards credits as compensation.
 * @module      Reports
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 */

import getDb from '../db/database.js';

const VALID_REASONS = ['wrong_words','inappropriate','image_error','generation_failed','poor_quality','other'];

// ── SUBMIT REPORT (user) ──────────────────────────────────────
export const submitReport = (req, res) => {
  const db     = getDb();
  const userId = req.user.userId;
  const { contentType, contentId, reason, detail, childId } = req.body;

  if (!contentType || !contentId || !reason) {
    return res.status(400).json({ success: false, message: 'contentType, contentId and reason are required' });
  }
  if (!['ai_story','story_book'].includes(contentType)) {
    return res.status(400).json({ success: false, message: 'contentType must be ai_story or story_book' });
  }
  if (!VALID_REASONS.includes(reason)) {
    return res.status(400).json({ success: false, message: `reason must be one of: ${VALID_REASONS.join(', ')}` });
  }

  // Prevent duplicate reports from same user for same content
  const existing = db.prepare(
    `SELECT id FROM content_reports WHERE user_id=? AND content_id=? AND status='pending'`
  ).get(userId, contentId);
  if (existing) {
    return res.status(409).json({ success: false, message: 'You have already reported this content. Our team will review it.' });
  }

  // Fetch content title for display in admin queue
  let title = '';
  try {
    if (contentType === 'ai_story') {
      const s = db.prepare('SELECT title FROM ai_stories WHERE id=?').get(contentId);
      title = s?.title || '';
    } else {
      const b = db.prepare('SELECT title FROM story_books WHERE id=?').get(contentId);
      title = b?.title || '';
    }
  } catch {}

  const reportId = crypto.randomUUID?.() || `r${Date.now()}`;
  db.prepare(`
    INSERT INTO content_reports
      (id, user_id, child_id, content_type, content_id, content_title, reason, detail)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(reportId, userId, childId || null, contentType, contentId, title, reason, detail || null);

  res.json({
    success: true,
    data: {
      reportId,
      message: 'Thank you for your report! Our team will review it. If your report helps us improve, you may receive bonus credits.',
    },
  });
};

// ── LIST MY REPORTS (user) ────────────────────────────────────
export const myReports = (req, res) => {
  const db     = getDb();
  const userId = req.user.userId;
  const reports = db.prepare(`
    SELECT id, content_type, content_title, reason, status, credits_awarded, credit_type, admin_note, created_at
    FROM content_reports WHERE user_id=? ORDER BY created_at DESC LIMIT 50
  `).all(userId);
  res.json({ success: true, data: reports });
};

// ── ADMIN: LIST ALL REPORTS ───────────────────────────────────
export const adminListReports = (req, res) => {
  const db     = getDb();
  const status = req.query.status || 'pending';
  const reports = db.prepare(`
    SELECT cr.*, u.email as user_email
    FROM content_reports cr
    JOIN users u ON u.id = cr.user_id
    WHERE cr.status = ?
    ORDER BY cr.created_at DESC
    LIMIT 100
  `).all(status);
  const counts = db.prepare(`
    SELECT status, COUNT(*) as n FROM content_reports GROUP BY status
  `).all();
  res.json({ success: true, data: { reports, counts } });
};

// ── ADMIN: REVIEW REPORT ──────────────────────────────────────
export const adminReviewReport = (req, res) => {
  const db      = getDb();
  const adminId = req.user.userId;
  const { id }  = req.params;
  const { action, adminNote, creditsAmount, creditType } = req.body;

  // action: 'credit' | 'dismiss'
  if (!['credit','dismiss'].includes(action)) {
    return res.status(400).json({ success: false, message: 'action must be credit or dismiss' });
  }

  const report = db.prepare('SELECT * FROM content_reports WHERE id=?').get(id);
  if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
  if (report.status !== 'pending') {
    return res.status(400).json({ success: false, message: 'Report already reviewed' });
  }

  if (action === 'credit') {
    const amt  = parseInt(creditsAmount) || 1;
    const type = creditType || (report.content_type === 'story_book' ? 'book' : 'story');

    // Award credits
    if (type === 'book') {
      // Book credits
      db.prepare(`INSERT OR IGNORE INTO book_credits (user_id, credits) VALUES (?,0)`).run(report.user_id);
      db.prepare(`UPDATE book_credits SET credits=credits+?, updated_at=CURRENT_TIMESTAMP WHERE user_id=?`).run(amt, report.user_id);
      db.prepare(`INSERT INTO book_credit_transactions (user_id, delta, reason, admin_id) VALUES (?,?,?,?)`).run(report.user_id, amt, 'report_credit', adminId);
    } else {
      // AI story generation credits — stored in app_settings per user (simple counter)
      const key = `story_credits:${report.user_id}`;
      const row = db.prepare(`SELECT value FROM app_settings WHERE key=?`).get(key);
      const cur = parseInt(row?.value || '0');
      db.prepare(`INSERT INTO app_settings (key, value, updated_at) VALUES (?,?,CURRENT_TIMESTAMP)
                  ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`)
        .run(key, String(cur + amt));
    }

    db.prepare(`
      UPDATE content_reports
      SET status='credited', admin_note=?, credits_awarded=?, credit_type=?,
          reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(adminNote || null, amt, type, adminId, id);

    return res.json({ success: true, data: { message: `Report credited — ${amt} ${type} credit(s) awarded to user.` } });
  }

  // Dismiss
  db.prepare(`
    UPDATE content_reports
    SET status='dismissed', admin_note=?, reviewed_by=?, reviewed_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(adminNote || null, adminId, id);

  res.json({ success: true, data: { message: 'Report dismissed.' } });
};
