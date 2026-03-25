/**
 * @file        SetupChild.jsx
 * @description First-run child profile wizard — shown after registration when parent has no children yet
 * @module      Pages
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - Avatar picker, age, pronouns and phonics phase selector with descriptions
 *   - On save: calls addChildToState() then navigates to /home
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { childrenAPI } from '../services/api';
import Footer from '../components/Footer';

const PHASES = {
  2: { label: 'Phase 2', desc: 'Simple CVC words — cat, dog, pin (ages 4–5)' },
  3: { label: 'Phase 3', desc: 'Digraphs & vowel teams — rain, shop, night (age 5)' },
  4: { label: 'Phase 4', desc: 'Consonant blends — frog, clap, stomp (age 5–6)' },
  5: { label: 'Phase 5', desc: 'Split digraphs — cake, slide, phone (age 6)' },
  6: { label: 'Phase 6', desc: 'Prefixes & suffixes — unhappy, careful (age 6–7+)' },
};

const AVATARS = [
  { id:'hedgehog', emoji:'🦔' }, { id:'owl', emoji:'🦉' }, { id:'fox', emoji:'🦊' },
  { id:'rabbit',   emoji:'🐰' }, { id:'deer', emoji:'🦌' }, { id:'bear', emoji:'🐻' },
  { id:'penguin',  emoji:'🐧' }, { id:'cat',  emoji:'🐱' },
];

export default function SetupChild({ onDone }) {
  const [f, setF] = useState({ name:'', age:'', gender:'neutral', phase:'2', avatar:'hedgehog' });
  const [err, setErr]     = useState('');
  const [saving, setSaving] = useState(false);
  const { addChildToState } = useAuth();
  const nav = useNavigate();

  const fi = (k, v) => setF(p => ({ ...p, [k]: v }));

  const handleAdd = async () => {
    setErr('');
    if (!f.name.trim()) { setErr('Please enter your child\'s name'); return; }
    setSaving(true);
    try {
      const res = await childrenAPI.add({
        name:   f.name.trim(),
        age:    f.age ? parseInt(f.age) : null,
        gender: f.gender,
        phase:  parseInt(f.phase),
        avatar: f.avatar,
      });
      if (res.success) {
        addChildToState(res.data.child);
        if (onDone) onDone(res.data.child);
        else nav('/home', { replace: true });
      }
    } catch (e) {
      setErr(e?.message || 'Failed to add child. Please try again.');
    } finally { setSaving(false); }
  };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-dark-mid)', fontFamily:'var(--font-body)', display:'flex', flexDirection:'column' }}>
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'32px 20px' }}>
        <div style={{ maxWidth:480, width:'100%' }}>

          {/* Header */}
          <div style={{ textAlign:'center', marginBottom:28 }}>
            <div style={{ fontSize:52, marginBottom:10 }}>🌳</div>
            <h1 style={{ fontSize:24, fontWeight:900, color:'white', margin:'0 0 6px', fontFamily:'Georgia' }}>
              Add your first child
            </h1>
            <p style={{ fontSize:13, color:'var(--overlay-50)', margin:0 }}>
              You can add more children later from your Parent Dashboard
            </p>
          </div>

          <div style={{ background:'var(--overlay-7)', backdropFilter:'blur(10px)', borderRadius:20, padding:'28px 24px', border:'1px solid var(--overlay-10)' }}>

            {/* Avatar picker */}
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--overlay-60)', display:'block', marginBottom:8 }}>
                Choose an avatar
              </label>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {AVATARS.map(a => (
                  <button key={a.id} onClick={() => fi('avatar', a.id)} style={{ width:44, height:44, borderRadius:50, border:`2.5px solid ${f.avatar===a.id?'var(--color-accent)':'var(--overlay-15)'}`, background: f.avatar===a.id?'rgba(251,191,36,0.2)':'transparent', fontSize:22, cursor:'pointer', transition:'all 0.15s' }}>
                    {a.emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--overlay-60)', display:'block', marginBottom:6 }}>
                Child's first name *
              </label>
              <input
                value={f.name} onChange={e => fi('name', e.target.value)}
                placeholder="e.g. Lily"
                style={{ width:'100%', padding:'11px 14px', borderRadius:12, border:'1.5px solid var(--overlay-15)', background:'var(--overlay-8)', color:'white', fontSize:14, fontFamily:'var(--font-body)', outline:'none', boxSizing:'border-box' }}
              />
            </div>

            {/* Age + Gender row */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
              <div>
                <label style={{ fontSize:12, fontWeight:700, color:'var(--overlay-60)', display:'block', marginBottom:6 }}>Age</label>
                <select value={f.age} onChange={e => fi('age', e.target.value)} style={{ width:'100%', padding:'11px 12px', borderRadius:12, border:'1.5px solid var(--overlay-15)', background:'var(--overlay-8)', color: f.age?'white':'var(--overlay-40)', fontSize:13, fontFamily:'var(--font-body)', outline:'none' }}>
                  <option value="">Not specified</option>
                  {Array.from({length:9},(_,i)=>i+3).map(a=><option key={a} value={a}>{a} years old</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize:12, fontWeight:700, color:'var(--overlay-60)', display:'block', marginBottom:6 }}>Pronouns</label>
                <select value={f.gender} onChange={e => fi('gender', e.target.value)} style={{ width:'100%', padding:'11px 12px', borderRadius:12, border:'1.5px solid var(--overlay-15)', background:'var(--overlay-8)', color:'white', fontSize:13, fontFamily:'var(--font-body)', outline:'none' }}>
                  <option value="girl">She / Her</option>
                  <option value="boy">He / Him</option>
                  <option value="neutral">They / Them</option>
                </select>
              </div>
            </div>

            {/* Phonics phase */}
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--overlay-60)', display:'block', marginBottom:8 }}>
                Starting phonics level
              </label>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {Object.entries(PHASES).map(([v, p]) => (
                  <button key={v} onClick={() => fi('phase', v)} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', borderRadius:12, border:`1.5px solid ${f.phase===v?'var(--color-accent)':'var(--overlay-10)'}`, background: f.phase===v?'rgba(251,191,36,0.12)':'transparent', cursor:'pointer', textAlign:'left', transition:'all 0.15s' }}>
                    <div style={{ width:20, height:20, borderRadius:50, border:`2px solid ${f.phase===v?'var(--brand-primary-light)':'var(--overlay-20)'}`, background:f.phase===v?'var(--brand-primary-light)':'transparent', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {f.phase===v && <div style={{ width:8, height:8, borderRadius:50, background:'white' }} />}
                    </div>
                    <div>
                      <span style={{ fontSize:13, fontWeight:700, color:'white' }}>{p.label}</span>
                      <span style={{ fontSize:11, color:'var(--overlay-45)', marginLeft:6 }}>{p.desc}</span>
                    </div>
                  </button>
                ))}
              </div>
              <p style={{ fontSize:11, color:'var(--overlay-35)', margin:'8px 0 0' }}>
                Not sure? Start at Phase 2 — you can change this any time.
              </p>
            </div>

            {err && <p style={{ fontSize:13, color:'var(--danger-light)', fontWeight:600, marginBottom:12, textAlign:'center' }}>{err}</p>}

            <button onClick={handleAdd} disabled={saving} style={{ width:'100%', padding:'13px', borderRadius:50, border:'none', background:'var(--grad-accent)', color:'white', fontWeight:800, fontSize:15, cursor:'pointer', fontFamily:'var(--font-body)' }}>
              {saving ? '…' : `Add ${f.name.trim() || 'child'} to the Forest 🌳`}
            </button>
          </div>
        </div>
      </div>
      <Footer dark />
    </div>
  );
}
