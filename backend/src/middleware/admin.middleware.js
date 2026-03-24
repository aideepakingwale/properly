/**
 * @file        admin.middleware.js
 * @description Admin access guard middleware and auto-promotion helper
 * @module      Middleware
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - requireAdmin checks users.is_admin=1 in DB
 *   - autoPromoteAdmins promotes emails listed in ADMIN_EMAILS env var on each login
 *   - Admin users bypass email verification gate
 */

import getDb from '../db/database.js';

export function requireAdmin(req, res, next) {
  const db   = getDb();
  const user = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.userId);
  if (!user?.is_admin) {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
}

/**
 * Auto-promote ADMIN_EMAILS list on login.
 * Call this after a successful login to grant admin rights to configured emails.
 */
export function autoPromoteAdmins(userId, email, db) {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  if (adminEmails.includes(email.toLowerCase())) {
    db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(userId);
  }
}
