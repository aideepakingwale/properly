/**
 * @file        VerifyEmail.jsx
 * @description Email verification page — handles verify token from email link and logs user in
 * @module      Pages
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Footer from '../components/Footer';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying'); // verifying | success | error | expired
  const [message, setMessage] = useState('');
  const { loginDirect } = useAuth();
  const nav = useNavigate();
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('No verification token found in this link.'); return; }
    (async () => {
      try {
        const res = await authAPI.verifyEmail(token);
        if (res.success) {
          // Auto-login the user after verification
          if (res.data?.token) {
            loginDirect(res.data.token, res.data.user, res.data.children?.[0]);
          }
          setStatus('success');
          setMessage(res.data?.message || 'Email verified!');
          setTimeout(() => nav('/home', { replace: true }), 2500);
        }
      } catch (err) {
        const e = err?.message || '';
        if (err?.expired) { setStatus('expired'); setMessage(e); }
        else { setStatus('error'); setMessage(e || 'This verification link is invalid or has already been used.'); }
      }
    })();
  }, [token]);

  const icons = { verifying: '🔄', success: '✅', error: '❌', expired: '⏰' };
  const titles = {
    verifying: 'Verifying your email…',
    success:   'Email verified!',
    error:     'Verification failed',
    expired:   'Link expired',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        <div style={{ maxWidth: 400, width: '100%', background: 'white', borderRadius: 20, padding: '40px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center' }}>

          <div style={{ fontSize: 64, marginBottom: 16 }}>{icons[status]}</div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: '#1C1917', marginBottom: 10 }}>
            {titles[status]}
          </h1>

          {status === 'verifying' && (
            <p style={{ color: '#6B7280', fontSize: 15 }}>Please wait while we verify your email address…</p>
          )}

          {status === 'success' && (
            <>
              <p style={{ color: '#059669', fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{message}</p>
              <p style={{ color: '#6B7280', fontSize: 13 }}>Taking you to the Phonics Forest now 🌳</p>
            </>
          )}

          {(status === 'error' || status === 'expired') && (
            <>
              <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>{message}</p>
              <button onClick={() => nav('/auth')} style={{
                background: '#2D6A4F', color: 'white', border: 'none', borderRadius: 50,
                padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'var(--font-body)', width: '100%', marginBottom: 12,
              }}>
                Back to login / register
              </button>
              {status === 'expired' && (
                <p style={{ fontSize: 12, color: '#9CA3AF' }}>
                  You can request a new verification email from the login page.
                </p>
              )}
            </>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
