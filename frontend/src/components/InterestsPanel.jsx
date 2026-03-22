/**
 * InterestsPanel — Parent sets child's interests
 * These drive theme selection in AI story generation
 */
import { useState } from 'react';
import { aiStoryAPI } from '../services/api';
import { Button, Spinner } from './ui';

const PRESET_INTERESTS = [
  { id:'space',       label:'Space',       emoji:'🚀' },
  { id:'dinosaurs',   label:'Dinosaurs',   emoji:'🦕' },
  { id:'dragons',     label:'Dragons',     emoji:'🐉' },
  { id:'animals',     label:'Animals',     emoji:'🦁' },
  { id:'ocean',       label:'Ocean',       emoji:'🌊' },
  { id:'magic',       label:'Magic',       emoji:'🧙' },
  { id:'superheroes', label:'Superheroes', emoji:'🦸' },
  { id:'robots',      label:'Robots',      emoji:'🤖' },
  { id:'pirates',     label:'Pirates',     emoji:'🏴‍☠️' },
  { id:'cats',        label:'Cats',        emoji:'🐱' },
  { id:'farm',        label:'Farm',        emoji:'🐄' },
  { id:'cooking',     label:'Cooking',     emoji:'🍳' },
  { id:'forest',      label:'Forest',      emoji:'🌲' },
  { id:'adventure',   label:'Adventure',   emoji:'🗺️' },
];

export default function InterestsPanel({ childId, childName, initialInterests = [], onSaved }) {
  const [selected, setSelected] = useState(new Set(initialInterests));
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else if (next.size < 5) { next.add(id); }
      return next;
    });
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await aiStoryAPI.interests.set(childId, { interests: [...selected] });
      setSaved(true);
      onSaved?.([...selected]);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
    finally { setSaving(false); }
  };

  return (
    <div style={{ background:'white', borderRadius:20, padding:22, boxShadow:'var(--shadow-sm)', marginBottom:16 }}>
      <div style={{ marginBottom:14 }}>
        <h3 style={{ fontWeight:900, fontSize:16, marginBottom:4 }}>🎨 {childName}'s Story Interests</h3>
        <p style={{ fontSize:13, color:'var(--text-muted)', lineHeight:1.45 }}>
          Pick up to 5 topics — the AI will weave these themes into {childName}'s personalised phonics stories.
        </p>
      </div>

      <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
        {PRESET_INTERESTS.map(i => {
          const active = selected.has(i.id);
          return (
            <button key={i.id} onClick={() => toggle(i.id)}
              style={{ padding:'8px 14px', borderRadius:50, border:`2px solid ${active?'#2D6A4F':'#E5E7EB'}`, background:active?'#F0FDF4':'#FAFAF9', color:active?'#2D6A4F':'#6B7280', fontSize:13, fontWeight:active?800:600, cursor:'pointer', fontFamily:'var(--font-body)', display:'flex', alignItems:'center', gap:5, transition:'all 0.15s', opacity:!active&&selected.size>=5?0.4:1 }}>
              <span style={{ fontSize:16 }}>{i.emoji}</span>
              {i.label}
            </button>
          );
        })}
      </div>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <p style={{ fontSize:12, color:'#9CA3AF' }}>{selected.size}/5 selected</p>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {saved && <span style={{ color:'#10B981', fontWeight:700, fontSize:13 }}>✓ Saved!</span>}
          <Button onClick={save} disabled={saving} size="sm">
            {saving ? <><Spinner size={14} color="white" /> Saving…</> : 'Save Interests'}
          </Button>
        </div>
      </div>

      <p style={{ fontSize:11, color:'#D1D5DB', marginTop:10 }}>
        💡 These are used to personalise AI stories. The starred (⭐) theme in the story generator will match {childName}'s interests.
      </p>
    </div>
  );
}
