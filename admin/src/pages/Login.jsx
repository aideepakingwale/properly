import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail]   = useState('');
  const [pass, setPass]     = useState('');
  const [err, setErr]       = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();

  const handle = async (e) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      await login(email, pass);
      nav('/dashboard');
    } catch (e) {
      setErr(e.message || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ width:360 }}>
        {/* Header */}
        <div style={{ marginBottom:32, textAlign:'center' }}>
          <div style={{ fontFamily:'var(--font-ui)', fontSize:28, fontWeight:800, color:'var(--accent)', marginBottom:4 }}>
            🦉 PROPERLY
          </div>
          <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:'3px' }}>ADMIN CONSOLE</div>
        </div>

        <form onSubmit={handle} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:28 }}>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:'block', fontSize:10, color:'var(--muted)', letterSpacing:'1px', marginBottom:6 }}>EMAIL</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@properly.app" required />
          </div>
          <div style={{ marginBottom:20 }}>
            <label style={{ display:'block', fontSize:10, color:'var(--muted)', letterSpacing:'1px', marginBottom:6 }}>PASSWORD</label>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" required />
          </div>
          {err && <div style={{ color:'var(--danger)', fontSize:12, marginBottom:14, padding:'8px 10px', background:'rgba(255,68,68,0.08)', borderRadius:'var(--radius)' }}>{err}</div>}
          <button type="submit" className="btn btn-accent" style={{ width:'100%', justifyContent:'center', padding:'10px' }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in →'}
          </button>
        </form>

        <div style={{ marginTop:16, fontSize:11, color:'var(--muted)', textAlign:'center', lineHeight:1.7 }}>
          Requires admin privileges.<br/>
          Set <code style={{ color:'var(--accent)' }}>ADMIN_EMAILS</code> in Render env vars<br/>
          or run: <code style={{ color:'var(--accent2)' }}>UPDATE users SET is_admin=1 WHERE email='you@x.com'</code>
        </div>
      </div>
    </div>
  );
}
