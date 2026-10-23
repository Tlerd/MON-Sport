import type { SessionUser } from '@monsport/shared';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api.ts';
import { disablePush, resyncPush } from '../lib/push.ts';

/** The most that a logout waits for the device to stop Web Push. */
const PUSH_OFF_LIMIT_MS = 5000;

export interface SessionContextValue {
  user: SessionUser | null | undefined;
  setUser: (user: SessionUser | null) => void;
  logout: () => Promise<void>;
  refreshKey: number;
  bumpRefresh: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    api<SessionUser>('/api/auth/me').then(setUser, () => setUser(null));
  }, []);

  // Brief F-014 (AC-22): once for a signed-in user, after a page load or a login.
  const userId = user?.id;
  useEffect(() => {
    if (userId) void resyncPush(userId);
  }, [userId]);

  async function logout() {
    // The device stops Web Push for this user first (AC-20). A failure or a slow answer never blocks the logout.
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([disablePush(), new Promise((resolve) => (timer = setTimeout(resolve, PUSH_OFF_LIMIT_MS)))]);
    clearTimeout(timer);
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
  }

  const bumpRefresh = () => setRefreshKey((n) => n + 1);

  return (
    <SessionContext.Provider value={{ user, setUser, logout, refreshKey, bumpRefresh }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
