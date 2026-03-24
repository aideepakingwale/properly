/**
 * @file        auth.middleware.js
 * @description JWT authentication middleware and per-child ownership guard
 * @module      Middleware
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - authMiddleware: validates Bearer token, attaches req.user
 *   - requireChild: validates childId belongs to authenticated parent, attaches req.child
 *   - optionalAuth: same as authMiddleware but does not reject unauthenticated requests
 */

import jwt from 'jsonwebtoken';
import getDb from '../db/database.js';

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    return res.status(401).json({ success: false, message: msg });
  }
}

export function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    } catch {}
  }
  next();
}

export function requireChild(req, res, next) {
  const childId = req.params.childId || req.body.childId;
  if (!childId) return res.status(400).json({ success: false, message: 'childId required' });

  const db = getDb();
  const child = db.prepare('SELECT * FROM children WHERE id = ? AND user_id = ?').get(childId, req.user.userId);
  if (!child) return res.status(403).json({ success: false, message: 'Child not found or access denied' });

  req.child = child;
  next();
}
