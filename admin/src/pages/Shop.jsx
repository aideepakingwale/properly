/**
 * @file        Shop.jsx
 * @description Gift shop management — full CRUD for shop items: add, edit cost/emoji/category/sort, delete
 * @module      Admin Pages
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - Item categories: avatar, background, badge, reward, physical
 *   - ownerCount shown per item so popular items can be identified before deletion
 */

import { useState, useEffect } from 'react';
import { adminAPI } from '../services/api';

const EMPTY = { id:'', name:'', emoji:'', cost:'', category:'avatar', description:'', sortOrder:'99' };
const CATS  = ['avatar','background','badge','reward','physical'];

function ItemForm({ initial, onSave, onCancel, isNew }) {
  const [f, setF]   = useState(initial || EMPTY);
  const [err, setErr] = useState('');
  const fi = (k,v) => setF(p => ({...p,[k]:v}));

  const submit = async () => {
    setErr('');
    if (!f.name || !f.emoji || !f.cost) { setErr('Name, emoji and cost are required'); return; }
    try { await onSave(f); }
    catch(e) { setErr(e.message); }
  };

  return (
    <div style={{ background:'var(--bg)', border:'1px solid var(--accent)', borderRadius:8, padding:20, marginBottom:16 }}>
      <div style={{ fontFamily:'var(--font-ui)', fontWeight:700, marginBottom:14, color:'var(--accent)' }}>
        {isNew ? '+ New Item' : 'Edit Item'}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
        {isNew && <div><label style={{ fontSize:10, color:'var(--muted)', display:'block', marginBottom:4 }}>ITEM ID *</label><input value={f.id} onChange={e=>fi('id',e.target.value)} placeholder="acorn-crown" /></div>}
        <div><label style={{ fontSize:10, color:'var(--muted)', display:'block', marginBottom:4 }}>NAME *</label><input value={f.name} onChange={e=>fi('name',e.target.value)} placeholder="Acorn Crown" /></div>
        <div><label style={{ fontSize:10, color:'var(--muted)', display:'block', marginBottom:4 }}>EMOJI *</label><input value={f.emoji} onChange={e=>fi('emoji',e.target.value)} placeholder="👑" style={{ fontSize:20 }} /></div>
        <div><label style={{ fontSize:10, color:'var(--muted)', display:'block', marginBottom:4 }}>COST (acorns) *</label><input type="number" value={f.cost} onChange={e=>fi('cost',e.target.value)} placeholder="500" /></div>
        <div><label style={{ fontSize:10, color:'var(--muted)', display:'block', marginBottom:4 }}>CATEGORY</label>
          <select value={f.category} onChange={e=>fi('category',e.target.value)}>
            {CATS.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div><label style={{ fontSize:10, color:'var(--muted)', display:'block', marginBottom:4 }}>SORT ORDER</label><input type="number" value={f.sortOrder} onChange={e=>fi('sortOrder',e.target.value)} /></div>
      </div>
      <div style={{ marginBottom:12 }}>
        <label style={{ fontSize:10, color:'var(--muted)', display:'block', marginBottom:4 }}>DESCRIPTION</label>
        <textarea value={f.description} onChange={e=>fi('description',e.target.value)} rows={2} placeholder="Short description for parents…" style={{ resize:'vertical' }} />
      </div>
      {err && <div style={{ color:'var(--danger)', fontSize:12, marginBottom:10 }}>{err}</div>}
      <div style={{ display:'flex', gap:8 }}>
        <button className="btn btn-accent btn-sm" onClick={submit}>Save Item</button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default function Shop() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = () => adminAPI.shop().then(r => { if (r.success) setItems(r.data.items); }).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const createItem = async (f) => {
    await adminAPI.createItem({ id:f.id, name:f.name, emoji:f.emoji, cost:parseInt(f.cost), category:f.category, description:f.description, sortOrder:parseInt(f.sortOrder) });
    setShowNew(false); load();
  };

  const updateItem = async (f) => {
    await adminAPI.updateItem(editing, { name:f.name, emoji:f.emoji, cost:parseInt(f.cost), category:f.category, description:f.description, sortOrder:parseInt(f.sortOrder) });
    setEditing(null); load();
  };

  const deleteItem = async (id) => {
    if (!confirm(`Delete item "${id}"? Owners keep it but it won't be purchasable.`)) return;
    await adminAPI.deleteItem(id); load();
  };

  const catColor = { avatar:'var(--blue)', background:'var(--purple)', badge:'var(--accent)', reward:'var(--accent2)', physical:'var(--danger)' };

  return (
    <div style={{ padding:28 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800 }}>Gift Shop</h1>
          <div style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>{items.length} items · children spend acorns here</div>
        </div>
        <button className="btn btn-accent" onClick={()=>{setShowNew(true);setEditing(null);}}>+ New Item</button>
      </div>

      {showNew && <ItemForm isNew onSave={createItem} onCancel={()=>setShowNew(false)} />}

      {loading
        ? <div style={{ color:'var(--muted)', padding:40, textAlign:'center' }}>Loading…</div>
        : (
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8 }}>
          <table>
            <thead>
              <tr><th>Item</th><th>Category</th><th>Cost</th><th>Owners</th><th>Sort</th><th></th></tr>
            </thead>
            <tbody>
              {items.map(item => (
                <>
                  <tr key={item.id}>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ fontSize:24 }}>{item.emoji}</span>
                        <div>
                          <div style={{ fontWeight:600, color:'var(--text)' }}>{item.name}</div>
                          <div style={{ fontSize:10, color:'var(--muted)' }}>{item.id}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="badge" style={{ background:`${catColor[item.category]}20`, color:catColor[item.category]||'var(--muted)', border:`1px solid ${catColor[item.category]}40` }}>{item.category}</span></td>
                    <td><span style={{ color:'var(--accent2)', fontWeight:700 }}>🌰 {item.cost}</span></td>
                    <td style={{ color:'var(--muted)' }}>{item.ownerCount}</td>
                    <td style={{ color:'var(--muted)' }}>{item.sort_order}</td>
                    <td>
                      <div style={{ display:'flex', gap:6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={()=>{setEditing(item.id);setShowNew(false);}}>Edit</button>
                        <button className="btn btn-danger btn-sm" onClick={()=>deleteItem(item.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                  {editing===item.id && (
                    <tr key={item.id+'_edit'}>
                      <td colSpan={6} style={{ padding:0, background:'var(--bg)' }}>
                        <div style={{ padding:16 }}>
                          <ItemForm initial={{ ...item, sortOrder:item.sort_order, cost:String(item.cost) }} onSave={updateItem} onCancel={()=>setEditing(null)} />
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
