/**
 * PlanCard + PlansSection — reusable subscription plan components
 * Used on: Landing page, Pricing page, Home upgrade prompt
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const PLAN_COLORS = { free: '#059669', sprout: '#2D6A4F', forest: '#1B4332' };

const API_BASE = (typeof __API_URL__ !== 'undefined' ? __API_URL__ : null)
  || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
  || '/api';

// ── SINGLE PLAN CARD ─────────────────────────────────────────
export function PlanCard({ plan, currentPlan = null, onUpgrade, loading, dark = false }) {
  const isCurrent   = currentPlan && plan.id === currentPlan;
  const isDowngrade = currentPlan && currentPlan !== 'free' && plan.id === 'free';
  const color       = PLAN_COLORS[plan.id] || '#2D6A4F';

  const cardBg      = dark ? 'rgba(255,255,255,0.07)' : 'white';
  const cardBorder  = plan.recommended
    ? `2.5px solid ${color}`
    : dark ? '1.5px solid rgba(255,255,255,0.12)' : '1.5px solid #E5E7EB';
  const textPrimary   = dark ? 'white'                  : '#1C1917';
  const textMuted     = dark ? 'rgba(255,255,255,0.3)'  : '#9CA3AF';
  const checkColor    = dark ? 'rgba(82,183,136,0.9)'   : color;
  const crossColor    = dark ? 'rgba(255,255,255,0.2)'  : '#D1D5DB';

  return (
    <div style={{ background: cardBg, backdropFilter: dark ? 'blur(10px)' : 'none', borderRadius: 24, border: cardBorder, overflow: 'hidden', position: 'relative', boxShadow: plan.recommended ? `0 8px 32px ${color}${dark?'40':'25'}` : 'none', transition: 'transform 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}>

      {plan.recommended && (
        <div style={{ background: color, textAlign: 'center', padding: '6px 0', fontSize: 11, fontWeight: 800, color: 'white', letterSpacing: '0.5px' }}>
          ⭐ MOST POPULAR
        </div>
      )}

      <div style={{ padding: '22px 20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 28 }}>{plan.emoji}</span>
          <div>
            <h3 style={{ margin: 0, fontSize: 19, fontWeight: 900, color: textPrimary }}>{plan.name}</h3>
            <p style={{ margin: 0, fontSize: 11, color: textMuted }}>{plan.tagline}</p>
          </div>
        </div>

        {/* Price */}
        <div style={{ margin: '14px 0 4px', display: 'flex', alignItems: 'baseline', gap: 3 }}>
          {plan.price === 0
            ? <span style={{ fontSize: 30, fontWeight: 900, color: textPrimary }}>Free</span>
            : <>
                <span style={{ fontSize: 13, fontWeight: 700, color: dark ? 'rgba(255,255,255,0.5)' : '#6B7280' }}>£</span>
                <span style={{ fontSize: 30, fontWeight: 900, color: textPrimary }}>{plan.price.toFixed(2)}</span>
                <span style={{ fontSize: 12, color: textMuted }}>/mo</span>
              </>
          }
        </div>
        {plan.price > 0 && (
          <p style={{ fontSize: 11, color: '#10B981', fontWeight: 700, margin: '0 0 14px' }}>🎁 7-day free trial</p>
        )}
        {plan.price === 0 && <div style={{ height: 18 }} />}

        {/* CTA button */}
        {onUpgrade && (
          <button
            onClick={() => !isCurrent && !isDowngrade && onUpgrade(plan.id)}
            disabled={isCurrent || isDowngrade || loading === plan.id}
            style={{ width: '100%', padding: '11px', borderRadius: 50, border: 'none', background: isCurrent ? `${color}20` : `linear-gradient(135deg,${color},${color}BB)`, color: isCurrent ? color : 'white', fontWeight: 800, fontSize: 13, cursor: (isCurrent || isDowngrade) ? 'default' : 'pointer', fontFamily: 'var(--font-body)', marginBottom: 16, opacity: isDowngrade ? 0.4 : 1 }}>
            {loading === plan.id ? '⏳ Loading…'
              : isCurrent    ? '✓ Current plan'
              : isDowngrade  ? '—'
              : plan.id === 'free' ? 'Get started free'
              : `Upgrade to ${plan.name}`}
          </button>
        )}

        {/* Divider */}
        <div style={{ borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : '#F3F4F6'}`, marginBottom: 14 }} />

        {/* Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {(plan.features || []).map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5 }}>
              <span style={{ color: checkColor, flexShrink: 0, marginTop: 1, fontWeight: 700 }}>✓</span>
              <span style={{ color: dark ? 'rgba(255,255,255,0.75)' : '#374151', lineHeight: 1.45 }}>{f}</span>
            </div>
          ))}
          {(plan.notIncluded || []).map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12.5 }}>
              <span style={{ color: crossColor, flexShrink: 0, marginTop: 1 }}>✗</span>
              <span style={{ color: dark ? 'rgba(255,255,255,0.25)' : '#C4B5A0', lineHeight: 1.45 }}>{f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── PLANS SECTION — embed anywhere ──────────────────────────
export function PlansSection({ dark = false, currentPlan = null, showCTA = true }) {
  const [plans, setPlans]         = useState([]);
  const [loading, setLoading]     = useState(null);
  const [fetching, setFetching]   = useState(true);
  const [stripeReady, setStripeReady] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    fetch(`${API_BASE}/plans`)
      .then(r => r.json())
      .then(d => { if (d.success) { setPlans(d.data.plans); setStripeReady(d.data.stripeAvailable); } })
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  const handleUpgrade = async (planId) => {
    const token = localStorage.getItem('properly_token');
    if (!token) { nav('/auth'); return; }
    if (planId === 'free') return;
    if (!stripeReady) { alert('Payment processing coming soon. Join the free plan today!'); return; }
    setLoading(planId);
    try {
      const res = await fetch(`${API_BASE}/subscription/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planId }),
      }).then(r => r.json());
      if (res.success && res.data?.checkoutUrl) window.location.href = res.data.checkoutUrl;
      else alert(res.message || 'Something went wrong');
    } catch { alert('Network error. Please try again.'); }
    finally { setLoading(null); }
  };

  if (fetching) return (
    <div style={{ textAlign: 'center', padding: '32px 0', color: dark ? 'rgba(255,255,255,0.35)' : '#9CA3AF', fontSize: 14 }}>
      🌱 Loading plans…
    </div>
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
      {plans.map(plan => (
        <PlanCard
          key={plan.id}
          plan={plan}
          currentPlan={currentPlan}
          onUpgrade={showCTA ? handleUpgrade : null}
          loading={loading}
          dark={dark}
        />
      ))}
    </div>
  );
}
