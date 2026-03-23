/**
 * API client — Axios with JWT interceptors
 *
 * BASE URL logic:
 *   Local dev  : Vite dev-server proxies /api → localhost:3001  (no env needed)
 *   Render prod: VITE_API_URL is injected at build time, e.g.
 *                https://properly-api.onrender.com/api
 */
import axios from 'axios';

// __API_URL__ is replaced at build time by Vite define (see vite.config.js)
// Falls back to /api for local dev (proxied by Vite)
const BASE = (typeof __API_URL__ !== 'undefined' ? __API_URL__ : null)
  || import.meta.env.VITE_API_URL
  || '/api';

const api = axios.create({ baseURL: BASE, timeout: 20000 });

// Attach JWT
api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('properly_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// Global 401 → force logout
api.interceptors.response.use(
  r => r.data,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('properly_token');
      localStorage.removeItem('properly_child_id');
      window.dispatchEvent(new Event('auth:logout'));
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
  feedback: (word, sentence, phase) => api.post('/ai/feedback', { word, sentence, phase }),
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
    return api.post('/speech/assess', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 25000,
    });
  },
};

export default api;

// ── AI STORY GENERATION ───────────────────────────────────────
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

  // Reading session lifecycle
  startSession:    (childId, storyId) => api.post(`/children/${childId}/ai-stories/${storyId}/session`),
  submitPage:      (childId, data) => api.post(`/children/${childId}/ai-stories/session/page`, data),
  completeSession: (childId, data) => api.post(`/children/${childId}/ai-stories/session/complete`, data),

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
