/**
 * @file        api.js
 * @description Axios HTTP client — base config, JWT interceptor, and typed API namespaces for every backend resource
 * @module      API Client
 *
 * @project     Properly — AI Phonics Tutor
 * @authors     Deepak Ingwale, Mahima Verma
 * @copyright   2026 Properly. All rights reserved.
 * @license     Proprietary
 *
 * @remarks
 *   - 401 interceptor only triggers auth:logout for /auth/me and /auth/login — not for resource-level 401s
 *   - All responses are unwrapped to r.data by the success interceptor
 */

import axios from 'axios';

// __API_URL__ is replaced at build time by Vite define (see vite.config.js)
// Falls back to /api for local dev (proxied by Vite)
function resolveApiBase() {
  const raw = (typeof __API_URL__ !== 'undefined' ? __API_URL__ : null)
    || import.meta.env.VITE_API_URL
    || '/api';
  // Render fromService:host gives "hostname.onrender.com" without protocol or /api
  // Normalise: ensure https:// prefix and /api suffix
  if (!raw || raw === '/api') return '/api';
  let url = raw;
  if (!url.startsWith('http')) url = 'https://' + url;
  if (!url.endsWith('/api')) url = url.replace(/\/$/, '') + '/api';
  return url;
}
const BASE = resolveApiBase();

const api = axios.create({ baseURL: BASE, timeout: 20000 });

