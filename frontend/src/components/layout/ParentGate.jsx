import { useState, useMemo } from 'react';
import { Modal, Button } from '../ui';

export default function ParentGate({ onPass, onClose }) {
  const [a, b] = useMemo(() => {
    const x = 3 + Math.floor(Math.random() * 7);
    const y = 3 + Math.floor(Math.random() * 7);
    return [x, y];
  }, []);
  const [ans, setAns] = useState('');
  const [err, setErr] = useState(false);

  const check = () => {
    if (parseInt(ans) === a * b) { onPass(); }
    else { setErr(true); setAns(''); }
  };

  return (
    <Modal onClose={onClose}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 52 }}>👨‍👩‍👧</div>
        <h3 style={{ fontSize: 20, fontWeight: 900, marginTop: 10, marginBottom: 6 }}>Parents Only!</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 18 }}>Solve this maths problem to enter the dashboard:</p>
        <div style={{ background: '#F0FDF4', borderRadius: 16, padding: '16px 22px', marginBottom: 14, fontSize: 28, fontWeight: 900, border: '2px solid #BBF7D0' }}>
          What is {a} × {b}?
        </div>
        <input
          type="number" value={ans}
          onChange={e => { setAns(e.target.value); setErr(false); }}
          onKeyDown={e => e.key === 'Enter' && check()}
          placeholder="Your answer"
          style={{ width: '100%', padding: '13px', border: `2px solid ${err ? 'var(--red)' : 'var(--border)'}`, borderRadius: 14, fontSize: 22, fontWeight: 900, textAlign: 'center', marginBottom: err ? 6 : 14, outline: 'none', fontFamily: 'var(--font-body)', color: 'var(--text)' }}
          onFocus={e => e.target.style.borderColor = 'var(--forest-bright)'}
        />
        {err && <p style={{ color: 'var(--red)', fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Not quite! Try again.</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 50, border: '2px solid var(--border)', background: 'white', color: 'var(--text-muted)', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 14 }}>Cancel</button>
          <Button onClick={check} style={{ flex: 2 }}>Enter Dashboard →</Button>
        </div>
      </div>
    </Modal>
  );
}
