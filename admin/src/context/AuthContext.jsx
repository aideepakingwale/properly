/**
 * @file        AuthContext.jsx
 * @description Admin authentication context — login, logout and session restore with isAdmin check
 * @module      Admin Auth
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - Rejects login if user exists but isAdmin is false — shows specific error message
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) { setLoading(false); return; }
    authAPI.me().then(r => {
      if (r.success && r.data.user?.isAdmin) {
        setUser(r.data.user);
      } else {
        localStorage.removeItem('admin_token');
      }
    }).catch(() => localStorage.removeItem('admin_token'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const res = await authAPI.login(email, password);
    if (!res.success) throw new Error(res.message || 'Login failed');
    const userData = res.data?.user;
    if (!userData?.isAdmin) throw new Error('This account does not have admin access.');
    localStorage.setItem('admin_token', res.data.token);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
