import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import type { SessionUser } from '@monsport/shared';
import { AuthPanel } from '../features/auth/AuthPanel.tsx';
import { GoogleComplete } from '../features/auth/GoogleComplete.tsx';
import { GoogleVerify } from '../features/auth/GoogleVerify.tsx';
import { resolveGoogleError } from '../features/auth/googleErrors.ts';
import { MyBookings } from '../features/bookings/MyBookings.tsx';
import { OwnerRequests } from '../features/bookings/OwnerRequests.tsx';
import { PhoneBookings } from '../features/bookings/PhoneBookings.tsx';
import { JoinedMatches } from '../features/matches/JoinedMatches.tsx';
import { Lobby } from '../features/matches/Lobby.tsx';
import { MyVenues } from '../features/venues/MyVenues.tsx';
import { StaffSection } from '../features/staff/StaffSection.tsx';
import { BookPage as InnerBookPage } from './BookPage.tsx';
import { useSession } from './session.tsx';

export function BookPage() {
  const [searchParams] = useSearchParams();
  const google = searchParams.get('google');
  const googleError = searchParams.get('google_error');
  const { user, setUser } = useSession();
  const navigate = useNavigate();
  // A signed-in user comes back here from the link flow with ?google_error=<code>.
  const signedInGoogleError = user && googleError ? resolveGoogleError(googleError) : null;
  const [googleNotice, setGoogleNotice] = useState<string | null>(signedInGoogleError);

  useEffect(() => {
    if (!signedInGoogleError) return;
    setGoogleNotice(signedInGoogleError);
    navigate('/', { replace: true });
  }, [signedInGoogleError, navigate]);

  const handleLogin = (u: SessionUser) => {
    setUser(u);
    navigate('/', { replace: true });
  };

  if (google === 'complete') {
    return (
      <div className="auth-page">
        <section className="panel">
          <GoogleComplete onLogin={handleLogin} />
        </section>
      </div>
    );
  }

  if (google === 'verify') {
    return (
      <div className="auth-page">
        <section className="panel">
          <GoogleVerify onLogin={handleLogin} />
        </section>
      </div>
    );
  }

  if (googleError && !user) {
    return (
      <div className="auth-page">
        <AuthPanel
          onLogin={handleLogin}
          initialError={resolveGoogleError(googleError) ?? undefined}
        />
      </div>
    );
  }

  const notice = googleNotice ?? signedInGoogleError;
  return (
    <>
      {notice && (
        <div className="notice" role="alert">
          <span>{notice}</span>{' '}
          <button type="button" className="link" onClick={() => setGoogleNotice(null)}>
            Đóng
          </button>
        </div>
      )}
      <InnerBookPage />
    </>
  );
}

export function OwnerRequestsPage() {
  const { user } = useSession();
  const isStaff = user?.role === 'STAFF';
  return (
    <div className="owner-requests-page stack">
      <OwnerRequests canManagePayment={!isStaff} />
      <PhoneBookings canCancel={!isStaff} />
    </div>
  );
}

export function MyVenuesPage() {
  return <MyVenues renderStaff={(v) => <StaffSection venueId={v.id} />} />;
}

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
  const [searchParams] = useSearchParams();
  const google = searchParams.get('google');
  const googleError = searchParams.get('google_error');
  const { setUser } = useSession();
  const navigate = useNavigate();

  const handleLogin = (u: SessionUser) => {
    setUser(u);
    const dest =
      u.role === 'OWNER'
        ? '/chu-san/yeu-cau'
        : u.role === 'STAFF'
          ? '/chu-san/lich'
          : u.role === 'ADMIN'
            ? '/admin'
            : '/';
    navigate(dest, { replace: true });
  };

  if (google === 'complete') {
    return (
      <div className="auth-page">
        <section className="panel">
          <GoogleComplete onLogin={handleLogin} />
        </section>
      </div>
    );
  }

  if (google === 'verify') {
    return (
      <div className="auth-page">
        <section className="panel">
          <GoogleVerify onLogin={handleLogin} />
        </section>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <AuthPanel
        onLogin={handleLogin}
        initialError={googleError ? (resolveGoogleError(googleError) ?? undefined) : undefined}
      />
    </div>
  );
}

export { SchedulePage } from './SchedulePage.tsx';
