/**
 * @file        email.service.js
 * @description Email delivery service — verification, welcome, and re-send emails via Resend → Brevo → SMTP fallback chain
 * @module      Email
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - emailAvailable() returns false when no provider is configured — callers skip verification gate
 *   - All sends are fire-and-forget; failures are logged but never thrown to callers
 */

const APP_VERSION = '2.0.0';

// ── AVAILABILITY CHECKS ───────────────────────────────────────
export function emailAvailable() {
  return Boolean(
    process.env.RESEND_API_KEY ||
    process.env.BREVO_API_KEY  ||
    (process.env.SMTP_USER && process.env.SMTP_PASS)
  );
}

function getActiveProvider() {
  if (process.env.RESEND_API_KEY) return 'resend';
  if (process.env.BREVO_API_KEY)  return 'brevo';
  if (process.env.SMTP_USER && process.env.SMTP_PASS) return 'smtp';
  return null;
}

// ── BRAND TEMPLATE ────────────────────────────────────────────
const year = new Date().getFullYear();

function emailWrapper(bodyHtml) {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Properly — AI Phonics Tutor</title>
<style>
  body{margin:0;padding:0;background:#F4F7F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1C1917}
  .wrap{max-width:520px;margin:32px auto;padding:0 16px}
  .card{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)}
  .header{background:#1B4332;padding:24px 32px;text-align:center}
  .header-icon{font-size:40px;margin-bottom:6px}
  .header-title{color:#fff;font-size:22px;font-weight:800;letter-spacing:0.5px;margin:0}
  .header-sub{color:rgba(255,255,255,0.55);font-size:13px;margin:4px 0 0}
  .body{padding:30px 28px}
  h2{font-size:20px;font-weight:800;color:#1C1917;margin:0 0 12px}
  p{font-size:15px;line-height:1.65;color:#44403C;margin:0 0 12px}
  .btn{display:block;width:fit-content;margin:22px auto;background:#2D6A4F;color:#fff!important;text-decoration:none;font-size:15px;font-weight:700;padding:13px 34px;border-radius:50px;text-align:center}
  .divider{border:none;border-top:1px solid #E7E5E4;margin:22px 0}
  .url-box{background:#F4F4F0;border-radius:8px;padding:12px 16px;font-size:12px;color:#78716C;word-break:break-all;font-family:monospace}
  .footer{text-align:center;padding:18px 16px 22px;font-size:12px;color:#A8A29E;line-height:1.7}
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
    © ${year} Deepak Ingwale & Mahima Verma · Properly v${APP_VERSION}<br>
    <a href="${appUrl}/privacy">Privacy Policy</a> ·
    <a href="${appUrl}/terms">Terms &amp; Conditions</a>
    <br><br>
    You received this because you registered on Properly.<br>
    If this wasn't you, you can safely ignore this email.
  </div>
</div>
</body></html>`;
}

// ── RESEND (HTTPS API — works on all platforms) ───────────────
async function sendViaResend({ to, subject, html, text }) {
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

  // Use configured from address, or Resend's free sandbox address
  const from = process.env.EMAIL_FROM
    || process.env.SMTP_FROM_NAME
      ? `${process.env.SMTP_FROM_NAME} <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`
      : 'Properly Phonics <onboarding@resend.dev>';

  const { data, error } = await resend.emails.send({ from, to, subject, html, text });
  if (error) throw new Error(`Resend error: ${error.message}`);
  return { id: data?.id };
}

// ── BREVO API (HTTPS — works on all platforms) ────────────────
async function sendViaBrevo({ to, subject, html, text }) {
  const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@properly.app';
  const fromName  = process.env.SMTP_FROM_NAME || 'Properly Phonics';

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender:   { name: fromName, email: fromEmail },
      to:       [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo API error ${res.status}: ${body}`);
  }
  const data = await res.json();
  return { id: data.messageId };
}

// ── NODEMAILER SMTP (fallback — may timeout on Render free) ───
async function sendViaSMTP({ to, subject, html, text }) {
  const nodemailer = (await import('nodemailer')).default;
  const provider   = (process.env.SMTP_PROVIDER || '').toLowerCase();

  let transportConfig;
  if (provider === 'gmail') {
    transportConfig = {
      service: 'gmail',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    };
  } else if (provider === 'outlook') {
    transportConfig = { host:'smtp-mail.outlook.com', port:587, secure:false, auth:{ user:process.env.SMTP_USER, pass:process.env.SMTP_PASS } };
  } else if (provider === 'brevo' || provider === 'sendinblue') {
    transportConfig = { host:'smtp-relay.brevo.com', port:587, secure:false, auth:{ user:process.env.SMTP_USER, pass:process.env.SMTP_PASS } };
  } else {
    transportConfig = {
      host:   process.env.SMTP_HOST || 'smtp.gmail.com',
      port:   parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 10_000,
      greetingTimeout:   8_000,
      socketTimeout:     10_000,
    };
  }

  const transport = nodemailer.createTransport(transportConfig);
  const fromName  = process.env.SMTP_FROM_NAME || 'Properly Phonics';
  const fromEmail = process.env.SMTP_USER;

  await transport.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to, subject, html, text,
  });
}

// ── CORE SEND DISPATCHER ──────────────────────────────────────
async function sendEmail({ to, subject, html, text }) {
  const provider = getActiveProvider();

  if (!provider) {
    console.warn('⚠️  No email provider configured — skipping email');
    console.warn('   Set RESEND_API_KEY (recommended), BREVO_API_KEY, or SMTP_USER+SMTP_PASS');
    return { sent: false, reason: 'not-configured' };
  }

  const label = `[email:${provider}] → ${to}`;
  try {
    if      (provider === 'resend') await sendViaResend({ to, subject, html, text });
    else if (provider === 'brevo')  await sendViaBrevo ({ to, subject, html, text });
    else                            await sendViaSMTP  ({ to, subject, html, text });
    console.log(`✅ ${label} — "${subject}"`);
    return { sent: true, provider };
  } catch (err) {
    const isTimeout = err.message?.toLowerCase().includes('timeout') || err.code === 'ETIMEDOUT';
    if (isTimeout) {
      console.error(`❌ ${label} — CONNECTION TIMEOUT`);
      console.error('   → SMTP ports are blocked on Render free tier');
      console.error('   → Fix: set RESEND_API_KEY or BREVO_API_KEY (both free & HTTPS-based)');
      console.error('   → Resend: resend.com → 3,000 free emails/month');
      console.error('   → Brevo:  brevo.com  → 300 free emails/day');
    } else {
      console.error(`❌ ${label} — ${err.message}`);
    }
    return { sent: false, reason: err.message, isTimeout };
  }
}

// ── PUBLIC EMAIL FUNCTIONS ────────────────────────────────────
export async function sendVerificationEmail({ email, childName, token }) {
  if (!emailAvailable()) return { sent: false, reason: 'not-configured' };

  const appUrl    = process.env.APP_URL || 'http://localhost:5173';
  const verifyUrl = `${appUrl}/verify-email?token=${token}`;

  const html = emailWrapper(`
    <h2>Welcome to the Phonics Forest! 🌳</h2>
    <p>Hi there! You've registered an account for <strong>${escapeHtml(childName)}</strong>.
    We're excited to have you join us.</p>
    <p>Please verify your email address to activate your account and start reading:</p>
    <a href="${verifyUrl}" class="btn">✅ Verify my email</a>
    <hr class="divider">
    <p style="font-size:13px;color:#78716C">Button not working? Copy and paste this link:</p>
    <div class="url-box">${verifyUrl}</div>
    <p style="font-size:13px;color:#78716C;margin-top:14px">This link expires in <strong>24 hours</strong>.</p>
  `);

  return sendEmail({
    to:      email,
    subject: '🦉 Welcome to Properly — please verify your email',
    html,
    text:    `Welcome to Properly!\n\nVerify your email:\n${verifyUrl}\n\nExpires in 24 hours.\n\n© ${year} Deepak Ingwale & Mahima Verma`,
  });
}

export async function sendWelcomeEmail({ email, childName }) {
  if (!emailAvailable()) return { sent: false };
  const appUrl = process.env.APP_URL || 'http://localhost:5173';

  const html = emailWrapper(`
    <h2>You're all set! 🎉</h2>
    <p>Your email is verified and <strong>${escapeHtml(childName)}'s</strong> account is ready to go.</p>
    <p>Head into the Phonics Forest and start reading — every story earns Golden Acorns!</p>
    <a href="${appUrl}" class="btn">🌳 Start reading now</a>
    <hr class="divider">
    <p style="font-size:13px;color:#78716C">
      <strong>Quick tips:</strong><br>
      🎙️ Tap the microphone and read the sentence aloud<br>
      🌰 Earn acorns for great reading<br>
      🏆 Unlock achievements as you progress<br>
      👨‍👩‍👧 Parents can track progress in the Parent Dashboard
    </p>
  `);

  return sendEmail({
    to:      email,
    subject: `🌳 ${childName} is ready to read on Properly!`,
    html,
    text:    `Your email is verified! Visit ${appUrl} to start reading.\n\n© ${year} Deepak Ingwale & Mahima Verma`,
  });
}

export async function sendResendVerificationEmail({ email, childName, token }) {
  return sendVerificationEmail({ email, childName, token });
}

function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
