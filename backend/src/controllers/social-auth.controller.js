/**
 * @file        social-auth.controller.js
 * @description OAuth social login controller — Google and Facebook via Passport.js
 * @module      Auth
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 */

import jwt from 'jsonwebtoken';
import getDb from '../db/database.js';
import { googleAvailable, facebookAvailable } from '../services/passport.service.js';

function signToken(userId, email) {
  return jwt.sign({ userId, email: email || '' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

// Called after successful Google/Facebook authentication
function handleSocialCallback(req, res) {
  try {
    if (!req.user) {
      return redirectError(res, 'Authentication failed. Please try again.');
    }

    const user     = req.user;
    const db       = getDb();
    const children = db.prepare('SELECT * FROM children WHERE user_id = ?').all(user.id);
    const child    = children[0];
    const token    = signToken(user.id, user.email);

    // Pass data to frontend via URL params — minimal, just the token
    // Frontend stores token and redirects to /home
    const frontendUrl = process.env.APP_URL || 'http://localhost:5173';
    const params = new URLSearchParams({
      token,
      provider: user.oauth_provider,
      isNew: children.length === 0 ? '1' : '0',
    });

    res.redirect(`${frontendUrl}/social-callback?${params}`);
  } catch (err) {
    console.error('Social callback error:', err);
    redirectError(res, 'Something went wrong. Please try again.');
  }
}

function redirectError(res, message) {
  const frontendUrl = process.env.APP_URL || 'http://localhost:5173';
  res.redirect(`${frontendUrl}/auth?error=${encodeURIComponent(message)}`);
}

// ── GOOGLE ────────────────────────────────────────────────────
export const googleAuth         = (req, res, next) => next(); // passport handles in route
export const googleCallback     = handleSocialCallback;

// ── FACEBOOK ─────────────────────────────────────────────────
export const facebookAuth       = (req, res, next) => next();
export const facebookCallback   = handleSocialCallback;

// ── STATUS: which providers are enabled ──────────────────────
export const socialStatus = (_req, res) => {
  res.json({
    success: true,
    data: {
      google:   googleAvailable(),
      facebook: facebookAvailable(),
    },
  });
};
