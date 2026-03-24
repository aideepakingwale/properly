/**
 * @file        AuthContext.jsx
 * @description Global authentication context — user session, active child selection, multi-child state and auth actions
 * @module      Auth Context
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - kids (internal) exposed as children in context value to avoid JSX prop name collision
 *   - switchChild() updates active child and reloads their progress
 *   - backupNow is NOT called here — handled server-side after critical writes
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI, progressAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]         = useState(null);
  const [child, setChild]       = useState(null);
  const [kids, setKids] = useState([]);
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
          setKids(kids);
          const activeChild = kids.find(c => c.id === savedChildId) || kids[0];
          if (activeChild) {
            setChild(activeChild);
            await loadProgress(activeChild.id);
          }
        }
      } catch {
        // Token invalid or server down — clear in-memory state only
        // Leave localStorage token intact so user can re-login (not re-register)
        setUser(null); setChild(null); setKids([]); setProgress(null);
        setToken(null);
        setLoading(false);
      }
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
    const kids = res.data.children || [];
    setKids(kids);
    const first = kids[0];
    if (first) {
      setChild(first);
      localStorage.setItem('properly_child_id', first.id);
      await loadProgress(first.id);
    }
    return res.data;
  };

  const register = async (email, password) => {
    const res = await authAPI.register({ email, password });
    if (!res.success) throw new Error(res.message);
    // If email not configured — token provided, log straight in
    if (res.data.token) {
      localStorage.setItem('properly_token', res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      // No child yet — parent adds kids after logging in
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

  // Switch active child (for multi-child families)
  const switchChild = async (childId) => {
    const found = kids.find(c => c.id === childId);
    if (!found) return;
    setChild(found);
    localStorage.setItem('properly_child_id', found.id);
    await loadProgress(found.id);
  };

  // Called after adding a new child via KidsManager
  const addChildToState = (newChild) => {
    setKids(prev => [...prev, newChild]);
    if (!child) {
      setChild(newChild);
      localStorage.setItem('properly_child_id', newChild.id);
    }
  };

  const removeChildFromState = (childId) => {
    setKids(prev => prev.filter(c => c.id !== childId));
    if (child?.id === childId) {
      const remaining = kids.filter(c => c.id !== childId);
      const next = remaining[0] || null;
      setChild(next);
      if (next) localStorage.setItem('properly_child_id', next.id);
      else      localStorage.removeItem('properly_child_id');
    }
  };

  const logout = () => {
    localStorage.removeItem('properly_token');
    localStorage.removeItem('properly_child_id');
    // NOTE: we intentionally do NOT clear any user-identifying data
    // so the login form can pre-fill the email if stored
    setToken(null); setUser(null); setChild(null); setProgress(null);
  };

  const refreshProgress = () => loadProgress(child?.id);

  const updateChildLocally = (updates) => {
    setChild(prev => prev ? { ...prev, ...updates } : prev);
    setProgress(prev => prev ? { ...prev, child: { ...prev.child, ...updates } } : prev);
  };

  return (
    <AuthContext.Provider value={{
      user, child, children: kids, progress, loading, token,
      login, register, logout, loginDirect,
      switchChild, addChildToState, removeChildFromState,
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
