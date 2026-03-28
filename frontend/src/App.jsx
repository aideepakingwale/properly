/**
 * @file        App.jsx
 * @description Root application router — defines all page routes and authentication guards
 * @module      Router
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - PrivateRoute redirects to /auth when unauthenticated
 *   - PrivateRoute redirects to /setup-child when authenticated but no child profiles exist yet
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e, info) { console.error('[ErrorBoundary]', e, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', background: '#0F0A2E', color: '#FCA5A5', minHeight: '100vh' }}>
          <div style={{ fontSize: 24, marginBottom: 16 }}>💥 Render Error</div>
          <div style={{ color: '#FCD34D', marginBottom: 8 }}>{this.state.error.message}</div>
          <pre style={{ color: '#93C5FD', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {this.state.error.stack}
          </pre>
          <button onClick={() => this.setState({ error: null })}
            style={{ marginTop: 16, padding: '8px 16px', background: '#7C3AED', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import { AuthProvider, useAuth } from './context/AuthContext';
import Landing        from './pages/Landing';
import Auth           from './pages/Auth';
import Home           from './pages/Home';
import ReadingSession from './pages/ReadingSession';
import Shop           from './pages/Shop';
import Trophies       from './pages/Trophies';
import ParentDash     from './pages/ParentDash';
import VerifyEmail    from './pages/VerifyEmail';
import SocialCallback       from './pages/SocialCallback';
import SetupChild          from './pages/SetupChild';
import Pricing              from './pages/Pricing';
import SubscriptionSuccess  from './pages/SubscriptionSuccess';
import Privacy        from './pages/Privacy';
import Terms          from './pages/Terms';
import './index.css';

function PrivateRoute({ children, requireChild = true }) {
  const { user, child, loading } = useAuth();
  if (loading) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:64 }} className="animate-float">🦉</div>
      <p style={{ color:'var(--text-muted)', fontWeight:700 }}>Loading your forest…</p>
    </div>
  );
  if (!user) return <Navigate to="/auth" replace />;
  // If no child profile yet, redirect to setup (except for the setup page itself)
  if (requireChild && !child) return <Navigate to="/setup-child" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/home" replace /> : children;
}

export default function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Public */}
          <Route path="/"              element={<PublicRoute><Landing /></PublicRoute>} />
          <Route path="/auth"          element={<PublicRoute><Auth /></PublicRoute>} />
          <Route path="/verify-email"   element={<VerifyEmail />} />
          <Route path="/social-callback"      element={<SocialCallback />} />
          <Route path="/setup-child"          element={<SetupChild />} />
          <Route path="/pricing"               element={<Pricing />} />
          <Route path="/subscription/success"  element={<SubscriptionSuccess />} />
          <Route path="/privacy"       element={<Privacy />} />
          <Route path="/terms"         element={<Terms />} />

          {/* Protected */}
          <Route path="/home"          element={<PrivateRoute><Home /></PrivateRoute>} />
          <Route path="/read/:storyId" element={<PrivateRoute><ReadingSession /></PrivateRoute>} />
          <Route path="/shop"          element={<PrivateRoute><Shop /></PrivateRoute>} />
          <Route path="/trophies"      element={<PrivateRoute><Trophies /></PrivateRoute>} />
          <Route path="/parent"        element={<PrivateRoute><ParentDash /></PrivateRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ErrorBoundary>
  );
}
