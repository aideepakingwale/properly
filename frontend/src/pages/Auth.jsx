/**
 * @file        Auth.jsx
 * @description Login and registration page — email/password auth with email verification flow
 * @module      Pages
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - Registration collects email + password only — child profiles are added in SetupChild after first login
 *   - Unverified accounts see a re-send verification option
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI, socialAuth } from '../services/api';
import { Button, Input } from '../components/ui';
import Footer from '../components/Footer';

// ── CHECK EMAIL SCREEN ────────────────────────────────────────
function CheckEmailScreen({ email, onResend, onBack }) {
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [countdown, setCountdown] = useState(0);

  const handleResend = async () => {
    if (countdown > 0) return;
    setResending(true); setResendMsg('');
    try {
      const res = await authAPI.resendVerification(email);
      setResendMsg(res.data?.message || 'Email sent!');
      setCountdown(60);
      const t = setInterval(() => setCountdown(c => { if(c<=1){ clearInterval(t); return 0; } return c-1; }), 1000);
    } catch(e) {
      setResendMsg(e?.message || 'Failed to resend. Please try again.');
    } finally { setResending(false); }
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 72, marginBottom: 16 }}>📧</div>
      <h2 style={{ fontSize: 22, fontWeight: 900, color: '#1C1917', marginBottom: 8 }}>Check your inbox!</h2>
      <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, marginBottom: 6 }}>
        We sent a verification link to:
      </p>
      <p style={{ fontSize: 15, fontWeight: 700, color: '#1C1917', marginBottom: 20, wordBreak: 'break-all' }}>
        {email}
      </p>
      <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 14, padding: '14px 16px', marginBottom: 24, textAlign: 'left' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#166534', lineHeight: 1.6 }}>
          📨 Click the link in the email to activate your account.<br />
          📁 Check your <strong>spam folder</strong> if you don't see it.<br />
          ⏰ The link expires in <strong>24 hours</strong>.
        </p>
      </div>
      {resendMsg && (
        <p style={{ fontSize: 13, color: resendMsg.includes('sent') ? '#059669' : '#DC2626', marginBottom: 12, fontWeight: 600 }}>
          {resendMsg}
        </p>
      )}
      <button onClick={handleResend} disabled={resending || countdown > 0}
        style={{ display: 'block', width: '100%', padding: '11px', marginBottom: 10, background: 'white', border: '1.5px solid #D1D5DB', borderRadius: 50, fontSize: 14, color: '#374151', fontWeight: 600, cursor: countdown > 0 ? 'default' : 'pointer', fontFamily: 'var(--font-body)' }}>
        {resending ? 'Sending…' : countdown > 0 ? `Resend in ${countdown}s` : '↩ Resend verification email'}
      </button>
      <button onClick={onBack}
        style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
        ← Back to login
      </button>
    </div>
  );
}

// ── MAIN AUTH PAGE ────────────────────────────────────────────
export default function Auth() {
  const [mode, setMode]   = useState('login');
  const [f, setF]         = useState({ email: '', password: '' });
  const [err, setErr]     = useState('');
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(null);
  const [socialProviders, setSocialProviders] = useState({ google: false, facebook: false });

  // Load which social providers are configured
  useState(() => {
    authAPI.socialStatus().then(r => { if(r.success) setSocialProviders(r.data); }).catch(() => {});
  });
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const { login, register } = useAuth();
  const nav = useNavigate();

  const fi = (k, v) => setF(p => ({ ...p, [k]: v }));

  const handle = async () => {
    setErr(''); setUnverifiedEmail('');
    if (!f.email.includes('@')) { setErr('Please enter a valid email address'); return; }
    if (f.password.length < 4)  { setErr('Password must be at least 4 characters'); return; }
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(f.email, f.password);
        nav('/home', { replace: true });
      } else {
        const res = await register(f.email, f.password);
        if (res?.requiresVerification) {
          setCheckEmail(f.email);  // show check-email screen
        } else {
          nav('/home', { replace: true });  // email not configured, go straight in
        }
      }
    } catch (e) {
      const msg = e?.message || 'Something went wrong';
      if (e?.unverified) {
        setErr('');
        setUnverifiedEmail(e.email || f.email);
      } else {
        setErr(msg);
      }
    } finally { setLoading(false); }
  };

  // ── CHECK EMAIL SCREEN ──
  if (checkEmail) {
    return (
      <div style={{ minHeight:'100vh', background:'#F9FAFB', display:'flex', flexDirection:'column' }}>
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 20px' }}>
          <div style={{ maxWidth:420, width:'100%', background:'white', borderRadius:20, padding:'40px 32px', boxShadow:'0 4px 24px rgba(0,0,0,0.08)' }}>
            <CheckEmailScreen
              email={checkEmail}
              onBack={() => { setCheckEmail(null); setMode('login'); }}
            />
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div style={{ minHeight:'100vh', background:'#F9FAFB', display:'flex', flexDirection:'column' }}>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 20px' }}>
        <div style={{ maxWidth:420, width:'100%' }}>

          {/* Brand */}
          <div style={{ textAlign:'center', marginBottom:28 }}>
            <div style={{ fontSize:52, marginBottom:8 }}>🦉</div>
            <h1 style={{ fontSize:26, fontWeight:900, color:'#1C1917', margin:'0 0 4px' }}>Properly</h1>
            <p style={{ fontSize:13, color:'#9CA3AF', margin:0 }}>AI Phonics Tutor · Ages 4–7</p>
          </div>

          <div style={{ background:'white', borderRadius:20, padding:'32px 28px', boxShadow:'0 4px 24px rgba(0,0,0,0.08)' }}>

            {/* Tab */}
            <div style={{ display:'flex', background:'#F3F4F6', borderRadius:12, padding:4, marginBottom:24, gap:4 }}>
              {['login','register'].map(m => (
                <button key={m} onClick={() => { setMode(m); setErr(''); setUnverifiedEmail(''); }}
                  style={{ flex:1, padding:'9px', borderRadius:9, border:'none', background: mode===m ? 'white' : 'transparent', fontWeight: mode===m ? 800 : 600, fontSize:13, cursor:'pointer', color: mode===m ? '#1C1917' : '#6B7280', fontFamily:'var(--font-body)', boxShadow: mode===m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                  {m === 'login' ? 'Log in' : 'Create account'}
                </button>
              ))}
            </div>

            {/* Unverified email warning */}
            {unverifiedEmail && (
              <div style={{ background:'#FEF3C7', border:'1.5px solid #FCD34D', borderRadius:12, padding:'12px 14px', marginBottom:16 }}>
                <p style={{ margin:'0 0 8px', fontSize:13, color:'#92400E', fontWeight:600 }}>
                  ⚠️ Email not verified yet
                </p>
                <p style={{ margin:'0 0 10px', fontSize:12, color:'#92400E' }}>
                  Please check your inbox for the verification link.
                </p>
                <button onClick={() => setCheckEmail(unverifiedEmail)} style={{ background:'#92400E', color:'white', border:'none', borderRadius:50, padding:'6px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }}>
                  Resend verification email →
                </button>
              </div>
            )}

            {/* Fields */}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:5 }}>Email address</label>
                <Input value={f.email} onChange={e => fi('email', e.target.value)} type="email" placeholder="parent@example.com" />
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:700, color:'#374151', display:'block', marginBottom:5 }}>Password</label>
                <Input value={f.password} onChange={e => fi('password', e.target.value)} type="password" placeholder={mode === 'register' ? 'At least 6 characters' : 'Your password'} onKeyDown={e => e.key==='Enter' && handle()} />
              </div>
              {mode === 'register' && (
                <div style={{ background:'#F0FDF4', border:'1.5px solid #BBF7D0', borderRadius:12, padding:'10px 14px' }}>
                  <p style={{ margin:0, fontSize:12, color:'#065F46', lineHeight:1.55 }}>
                    🌳 After creating your account you'll add your child's profile — name, age, and phonics level — so stories are perfectly personalised for them.
                  </p>
                </div>
              )}
            </div>

            {err && (
              <p style={{ fontSize:13, color:'#DC2626', fontWeight:600, marginTop:12, marginBottom:0, textAlign:'center' }}>{err}</p>
            )}

            <Button variant="primary" size="lg" onClick={handle} disabled={loading}
              style={{ width:'100%', marginTop:20 }}>
              {loading ? '…' : mode === 'login' ? 'Log in' : 'Create account'}
            </Button>

            {/* Social login divider */}
            {(socialProviders.google || socialProviders.facebook) && (
              <div style={{ margin:'16px 0' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ flex:1, height:1, background:'#E5E7EB' }}/>
                  <span style={{ fontSize:11, color:'#9CA3AF', fontWeight:600 }}>or continue with</span>
                  <div style={{ flex:1, height:1, background:'#E5E7EB' }}/>
                </div>
                <div style={{ display:'flex', gap:8, marginTop:12, flexDirection: socialProviders.google && socialProviders.facebook ? 'row' : 'column' }}>
                  {socialProviders.google && (
                    <button onClick={() => socialAuth.redirectToGoogle()}
                      style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 14px', border:'1.5px solid #E5E7EB', borderRadius:50, background:'white', cursor:'pointer', fontSize:13, fontWeight:600, color:'#374151', fontFamily:'var(--font-body)', transition:'all 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor='#D1D5DB'}
                      onMouseLeave={e => e.currentTarget.style.borderColor='#E5E7EB'}>
                      <svg width="18" height="18" viewBox="0 0 18 18">
                        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                        <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
                        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
                      </svg>
                      Sign in with Google
                    </button>
                  )}
                  {socialProviders.facebook && (
                    <button onClick={() => socialAuth.redirectToFacebook()}
                      style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'10px 14px', border:'1.5px solid #E5E7EB', borderRadius:50, background:'white', cursor:'pointer', fontSize:13, fontWeight:600, color:'#374151', fontFamily:'var(--font-body)', transition:'all 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor='#D1D5DB'}
                      onMouseLeave={e => e.currentTarget.style.borderColor='#E5E7EB'}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                      Sign in with Facebook
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Legal consent on register */}
            {mode === 'register' && (
              <p style={{ fontSize:11, color:'#9CA3AF', textAlign:'center', marginTop:12, lineHeight:1.5 }}>
                By creating an account you agree to our{' '}
                <button onClick={() => nav('/terms')} style={{ background:'none', border:'none', color:'#6B7280', fontSize:11, cursor:'pointer', padding:0, textDecoration:'underline', fontFamily:'var(--font-body)' }}>Terms</button>
                {' '}and{' '}
                <button onClick={() => nav('/privacy')} style={{ background:'none', border:'none', color:'#6B7280', fontSize:11, cursor:'pointer', padding:0, textDecoration:'underline', fontFamily:'var(--font-body)' }}>Privacy Policy</button>.
              </p>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
