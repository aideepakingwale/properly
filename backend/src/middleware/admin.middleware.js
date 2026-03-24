/**
 * Admin middleware — verifies authenticated user is an admin.
 * Must be used AFTER authMiddleware.
 *
 * To make yourself an admin:
 *   sqlite3 data/properly.db "UPDATE users SET is_admin=1 WHERE email='your@email.com';"
 *   Or set ADMIN_EMAILS env var (comma-separated) to auto-promote on next login.
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