// Attach JWT
api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('properly_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// Global 401 handler
// Only dispatches logout if the token is genuinely invalid (not just a child-level 403)
// Keeps localStorage intact so users can re-login without re-registering
let _logoutDispatched = false;
api.interceptors.response.use(
  r => r.data,
  err => {
    if (err.response?.status === 401) {
      const url = err.config?.url || '';
      // Only force logout for auth-level 401s, not per-resource ones
      const isAuthRoute = url.includes('/auth/me') || url.includes('/auth/login');
      if (isAuthRoute && !_logoutDispatched) {
        _logoutDispatched = true;
        // Keep the token in localStorage — just signal the app to show login screen
        // User can log in again without losing their account
        window.dispatchEvent(new Event('auth:logout'));
        // Allow dispatching again after a short delay (e.g. after re-login)
        setTimeout(() => { _logoutDispatched = false; }, 5000);
      }
    }
    return Promise.reject(err.response?.data || { message: err.message || 'Network error' });
  }
);

// ── AUTH ─────────────────────────────────────────────────────
export const authAPI = {
  register:           d       => api.post('/auth/register', d),  // { email, password } only
  login:              d       => api.post('/auth/login', d),
  me:                 ()      => api.get('/auth/me'),
  verifyEmail:        (token) => api.get(`/auth/verify-email?token=${token}`),
  resendVerification: (email) => api.post('/auth/resend-verification', { email }),
  socialStatus:       ()      => api.get('/auth/social/status'),
};

// ── SOCIAL AUTH URLs ──────────────────────────────────────────
// These redirect the browser to the backend OAuth flow
// BASE must be the API base (without /api suffix for redirects)
const OAUTH_BASE = (BASE.endsWith('/api') ? BASE.slice(0, -4) : BASE);
export const socialAuth = {
  googleUrl:   () => `${OAUTH_BASE}/api/auth/google`,
  facebookUrl: () => `${OAUTH_BASE}/api/auth/facebook`,
  redirectToGoogle:   () => { window.location.href = socialAuth.googleUrl(); },
  redirectToFacebook: () => { window.location.href = socialAuth.facebookUrl(); },
};

// ── CHILDREN MANAGEMENT ─────────────────────────────────────
export const childrenAPI = {
  list:   ()           => api.get('/children'),
  add:    (data)       => api.post('/children', data),
  update: (id, data)   => api.patch(`/children/${id}`, data),
  remove: (id)         => api.delete(`/children/${id}`),
};

// ── STORIES ──────────────────────────────────────────────────
export const storyAPI = {
  list:   (phase, childId) => api.get('/stories', { params: { phase, childId } }),
  get:    (id)             => api.get(`/stories/${id}`),
  phases: ()               => api.get('/phases'),
};

// ── PROGRESS ─────────────────────────────────────────────────
export const progressAPI = {
  get:             (cid)      => api.get(`/children/${cid}/progress`),
  updateChild:     (cid, d)   => api.patch(`/children/${cid}`, d),
  startSession:    (cid, sid, storyType='static') => api.post(`/children/${cid}/sessions`, { storyId: sid, storyType }),
  submitPage:      (cid, d)   => api.post(`/children/${cid}/sessions/page`, d),
  completeSession: (cid, d)   => api.post(`/children/${cid}/sessions/complete`, d),
  upsertGoal:      (cid, d)   => api.put(`/children/${cid}/goal`, d),
  deleteGoal:      (cid)      => api.delete(`/children/${cid}/goal`),
};

// ── SHOP ─────────────────────────────────────────────────────
export const shopAPI = {
  items: (cat) => api.get('/shop/items', { params: { category: cat } }),
  owned: (cid) => api.get(`/children/${cid}/shop/owned`),
  buy:   (cid, itemId) => api.post(`/children/${cid}/shop/buy`, { itemId }),
};

// ── AI ───────────────────────────────────────────────────────
export const aiAPI = {
  feedback: (word, sentence, phase, worstPhoneme) => api.post('/ai/feedback', { word, sentence, phase, worstPhoneme }),
};

// ── SPEECH ───────────────────────────────────────────────────
export const speechAPI = {
  status: () => api.get('/speech/status'),
  token:  () => api.get('/speech/token'),
  assess: (audioBlob, referenceText, transcript = null) => {
    const form = new FormData();
    form.append('referenceText', referenceText);
    if (audioBlob) {
      const ext = audioBlob.type?.includes('webm') ? 'webm'
                : audioBlob.type?.includes('ogg')  ? 'ogg' : 'wav';
      form.append('audio', audioBlob, `rec.${ext}`);
    }
    if (transcript) form.append('transcript', transcript);
    // DO NOT set Content-Type manually — Axios must auto-set it with the
    // multipart boundary: 'multipart/form-data; boundary=----WebKitFormBoundaryXXX'
    // Without the boundary, multer cannot parse the body and req.file is undefined.
    return api.post('/speech/assess', form, { timeout: 25000 });
  },
};

export default api;

// ── AI STORY GENERATION ───────────────────────────────────────
export const reportAPI = {
  submit:   (payload)  => api.post('/reports', payload),
  myReports: ()        => api.get('/reports/mine'),
};

export const bookAPI = {
  getCredits: ()                   => api.get('/books/credits'),
  listForChild: (childId)          => api.get(`/books/child/${childId}`),
  getBook: (bookId)                => api.get(`/books/${bookId}`),
  createBook: (aiStoryId, childId) => api.post('/books', { aiStoryId, childId }),
  deleteBook: (bookId)             => api.delete(`/books/${bookId}`),
  orderPrint: (bookId, address)    => api.post(`/books/${bookId}/order-print`, address),
  retryBook:  (bookId)             => api.post(`/books/${bookId}/retry`),
  getLog:     (bookId)             => api.get(`/books/${bookId}/log`),   // generation steps
};

export const aiStoryAPI = {
  // Batch generation — generates 3-5 stories in one AI call
  generateBatch: (childId, opts) => api.post(`/children/${childId}/ai-stories/batch`, opts),
  // Legacy single-story alias (uses batch size 1 internally)
  generate: (childId, opts) => api.post(`/children/${childId}/ai-stories/batch`, { ...opts, count:1 }),

  // Story library
  list:     (childId, params) => api.get(`/children/${childId}/ai-stories`, { params }),
  get:      (childId, storyId) => api.get(`/children/${childId}/ai-stories/${storyId}`),
  delete:   (childId, storyId) => api.delete(`/children/${childId}/ai-stories/${storyId}`),

  // Progress tracking
  progress: (childId) => api.get(`/children/${childId}/ai-stories/progress`),

  // Interests
  interests: {
    get: (childId) => api.get(`/children/${childId}/interests`),
    set: (childId, data) => api.put(`/children/${childId}/interests`, data),
  },

  // Struggle words (spaced repetition)
  struggles: {
    record: (childId, data) => api.post(`/children/${childId}/struggles`, data),
    get:    (childId) => api.get(`/children/${childId}/struggles`),
  },

  // Meta
  themes: () => api.get('/ai-stories/themes'),
  status: () => api.get('/ai-stories/status'),
};
