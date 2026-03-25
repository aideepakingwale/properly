/**
 * @file        SubscriptionSuccess.jsx
 * @description Post-Stripe-checkout success page — confirms plan upgrade and refreshes session
 * @module      Pages
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 */

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Footer from '../components/Footer';

const API_BASE = (typeof __API_URL__ !== 'undefined' ? __API_URL__ : null)
  || import.meta.env.VITE_API_URL || '/api';

export default function SubscriptionSuccess() {
  const [params] = useSearchParams();
  const [status, setStatus]   = useState('verifying');
  const [planName, setPlanName] = useState('');
  const nav = useNavigate();
  const sessionId = params.get('session_id');

  useEffect(() => {
    if (!sessionId) { setStatus('error'); return; }
    fetch(`${API_BASE}/subscription/verify?session_id=${sessionId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('properly_token')}` }
    })
    .then(r => r.json())
    .then(d => {
      if (d.success) {
        setPlanName(d.data.plan === 'forest' ? 'Forest 🌳' : 'Sprout 🌿');
        setStatus('success');
        setTimeout(() => nav('/home'), 4000);
      } else { setStatus('error'); }
    })
    .catch(() => setStatus('error'));
  }, [sessionId]);

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-primary-light)', display:'flex', flexDirection:'column', fontFamily:'var(--font-body)' }}>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'40px 20px' }}>
        <div style={{ textAlign:'center', maxWidth:400 }}>
          {status === 'verifying' && (
            <>
              <div style={{ fontSize:72, marginBottom:16 }}>🔄</div>
              <h2 style={{ fontSize:22, fontWeight:900, color:'var(--text)' }}>Confirming your subscription…</h2>
            </>
          )}
          {status === 'success' && (
            <>
              <div style={{ fontSize:72, marginBottom:16 }}>🎉</div>
              <h2 style={{ fontSize:24, fontWeight:900, color:'var(--text-success)', marginBottom:10 }}>Welcome to {planName}!</h2>
              <p style={{ color:'var(--text-muted)', fontSize:15, lineHeight:1.6, marginBottom:20 }}>
                Your subscription is now active. All premium features have been unlocked for your child's reading journey!
              </p>
              <div style={{ background:'white', borderRadius:16, padding:'16px 20px', marginBottom:24, border:'1.5px solid var(--border-primary-light)' }}>
                <p style={{ margin:'0 0 8px', fontSize:14, fontWeight:700, color:'var(--text-success-dark)' }}>Now available:</p>
                {['☁️ Azure phoneme-level pronunciation scoring',
                  '🦉 Natural Mrs. Owl UK voice',
                  '📚 All 14 curriculum stories',
                  '✨ More AI personalised stories'
                ].map(f => <p key={f} style={{ margin:'4px 0', fontSize:13, color:'var(--text-success-dark)' }}>{f}</p>)}
              </div>
              <p style={{ fontSize:13, color:'var(--text-light)' }}>Taking you to the Phonics Forest in a moment…</p>
              <button onClick={() => nav('/home')} style={{ marginTop:12, background:'var(--color-primary)', color:'white', border:'none', borderRadius:50, padding:'12px 28px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }}>
                🌳 Go to the Forest now
              </button>
            </>
          )}
          {status === 'error' && (
            <>
              <div style={{ fontSize:72, marginBottom:16 }}>⚠️</div>
              <h2 style={{ fontSize:22, fontWeight:900, color:'var(--text)', marginBottom:10 }}>Something went wrong</h2>
              <p style={{ color:'var(--text-muted)', fontSize:14, marginBottom:20 }}>We couldn't verify your subscription. If you were charged, please contact support@properly.app</p>
              <button onClick={() => nav('/pricing')} style={{ background:'var(--color-primary)', color:'white', border:'none', borderRadius:50, padding:'12px 28px', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }}>
                Back to pricing
              </button>
            </>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
