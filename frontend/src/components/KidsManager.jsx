/**
 * @file        KidsManager.jsx
 * @description Multi-child management component — add, edit, switch and remove child profiles with plan-limit enforcement
 * @module      Components
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - Embedded in ParentDash; fetches fresh list from /children on mount
 *   - Upgrade nudge shown when plan limit is reached
 *   - Inline edit form replaces the card row to avoid layout shift
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { childrenAPI } from '../services/api';

const PHASES = { 2:'Phase 2 (CVC)', 3:'Phase 3 (Digraphs)', 4:'Phase 4 (Blends)', 5:'Phase 5 (Split digraphs)', 6:'Phase 6 (Morphology)' };
const AVATARS = [
  { id:'hedgehog',emoji:'🦔' },{ id:'owl',emoji:'🦉' },{ id:'fox',emoji:'🦊' },
  { id:'rabbit',emoji:'🐰' },  { id:'deer',emoji:'🦌' },{ id:'bear',emoji:'🐻' },
  { id:'penguin',emoji:'🐧' }, { id:'cat',emoji:'🐱' },
];
const AVATAR_MAP = Object.fromEntries(AVATARS.map(a=>[a.id,a.emoji]));

function ChildForm({ initial, onSave, onCancel, saving }) {
  const [f, setF] = useState(initial || { name:'', age:'', gender:'neutral', phase:'2', avatar:'hedgehog' });
  const fi = (k,v) => setF(p=>({...p,[k]:v}));

  return (
    <div style={{ background:'var(--overlay-4)', borderRadius:16, padding:'18px', border:'1.5px solid var(--overlay-10)' }}>
      {/* Avatar row */}
      <div style={{ display:'flex', gap:6, marginBottom:14, flexWrap:'wrap' }}>
        {AVATARS.map(a=>(
          <button key={a.id} onClick={()=>fi('avatar',a.id)} style={{ width:38,height:38,borderRadius:50,border:`2px solid ${f.avatar===a.id?'var(--brand-primary-light)':'var(--overlay-15)'}`,background:f.avatar===a.id?'rgba(167,139,250,0.2)':'transparent',fontSize:18,cursor:'pointer' }}>
            {a.emoji}
          </button>
        ))}
      </div>
      {/* Name */}
      <input value={f.name} onChange={e=>fi('name',e.target.value)} placeholder="Child's first name *"
        style={{ width:'100%',padding:'9px 12px',borderRadius:10,border:'1.5px solid var(--overlay-15)',background:'var(--overlay-7)',color:'white',fontSize:13,fontFamily:'var(--font-body)',outline:'none',marginBottom:10,boxSizing:'border-box' }} />
      {/* Age + Gender */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10 }}>
        <select value={f.age} onChange={e=>fi('age',e.target.value)}
          style={{ padding:'9px 10px',borderRadius:10,border:'1.5px solid var(--overlay-15)',background:'var(--overlay-7)',color:f.age?'white':'var(--overlay-40)',fontSize:12,fontFamily:'var(--font-body)',outline:'none' }}>
          <option value="">Age (optional)</option>
          {Array.from({length:9},(_,i)=>i+3).map(a=><option key={a} value={a}>{a} yrs</option>)}
        </select>
        <select value={f.gender} onChange={e=>fi('gender',e.target.value)}
          style={{ padding:'9px 10px',borderRadius:10,border:'1.5px solid var(--overlay-15)',background:'var(--overlay-7)',color:'white',fontSize:12,fontFamily:'var(--font-body)',outline:'none' }}>
          <option value="girl">She / Her</option>
          <option value="boy">He / Him</option>
          <option value="neutral">They / Them</option>
        </select>
      </div>
      {/* Phase */}
      <select value={f.phase} onChange={e=>fi('phase',e.target.value)}
        style={{ width:'100%',padding:'9px 12px',borderRadius:10,border:'1.5px solid var(--overlay-15)',background:'var(--overlay-7)',color:'white',fontSize:12,fontFamily:'var(--font-body)',outline:'none',marginBottom:14 }}>
        {Object.entries(PHASES).map(([v,l])=><option key={v} value={v}>{l}</option>)}
      </select>
      {/* Buttons */}
      <div style={{ display:'flex',gap:8 }}>
        <button onClick={()=>onSave(f)} disabled={saving||!f.name.trim()}
          style={{ flex:1,padding:'9px',borderRadius:50,border:'none',background:'var(--color-primary)',color:'white',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:'var(--font-body)',opacity:(!f.name.trim()||saving)?0.5:1 }}>
          {saving?'Saving…':'Save'}
        </button>
        <button onClick={onCancel} style={{ padding:'9px 16px',borderRadius:50,border:'1.5px solid var(--overlay-15)',background:'transparent',color:'var(--overlay-60)',fontWeight:600,fontSize:13,cursor:'pointer',fontFamily:'var(--font-body)' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function KidsManager() {
  const { child: activeChild, children, switchChild, addChildToState, removeChildFromState } = useAuth();
  const [allChildren, setAllChildren]   = useState(children || []);
  const [limit, setLimit]               = useState(1);
  const [showAdd, setShowAdd]           = useState(false);
  const [editing, setEditing]           = useState(null);   // child id being edited
  const [deleting, setDeleting]         = useState(null);
  const [saving, setSaving]             = useState(false);
  const [err, setErr]                   = useState('');
  const nav = useNavigate();

  useEffect(() => {
    childrenAPI.list().then(r => {
      if (r.success) { setAllChildren(r.data.children); setLimit(r.data.limit); }
    }).catch(() => {});
  }, []);

  const handleAdd = async (formData) => {
    setErr(''); setSaving(true);
    try {
      const res = await childrenAPI.add({ name:formData.name.trim(), age:formData.age?parseInt(formData.age):null, gender:formData.gender, phase:parseInt(formData.phase), avatar:formData.avatar });
      if (res.success) {
        setAllChildren(prev => [...prev, res.data.child]);
        addChildToState(res.data.child);
        setShowAdd(false);
      }
    } catch(e) { setErr(e?.message||'Failed to add child'); }
    finally { setSaving(false); }
  };

  const handleEdit = async (formData) => {
    setErr(''); setSaving(true);
    try {
      const res = await childrenAPI.update(editing, { name:formData.name.trim(), age:formData.age?parseInt(formData.age):null, gender:formData.gender, phase:parseInt(formData.phase), avatar:formData.avatar });
      if (res.success) {
        setAllChildren(prev => prev.map(c => c.id===editing ? res.data.child : c));
        setEditing(null);
      }
    } catch(e) { setErr(e?.message||'Failed to update'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (childId) => {
    if (!window.confirm('Remove this child profile? All their stories and progress will be permanently deleted.')) return;
    try {
      await childrenAPI.remove(childId);
      setAllChildren(prev => prev.filter(c=>c.id!==childId));
      removeChildFromState(childId);
    } catch(e) { setErr(e?.message||'Failed to remove'); }
    finally { setDeleting(null); }
  };

  const canAdd = allChildren.length < limit;

  return (
    <div>
      {/* Section header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <h2 style={{ margin:0, fontSize:18, fontWeight:900, color:'white' }}>My Children</h2>
          <p style={{ margin:'3px 0 0', fontSize:12, color:'var(--overlay-40)' }}>
            {allChildren.length} of {limit} profile{limit>1?'s':''} used
          </p>
        </div>
        {canAdd && !showAdd && (
          <button onClick={()=>setShowAdd(true)} style={{ background:'var(--color-primary)', border:'none', borderRadius:50, padding:'7px 16px', color:'white', fontWeight:700, fontSize:12, cursor:'pointer', fontFamily:'var(--font-body)' }}>
            + Add child
          </button>
        )}
      </div>

      {err && <p style={{ color:'#FCA5A5', fontSize:13, marginBottom:12 }}>{err}</p>}

      {/* Add form */}
      {showAdd && (
        <div style={{ marginBottom:16 }}>
          <p style={{ fontSize:12, fontWeight:700, color:'var(--brand-primary-light)', marginBottom:8 }}>New child profile</p>
          <ChildForm onSave={handleAdd} onCancel={()=>setShowAdd(false)} saving={saving} />
        </div>
      )}

      {/* Children list */}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {allChildren.map(c => {
          const isActive = c.id === activeChild?.id;
          return (
            <div key={c.id}>
              {editing === c.id ? (
                <ChildForm
                  initial={{ name:c.name, age:c.age||'', gender:c.gender||'neutral', phase:String(c.phase), avatar:c.avatar||'hedgehog' }}
                  onSave={handleEdit} onCancel={()=>setEditing(null)} saving={saving}
                />
              ) : (
                <div style={{ background: isActive?'rgba(167,139,250,0.12)':'var(--overlay-4)', borderRadius:14, padding:'12px 14px', border:`1.5px solid ${isActive?'rgba(167,139,250,0.4)':'var(--overlay-8)'}`, display:'flex', alignItems:'center', gap:12 }}>
                  {/* Avatar */}
                  <div style={{ width:44, height:44, borderRadius:50, background:isActive?'rgba(167,139,250,0.2)':'var(--overlay-7)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                    {AVATAR_MAP[c.avatar||'hedgehog']}
                  </div>
                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                      <span style={{ fontWeight:800, fontSize:14, color:'white' }}>{c.name}</span>
                      {isActive && <span style={{ fontSize:10, fontWeight:700, background:'rgba(167,139,250,0.25)', color:'var(--brand-primary-light)', borderRadius:50, padding:'1px 8px' }}>Reading now</span>}
                    </div>
                    <div style={{ fontSize:11, color:'var(--overlay-40)', marginTop:2 }}>
                      {PHASES[c.phase]} {c.age ? `· Age ${c.age}` : ''} · 🌰 {c.acorns} acorns
                    </div>
                  </div>
                  {/* Actions */}
                  <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                    {!isActive && (
                      <button onClick={()=>{ switchChild(c.id); nav('/home'); }} style={{ background:'rgba(167,139,250,0.15)', border:'1.5px solid rgba(167,139,250,0.3)', borderRadius:50, padding:'5px 12px', color:'var(--brand-primary-light)', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)' }}>
                        Switch
                      </button>
                    )}
                    <button onClick={()=>setEditing(c.id)} style={{ background:'var(--overlay-7)', border:'1.5px solid var(--overlay-12)', borderRadius:50, padding:'5px 10px', color:'var(--overlay-60)', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'var(--font-body)' }}>
                      Edit
                    </button>
                    {allChildren.length > 1 && (
                      <button onClick={()=>handleDelete(c.id)} style={{ background:'rgba(239,68,68,0.12)', border:'1.5px solid rgba(239,68,68,0.25)', borderRadius:50, padding:'5px 10px', color:'#FCA5A5', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'var(--font-body)' }}>
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Upgrade nudge when at limit */}
      {!canAdd && (
        <div style={{ marginTop:14, background:'rgba(245,158,11,0.1)', border:'1.5px solid rgba(245,158,11,0.25)', borderRadius:12, padding:'12px 14px', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:20 }}>🌳</span>
          <div style={{ flex:1 }}>
            <p style={{ margin:0, fontSize:13, fontWeight:700, color:'var(--brand-accent)' }}>Plan limit reached ({limit} child{limit>1?'ren':''})</p>
            <p style={{ margin:'2px 0 0', fontSize:11, color:'var(--overlay-40)' }}>Upgrade to Forest plan to add up to 5 children</p>
          </div>
          <button onClick={()=>nav('/pricing')} style={{ background:'var(--brand-accent)', border:'none', borderRadius:50, padding:'6px 14px', color:'var(--brand-primary-darker)', fontSize:11, fontWeight:800, cursor:'pointer', fontFamily:'var(--font-body)', flexShrink:0 }}>
            Upgrade
          </button>
        </div>
      )}
    </div>
  );
}
