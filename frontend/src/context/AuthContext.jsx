import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, progressAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null);
  const [child, setChild]       = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [token, setToken]       = useState(() => localStorage.getItem('properly_token'));

  const loadProgress = useCallback(async (childId) => {
    if (!childId) return;
    try {
      const res = await progressAPI.get(childId);
      if (res.success) setProgress(res.data);
    } catch {}
  }, []);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      const t = localStorage.getItem('properly_token');
      if (!t) { setLoading(false); return; }
      try {
        const res = await authAPI.me();
        if (res.success) {
          setUser(res.data.user);
          const savedChildId = localStorage.getItem('properly_child_id');
          const kids = res.data.children || [];
          const activeChild = kids.find(c => c.id === savedChildId) || kids[0];
          if (activeChild) {
            setChild(activeChild);
            await loadProgress(activeChild.id);
          }
        }
      } catch { logout(); }
      finally { setLoading(false); }
    })();
  }, []);

  // Listen for forced logout
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    if (!res.success) {
      const err = new Error(res.message);
      err.unverified = res.unverified;
      err.email = res.email;
      throw err;
    }
    localStorage.setItem('properly_token', res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
    const first = res.data.children?.[0];
    if (first) {
      setChild(first);
      localStorage.setItem('properly_child_id', first.id);
      await loadProgress(first.id);
    }
    return res.data;
  };

  const register = async (email, password, childName, phase) => {
    const res = await authAPI.register({ email, password, childName, phase });
    if (!res.success) throw new Error(res.message);
    // If email verification is required, res.data.token will be undefined
    // Just return the data — Auth.jsx handles the check-email screen
    if (res.data.token) {
      // Email not configured — token provided, log straight in
      localStorage.setItem('properly_token', res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      if (res.data.child) {
        setChild(res.data.child);
        localStorage.setItem('properly_child_id', res.data.child.id);
        await loadProgress(res.data.child.id);
      }
    }
    return res.data; // Auth.jsx checks res.requiresVerification
  };

  const loginDirect = async (jwtToken, userData, firstChild) => {
    localStorage.setItem('properly_token', jwtToken);
    setToken(jwtToken);
    setUser(userData);
    if (firstChild) {
      setChild(firstChild);
      localStorage.setItem('properly_child_id', firstChild.id);
      await loadProgress(firstChild.id);
    }
  };

  const logout = () => {
    localStorage.removeItem('properly_token');
    localStorage.removeItem('properly_child_id');
    setToken(null); setUser(null); setChild(null); setProgress(null);
  };

  const refreshProgress = () => loadProgress(child?.id);

  const updateChildLocally = (updates) => {
    setChild(prev => prev ? { ...prev, ...updates } : prev);
    setProgress(prev => prev ? { ...prev, child: { ...prev.child, ...updates } } : prev);
  };

  return (
    <AuthContext.Provider value={{
      user, child, progress, loading, token,
      login, register, logout, loginDirect,
      refreshProgress, updateChildLocally, loadProgress,
      setChild, setProgress,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
