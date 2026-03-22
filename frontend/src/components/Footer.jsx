import { useNavigate, useLocation } from 'react-router-dom';

const APP_VERSION = '2.0.0';
const year = new Date().getFullYear();

export default function Footer({ dark = false }) {
  const nav = useNavigate();
  const loc = useLocation();
  const isAuthPage = ['/auth', '/'].includes(loc.pathname) ||
    loc.pathname.startsWith('/verify') || loc.pathname.startsWith('/privacy') ||
    loc.pathname.startsWith('/terms');

  const textColor  = dark ? 'rgba(255,255,255,0.35)' : '#9CA3AF';
  const linkColor  = dark ? 'rgba(255,255,255,0.5)'  : '#6B7280';
  const borderColor= dark ? 'rgba(255,255,255,0.08)' : '#E5E7EB';

  return (
    <footer style={{
      borderTop: `1px solid ${borderColor}`,
      padding: '16px 20px',
      textAlign: 'center',
      fontFamily: 'var(--font-body)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>🦉</span>
        <span style={{ fontSize: 12, color: textColor, fontWeight: 600 }}>
          Properly — AI Phonics Tutor
        </span>
        <span style={{ fontSize: 11, color: textColor, background: dark ? 'rgba(255,255,255,0.07)' : '#F3F4F6', borderRadius: 50, padding: '1px 7px' }}>
          v{APP_VERSION}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <button onClick={() => nav('/privacy')} style={{ background: 'none', border: 'none', color: linkColor, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)', textDecoration: 'underline', padding: 0 }}>
          Privacy Policy
        </button>
        <span style={{ color: textColor, fontSize: 11 }}>·</span>
        <button onClick={() => nav('/terms')} style={{ background: 'none', border: 'none', color: linkColor, fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-body)', textDecoration: 'underline', padding: 0 }}>
          Terms &amp; Conditions
        </button>
        <span style={{ color: textColor, fontSize: 11 }}>·</span>
        <a href="mailto:support@properly.app" style={{ color: linkColor, fontSize: 12, textDecoration: 'underline' }}>
          Contact
        </a>
      </div>

      <p style={{ margin: 0, fontSize: 11, color: textColor }}>
        © {year} Deepak Ingwale. All rights reserved.
      </p>
    </footer>
  );
}
