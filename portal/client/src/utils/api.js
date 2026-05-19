import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // Send httpOnly cookies on every request
  headers: { 'Content-Type': 'application/json' },
});

// Auto-redirect to login on 401 (token expired or invalid)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      window.location.href = '/portal/login';
    }
    return Promise.reject(err);
  }
);

export default api;
