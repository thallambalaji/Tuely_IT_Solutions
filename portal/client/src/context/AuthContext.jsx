import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { connectSocket, disconnectSocket } from '../socket/socket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('tc_dark') === 'true');

  // Apply dark mode to <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('tc_dark', darkMode);
  }, [darkMode]);

  // Check existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const storedToken = sessionStorage.getItem('tc_token');
      if (!storedToken) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        setUser(data.user);
        if (data.token) {
          sessionStorage.setItem('tc_token', data.token);
          if (!sessionStorage.getItem('tc_token_expires_at')) {
            sessionStorage.setItem('tc_token_expires_at', String(Date.now() + 60 * 60 * 1000));
          }
        }
        connectSocket(data.token || storedToken);
      } catch {
        setUser(null);
        sessionStorage.removeItem('tc_token');
        sessionStorage.removeItem('tc_token_expires_at');
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  const login = useCallback(async (companyEmail, password) => {
    const { data } = await api.post('/auth/login', { companyEmail, password });
    setUser(data.user);
    if (data.token) {
      sessionStorage.setItem('tc_token', data.token);
      sessionStorage.setItem('tc_token_expires_at', String(Date.now() + 60 * 60 * 1000));
    }
    connectSocket(data.token);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (_) {}
    sessionStorage.removeItem('tc_token');
    sessionStorage.removeItem('tc_token_expires_at');
    setUser(null);
    disconnectSocket();
    window.location.href = '/portal/login';
  }, []);

  // Auto-logout check interval (absolute 1-hour session timeout)
  useEffect(() => {
    const interval = setInterval(() => {
      const expiresAt = sessionStorage.getItem('tc_token_expires_at');
      if (expiresAt && Date.now() > Number(expiresAt) && user) {
        console.log('Session expired. Logging out.');
        logout();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [user, logout]);

  const toggleDark = useCallback(() => setDarkMode(d => !d), []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, darkMode, toggleDark }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

export default AuthContext;
