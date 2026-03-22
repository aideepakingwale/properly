/**
 * Passport.js OAuth Strategies
 *
 * Google OAuth2:
 *   Setup: console.cloud.google.com → APIs & Services → Credentials → OAuth 2.0 Client ID
 *   Redirect URI: https://properly-api.onrender.com/api/auth/google/callback
 *
 * Facebook:
 *   Setup: developers.facebook.com → My Apps → Create App → Facebook Login
 *   Redirect URI: https://properly-api.onrender.com/api/auth/facebook/callback
 */

import passport        from 'passport';
import GoogleStrategy  from 'passport-google-oauth20';
import FacebookStrategy from 'passport-facebook';
import getDb           from '../db/database.js';
import { randomBytes } from 'crypto';

// ── HELPER: find or create social user ────────────────────────
function findOrCreateSocialUser(provider, profile) {
  const db = getDb();

  // 1. Look up by oauth_provider + oauth_id (returning user)
  const existing = db.prepare(
    'SELECT * FROM users WHERE oauth_provider = ? AND oauth_id = ?'
  ).get(provider, profile.id);

  if (existing) {
    // Update name/avatar in case they changed on provider
    db.prepare(
      'UPDATE users SET oauth_name = ?, oauth_avatar = ? WHERE id = ?'
    ).run(profile.displayName || existing.oauth_name, profile.photos?.[0]?.value || existing.oauth_avatar, existing.id);
    return existing;
  }

  // 2. Email from provider — check if account already exists
  const email = profile.emails?.[0]?.value?.toLowerCase() || null;
  if (email) {
    const byEmail = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (byEmail) {
      // Link social to existing email account
      db.prepare(
        'UPDATE users SET oauth_provider = ?, oauth_id = ?, oauth_name = ?, oauth_avatar = ?, email_verified = 1 WHERE id = ?'
      ).run(provider, profile.id, profile.displayName || '', profile.photos?.[0]?.value || null, byEmail.id);
      return { ...byEmail, oauth_provider: provider };
    }
  }

  // 3. Brand new user — create account
  const newUser = db.prepare(`
    INSERT INTO users (email, password, email_verified, oauth_provider, oauth_id, oauth_name, oauth_avatar)
    VALUES (?,NULL,1,?,?,?,?) RETURNING *
  `).get(email, provider, profile.id, profile.displayName || '', profile.photos?.[0]?.value || null);

  // Create a default child profile (parent can customise name/phase in ParentDash)
  const defaultName = (profile.displayName || email || 'My Child').split(' ')[0];
  db.prepare(
    'INSERT INTO children (user_id, name, phase, acorns, total_acorns) VALUES (?,?,2,60,60)'
  ).run(newUser.id, defaultName + "'s Child");

  return newUser;
}

// ── GOOGLE STRATEGY ──────────────────────────────────────────
export function configurePassport() {
  // Serialize/deserialize for session (only used during OAuth handshake)
  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser((id, done) => {
    try {
      const user = getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
      done(null, user || false);
    } catch (err) { done(err); }
  });

  // ── GOOGLE ───────────────────────────────────────────────
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy(
      {
        clientID:     process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:  `${process.env.API_URL || 'http://localhost:3001'}/api/auth/google/callback`,
        scope:        ['profile', 'email'],
      },
      (_accessToken, _refreshToken, profile, done) => {
        try {
          const user = findOrCreateSocialUser('google', profile);
          done(null, user);
        } catch (err) { done(err); }
      }
    ));
    console.log('✅ Google OAuth configured');
  } else {
    console.log('⚠️  Google OAuth not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing)');
  }

  // ── FACEBOOK ─────────────────────────────────────────────
  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    passport.use(new FacebookStrategy(
      {
        clientID:     process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL:  `${process.env.API_URL || 'http://localhost:3001'}/api/auth/facebook/callback`,
        profileFields: ['id', 'displayName', 'photos', 'email'],
      },
      (_accessToken, _refreshToken, profile, done) => {
        try {
          const user = findOrCreateSocialUser('facebook', profile);
          done(null, user);
        } catch (err) { done(err); }
      }
    ));
    console.log('✅ Facebook OAuth configured');
  } else {
    console.log('⚠️  Facebook OAuth not configured (FACEBOOK_APP_ID / FACEBOOK_APP_SECRET missing)');
  }

  return passport;
}

export function googleAvailable() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function facebookAvailable() {
  return Boolean(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
}
