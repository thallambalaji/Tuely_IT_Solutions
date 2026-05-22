import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // Send httpOnly cookies on every request
});

// Request interceptor to automatically delete default Content-Type when sending FormData
api.interceptors.request.use(
  (config) => {
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

// Auto-redirect to login on 401 (token expired or invalid)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Prevent infinite reload loop if we are already on the login page
      if (window.location.pathname !== '/portal/login' && window.location.pathname !== '/portal/login/') {
        window.location.href = '/portal/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
