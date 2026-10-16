import type { SessionUser } from '@monsport/shared';
import { useEffect, useState } from 'react';
import { LoginForm } from '../features/auth/LoginForm.tsx';
import { BookingForm } from '../features/bookings/BookingForm.tsx';
import { MyBookings } from '../features/bookings/MyBookings.tsx';
import { OwnerRequests } from '../features/bookings/OwnerRequests.tsx';
import { api } from '../lib/api.ts';

const HERO: Record<SessionUser['role'] | 'GUEST', string> = {
  GUEST: 'Chọn giờ trống, gửi yêu cầu, chủ sân xác nhận.',
  USER: 'Chọn sân và giờ chơi, rồi gửi yêu cầu cho chủ sân.',
  OWNER: 'Các yêu cầu đặt sân của bạn nằm ở đây.',
  ADMIN: 'Màn quản trị đang được làm.',
};

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
        <span className="brand">MONSPORT</span>
        {user && (
          <span className="who">
            <span className="avatar" aria-hidden="true">{user.name.slice(0, 1)}</span>
            {user.name}
            <button type="button" className="link" onClick={logout}>Đăng xuất</button>
          </span>
        )}
      </header>
      {user !== undefined && (
        <div className="hero">
          <CourtLines />
          <h1>{user ? `Chào ${user.name}` : 'Đặt sân gần bạn'}</h1>
          <p>{HERO[user?.role ?? 'GUEST']}</p>
        </div>
      )}
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

/** A badminton court seen from above, drawn in line white: the one decoration of the app. */
function CourtLines() {
  return (
    <svg className="court-lines" viewBox="0 0 200 92" aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="198" height="90" />
      <line x1="1" y1="8" x2="199" y2="8" />
      <line x1="1" y1="84" x2="199" y2="84" />
      <line x1="12" y1="1" x2="12" y2="91" />
      <line x1="188" y1="1" x2="188" y2="91" />
      <line x1="70" y1="1" x2="70" y2="91" />
      <line x1="130" y1="1" x2="130" y2="91" />
      <line x1="12" y1="46" x2="70" y2="46" />
      <line x1="130" y1="46" x2="188" y2="46" />
      <line className="net" x1="100" y1="-4" x2="100" y2="96" />
    </svg>
  );
}
