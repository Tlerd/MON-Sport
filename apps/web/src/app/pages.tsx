import { type CSSProperties, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { SKILL_LEVEL_LABELS, type SessionUser, type SkillLevel } from '@monsport/shared';
import { ComingSoonButton, ComingSoonPage } from '../components/ComingSoon.tsx';
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
import { HomePage as InnerHomePage } from './HomePage.tsx';
import { useSession } from './session.tsx';
import { VenuesPage as InnerVenuesPage } from './VenuesPage.tsx';

export function HomePage() {
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
        <GoogleComplete onLogin={handleLogin} />
      </div>
    );
  }

  if (google === 'verify') {
    return (
      <div className="auth-page">
        <GoogleVerify onLogin={handleLogin} />
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
        <div className="notice warnbox" role="alert">
          <span>{notice}</span>{' '}
          <button type="button" className="link" onClick={() => setGoogleNotice(null)}>
            Đóng
          </button>
        </div>
      )}
      <InnerHomePage />
    </>
  );
}

export function VenuesPage() {
  return <InnerVenuesPage />;
}

export function BookPage() {
  return <InnerBookPage />;
}

export function OwnerRequestsPage() {
  const { user } = useSession();
  const isStaff = user?.role === 'STAFF';
  return (
    <div className="page stack">
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
    <div className="page lobby-page">
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
    <div className="page narrow my-page">
      <div className="page-head">
        <div>
          <h1>Lịch của tôi</h1>
          <p>Mọi booking và mọi trận bạn tham gia.</p>
        </div>
      </div>
      <nav className="seg tabs" aria-label="Lịch của tôi">
        <button
          type="button"
          className={tab === 'upcoming' ? 'on active' : ''}
          onClick={() => setTab('upcoming')}
        >
          Sắp tới
        </button>
        <button
          type="button"
          className={tab === 'joined' ? 'on active' : ''}
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
        ? '/chu-san/tong-quan'
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
        <GoogleComplete onLogin={handleLogin} />
      </div>
    );
  }

  if (google === 'verify') {
    return (
      <div className="auth-page">
        <GoogleVerify onLogin={handleLogin} />
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

export function TeamsPage() {
  return (
    <ComingSoonPage
      title="Đội"
      description="Lập đội để nhận trận đội, theo dõi thành tích và rủ nhau ra sân."
      actionLabel="Lập đội mới"
      wide
    />
  );
}

export function ProfilePage() {
  const { user } = useSession();
  const profile = user as (SessionUser & { phone?: string | null; skillLevel?: SkillLevel | null }) | null;
  const displayName = profile?.name ?? '';
  const avatarInitial = [...(displayName.normalize('NFC').trim().split(/\s+/).at(-1) ?? '')][0] ?? '';

  return (
    <div className="page narrow">
      <section className="card phead">
        <span
          className="av"
          style={{ '--s': '88px', '--c': 'var(--ok)' } as CSSProperties}
          aria-hidden="true"
        >
          {avatarInitial}
        </span>
        <div>
          <h1>{displayName}</h1>
          {profile?.phone && <p className="meta">{profile.phone}</p>}
          {profile?.skillLevel && (
            <div className="tags">
              <span className="tag solo">{SKILL_LEVEL_LABELS[profile.skillLevel] ?? profile.skillLevel}</span>
            </div>
          )}
        </div>
        <ComingSoonButton className="btn ghost">Sửa hồ sơ</ComingSoonButton>
      </section>

      <section className="card">
        <div className="empty">
          <div className="empty-ball" aria-hidden="true">
            <svg
              className="ic"
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M5.2 6.2c3.6 2.6 3.6 9 0 11.6M18.8 6.2c-3.6 2.6-3.6 9 0 11.6" />
            </svg>
          </div>
          <h3>Sắp ra mắt</h3>
          <p>Thống kê trận đấu và lịch sử gần đây sẽ hiển thị tại đây.</p>
        </div>
      </section>
    </div>
  );
}

export { SchedulePage } from './SchedulePage.tsx';
export { OwnerOverview } from './OwnerOverview.tsx';
