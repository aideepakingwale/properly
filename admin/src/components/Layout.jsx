import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/dashboard', label: 'Dashboard',  icon: '▦' },
  { to: '/users',     label: 'Users',      icon: '◉' },
  { to: '/shop',      label: 'Gift Shop',  icon: '◈' },
  { to: '/stories',   label: 'Stories',    icon: '◆' },
  { to: '/analytics', label: 'Analytics',  icon: '◳' },
  { to: '/config',    label: 'Config',     icon: '◎' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const handleLogout = () => { logout(); nav('/login'); };

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      {/* Sidebar */}
      <aside style={{ width:210, background:'var(--surface)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0 }}>
        {/* Logo */}
        <div style={{ padding:'20px 18px 16px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ fontFamily:'var(--font-ui)', fontSize:18, fontWeight:800, color:'var(--accent)', letterSpacing:'-0.5px' }}>
            🦉 PROPERLY
          </div>
          <div style={{ fontSize:9, color:'var(--muted)', letterSpacing:'2px', marginTop:2 }}>ADMIN CONSOLE</div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'12px 0', overflowY:'auto' }}>
          {NAV.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 18px',
              color: isActive ? 'var(--accent)' : 'var(--muted)',
              background: isActive ? 'rgba(0,229,160,0.06)' : 'transparent',
              borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              textDecoration: 'none',
              fontSize: 12,
              fontWeight: isActive ? 700 : 400,
              transition: 'all 0.12s',
            })}>
              <span style={{ fontFamily:'monospace', fontSize:14, lineHeight:1 }}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div style={{ padding:'12px 18px', borderTop:'1px solid var(--border)' }}>
          <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>Signed in as</div>
          <div style={{ fontSize:11, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:8 }}>
            {user?.email}
          </div>
          <button onClick={handleLogout} className="btn btn-ghost btn-sm" style={{ width:'100%', justifyContent:'center' }}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex:1, overflow:'auto', background:'var(--bg)' }}>
        <Outlet />
      </main>
    </div>
  );
}
