/**
 * @file        index.jsx
 * @description Shared UI primitives — Button, Input, Select, Spinner, AcornPill, Toast used across all pages
 * @module      UI Components
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 */

import { useEffect } from 'react';

// ── BUTTON ───────────────────────────────────────────────────
export function Button({ children, onClick, variant = 'primary', size = 'md', disabled = false, fullWidth = false, className = '', style = {} }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontFamily: 'var(--font-body)', fontWeight: 800, borderRadius: 50, border: 'none',
    cursor: disabled ? 'default' : 'pointer', transition: 'all 0.18s ease',
    width: fullWidth ? '100%' : undefined, opacity: disabled ? 0.55 : 1,
    pointerEvents: disabled ? 'none' : 'auto',
  };
  const sizes = { sm: { padding: '8px 18px', fontSize: 13 }, md: { padding: '12px 26px', fontSize: 15 }, lg: { padding: '15px 36px', fontSize: 17 } };
  const variants = {
    primary:  { background: 'var(--grad-primary)', color: 'white', boxShadow: '0 4px 16px var(--primary-40)' },
    secondary:{ background: 'white', color: 'var(--color-primary)', border: '2px solid var(--color-primary)', boxShadow: '0 2px 8px rgba(124,58,237,0.15)' },
    ghost:    { background: 'var(--overlay-10)', color: 'var(--overlay-80)', border: '1.5px solid var(--overlay-20)' },
    danger:   { background: 'var(--grad-danger)', color: 'white' },
    acorn:    { background: 'linear-gradient(135deg,var(--brand-accent),var(--color-accent))', color: 'var(--text-warning-dark)', boxShadow: '0 4px 16px rgba(245,158,11,0.35)' },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...sizes[size], ...variants[variant], ...style }} className={className}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
      {children}
    </button>
  );
}

// ── CARD ─────────────────────────────────────────────────────
export function Card({ children, style = {}, className = '', onClick, hover = false }) {
  return (
    <div onClick={onClick} className={className}
      style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow)', overflow: 'hidden', cursor: onClick ? 'pointer' : undefined, transition: hover ? 'transform 0.15s, box-shadow 0.15s' : undefined, ...style }}
      onMouseEnter={e => { if (hover) { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = 'var(--shadow-xl)'; } }}
      onMouseLeave={e => { if (hover) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow)'; } }}>
      {children}
    </div>
  );
}

// ── MODAL ────────────────────────────────────────────────────
export function Modal({ children, onClose, maxWidth = 420 }) {
  useEffect(() => {
    const h = e => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20, backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose?.()}>
      <div className="animate-bounce-in" style={{ maxWidth, width: '100%', background: 'white', borderRadius: 28, padding: 32, boxShadow: '0 24px 80px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

// ── INPUT ────────────────────────────────────────────────────
export function Input({ label, type = 'text', value, onChange, onKeyDown, placeholder, error, autoComplete }) {
  return (
    <div>
      {label && <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 5, letterSpacing: '0.5px' }}>{label}</label>}
      <input type={type} value={value} onChange={onChange} onKeyDown={onKeyDown} placeholder={placeholder} autoComplete={autoComplete}
        style={{ width: '100%', padding: '12px 15px', border: `2px solid ${error ? 'var(--red)' : 'var(--border)'}`, borderRadius: 12, fontSize: 15, fontWeight: 600, color: 'var(--text)', background: 'var(--bg-muted)', outline: 'none', fontFamily: 'var(--font-body)', transition: 'border-color 0.2s' }}
        onFocus={e => e.target.style.borderColor = 'var(--forest-bright)'}
        onBlur={e => e.target.style.borderColor = error ? 'var(--red)' : 'var(--border)'} />
      {error && <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 4, fontWeight: 600 }}>{error}</p>}
    </div>
  );
}

// ── SELECT ───────────────────────────────────────────────────
export function Select({ label, value, onChange, children }) {
  return (
    <div>
      {label && <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 5, letterSpacing: '0.5px' }}>{label}</label>}
      <select value={value} onChange={onChange} style={{ width: '100%', padding: '12px 15px', border: '2px solid var(--border)', borderRadius: 12, fontSize: 15, fontWeight: 700, color: 'var(--text)', background: 'var(--bg-muted)', outline: 'none', fontFamily: 'var(--font-body)', cursor: 'pointer' }}
        onFocus={e => e.target.style.borderColor = 'var(--forest-bright)'}
        onBlur={e => e.target.style.borderColor = 'var(--border)'}>
        {children}
      </select>
    </div>
  );
}

