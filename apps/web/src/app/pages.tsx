import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { SKILL_LEVEL_LABELS, type SessionUser, type SkillLevel } from '@monsport/shared';
import { Avatar } from '../components/Avatar.tsx';
import { ComingSoonButton, ComingSoonPage } from '../components/ComingSoon.tsx';
import { AccessTokensSection } from '../features/access-tokens/AccessTokensSection.tsx';
import { AuthPanel } from '../features/auth/AuthPanel.tsx';
import { GoogleComplete } from '../features/auth/GoogleComplete.tsx';
import { GoogleVerify } from '../features/auth/GoogleVerify.tsx';
import { resolveGoogleError } from '../features/auth/googleErrors.ts';
import { safeNext } from '../features/auth/safeNext.ts';
import { BookPage as InnerBookPage } from '../features/bookings/book/BookPage.tsx';
import { MyBookings } from '../features/bookings/MyBookings.tsx';
import { OwnerRequests } from '../features/bookings/OwnerRequests.tsx';
import { PhoneBookings } from '../features/bookings/PhoneBookings.tsx';
import { HomePage as InnerHomePage } from '../features/home/HomePage.tsx';
import { JoinedMatches } from '../features/matches/JoinedMatches.tsx';
import { Lobby } from '../features/matches/Lobby.tsx';
import { ConsentScreen } from '../features/oauth/ConsentScreen.tsx';
import { OwnerOverview as InnerOwnerOverview } from '../features/owner/OwnerOverview.tsx';
import { SchedulePage as InnerSchedulePage } from '../features/schedule/SchedulePage.tsx';
import { StaffSection } from '../features/staff/StaffSection.tsx';
import { MyVenues } from '../features/venues/MyVenues.tsx';
import { VenuesPage as InnerVenuesPage } from '../features/venues/VenuesPage.tsx';
import { useSession } from './session.tsx';

export function HomePage() {
  const [searchParams] = useSearchParams();
  const google = searchParams.get('google');
  const googleError = searchParams.get('google_error');
  const { user, setUser } = useSession();
  const navigate = useNavigate();
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
      <InnerHomePage user={user ?? null} />
    </>
  );
}

export function VenuesPage() {
  return <InnerVenuesPage />;
}

export function BookPage() {
  const { user, bumpRefresh } = useSession();
  return <InnerBookPage user={user ?? null} onBooked={bumpRefresh} />;
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
  const next = safeNext(searchParams.get('tiep'));
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
    navigate(next ?? dest, { replace: true });
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

export function ConsentPage() {
  const { user } = useSession();
  return <ConsentScreen user={user} />;
}

export function ProfilePage() {
  const { user } = useSession();
  const profile = user as (SessionUser & { phone?: string | null; skillLevel?: SkillLevel | null }) | null;
  const displayName = profile?.name ?? '';

  return (
    <div className="page narrow">
      <section className="card phead">
        <Avatar name={displayName} size={88} />
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

      {user?.role === 'USER' && <AccessTokensSection />}

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

export function SchedulePage() {
  const { refreshKey, bumpRefresh } = useSession();
  return <InnerSchedulePage refreshKey={refreshKey} onRefresh={bumpRefresh} />;
}

export function OwnerOverview() {
  return <InnerOwnerOverview />;
}
