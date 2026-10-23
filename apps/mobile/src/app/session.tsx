import { api } from '@monsport/client';
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
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  const login = (newUser: SessionUser) => {
    setUser(newUser);
  };

  const logout = async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
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
