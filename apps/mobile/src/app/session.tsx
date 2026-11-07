import { api, ApiError } from '@monsport/client';
import type { SessionUser } from '@monsport/shared';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface SessionContextType {
  user: SessionUser | null | undefined;
  setUser: (user: SessionUser | null) => void;
  login: (user: SessionUser) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  loading: boolean;
}

const SessionContext = createContext<SessionContextType | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  const fetchMe = async () => {
    try {
      const me = await api<SessionUser>('/api/auth/me');
      setUser(me);
    } catch (err) {
      // A failed reply that is not a 401 keeps a user that login() just set (QA D-4).
      if (err instanceof ApiError && err.status === 401) setUser(null);
      else setUser((prev) => prev ?? null);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  const login = (newUser: SessionUser) => {
    setUser(newUser);
  };

  const logout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      // The cookie may still live: keep the user and let the caller show the error (QA D-2).
      if (!(err instanceof ApiError) || err.status >= 500) throw err;
    }
    setUser(null);
  };

  return (
    <SessionContext.Provider
      value={{
        user,
        setUser,
        login,
        logout,
        refresh: fetchMe,
        loading: user === undefined,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextType {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
