import { joinedByOthers, splitMine } from '@monsport/client';
import { useNavigate } from 'react-router';
import { useSession } from '../../app/session.tsx';
import { Chip } from '../../components/Chip.tsx';
import { ContextBar } from '../../components/ContextBar.tsx';
import { EmptyState } from '../../components/EmptyState.tsx';
import { LoginSheet } from '../auth/LoginSheet.tsx';
import { BookingCard } from './BookingCard.tsx';
import { MatchCard } from './MatchCard.tsx';
import { MyBookingSheets } from './MyBookingSheets.tsx';
import { useMySchedule } from './useMySchedule.ts';

export interface MyScreenProps {
  now?: Date;
}

const listStyle = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '1px',
  minWidth: 0,
} as const;

export function MyScreen({ now: nowProp }: MyScreenProps) {
  const navigate = useNavigate();
  const { user } = useSession();
  const now = nowProp ?? new Date();

  const {
    tab,
    setTab,
    bookings,
    matches,
    bookingsFailed,
    joinedFailed,
    loginOpen,
    setLoginOpen,
    sessionLoginOpen,
    setSessionLoginOpen,
    cancelTarget,
    cancelBusy,
    cancelError,
    openTarget,
    openCapacity,
    setOpenCapacity,
    openPrice,
    setOpenPrice,
    openJoinMode,
    setOpenJoinMode,
    openBusy,
    setOpenError,
    openValidationMessage,
    openAlert,
    load,
    openCancel,
    closeCancel,
    confirmCancel,
    openMatch,
    closeOpenMatch,
    confirmOpenMatch,
  } = useMySchedule({ user, navigate });

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
  const joinedMatches = matches ? joinedByOthers(matches, user.id, now) : undefined;

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
        {tab === 'JOINED' ? (
          joinedFailed ? (
            <EmptyState message="Không tải được" actionLabel="Thử lại" onAction={load} />
          ) : !joinedMatches ? (
            <EmptyState message="Đang tải" />
          ) : joinedMatches.length === 0 ? (
            <EmptyState message="Bạn chưa vào trận nào" />
          ) : (
            <ul style={listStyle}>
              {joinedMatches.map((match) => (
                <li key={match.id} style={{ minWidth: 0 }}>
                  <MatchCard match={match} />
                </li>
              ))}
            </ul>
          )
        ) : bookingsFailed ? (
          <EmptyState message="Không tải được" actionLabel="Thử lại" onAction={load} />
        ) : !split ? (
          <EmptyState message="Đang tải" />
        ) : tab === 'UPCOMING' ? (
          split.upcoming.length === 0 ? (
            <EmptyState
              message="Chưa có booking sắp tới"
              actionLabel="Đặt sân"
              onAction={() => navigate('/')}
            />
          ) : (
            <ul style={listStyle}>
              {split.upcoming.map((booking) => (
                <li key={booking.id} style={{ minWidth: 0 }}>
                  <BookingCard
                    booking={booking}
                    now={now}
                    onCancel={openCancel}
                    onOpenMatch={openMatch}
                  />
                </li>
              ))}
            </ul>
          )
        ) : split.history.length === 0 ? (
          <EmptyState message="Chưa có lịch sử" />
        ) : (
          <ul style={listStyle}>
            {split.history.map((booking) => (
              <li key={booking.id} style={{ minWidth: 0 }}>
                <BookingCard
                  booking={booking}
                  now={now}
                  onCancel={openCancel}
                  onOpenMatch={openMatch}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <MyBookingSheets
        openTarget={openTarget}
        openCapacity={openCapacity}
        onChangeCapacity={(value) => {
          setOpenError('');
          setOpenCapacity(value);
        }}
        openPrice={openPrice}
        onChangePrice={(value) => {
          setOpenError('');
          setOpenPrice(value);
        }}
        openJoinMode={openJoinMode}
        onChangeJoinMode={(mode) => {
          setOpenError('');
          setOpenJoinMode(mode);
        }}
        openBusy={openBusy}
        openValidationMessage={openValidationMessage}
        openAlert={openAlert}
        onCloseOpenMatch={closeOpenMatch}
        onConfirmOpenMatch={() => void confirmOpenMatch()}
        cancelTarget={cancelTarget}
        cancelBusy={cancelBusy}
        cancelError={cancelError}
        onCloseCancel={closeCancel}
        onConfirmCancel={() => void confirmCancel()}
        sessionLoginOpen={sessionLoginOpen}
        onCloseSessionLogin={() => setSessionLoginOpen(false)}
        onSessionLoggedIn={load}
      />
    </div>
  );
}
