import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail]   = useState('');
  const [pass,  setPass]    = useState('');
  const [err,   setErr]     = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const nav = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    const res = await login(email, pass);
    setLoading(false);
    if (res.success) nav('/dashboard');
    else setErr(res.message || 'Invalid credentials');
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #F4F6FB 0%, #EEF0FF 100%)',
      padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #5B68F6, #8B5CF6)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, marginBottom: 14, boxShadow: '0 8px 24px rgba(91,104,246,0.3)',
          }}>🦉</div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#111827', marginBottom: 4 }}>Properly Admin</h1>
          <p style={{ fontSize: '0.875rem', color: '#6B7280' }}>Sign in to your admin console</p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: '28px 32px' }}>
          {err && <div className="alert alert-error" style={{ marginBottom: 18 }}>⚠️ {err}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="input-group">
              <label>Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@properly.app"
                required
                autoFocus
              />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input
                type="password"
                value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 4, width: '100%' }}>
              {loading ? '⏳ Signing in…' : 'Sign In →'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.78rem', color: '#9CA3AF', marginTop: 20 }}>
          Properly Ltd · Admin Console v2.0
        </p>
      </div>
    </div>
  );
}
