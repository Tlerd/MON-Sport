import { api, ApiError, disablePush, resyncPush } from '@monsport/client';
import type { SessionUser } from '@monsport/shared';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const PUSH_OFF_LIMIT_MS = 5000;

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
      if (err instanceof ApiError && err.status === 401) setUser(null);
      else setUser((prev) => prev ?? null);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  const userId = user?.id;
  useEffect(() => {
    if (userId) void resyncPush(userId);
  }, [userId]);

  const login = (newUser: SessionUser) => {
    setUser(newUser);
  };

  const logout = async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      disablePush().catch(() => undefined),
      new Promise((resolve) => {
        timer = setTimeout(resolve, PUSH_OFF_LIMIT_MS);
      }),
    ]);
    clearTimeout(timer);
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch (err) {
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
