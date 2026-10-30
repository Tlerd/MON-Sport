import { api, splitMine } from '@monsport/client';
import type { MyBookingView } from '@monsport/shared';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSession } from '../../app/session.tsx';
import { Chip } from '../../components/Chip.tsx';
import { ContextBar } from '../../components/ContextBar.tsx';
import { EmptyState } from '../../components/EmptyState.tsx';
import { LoginSheet } from '../auth/LoginSheet.tsx';
import { BookingCard } from './BookingCard.tsx';

type Tab = 'UPCOMING' | 'JOINED' | 'HISTORY';

export interface MyScreenProps {
  now?: Date;
}

export function MyScreen({ now: nowProp }: MyScreenProps) {
  const navigate = useNavigate();
  const { user } = useSession();
  const now = nowProp ?? new Date();

  const [tab, setTab] = useState<Tab>('UPCOMING');
  const [bookings, setBookings] = useState<MyBookingView[] | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    api<MyBookingView[]>('/api/bookings/mine').then(
      (data) => setBookings(data),
      () => setFailed(true),
    );
  }, []);

  useEffect(() => {
    if (user?.role === 'OWNER') {
      navigate('/chu-san/yeu-cau', { replace: true });
    }
  }, [user?.role, navigate]);

  useEffect(() => {
    if (user && user.role !== 'OWNER') {
      load();
    }
  }, [user, load]);

  useEffect(() => {
    if (!user || user.role === 'OWNER') return;

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        load();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [user, load]);

  if (user === undefined) {
    return <EmptyState message="Đang tải" />;
  }

  if (user === null) {
    return (
      <div style={{ minWidth: 0 }}>
        <EmptyState
          message="Đăng nhập để xem lịch của bạn"
          actionLabel="Đăng nhập"
          onAction={() => setLoginOpen(true)}
        />
        <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />
      </div>
    );
  }

  if (user.role === 'OWNER') {
    return null;
  }

  const split = bookings ? splitMine(bookings, now) : undefined;

  return (
    <div style={{ minWidth: 0 }}>
      <ContextBar aria-label="Lịch của tôi">
        <Chip selected={tab === 'UPCOMING'} onClick={() => setTab('UPCOMING')}>
          Sắp tới
        </Chip>
        <Chip selected={tab === 'JOINED'} onClick={() => setTab('JOINED')}>
          Trận đã vào
        </Chip>
        <Chip selected={tab === 'HISTORY'} onClick={() => setTab('HISTORY')}>
          Lịch sử
        </Chip>
      </ContextBar>

      <div style={{ paddingTop: '61px', minWidth: 0 }}>
        {failed ? (
          <EmptyState message="Không tải được" actionLabel="Thử lại" onAction={load} />
        ) : !bookings || !split ? (
          <EmptyState message="Đang tải" />
        ) : tab === 'UPCOMING' ? (
          split.upcoming.length === 0 ? (
            <EmptyState
              message="Chưa có booking sắp tới"
              actionLabel="Đặt sân"
              onAction={() => navigate('/')}
            />
          ) : (
            <ul
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '1px',
                minWidth: 0,
              }}
            >
              {split.upcoming.map((booking) => (
                <li key={booking.id} style={{ minWidth: 0 }}>
                  <BookingCard booking={booking} />
                </li>
              ))}
            </ul>
          )
        ) : tab === 'JOINED' ? (
          <EmptyState message="Bạn chưa vào trận nào" />
        ) : split.history.length === 0 ? (
          <EmptyState message="Chưa có lịch sử" />
        ) : (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '1px',
              minWidth: 0,
            }}
          >
            {split.history.map((booking) => (
              <li key={booking.id} style={{ minWidth: 0 }}>
                <BookingCard booking={booking} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
