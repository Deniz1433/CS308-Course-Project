// frontend/src/middleware/SessionManager.js
import React, { createContext, useState, useEffect } from 'react';

export const SessionContext = createContext(null);

export const SessionProvider = ({ children }) => {
  // 1) read existing user from localStorage immediately
  const [user, setUser] = useState(() => {
    try {
      const s = localStorage.getItem('user');
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(!user); 
  // only loading=true if we have no local user

  useEffect(() => {
    if (user) { 
      // we already have a cached user, skip network check
      setLoading(false);
      return;
    }
    // otherwise fetch session once
    (async () => {
      try {
        const res = await fetch('/api/session', { credentials: 'include' });
        if (res.ok) {
          const { user } = await res.json();
          setUser(user);
          localStorage.setItem('user', JSON.stringify(user));
        } else {
          localStorage.removeItem('user');
        }
      } catch (e) {
        console.error('Session check failed:', e);
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = (u) => {
    setUser(u);
    localStorage.setItem('user', JSON.stringify(u));
  };

  const logout = async () => {
    await fetch('/api/logout', {
      method: 'POST',
      credentials: 'include'
    });
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <SessionContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </SessionContext.Provider>
  );
};
