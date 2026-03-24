/**
 * @file        Landing.jsx
 * @description Marketing landing page — product pitch, feature highlights and call-to-action for sign-up
 * @module      Pages
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 */

import Footer from '../components/Footer';
import { useNavigate } from 'react-router-dom';
import { Button, StarBg } from '../components/ui';
import { PlansSection } from '../components/PlanCard';

const FEATURES = [
  { e:'🎙️', t:'Listens as you read',    d:'Hears every word and scores each one in real time using Azure AI.' },
  { e:'🦉', t:"Mrs. Owl coaches you",    d:'Gentle phonics tips from Gemini or Groq AI in a warm UK voice.' },
  { e:'🌰', t:'Earn Golden Acorns',      d:'Great reading earns acorns to spend on digital and real prizes.' },
  { e:'📊', t:'Parents stay informed',   d:'Phase progress, streaks, and achievements in a protected dashboard.' },
];

export default function Landing() {
  const nav = useNavigate();
  return (
    <div style={{ minHeight:'100vh', background:'#0D2318', fontFamily:'var(--font-body)', overflow:'hidden', position:'relative' }}>
      <StarBg count={22} />
      {['🌲','🌳','🌲','🌿','🍃','🌲','🌳'].map((t,i)=>(
        <div key={i} style={{ position:'fixed', fontSize:22+i*4, opacity:0.09, bottom:`${i*9}%`, left:i%2===0?`${i*5}%`:undefined, right:i%2!==0?`${i*3}%`:undefined, pointerEvents:'none', animation:`floatSlow ${3+i*0.5}s ease-in-out infinite`, animationDelay:`${i*0.5}s` }}>{t}</div>
      ))}

      {/* ── NAV ── */}
      <nav style={{ position:'sticky', top:0, zIndex:50, background:'rgba(13,35,24,0.92)', backdropFilter:'blur(12px)', borderBottom:'1px solid rgba(255,255,255,0.07)', padding:'12px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>🦉</div>
          <span style={{ fontFamily:'var(--font-display)', fontSize:22, color:'white', letterSpacing:1 }}>properly</span>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => { const el=document.getElementById('pricing'); el?.scrollIntoView({behavior:'smooth'}); }}
            style={{ background:'rgba(255,255,255,0.08)', border:'1.5px solid rgba(255,255,255,0.15)', borderRadius:50, padding:'6px 14px', color:'rgba(255,255,255,0.75)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }}>
            Pricing
          </button>
          <button onClick={() => nav('/auth')}
            style={{ background:'#2D6A4F', border:'none', borderRadius:50, padding:'6px 16px', color:'white', fontSize:12, fontWeight:800, cursor:'pointer', fontFamily:'var(--font-body)' }}>
            Log in
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div style={{ maxWidth:860, margin:'0 auto', padding:'56px 24px 20px', position:'relative', zIndex:1, textAlign:'center' }}>
        <div className="animate-float" style={{ fontSize:96, lineHeight:1, marginBottom:22 }}>🌳</div>
        <h1 style={{ fontSize:'clamp(28px,7vw,62px)', fontWeight:900, lineHeight:1.1, color:'white', marginBottom:18 }}>
          Where Little Readers<br /><span style={{ color:'#52B788' }}>Find Their Voice</span>
        </h1>
        <p style={{ fontSize:'clamp(14px,2.5vw,18px)', color:'rgba(255,255,255,0.62)', maxWidth:480, margin:'0 auto 36px', lineHeight:1.65 }}>
          Properly listens as your child reads aloud, celebrates every correct sound, and gently coaches tricky words — powered by real AI.
        </p>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
          <Button variant="acorn" size="lg" onClick={() => nav('/auth')}>🚀 Start Reading — Free</Button>
          <p style={{ fontSize:12, color:'rgba(255,255,255,0.3)' }}>No credit card · Ages 4–7 · UK Phonics Phases 2–6</p>
        </div>
      </div>

      {/* ── FEATURES ── */}
      <div style={{ maxWidth:860, margin:'0 auto', padding:'44px 24px 20px', position:'relative', zIndex:1 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))', gap:16 }}>
          {FEATURES.map((f,i)=>(
            <div key={f.t} className="animate-slide-up" style={{ animationDelay:`${i*0.08}s`, background:'rgba(255,255,255,0.06)', backdropFilter:'blur(10px)', borderRadius:20, padding:'22px 18px', border:'1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize:36, marginBottom:12 }}>{f.e}</div>
              <div style={{ fontWeight:800, fontSize:15, color:'white', marginBottom:6 }}>{f.t}</div>
              <div style={{ fontSize:13, color:'rgba(255,255,255,0.52)', lineHeight:1.5 }}>{f.d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── PRICING SECTION ── */}
      <div id="pricing" style={{ maxWidth:900, margin:'0 auto', padding:'60px 24px 20px', position:'relative', zIndex:1 }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <p style={{ color:'rgba(255,255,255,0.4)', fontSize:11, fontWeight:800, letterSpacing:'1.5px', marginBottom:8 }}>PRICING</p>
          <h2 style={{ fontSize:'clamp(22px,5vw,38px)', fontWeight:900, color:'white', margin:'0 0 12px' }}>
            Simple, honest pricing
          </h2>
          <p style={{ fontSize:15, color:'rgba(255,255,255,0.5)', maxWidth:420, margin:'0 auto' }}>
            Start free forever. Upgrade for Azure phoneme scoring, all phases, and more stories.
          </p>
        </div>

        <PlansSection dark={true} showCTA={true} />

        <p style={{ textAlign:'center', marginTop:28, color:'rgba(255,255,255,0.2)', fontSize:12 }}>
          🔒 Secure Stripe payments · Cancel any time · No hidden fees
        </p>
      </div>

      {/* ── BOTTOM CTA ── */}
      <div style={{ maxWidth:600, margin:'0 auto', padding:'48px 24px 20px', textAlign:'center', position:'relative', zIndex:1 }}>
        <h2 style={{ fontSize:26, fontWeight:900, color:'white', marginBottom:12 }}>Ready to start reading? 🦉</h2>
        <p style={{ color:'rgba(255,255,255,0.5)', fontSize:15, marginBottom:24 }}>Join families already reading with Properly — free forever, no card needed.</p>
        <Button variant="acorn" size="lg" onClick={() => nav('/auth')}>🚀 Create Free Account</Button>
      </div>

      <div style={{ maxWidth:860, margin:'0 auto', padding:'12px 24px 20px', position:'relative', zIndex:1 }}>
        <p style={{ textAlign:'center', color:'rgba(255,255,255,0.15)', fontSize:12 }}>
          🔒 No audio ever saved · GDPR‑K compliant · Chrome, Safari &amp; Edge
        </p>
      </div>
      <Footer dark={true} />
    </div>
  );
}
