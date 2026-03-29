/**
 * @file        Layout.jsx
 * @description Admin shell — responsive sidebar + top bar
 */
import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = [
  { to: '/dashboard', label: 'Dashboard',  icon: '📊' },
  { to: '/users',     label: 'Users',      icon: '👥' },
  { to: '/books',     label: 'Books',      icon: '📚' },
  { to: '/stories',   label: 'AI Stories', icon: '✨' },
  { to: '/shop',      label: 'Gift Shop',  icon: '🛍️' },
  { to: '/analytics', label: 'Analytics',  icon: '📈' },
  { to: '/reports',   label: 'Reports',    icon: '🚩' },
  { to: '/config',    label: 'Config',     icon: '⚙️' },
];

const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/users': 'Users',
  '/books': 'Books',
  '/stories': 'AI Stories',
  '/shop': 'Gift Shop',
  '/analytics': 'Analytics',
  '/reports': 'Reports',
  '/config': 'Config',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => { logout(); nav('/login'); };
  const pageTitle = PAGE_TITLES[loc.pathname] || PAGE_TITLES[Object.keys(PAGE_TITLES).find(k => loc.pathname.startsWith(k))] || 'Admin';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`layout-sidebar ${sidebarOpen ? 'open' : ''}`} style={{
        width: 'var(--sidebar-w)',
        background: 'var(--sidebar-bg)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        overflowY: 'auto',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg, #5B68F6, #8B5CF6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, flexShrink: 0,
            }}>🦉</div>
            <div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.2px' }}>Properly</div>
              <div style={{ fontSize: 9, color: 'var(--sidebar-muted)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Admin Console</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 10px', overflowY: 'auto' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--sidebar-muted)', letterSpacing: '1.2px', textTransform: 'uppercase', padding: '12px 8px 6px' }}>Navigation</div>
          {NAV.map(({ to, label, icon }) => (
            <NavLink key={to} to={to}
              onClick={() => setSidebarOpen(false)}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 10px',
                color: isActive ? '#fff' : 'var(--sidebar-text)',
                background: isActive ? 'rgba(91,104,246,0.25)' : 'transparent',
                borderRadius: 8,
                marginBottom: 2,
                textDecoration: 'none',
                fontSize: 13.5,
                fontWeight: isActive ? 600 : 400,
                transition: 'all 0.12s',
                borderLeft: isActive ? '3px solid var(--sidebar-active)' : '3px solid transparent',
              })}
              onMouseEnter={e => { if (!e.currentTarget.style.background.includes('0.25')) e.currentTarget.style.background = 'var(--sidebar-hover)'; }}
              onMouseLeave={e => { if (!e.currentTarget.style.background.includes('0.25')) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ width: 20, textAlign: 'center', fontSize: 15 }}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div style={{ padding: '12px 14px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'linear-gradient(135deg, #5B68F6, #8B5CF6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, color: '#fff', fontWeight: 700, flexShrink: 0,
            }}>
              {(user?.email?.[0] || 'A').toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: '#fff', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email?.split('@')[0]}
              </div>
              <div style={{ fontSize: 10, color: 'var(--sidebar-muted)' }}>Administrator</div>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-ghost btn-sm" style={{
            width: '100%',
            color: 'var(--sidebar-text)',
            borderColor: 'rgba(255,255,255,0.12)',
            fontSize: 12,
          }}>
            ↩ Sign out
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', marginLeft: 'var(--sidebar-w)' }}>

        {/* Top bar */}
        <header style={{
          height: 56,
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          gap: 16,
          flexShrink: 0,
          position: 'sticky', top: 0, zIndex: 50,
          boxShadow: '0 1px 3px rgba(17,24,39,0.04)',
        }}>
          {/* Mobile hamburger */}
          <button
            className="menu-toggle"
            onClick={() => setSidebarOpen(true)}
            style={{
              display: 'none', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, border: '1.5px solid var(--border)',
              borderRadius: 8, background: 'transparent', cursor: 'pointer',
              fontSize: 16, color: 'var(--text-2)',
            }}
          >☰</button>

          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', flex: 1 }}>{pageTitle}</h2>

          {/* Header right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              height: 28, background: 'var(--accent-light)', color: '#065F46',
              borderRadius: 50, padding: '0 10px', fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
              Live
            </div>
            <a
              href="https://properly-web.onrender.com"
              target="_blank"
              rel="noreferrer"
              style={{
                height: 32, border: '1.5px solid var(--border)', borderRadius: 8,
                padding: '0 12px', fontSize: 12, fontWeight: 600, color: 'var(--text-2)',
                display: 'flex', alignItems: 'center', gap: 6,
                textDecoration: 'none', background: 'var(--surface-2)',
                transition: 'all 0.15s',
              }}
            >
              🌐 View App ↗
            </a>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}>
          <Outlet />
        </main>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .layout-sidebar { position: fixed !important; }
          div[style*="margin-left: var(--sidebar-w)"] { margin-left: 0 !important; }
        }
      `}</style>
    </div>
  );
}