// ── PROGRESS BAR ─────────────────────────────────────────────
export function ProgressBar({ value, max, color = 'var(--color-accent)', height = 8, label, showPct = false }) {
  const pct = Math.min(100, max > 0 ? Math.round(value / max * 100) : 0);
  return (
    <div>
      {(label || showPct) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>
          <span>{label}</span>
          {showPct && <span>{pct}%</span>}
        </div>
      )}
      <div style={{ background: 'var(--bg-subtle)', borderRadius: 50, height, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: color, borderRadius: 50, width: `${pct}%`, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

// ── ACORN PILL ───────────────────────────────────────────────
export function AcornPill({ count, size = 13, style = {} }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--grad-goal)', color: 'var(--text-warning-dark)', padding: `${size > 14 ? 6 : 4}px ${size > 14 ? 14 : 10}px`, borderRadius: 50, fontSize: size, fontWeight: 900, border: '1.5px solid rgba(245,158,11,0.25)', whiteSpace: 'nowrap', ...style }}>
      🌰&nbsp;{count}
    </span>
  );
}

// ── BADGE ────────────────────────────────────────────────────
export function Badge({ children, color = 'var(--color-primary)', bg = 'var(--bg-primary-light)', style = {} }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: bg || color + '20', color, padding: '3px 10px', borderRadius: 50, fontSize: 11, fontWeight: 800, border: `1.5px solid ${color}35`, ...style }}>
      {children}
    </span>
  );
}

// ── SPINNER ──────────────────────────────────────────────────
export function Spinner({ size = 24, color = 'var(--color-primary)' }) {
  return (
    <div style={{ width: size, height: size, border: `3px solid var(--dark-10)`, borderTop: `3px solid ${color}`, borderRadius: '50%' }} className="animate-spin" />
  );
}

// ── STAR BACKGROUND ──────────────────────────────────────────
export function StarBg({ count = 12, color = 'var(--overlay-60)' }) {
  const stars = Array.from({ length: count }, (_, i) => ({
    top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`,
    size: 2 + Math.random() * 3,
    delay: Math.random() * 3, dur: 1.5 + Math.random() * 2,
  }));
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      {stars.map((s, i) => (
        <div key={i} style={{ position: 'absolute', top: s.top, left: s.left, width: s.size, height: s.size, borderRadius: '50%', background: color, animation: `twinkle ${s.dur}s ease-in-out infinite`, animationDelay: `${s.delay}s` }} />
      ))}
    </div>
  );
}

// ── CONFETTI ─────────────────────────────────────────────────
export function Confetti({ active }) {
  if (!active) return null;
  const colors = ['var(--brand-accent)', 'var(--color-success)', 'var(--color-info)', 'var(--color-danger)', 'var(--color-primary-light)', '#EC4899'];
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', pointerEvents: 'none', zIndex: 600 }}>
      {Array.from({ length: 24 }, (_, i) => (
        <div key={i} style={{ position: 'absolute', top: -20, left: `${3 + i * 4}%`, width: 8 + Math.random() * 6, height: 8 + Math.random() * 6, background: colors[i % colors.length], borderRadius: i % 3 === 0 ? '50%' : 2, animation: `confetti 2.5s ease-in ${Math.random()}s forwards`, transform: `rotate(${Math.random() * 360}deg)` }} />
      ))}
    </div>
  );
}

// ── TOAST ────────────────────────────────────────────────────
export function Toast({ message, emoji = '🌟', onHide }) {
  useEffect(() => { const t = setTimeout(onHide, 3000); return () => clearTimeout(t); }, [onHide]);
  return (
    <div className="animate-bounce-in" style={{ position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)', background: 'var(--text)', color: 'white', borderRadius: 50, padding: '11px 24px', fontSize: 14, fontWeight: 800, zIndex: 700, boxShadow: '0 8px 32px rgba(0,0,0,0.35)', whiteSpace: 'nowrap' }}>
      {emoji} {message}
    </div>
  );
}

// ── EMPTY STATE ──────────────────────────────────────────────
export function EmptyState({ emoji, title, desc, action }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
      <div style={{ fontSize: 56, marginBottom: 14 }}>{emoji}</div>
      <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>{title}</h3>
      {desc && <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: action ? 20 : 0 }}>{desc}</p>}
      {action}
    </div>
  );
}
