import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, post, tokens } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!tokens.access) {
      setLoading(false);
      return;
    }
    try {
      const data = await api('/auth/me');
      setUser(data.user);
      setPermissions(data.permissions || {});
    } catch {
      tokens.clear();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = async (email, password) => {
    const data = await post('/auth/login', { email, password });
    tokens.set(data);
    await loadMe();
    return data.user;
  };

  const logout = async () => {
    try {
      await post('/auth/logout', { refreshToken: tokens.refresh });
    } catch {
      /* ignore */
    }
    tokens.clear();
    setUser(null);
    setPermissions({});
  };

  const can = (moduleCode, action) => Boolean(permissions[moduleCode]?.[action]);

  return (
    <AuthContext.Provider value={{ user, permissions, loading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
