import Footer from '../components/Footer';
import { useNavigate } from 'react-router-dom';
import { Button, StarBg } from '../components/ui';

const FEATURES = [
  { e: '🎙️', t: 'Listens As You Read', d: 'Browser speech recognition hears every word. Each is scored and colour‑coded instantly.' },
  { e: '🦉', t: 'Mrs. Owl Coaches You', d: 'When a word trips you up, Mrs. Owl gives a gentle, playful tip in a warm UK voice.' },
  { e: '🌰', t: 'Earn Golden Acorns',   d: 'Great reading earns acorns. Spend them in the shop on digital and physical rewards.' },
  { e: '📊', t: 'Parents Stay Informed', d: 'Phase progress, streak, words read, achievements — all in a protected parent dashboard.' },
];

export default function Landing() {
  const nav = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: '#0D2318', fontFamily: 'var(--font-body)', overflow: 'hidden', position: 'relative' }}>
      <StarBg count={22} />

      {/* Ambient trees */}
      {['🌲','🌳','🌲','🌿','🍃','🌲','🌳'].map((t, i) => (
        <div key={i} style={{ position: 'fixed', fontSize: 22 + i * 4, opacity: 0.09, bottom: `${i * 9}%`, left: i % 2 === 0 ? `${i * 5}%` : undefined, right: i % 2 !== 0 ? `${i * 3}%` : undefined, pointerEvents: 'none', animation: `floatSlow ${3 + i * 0.5}s ease-in-out infinite`, animationDelay: `${i * 0.5}s` }}>{t}</div>
      ))}

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '56px 24px 20px', position: 'relative', zIndex: 1 }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 44 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>🦉</div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 34, color: 'white', letterSpacing: 1 }}>properly</span>
        </div>

        {/* Hero */}
        <div style={{ textAlign: 'center' }}>
          <div className="animate-float" style={{ fontSize: 100, lineHeight: 1, marginBottom: 22 }}>🌳</div>
          <h1 style={{ fontSize: 'clamp(28px,7vw,62px)', fontWeight: 900, lineHeight: 1.1, color: 'white', marginBottom: 18 }}>
            Where Little Readers<br />
            <span style={{ color: '#52B788' }}>Find Their Voice</span>
          </h1>
          <p style={{ fontSize: 'clamp(14px,2.5vw,18px)', color: 'rgba(255,255,255,0.62)', maxWidth: 480, margin: '0 auto 36px', lineHeight: 1.65 }}>
            Properly listens as your child reads aloud, celebrates every correct sound, and gently coaches tricky words — powered by real AI.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <Button variant="acorn" size="lg" onClick={() => nav('/auth')}>🚀 Start Reading — Free</Button>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>No credit card · Ages 4–7 · UK Phonics Phases 2–6</p>
          </div>
        </div>
      </div>

      {/* Feature grid */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '44px 24px 60px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 16 }}>
          {FEATURES.map((f, i) => (
            <div key={f.t} className="animate-slide-up" style={{ animationDelay: `${i * 0.08}s`, background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)', borderRadius: 20, padding: '22px 18px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>{f.e}</div>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'white', marginBottom: 6 }}>{f.t}</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.52)', lineHeight: 1.5 }}>{f.d}</div>
            </div>
          ))}
        </div>

        <p style={{ textAlign: 'center', marginTop: 40, color: 'rgba(255,255,255,0.18)', fontSize: 12 }}>
          🔒 No audio ever saved · GDPR‑K compliant · Chrome, Safari & Edge
        </p>
      </div>
    </div>
  );
}
