/**
 * @file        api.js
 * @description Admin Axios client — auth interceptor, all admin API calls and live test endpoints
 * @module      Admin API
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - 403 during login attempts is NOT redirected — surface error to login form instead
 *   - Token stored as admin_token (separate from properly_token used by parent app)
 */

import axios from 'axios';

const BASE = (typeof __API_URL__ !== 'undefined' && __API_URL__)
  ? `https://${__API_URL__}/api`
  : '/api';

const api = axios.create({ baseURL: BASE, timeout: 30000 });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('admin_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});
api.interceptors.response.use(
  r => r.data,
  err => {
    // Only auto-redirect on 401 from authenticated routes (token expired)
    // Do NOT redirect on 403 from /auth/login — that's a valid error (unverified, not admin)
    const isLoginAttempt = err.config?.url?.includes('/auth/login');
    if (err.response?.status === 401 && !isLoginAttempt) {
      localStorage.removeItem('admin_token');
      window.location.href = '/login';
    }
    return Promise.reject(err.response?.data || { message: err.message });
  }
);

export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  me:    ()                 => api.get('/auth/me'),
};

export const adminAPI = {
  dashboard:  ()             => api.get('/admin/dashboard'),
  users:      (params)       => api.get('/admin/users', { params }),
  user:       (id)           => api.get(`/admin/users/${id}`),
  updateUser: (id, data)     => api.patch(`/admin/users/${id}`, data),
  deleteUser: (id)           => api.delete(`/admin/users/${id}`),
  shop:       ()             => api.get('/admin/shop'),
  createItem: (data)         => api.post('/admin/shop', data),
  updateItem: (id, data)     => api.patch(`/admin/shop/${id}`, data),
  deleteItem: (id)           => api.delete(`/admin/shop/${id}`),
  stories:    ()             => api.get('/admin/stories'),
  aiStats:    ()             => api.get('/admin/stories/ai-stats'),
  analytics:  ()             => api.get('/admin/analytics'),
  config:     ()             => api.get('/admin/config'),
  r2Status:   ()             => api.get('/admin/r2-status'),
  reports:    (status)       => api.get('/admin/reports', { params: { status } }),
  reviewReport: (id, body)   => api.post(`/admin/reports/${id}/review`, body),
  bookDebugLog: (bookId)     => api.get(`/books/${bookId}/debug`),
  books:        ()           => api.get('/admin/books'),
  bookLogs:     (bookId)     => api.get(`/admin/books/${bookId}/logs`),
  bookCredits:()             => api.get('/admin/books/credits'),
  addBookCredits: (userId, credits, reason) => api.post(`/admin/users/${userId}/credits`, { credits, reason }),
  triggerBackup: ()          => api.post('/admin/r2-backup'),
  debugEnv:     ()          => api.get('/admin/debug/env'),
  getDebugMode: ()          => api.get('/admin/debug-mode'),
  setDebugMode: (enabled)   => api.post('/admin/debug-mode', { enabled }),
  test: {
    azure:  () => api.post('/admin/test/azure'),
    gemini: () => api.post('/admin/test/gemini'),
    groq:   () => api.post('/admin/test/groq'),
    resend: () => api.post('/admin/test/resend'),
    stripe:       () => api.post('/admin/test/stripe'),
    pollinations:    () => api.post('/admin/test/pollinations'),
    audioPipeline:   () => api.post('/admin/test/audio-pipeline'),
  },
};

export default api;
