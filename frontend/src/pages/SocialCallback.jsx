/**
 * SocialCallback — receives token from backend after OAuth success
 * URL: /social-callback?token=...&provider=google|facebook&isNew=0|1
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';

export default function SocialCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus]   = useState('processing');
  const [message, setMessage] = useState('');
  const { loginDirect }       = useAuth();
  const nav                   = useNavigate();

  useEffect(() => {
    const token    = searchParams.get('token');
    const provider = searchParams.get('provider');
    const isNew    = searchParams.get('isNew') === '1';

    if (!token) {
      setStatus('error');
      setMessage('No authentication token received. Please try again.');
      return;
    }

    (async () => {
      try {
        // Store token then fetch full user profile
        localStorage.setItem('properly_token', token);
        const res = await authAPI.me();
        if (res.success) {
          const child = res.data.children?.[0];
          await loginDirect(token, res.data.user, child);
          setStatus('success');
          // If new user with no child configured, go to home (they can update in ParentDash)
          setTimeout(() => nav('/home', { replace: true }), 1200);
        } else {
          throw new Error('Could not load account');
        }
      } catch (err) {
        localStorage.removeItem('properly_token');
        setStatus('error');
        setMessage(err?.message || 'Authentication failed. Please try again.');
      }
    })();
  }, []);

  const providerLabel = searchParams.get('provider') === 'facebook' ? 'Facebook' : 'Google';
  const providerIcon  = searchParams.get('provider') === 'facebook' ? '🟦' : '🔴';

  return (
    <div style={{ minHeight:'100vh', background:'#F9FAFB', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-body)' }}>
      <div style={{ textAlign:'center', maxWidth:340, padding:'0 20px' }}>

        {status === 'processing' && (
          <>
            <div style={{ fontSize:72, marginBottom:16, animation:'spin 1.5s linear infinite', display:'inline-block' }}>🦉</div>
            <h2 style={{ fontSize:20, fontWeight:900, color:'#1C1917', marginBottom:8 }}>
              Signing you in with {providerLabel}…
            </h2>
            <p style={{ color:'#6B7280', fontSize:14 }}>Just a moment</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize:72, marginBottom:16 }}>✅</div>
            <h2 style={{ fontSize:20, fontWeight:900, color:'#059669', marginBottom:8 }}>Signed in!</h2>
            <p style={{ color:'#6B7280', fontSize:14 }}>Taking you to the Phonics Forest…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize:72, marginBottom:16 }}>❌</div>
            <h2 style={{ fontSize:20, fontWeight:900, color:'#DC2626', marginBottom:8 }}>Sign-in failed</h2>
            <p style={{ color:'#6B7280', fontSize:14, marginBottom:20 }}>{message}</p>
            <button onClick={() => nav('/auth')} style={{ background:'#2D6A4F', color:'white', border:'none', borderRadius:50, padding:'12px 28px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }}>
              ← Back to login
            </button>
          </>
        )}

        <style>{`
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}
