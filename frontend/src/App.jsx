import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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
import Pricing              from './pages/Pricing';
import SubscriptionSuccess  from './pages/SubscriptionSuccess';
import Privacy        from './pages/Privacy';
import Terms          from './pages/Terms';
import './index.css';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:64 }} className="animate-float">🦉</div>
      <p style={{ color:'var(--text-muted)', fontWeight:700 }}>Loading your forest…</p>
    </div>
  );
  return user ? children : <Navigate to="/auth" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/home" replace /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Public */}
          <Route path="/"              element={<PublicRoute><Landing /></PublicRoute>} />
          <Route path="/auth"          element={<PublicRoute><Auth /></PublicRoute>} />
          <Route path="/verify-email"   element={<VerifyEmail />} />
          <Route path="/social-callback"      element={<SocialCallback />} />
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
  );
}
