import React, { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000' });

// Attach JWT to every request automatically
API.interceptors.request.use((config) => {
  const raw = localStorage.getItem('auth');
  if (raw) {
    try {
      const { token } = JSON.parse(raw);
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch { /* ignore */ }
  }
  return config;
});

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    try { return JSON.parse(localStorage.getItem('auth')) || null; }
    catch { return null; }
  });

  const login = useCallback((token, user) => {
    const data = { token, user };
    localStorage.setItem('auth', JSON.stringify(data));
    setAuth(data);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth');
    setAuth(null);
  }, []);

  const hasRole = useCallback((role) => auth?.user?.role === role, [auth]);

  return (
    <AuthContext.Provider value={{ auth, user: auth?.user, login, logout, hasRole, API }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export { API };
