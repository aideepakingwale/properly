import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PlanCard, PlansSection } from '../components/PlanCard';
import Footer from '../components/Footer';

const API_BASE = (typeof __API_URL__ !== 'undefined' ? __API_URL__ : null)
  || import.meta.env.VITE_API_URL || '/api';

export default function Pricing() {
  const [sub, setSub]             = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const { user }                  = useAuth();
  const nav                       = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('properly_token');
    if (!token) { setPageLoading(false); return; }
    fetch(`${API_BASE}/subscription`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setSub(d.data); })
      .catch(() => {})
      .finally(() => setPageLoading(false));
  }, [user]);

  const currentPlan = sub?.plan || 'free';

  const handleManageBilling = async () => {
    const token = localStorage.getItem('properly_token');
    const res = await fetch(`${API_BASE}/subscription/portal`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json());
    if (res.data?.portalUrl) window.location.href = res.data.portalUrl;
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F9FAFB', fontFamily: 'var(--font-body)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: 'white', borderBottom: '1px solid #E5E7EB', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => nav(-1)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6B7280', padding: 0 }}>←</button>
        <span style={{ fontSize: 16 }}>🦉</span>
        <span style={{ fontWeight: 900, fontSize: 16, color: '#1C1917' }}>Choose a plan</span>
        {sub && sub.plan !== 'free' && (
          <button onClick={handleManageBilling} style={{ marginLeft: 'auto', background: 'none', border: '1.5px solid #E5E7EB', borderRadius: 50, padding: '5px 14px', fontSize: 12, cursor: 'pointer', color: '#6B7280', fontFamily: 'var(--font-body)', fontWeight: 600 }}>
            Manage billing →
          </button>
        )}
      </header>

      <main style={{ flex: 1, maxWidth: 960, margin: '0 auto', padding: '36px 20px 0', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#1C1917', margin: '0 0 10px' }}>
            Choose the right plan 🌳
          </h1>
          <p style={{ fontSize: 15, color: '#6B7280', maxWidth: 480, margin: '0 auto' }}>
            Start free. Upgrade anytime. Cancel anytime. All paid plans include a 7-day free trial.
          </p>
        </div>

        {pageLoading
          ? <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>Loading plans…</div>
          : <PlansSection currentPlan={currentPlan} showCTA={true} dark={false} />
        }

        {/* Current plan status banner */}
        {sub && sub.plan !== 'free' && (
          <div style={{ marginTop: 24, background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>✅</span>
            <div>
              <p style={{ margin: 0, fontWeight: 800, color: '#065F46', fontSize: 14 }}>
                You're on the {sub.planName} {sub.planEmoji} plan
              </p>
              {sub.currentPeriodEnd && (
                <p style={{ margin: 0, fontSize: 12, color: '#059669' }}>
                  {sub.cancelAtPeriodEnd
                    ? `Cancels on ${new Date(sub.currentPeriodEnd).toLocaleDateString('en-GB')}`
                    : `Renews on ${new Date(sub.currentPeriodEnd).toLocaleDateString('en-GB')}`}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Trust badges */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, margin: '28px 0', flexWrap: 'wrap' }}>
          {['🔒 Secure Stripe payments', '↩ Cancel any time', '📧 Email support', '🇬🇧 UK pricing'].map(b => (
            <span key={b} style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600 }}>{b}</span>
          ))}
        </div>

        {/* FAQ */}
        <div style={{ maxWidth: 560, margin: '0 auto', paddingBottom: 48 }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: '#1C1917', marginBottom: 20, textAlign: 'center' }}>Common questions</h2>
          {[
            { q: 'Can I cancel any time?',             a: 'Yes — cancel from your billing dashboard with one click. You keep access until the end of your paid period.' },
            { q: 'What is the 7-day trial?',           a: "You won't be charged for 7 days. If you cancel within that window, you pay nothing." },
            { q: 'Do I need a credit card to start?',  a: 'No. The free Seedling plan requires no payment details at all.' },
            { q: 'Can I switch between Sprout and Forest?', a: 'Yes — upgrade or downgrade instantly via the billing portal. Charges are prorated.' },
            { q: "Is my child's data safe?",           a: 'Always. We never store audio recordings. All data is encrypted. See our Privacy Policy.' },
          ].map(({ q, a }) => (
            <div key={q} style={{ borderBottom: '1px solid #E5E7EB', padding: '14px 0' }}>
              <p style={{ fontWeight: 700, color: '#1C1917', margin: '0 0 4px', fontSize: 14 }}>{q}</p>
              <p style={{ color: '#6B7280', margin: 0, fontSize: 13, lineHeight: 1.6 }}>{a}</p>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
