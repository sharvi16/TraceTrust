import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);

  // Restore session from localStorage on first load
  useEffect(() => {
    const savedToken = localStorage.getItem('tracetrust_token');
    const savedUser = localStorage.getItem('tracetrust_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  function login(newToken, newUser) {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('tracetrust_token', newToken);
    localStorage.setItem('tracetrust_user', JSON.stringify(newUser));
  }

  function logout() {
    setToken(null);
    setUser(null);
    localStorage.removeItem('tracetrust_token');
    localStorage.removeItem('tracetrust_user');
    window.location.href = '/login';
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
