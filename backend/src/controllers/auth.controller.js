import bcrypt from 'bcryptjs';
import jwt    from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import getDb  from '../db/database.js';
import { sendVerificationEmail, sendWelcomeEmail, sendResendVerificationEmail, emailAvailable } from '../services/email.service.js';
import { autoPromoteAdmins } from '../middleware/admin.middleware.js';

function signToken(userId, email) {
  return jwt.sign({ userId, email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

function generateToken() {
  return randomBytes(32).toString('hex');
}

// ── REGISTER ──────────────────────────────────────────────────
export const register = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    if (!email.includes('@')) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const db = getDb();
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (exists) return res.status(409).json({ success: false, message: 'This email is already registered' });

    const hash         = await bcrypt.hash(password, 12);
    const verifyToken  = generateToken();
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const userId = db.prepare(`
      INSERT INTO users (email, password, email_verified, verify_token, verify_expires, verify_sent_at)
      VALUES (?,?,0,?,?,CURRENT_TIMESTAMP) RETURNING id
    `).get(email.toLowerCase(), hash, verifyToken, verifyExpiry).id;

    // No child created at registration — parent adds children after logging in
    const emailResult = await sendVerificationEmail({
      email: email.toLowerCase(),
      childName: 'there',   // generic welcome
      token: verifyToken,
    });

    res.status(201).json({
      success: true,
      data: {
        emailSent:            emailResult.sent,
        emailConfigured:      emailAvailable(),
        requiresVerification: emailAvailable(),
        message: emailResult.sent
          ? `Verification email sent to ${email}. Please check your inbox to activate your account.`
          : emailAvailable()
          ? 'Registration successful. There was a problem sending the verification email — please use Resend below.'
          : 'Registration successful! You can log in now.',
        ...(!emailAvailable() && {
          token: signToken(userId, email.toLowerCase()),
          user:  { id: userId, email: email.toLowerCase() },
          children: [],
        }),
      },
    });
  } catch (err) {
    console.error('register:', err);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
};

// ── VERIFY EMAIL ──────────────────────────────────────────────
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ success: false, message: 'Verification token missing' });

    const db   = getDb();
    const user = db.prepare('SELECT * FROM users WHERE verify_token = ?').get(token);

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification link. Please request a new one.' });
    }
    if (user.email_verified) {
      // Already verified — just log them in
      const children = db.prepare('SELECT * FROM children WHERE user_id = ?').all(user.id);
      const jwt_token = signToken(user.id, user.email);
      return res.json({
        success: true,
        alreadyVerified: true,
        data: { token: jwt_token, user: { id: user.id, email: user.email }, children: children.map(formatChild) },
      });
    }
    if (new Date(user.verify_expires) < new Date()) {
      return res.status(400).json({ success: false, expired: true, message: 'This link has expired. Please request a new verification email.' });
    }

    // Mark verified
    db.prepare('UPDATE users SET email_verified = 1, verify_token = NULL, verify_expires = NULL WHERE id = ?')
      .run(user.id);

    const children = db.prepare('SELECT * FROM children WHERE user_id = ?').all(user.id);
    const child    = children[0];

    // Send welcome email (fire-and-forget)
    const firstChild = db.prepare('SELECT name FROM children WHERE user_id=? LIMIT 1').get(user.id);
    sendWelcomeEmail({ email: user.email, childName: firstChild?.name || 'there' });

    const jwt_token = signToken(user.id, user.email);
    res.json({
      success: true,
      data: {
        token: jwt_token,
        user: { id: user.id, email: user.email },
        children: children.map(formatChild),
        message: 'Email verified! Welcome to the Phonics Forest 🌳',
      },
    });
  } catch (err) {
    console.error('verifyEmail:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── RESEND VERIFICATION ───────────────────────────────────────
export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });

    const db   = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());

    if (!user) return res.status(404).json({ success: false, message: 'No account found with this email' });
    if (user.email_verified) return res.status(400).json({ success: false, message: 'This email is already verified' });

    // Rate limit: allow resend only every 60 seconds
    if (user.verify_sent_at) {
      const lastSent = new Date(user.verify_sent_at).getTime();
      if (Date.now() - lastSent < 60_000) {
        return res.status(429).json({ success: false, message: 'Please wait 60 seconds before requesting another email' });
      }
    }

    const newToken  = generateToken();
    const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    db.prepare('UPDATE users SET verify_token = ?, verify_expires = ?, verify_sent_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newToken, newExpiry, user.id);

    const firstChild = db.prepare('SELECT name FROM children WHERE user_id=? LIMIT 1').get(user.id);

    const result = await sendResendVerificationEmail({
      email: user.email,
      childName: firstChild?.name || 'there',
      token: newToken,
    });

    res.json({
      success: true,
      data: { sent: result.sent, message: result.sent ? 'Verification email resent — check your inbox!' : 'Could not send email. Please check your email address.' },
    });
  } catch (err) {
    console.error('resendVerification:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── LOGIN ─────────────────────────────────────────────────────
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'email and password required' });

    const db   = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user) return res.status(401).json({ success: false, message: 'Invalid email or password' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid email or password' });

    // Block unverified users only if email IS configured (so non-email setups work)
    if (emailAvailable() && !user.email_verified) {
      return res.status(403).json({
        success: false,
        unverified: true,
        message: 'Please verify your email address before logging in. Check your inbox for the verification link.',
        email: user.email,
      });
    }

    const children = db.prepare('SELECT * FROM children WHERE user_id = ?').all(user.id);
    const token    = signToken(user.id, user.email);

    res.json({
      success: true,
      data: { token, user: { id: user.id, email: user.email }, children: children.map(formatChild) },
    });
  } catch (err) {
    console.error('login:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── GET ME ────────────────────────────────────────────────────
export const getMe = (req, res) => {
  const db   = getDb();
  const user = db.prepare('SELECT id, email, email_verified, created_at FROM users WHERE id = ?').get(req.user.userId);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const children = db.prepare('SELECT * FROM children WHERE user_id = ?').all(user.id);
  res.json({ success: true, data: { user, children: children.map(formatChild) } });
};

function formatChild(c) {
  return {
    id: c.id, name: c.name, phase: c.phase, acorns: c.acorns,
    totalAcorns: c.total_acorns, wordsRead: c.words_read,
    streak: c.streak, lastRead: c.last_read,
    hasPerfect: Boolean(c.has_perfect), avatar: c.avatar, createdAt: c.created_at,
  };
}
