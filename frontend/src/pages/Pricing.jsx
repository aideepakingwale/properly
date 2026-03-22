import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import Footer from '../components/Footer';

const API_BASE = (typeof __API_URL__ !== 'undefined' ? __API_URL__ : null)
  || import.meta.env.VITE_API_URL || '/api';

const PLAN_COLORS = { free:'#059669', sprout:'#2D6A4F', forest:'#1B4332' };

function PlanCard({ plan, currentPlan, onUpgrade, loading }) {
  const isCurrent  = plan.id === currentPlan;
  const isDowngrade= currentPlan !== 'free' && plan.id === 'free';
  const color      = PLAN_COLORS[plan.id] || '#2D6A4F';

  return (
    <div style={{
      background: 'white',
      borderRadius: 24,
      border: plan.recommended
        ? `2.5px solid ${color}`
        : '1.5px solid #E5E7EB',
      overflow: 'hidden',
      position: 'relative',
      boxShadow: plan.recommended ? `0 8px 32px ${color}25` : 'none',
    }}>
      {plan.recommended && (
        <div style={{ background: color, textAlign:'center', padding:'6px 0', fontSize:11, fontWeight:800, color:'white', letterSpacing:'0.5px' }}>
          ⭐ MOST POPULAR
        </div>
      )}

      <div style={{ padding:'24px 22px' }}>
        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
          <span style={{ fontSize:28 }}>{plan.emoji}</span>
          <div>
            <h3 style={{ margin:0, fontSize:20, fontWeight:900, color:'#1C1917' }}>{plan.name}</h3>
            <p style={{ margin:0, fontSize:11, color:'#9CA3AF' }}>{plan.tagline}</p>
          </div>
        </div>

        {/* Price */}
        <div style={{ margin:'16px 0', display:'flex', alignItems:'baseline', gap:4 }}>
          {plan.price === 0 ? (
            <span style={{ fontSize:32, fontWeight:900, color:'#1C1917' }}>Free</span>
          ) : (
            <>
              <span style={{ fontSize:14, fontWeight:700, color:'#6B7280' }}>£</span>
              <span style={{ fontSize:32, fontWeight:900, color:'#1C1917' }}>{plan.price.toFixed(2)}</span>
              <span style={{ fontSize:13, color:'#9CA3AF' }}>/month</span>
            </>
          )}
        </div>
        {plan.price > 0 && (
          <p style={{ fontSize:11, color:'#10B981', fontWeight:700, margin:'-12px 0 12px', display:'flex', alignItems:'center', gap:4 }}>
            🎁 7-day free trial included
          </p>
        )}

        {/* CTA button */}
        <button
          onClick={() => !isCurrent && !isDowngrade && onUpgrade(plan.id)}
          disabled={isCurrent || isDowngrade || loading === plan.id}
          style={{
            width: '100%', padding: '12px', borderRadius: 50,
            border: 'none',
            background: isCurrent
              ? `${color}18`
              : `linear-gradient(135deg, ${color}, ${color}CC)`,
            color: isCurrent ? color : 'white',
            fontWeight: 800, fontSize: 14, cursor: (isCurrent || isDowngrade) ? 'default' : 'pointer',
            fontFamily: 'var(--font-body)', marginBottom: 18,
            opacity: isDowngrade ? 0.4 : 1,
          }}>
          {loading === plan.id ? '⏳ Loading…'
            : isCurrent      ? '✓ Current plan'
            : isDowngrade    ? 'Manage subscription'
            : plan.id === 'free' ? 'Get started free'
            : `Upgrade to ${plan.name}`}
        </button>

        {/* Feature list */}
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {(plan.features || []).map(f => (
            <div key={f} style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:13 }}>
              <span style={{ color:color, flexShrink:0, marginTop:1, fontSize:14 }}>✓</span>
              <span style={{ color:'#374151' }}>{f}</span>
            </div>
          ))}
          {(plan.notIncluded || []).map(f => (
            <div key={f} style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:13 }}>
              <span style={{ color:'#D1D5DB', flexShrink:0, marginTop:1, fontSize:14 }}>✗</span>
              <span style={{ color:'#9CA3AF' }}>{f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Pricing() {
  const [plans, setPlans]           = useState([]);
  const [sub, setSub]               = useState(null);
  const [loading, setLoading]       = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [stripeReady, setStripeReady] = useState(false);
  const { user }                    = useAuth();
  const nav                         = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const [plansRes, subRes] = await Promise.allSettled([
          fetch(`${API_BASE}/plans`).then(r => r.json()),
          user ? fetch(`${API_BASE}/subscription`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('properly_token')}` }
          }).then(r => r.json()) : Promise.resolve(null),
        ]);
        if (plansRes.status === 'fulfilled' && plansRes.value.success) {
          setPlans(plansRes.value.data.plans);
          setStripeReady(plansRes.value.data.stripeAvailable);
        }
        if (subRes.status === 'fulfilled' && subRes.value?.success) {
          setSub(subRes.value.data);
        }
      } catch {}
      finally { setPageLoading(false); }
    })();
  }, [user]);

  const handleUpgrade = async (planId) => {
    if (!user) { nav('/auth'); return; }
    if (planId === 'free') return;
    if (!stripeReady) {
      alert('Payment processing is not yet configured. Please contact support@properly.app');
      return;
    }
    setLoading(planId);
    try {
      const res = await fetch(`${API_BASE}/subscription/checkout`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${localStorage.getItem('properly_token')}` },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (data.success && data.data.checkoutUrl) {
        window.location.href = data.data.checkoutUrl;
      } else {
        alert(data.message || 'Something went wrong');
      }
    } catch { alert('Network error. Please try again.'); }
    finally { setLoading(null); }
  };

  const currentPlan = sub?.plan || 'free';

  return (
    <div style={{ minHeight:'100vh', background:'#F9FAFB', fontFamily:'var(--font-body)', display:'flex', flexDirection:'column' }}>
      <header style={{ background:'white', borderBottom:'1px solid #E5E7EB', padding:'14px 24px', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={() => nav(-1)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#6B7280', padding:0 }}>←</button>
        <span style={{ fontSize:16 }}>🦉</span>
        <span style={{ fontWeight:900, fontSize:16, color:'#1C1917' }}>Choose a plan</span>
        {sub && sub.plan !== 'free' && (
          <button onClick={async () => {
            const res = await fetch(`${API_BASE}/subscription/portal`, {
              method:'POST', headers:{ Authorization:`Bearer ${localStorage.getItem('properly_token')}` }
            }).then(r=>r.json());
            if (res.data?.portalUrl) window.location.href = res.data.portalUrl;
          }} style={{ marginLeft:'auto', background:'none', border:'1.5px solid #E5E7EB', borderRadius:50, padding:'5px 14px', fontSize:12, cursor:'pointer', color:'#6B7280', fontFamily:'var(--font-body)', fontWeight:600 }}>
            Manage billing →
          </button>
        )}
      </header>

      <main style={{ flex:1, maxWidth:960, margin:'0 auto', padding:'36px 20px', width:'100%' }}>
        <div style={{ textAlign:'center', marginBottom:36 }}>
          <h1 style={{ fontSize:28, fontWeight:900, color:'#1C1917', margin:'0 0 10px' }}>
            Help {sub ? 'your child' : 'your little reader'} thrive 🌳
          </h1>
          <p style={{ fontSize:15, color:'#6B7280', maxWidth:480, margin:'0 auto' }}>
            Start free. Upgrade anytime. Cancel anytime. All plans include a 7-day free trial.
          </p>
          {!stripeReady && (
            <div style={{ marginTop:12, display:'inline-block', background:'#FEF3C7', border:'1.5px solid #FDE68A', borderRadius:50, padding:'5px 16px', fontSize:12, color:'#92400E', fontWeight:600 }}>
              ⚠️ Payment processing coming soon — join the free plan today
            </div>
          )}
        </div>

        {pageLoading ? (
          <div style={{ textAlign:'center', padding:60, color:'#9CA3AF' }}>Loading plans…</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:20 }}>
            {plans.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                currentPlan={currentPlan}
                onUpgrade={handleUpgrade}
                loading={loading}
              />
            ))}
          </div>
        )}

        {/* Trust badges */}
        <div style={{ display:'flex', justifyContent:'center', gap:20, marginTop:36, flexWrap:'wrap' }}>
          {['🔒 Secure Stripe payments','↩ Cancel any time','📧 Email support','🇬🇧 UK-based team'].map(b => (
            <span key={b} style={{ fontSize:12, color:'#9CA3AF', fontWeight:600 }}>{b}</span>
          ))}
        </div>

        {/* FAQ */}
        <div style={{ marginTop:48, maxWidth:560, margin:'48px auto 0' }}>
          <h2 style={{ fontSize:18, fontWeight:900, color:'#1C1917', marginBottom:20, textAlign:'center' }}>Common questions</h2>
          {[
            { q:'Can I cancel any time?', a:'Yes — cancel from your billing dashboard with one click. You keep access until the end of your paid period.' },
            { q:'What is the 7-day trial?', a:'You won\'t be charged for 7 days. If you cancel within that window, you pay nothing.' },
            { q:'Do I need a credit card to start?', a:'No. The free Seedling plan requires no payment details at all.' },
            { q:'Can I switch between Sprout and Forest?', a:'Yes — upgrade or downgrade instantly via the billing portal. Charges are prorated.' },
            { q:'Is my child\'s data safe?', a:'Always. We never store audio recordings. All data is encrypted. See our Privacy Policy.' },
          ].map(({q,a}) => (
            <div key={q} style={{ borderBottom:'1px solid #E5E7EB', padding:'14px 0' }}>
              <p style={{ fontWeight:700, color:'#1C1917', margin:'0 0 4px', fontSize:14 }}>{q}</p>
              <p style={{ color:'#6B7280', margin:0, fontSize:13, lineHeight:1.6 }}>{a}</p>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
