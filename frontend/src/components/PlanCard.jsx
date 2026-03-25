/**
 * @file        PlanCard.jsx
 * @description Pricing plan card component — renders plan name, price, features and CTA button
 * @module      Components
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = (typeof __API_URL__ !== 'undefined' ? __API_URL__ : null)
  || (typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_URL : null)
  || '/api';

// ── PLAN DATA (mirrored from backend/src/config/plans.js) ────
// Kept here so cards render instantly without waiting for the API
const STATIC_PLANS = [
  {
    id:          'free',
    name:        'Seedling',
    emoji:       '🌱',
    price:       0,
    tagline:     'Get started free',
    color:       'var(--text-success)',
    recommended: false,
    features: [
      '3 curriculum phonics stories',
      '2 AI personalised stories/day',
      'Browser microphone scoring',
      'Golden Acorn rewards',
      'Basic progress tracking',
    ],
    notIncluded: [
      'Azure phoneme-level scoring',
      'Natural Mrs. Owl voice',
      'All 5 phonics phases',
      'Multiple children profiles',
      'Parent analytics dashboard',
    ],
  },
  {
    id:          'sprout',
    name:        'Sprout',
    emoji:       '🌿',
    price:       3.99,
    tagline:     'Most popular',
    color:       'var(--color-primary)',
    recommended: true,
    features: [
      'All 14 curriculum stories',
      '10 AI personalised stories/day',
      '☁️ Azure phoneme-level scoring',
      '🦉 Natural Mrs. Owl UK voice',
      'All 5 phonics phases (2–6)',
      'Parent analytics dashboard',
      'Custom reading goals',
    ],
    notIncluded: [
      'Multiple children profiles',
      'PDF progress reports',
    ],
  },
  {
    id:          'forest',
    name:        'Forest',
    emoji:       '🌳',
    price:       6.99,
    tagline:     'For families',
    color:       'var(--brand-primary-darker)',
    recommended: false,
    features: [
      'Everything in Sprout',
      'Up to 5 children profiles',
      'Unlimited AI stories',
      'PDF progress reports',
      'Priority email support',
      'Early access to new features',
    ],
    notIncluded: [],
  },
];

// ── SINGLE PLAN CARD ─────────────────────────────────────────
export function PlanCard({ plan, currentPlan = null, onUpgrade, loading, dark = false }) {
  const isCurrent   = currentPlan && plan.id === currentPlan;
  const isDowngrade = currentPlan && currentPlan !== 'free' && plan.id === 'free';
  const color       = plan.color || 'var(--color-primary)';

  const cardBg     = dark ? 'var(--overlay-7)' : 'white';
  const cardBorder = plan.recommended
    ? `2.5px solid ${color}`
    : dark ? '1.5px solid var(--overlay-12)' : '1.5px solid var(--border)';
  const textPrimary   = dark ? 'white'                  : 'var(--text)';
  const textMuted     = dark ? 'var(--overlay-30)'  : 'var(--text-light)';
  const checkColor    = dark ? 'rgba(167,139,250,0.9)'   : color;
  const crossColor    = dark ? 'rgba(255,255,255,0.18)' : 'var(--border-2)';

  return (
    <div
      style={{ background: cardBg, backdropFilter: dark ? 'blur(10px)' : 'none', borderRadius: 24, border: cardBorder, overflow: 'hidden', position: 'relative', boxShadow: plan.recommended ? `0 8px 32px ${color}${dark ? '40' : '20'}` : 'none', transition: 'transform 0.15s, box-shadow 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = plan.recommended ? `0 12px 40px ${color}50` : `0 4px 20px rgba(0,0,0,0.12)`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = plan.recommended ? `0 8px 32px ${color}${dark ? '40' : '20'}` : 'none'; }}
    >
      {plan.recommended && (
        <div style={{ background: color, textAlign: 'center', padding: '6px 0', fontSize: 11, fontWeight: 800, color: 'white', letterSpacing: '0.5px' }}>
          ⭐ MOST POPULAR
        </div>
      )}

      <div style={{ padding: '22px 20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
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
                <span style={{ fontSize: 13, fontWeight: 700, color: textMuted }}>£</span>
                <span style={{ fontSize: 30, fontWeight: 900, color: textPrimary }}>{plan.price.toFixed(2)}</span>
                <span style={{ fontSize: 12, color: textMuted }}>/month</span>
              </>
          }
        </div>
        {plan.price > 0 && (
          <p style={{ fontSize: 11, color: 'var(--color-success)', fontWeight: 700, margin: '2px 0 14px', display: 'flex', alignItems: 'center', gap: 4 }}>
            🎁 7-day free trial included
          </p>
        )}
        {plan.price === 0 && <div style={{ height: 20 }} />}

        {/* CTA */}
        {onUpgrade && (
          <button
            onClick={() => !isCurrent && !isDowngrade && onUpgrade(plan.id)}
            disabled={isCurrent || isDowngrade || loading === plan.id}
            style={{ width: '100%', padding: '12px', borderRadius: 50, border: 'none', background: isCurrent ? `${color}20` : `linear-gradient(135deg,${color},${color}BB)`, color: isCurrent ? color : 'white', fontWeight: 800, fontSize: 13, cursor: (isCurrent || isDowngrade) ? 'default' : 'pointer', fontFamily: 'var(--font-body)', marginBottom: 16, opacity: isDowngrade ? 0.4 : 1, transition: 'opacity 0.15s' }}>
            {loading === plan.id ? '⏳ Loading…'
              : isCurrent    ? '✓ Current plan'
              : isDowngrade  ? '—'
              : plan.id === 'free' ? 'Get started free'
              : `Upgrade to ${plan.name}`}
          </button>
        )}

        {/* Divider */}
        <div style={{ borderTop: `1px solid ${dark ? 'var(--overlay-10)' : 'var(--bg-subtle)'}`, marginBottom: 14 }} />

        {/* Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(plan.features || []).map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13 }}>
              <span style={{ color: checkColor, flexShrink: 0, marginTop: 1, fontWeight: 700 }}>✓</span>
              <span style={{ color: dark ? 'rgba(255,255,255,0.78)' : 'var(--text-secondary)', lineHeight: 1.45 }}>{f}</span>
            </div>
          ))}
          {(plan.notIncluded || []).map(f => (
            <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13 }}>
              <span style={{ color: crossColor, flexShrink: 0, marginTop: 1 }}>✗</span>
              <span style={{ color: dark ? 'rgba(255,255,255,0.22)' : '#C4B5A0', lineHeight: 1.45 }}>{f}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── PLANS SECTION ─────────────────────────────────────────────
export function PlansSection({ dark = false, currentPlan = null, showCTA = true }) {
  const [stripeReady, setStripeReady] = useState(false);
  const [loading, setLoading]         = useState(null);
  const nav = useNavigate();

  // Fetch live status from API (non-blocking — cards always show immediately)
  useEffect(() => {
    fetch(`${API_BASE}/plans`, { signal: AbortSignal.timeout(5000) })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.success) setStripeReady(d.data.stripeAvailable); })
      .catch(() => {}); // silent — static plans still shown
  }, []);

  const handleUpgrade = async (planId) => {
    const token = localStorage.getItem('properly_token');
    if (!token) { nav('/auth'); return; }
    if (planId === 'free') return;
    if (!stripeReady) {
      alert('Payment processing is not yet configured. You can sign up for the free plan now, and upgrade later when payments are enabled.');
      return;
    }
    setLoading(planId);
    try {
      const res = await fetch(`${API_BASE}/subscription/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ planId }),
      }).then(r => r.json());
      if (res.success && res.data?.checkoutUrl) window.location.href = res.data.checkoutUrl;
      else alert(res.message || 'Something went wrong. Please try again.');
    } catch { alert('Network error. Please try again.'); }
    finally { setLoading(null); }
  };

  // Always render immediately using static plan data
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
      {STATIC_PLANS.map(plan => (
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
