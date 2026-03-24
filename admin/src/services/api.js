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
    if (err.response?.status === 401 || err.response?.status === 403) {
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
};

export default api;
