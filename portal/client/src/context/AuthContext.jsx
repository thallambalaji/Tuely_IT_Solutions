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
      const storedToken = localStorage.getItem('tc_token');
      if (!storedToken) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        setUser(data.user);
        if (data.token) {
          localStorage.setItem('tc_token', data.token);
        }
        connectSocket(data.token || storedToken);
      } catch {
        setUser(null);
        localStorage.removeItem('tc_token');
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
      localStorage.setItem('tc_token', data.token);
    }
    connectSocket(data.token);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (_) {}
    localStorage.removeItem('tc_token');
    setUser(null);
    disconnectSocket();
    window.location.href = '/portal/login';
  }, []);

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
