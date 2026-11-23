import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('labflow_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);

  const login = async (email, role = 'staff') => {
    try {
      setLoading(true);
      const res = await api.login({ email, role });
      if (res.user) {
        setUser(res.user);
        localStorage.setItem('labflow_user', JSON.stringify(res.user));
        localStorage.setItem('labflow_token', res.token);
      }
      return res;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('labflow_user');
    localStorage.removeItem('labflow_token');
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export default AuthContext;
