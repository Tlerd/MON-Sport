import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { SessionUser } from '@monsport/shared';
import { AuthPanel } from '../features/auth/AuthPanel.tsx';
import { BookingForm } from '../features/bookings/BookingForm.tsx';
import { MyBookings } from '../features/bookings/MyBookings.tsx';
import { PhoneBookings } from '../features/bookings/PhoneBookings.tsx';
import { JoinedMatches } from '../features/matches/JoinedMatches.tsx';
import { Lobby } from '../features/matches/Lobby.tsx';
import { VenueBrowser } from '../features/venues/VenueBrowser.tsx';
import { useSession } from './session.tsx';

function CourtLines() {
  return (
    <svg className="court-lines" viewBox="0 0 134 61" aria-hidden="true">
      <rect x="0.5" y="0.5" width="133" height="60" fill="none" stroke="currentColor" strokeWidth="1" />
      <line x1="67" y1="0.5" x2="67" y2="60.5" stroke="currentColor" strokeWidth="1" />
      <line x1="20" y1="0.5" x2="20" y2="60.5" stroke="currentColor" strokeWidth="1" />
      <line x1="114" y1="0.5" x2="114" y2="60.5" stroke="currentColor" strokeWidth="1" />
      <line x1="20" y1="30.5" x2="114" y2="30.5" stroke="currentColor" strokeWidth="1" />
      <line x1="0.5" y1="4.5" x2="133.5" y2="4.5" stroke="currentColor" strokeWidth="1" />
      <line x1="0.5" y1="56.5" x2="133.5" y2="56.5" stroke="currentColor" strokeWidth="1" />
      <line x1="7.5" y1="0.5" x2="7.5" y2="60.5" stroke="currentColor" strokeWidth="1" />
      <line x1="126.5" y1="0.5" x2="126.5" y2="60.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export { BookPage } from './BookPage.tsx';

export function LobbyPage() {
  const { user, refreshKey, bumpRefresh } = useSession();

  return (
    <div className="lobby-page">
      <Lobby
        user={user ?? null}
        refresh={refreshKey}
        onMatchChanged={bumpRefresh}
      />
    </div>
  );
}

export function MyPage() {
  const { refreshKey, bumpRefresh } = useSession();
  const [tab, setTab] = useState<'upcoming' | 'joined'>('upcoming');

  return (
    <div className="my-page">
      <nav className="tabs" aria-label="Lịch của tôi">
        <button
          type="button"
          className={tab === 'upcoming' ? 'active' : ''}
          onClick={() => setTab('upcoming')}
        >
          Sắp tới
        </button>
        <button
          type="button"
          className={tab === 'joined' ? 'active' : ''}
          onClick={() => setTab('joined')}
        >
          Trận đã vào
        </button>
      </nav>
      {tab === 'upcoming' ? (
        <MyBookings refresh={refreshKey} onMatchChanged={bumpRefresh} />
      ) : (
        <JoinedMatches refresh={refreshKey} />
      )}
    </div>
  );
}

export function AuthPage() {
  const { setUser } = useSession();
  const navigate = useNavigate();

  const handleLogin = (u: SessionUser) => {
    setUser(u);
    const dest =
      u.role === 'OWNER'
        ? '/chu-san/yeu-cau'
        : u.role === 'ADMIN'
          ? '/admin'
          : '/';
    navigate(dest, { replace: true });
  };

  return (
    <div className="auth-page">
      <AuthPanel onLogin={handleLogin} />
    </div>
  );
}

export { SchedulePage } from './SchedulePage.tsx';
