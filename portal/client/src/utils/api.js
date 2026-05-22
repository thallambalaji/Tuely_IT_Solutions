import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://tuely-it-solutions.onrender.com');

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true, // Send httpOnly cookies on every request
});

// Request interceptor to automatically insert JWT and handle FormData Content-Type deletion
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('tc_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.data instanceof FormData) {
      if (config.headers) {
        if (typeof config.headers.delete === 'function') {
          config.headers.delete('Content-Type');
          config.headers.delete('content-type');
        } else {
          delete config.headers['Content-Type'];
          delete config.headers['content-type'];
        }
      }
    }
    return config;
  },
  (err) => Promise.reject(err)
);

// Auto-redirect to login on 401 (token expired or invalid) and clear token
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('tc_token');
      // Prevent infinite reload loop if we are already on the login page
      if (window.location.pathname !== '/portal/login' && window.location.pathname !== '/portal/login/') {
        window.location.href = '/portal/login';
      }
    }
    return Promise.reject(err);
  }
);

/**
 * Returns absolute URL pointing to Render backend, appended with token query parameter.
 */
export const getFullUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;

  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  const token = localStorage.getItem('tc_token');
  const separator = cleanUrl.includes('?') ? '&' : '?';
  const urlWithToken = token ? `${cleanUrl}${separator}token=${token}` : cleanUrl;

  return `${API_BASE_URL}${urlWithToken}`;
};

export default api;
