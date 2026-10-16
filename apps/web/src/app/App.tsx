import type { SessionUser } from '@monsport/shared';
import { useEffect, useState } from 'react';
import { LoginForm } from '../features/auth/LoginForm.tsx';
import { BookingForm } from '../features/bookings/BookingForm.tsx';
import { MyBookings } from '../features/bookings/MyBookings.tsx';
import { OwnerRequests } from '../features/bookings/OwnerRequests.tsx';
import { api } from '../lib/api.ts';

/** Composes the features by role. An admin has no screen in F-002. */
export function App() {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [booked, setBooked] = useState(0);

  useEffect(() => {
    api<SessionUser>('/api/auth/me').then(setUser, () => setUser(null));
  }, []);

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setUser(null);
  }

  return (
    <div className="shell">
      <header className="top">
        <h1>MONSPORT</h1>
        {user && (
          <span className="who">
            {user.name}
            <button type="button" className="link" onClick={logout}>Đăng xuất</button>
          </span>
        )}
      </header>
      <main>
        {user === null && <LoginForm onLogin={setUser} />}
        {user?.role === 'USER' && (
          <>
            <BookingForm onBooked={() => setBooked((n) => n + 1)} />
            <MyBookings refresh={booked} />
          </>
        )}
        {user?.role === 'OWNER' && <OwnerRequests />}
        {user?.role === 'ADMIN' && <p className="empty">Màn admin chưa có trong bản này.</p>}
      </main>
    </div>
  );
}
