/**
 * Email Service — Nodemailer
 *
 * Supports any SMTP provider. Pre-configured for:
 *   - Gmail (free, 500 emails/day)         SMTP_PROVIDER=gmail
 *   - Outlook/Hotmail (free)               SMTP_PROVIDER=outlook
 *   - Brevo/SendinBlue (300 emails/day)    SMTP_PROVIDER=brevo
 *   - Custom SMTP                          Use SMTP_HOST/PORT/USER/PASS
 *
 * Gmail setup (recommended):
 *   1. Enable 2-Factor Authentication on your Google account
 *   2. Go to myaccount.google.com → Security → App passwords
 *   3. Create an App Password for "Mail"
 *   4. Use that 16-char password as SMTP_PASS (not your Gmail password)
 */

import nodemailer from 'nodemailer';

const APP_VERSION = '2.0.0';

// ── TRANSPORT FACTORY ─────────────────────────────────────────
function createTransport() {
  const provider = (process.env.SMTP_PROVIDER || '').toLowerCase();

  if (provider === 'gmail') {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }

  if (provider === 'outlook') {
    return nodemailer.createTransport({
      host: 'smtp-mail.outlook.com',
      port: 587, secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }

  if (provider === 'brevo') {
    return nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587, secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }

  // Generic custom SMTP
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }

  return null;
}

export function emailAvailable() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

// ── SHARED BRAND HEADER/FOOTER ────────────────────────────────
const year = new Date().getFullYear();

function emailWrapper(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Properly — AI Phonics Tutor</title>
<style>
  body{margin:0;padding:0;background:#F4F7F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1C1917}
  .wrap{max-width:520px;margin:32px auto;padding:0 16px}
  .card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)}
  .header{background:#1B4332;padding:28px 32px;text-align:center}
  .header-icon{font-size:44px;margin-bottom:8px}
  .header-title{color:#fff;font-size:22px;font-weight:800;letter-spacing:0.5px;margin:0}
  .header-sub{color:rgba(255,255,255,0.6);font-size:13px;margin:4px 0 0}
  .body{padding:32px}
  h2{font-size:20px;font-weight:800;color:#1C1917;margin:0 0 12px}
  p{font-size:15px;line-height:1.65;color:#44403C;margin:0 0 14px}
  .btn{display:block;width:fit-content;margin:24px auto;background:#2D6A4F;color:#fff!important;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:50px;text-align:center}
  .divider{border:none;border-top:1px solid #E7E5E4;margin:24px 0}
  .url-box{background:#F4F4F0;border-radius:8px;padding:12px 16px;font-size:12px;color:#78716C;word-break:break-all;font-family:monospace}
  .footer{text-align:center;padding:20px 16px 24px;font-size:12px;color:#A8A29E;line-height:1.7}
  .footer a{color:#A8A29E;text-decoration:underline}
</style></head>
<body>
<div class="wrap">
  <div class="card">
    <div class="header">
      <div class="header-icon">🦉</div>
      <p class="header-title">Properly</p>
      <p class="header-sub">AI Phonics Tutor for Ages 4–7</p>
    </div>
    <div class="body">${bodyHtml}</div>
  </div>
  <div class="footer">
    © ${year} Deepak Ingwale · Properly v${APP_VERSION}<br>
    <a href="${process.env.APP_URL || 'http://localhost:5173'}/privacy">Privacy Policy</a> ·
    <a href="${process.env.APP_URL || 'http://localhost:5173'}/terms">Terms &amp; Conditions</a>
    <br><br>
    You received this email because you registered on Properly.<br>
    If this wasn't you, you can safely ignore this email.
  </div>
</div>
</body></html>`;
}

// ── SEND VERIFICATION EMAIL ───────────────────────────────────
export async function sendVerificationEmail({ email, childName, token }) {
  if (!emailAvailable()) {
    console.warn('⚠️  Email not configured — skipping verification email');
    console.warn('   Set SMTP_USER, SMTP_PASS, SMTP_PROVIDER in .env to enable emails');
    return { sent: false, reason: 'not-configured' };
  }

  const transport = createTransport();
  if (!transport) return { sent: false, reason: 'no-transport' };

  const baseUrl = process.env.APP_URL || 'http://localhost:5173';
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`;
  const fromName = process.env.SMTP_FROM_NAME || 'Properly Phonics';
  const fromEmail = process.env.SMTP_USER;

  const html = emailWrapper(`
    <h2>Welcome to the Phonics Forest! 🌳</h2>
    <p>Hi there! You've registered an account for <strong>${escapeHtml(childName)}</strong>. 
    We're so excited to have you join us.</p>
    <p>Please verify your email address to activate your account and start reading:</p>
    <a href="${verifyUrl}" class="btn">✅ Verify my email</a>
    <hr class="divider">
    <p style="font-size:13px;color:#78716C">Button not working? Copy and paste this link into your browser:</p>
    <div class="url-box">${verifyUrl}</div>
    <p style="font-size:13px;color:#78716C;margin-top:14px">This link expires in <strong>24 hours</strong>.</p>
  `);

  try {
    await transport.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: email,
      subject: `🦉 Welcome to Properly — please verify your email`,
      html,
      text: `Welcome to Properly!\n\nPlease verify your email by visiting:\n${verifyUrl}\n\nThis link expires in 24 hours.\n\n© ${year} Deepak Ingwale · Properly v${APP_VERSION}`,
    });
    console.log(`✅ Verification email sent to ${email}`);
    return { sent: true };
  } catch (err) {
    console.error('Email send error:', err.message);
    return { sent: false, reason: err.message };
  }
}

// ── SEND WELCOME EMAIL (after verification) ───────────────────
export async function sendWelcomeEmail({ email, childName }) {
  if (!emailAvailable()) return { sent: false };
  const transport = createTransport();
  if (!transport) return { sent: false };

  const baseUrl = process.env.APP_URL || 'http://localhost:5173';
  const fromName = process.env.SMTP_FROM_NAME || 'Properly Phonics';

  const html = emailWrapper(`
    <h2>You're all set! 🎉</h2>
    <p>Your email is verified and <strong>${escapeHtml(childName)}'s</strong> account is ready to go.</p>
    <p>Head into the Phonics Forest and start reading — every story earns Golden Acorns!</p>
    <a href="${baseUrl}" class="btn">🌳 Start reading now</a>
    <hr class="divider">
    <p style="font-size:13px;color:#78716C">
      <strong>Quick tips:</strong><br>
      🎙️ Tap the microphone and read the sentence aloud<br>
      🌰 Earn acorns for great reading<br>
      🏆 Unlock achievements as you progress<br>
      👨‍👩‍👧 Parents can track progress in the Parent Dashboard
    </p>
  `);

  try {
    await transport.sendMail({
      from: `"${fromName}" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `🌳 ${childName} is ready to read on Properly!`,
      html,
      text: `Your email is verified! Visit ${baseUrl} to start reading.\n\n© ${year} Deepak Ingwale · Properly v${APP_VERSION}`,
    });
    return { sent: true };
  } catch (err) {
    console.error('Welcome email error:', err.message);
    return { sent: false };
  }
}

// ── SEND RESEND VERIFICATION ──────────────────────────────────
export async function sendResendVerificationEmail({ email, childName, token }) {
  return sendVerificationEmail({ email, childName, token });
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
