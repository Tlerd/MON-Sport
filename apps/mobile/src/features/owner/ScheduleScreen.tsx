import { dayChipLabel } from '@monsport/client';
import { addDaysYmd, vnDateString } from '@monsport/shared';
import { useNavigate } from 'react-router';
import { useSession } from '../../app/session.tsx';
import { Chip } from '../../components/Chip.tsx';
import { ContextBar } from '../../components/ContextBar.tsx';
import { EmptyState } from '../../components/EmptyState.tsx';
import { LoginSheet } from '../auth/LoginSheet.tsx';
import { DayBookings } from './DayBookings.tsx';
import { PhoneBookingSheet } from './PhoneBookingSheet.tsx';
import { ScheduleCourts } from './ScheduleCourts.tsx';
import { useOwnerSchedule } from './useOwnerSchedule.ts';

const DAY_COUNT = 7;

export interface ScheduleScreenProps {
  now?: Date;
}

export function ScheduleScreen({ now }: ScheduleScreenProps) {
  const { user } = useSession();
  return <ScheduleScreenBody key={user?.id ?? 'guest'} now={now} />;
}

function ScheduleScreenBody({ now: nowProp }: ScheduleScreenProps) {
  const navigate = useNavigate();
  const { user } = useSession();
  const now = nowProp ?? new Date();
  const today = vnDateString(now);

  const {
    active,
    venues,
    venuesFailed,
    setVenuesFailed,
    venue,
    date,
    bookings,
    bookingsFailed,
    notice,
    setNotice,
    sheetTarget,
    setSheetTarget,
    loginOpen,
    setLoginOpen,
    sessionLoginOpen,
    setSessionLoginOpen,
    targetCourt,
    targetFree,
    loadVenues,
    loadBookings,
    retryCourt,
    reloadAllCourts,
    stateOf,
    startableOf,
    pickDate,
    pickVenue,
  } = useOwnerSchedule({ user, today, now, navigate });

  if (user === undefined) {
    return <EmptyState message="Đang tải" />;
  }

  if (user === null) {
    return (
      <div style={{ minWidth: 0 }}>
        <EmptyState
          message="Đăng nhập để xem lịch sân"
          actionLabel="Đăng nhập"
          onAction={() => setLoginOpen(true)}
        />
        <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />
      </div>
    );
  }

  if (user.role === 'ADMIN' || !active) {
    return null;
  }

  if (!venues) {
    return (
      <div style={{ minWidth: 0 }}>
        {venuesFailed ? (
          <EmptyState
            message="Không tải được"
            actionLabel="Thử lại"
            onAction={() => {
              setVenuesFailed(false);
              loadVenues();
              loadBookings();
            }}
          />
        ) : (
          <EmptyState message="Đang tải" />
        )}
        <LoginSheet
          open={sessionLoginOpen}
          onClose={() => setSessionLoginOpen(false)}
          onLoggedIn={() => {
            loadVenues();
            loadBookings();
          }}
          notice="Phiên đăng nhập đã hết. Hãy đăng nhập lại."
        />
      </div>
    );
  }

  if (venues.length === 0 || !venue) {
    return (
      <div style={{ minWidth: 0 }}>
        <EmptyState message="Bạn chưa có đơn vị nào" />
        <LoginSheet
          open={sessionLoginOpen}
          onClose={() => setSessionLoginOpen(false)}
          onLoggedIn={() => {
            loadVenues();
            loadBookings();
          }}
          notice="Phiên đăng nhập đã hết. Hãy đăng nhập lại."
        />
      </div>
    );
  }

  const days = Array.from({ length: DAY_COUNT }, (_, i) => (i === 0 ? today : addDaysYmd(today, i)));

  return (
    <div style={{ minWidth: 0, maxWidth: '100%' }}>
      <ContextBar aria-label="Ngày">
        {days.map((ymd, i) => (
          <Chip key={ymd} selected={ymd === date} onClick={() => pickDate(ymd)}>
            {i === 0 ? 'Hôm nay' : dayChipLabel(ymd)}
          </Chip>
        ))}
      </ContextBar>

      <div style={{ paddingTop: '61px', minWidth: 0, maxWidth: '100%' }}>
        {venues.length >= 2 && (
          <div
            role="group"
            aria-label="Đơn vị"
            style={{
              display: 'flex',
              gap: 'var(--space-sm)',
              padding: 'var(--space-sm) var(--space-base)',
              minWidth: 0,
              overflowX: 'auto',
              scrollbarWidth: 'none',
            }}
          >
            {venues.map((v) => (
              <Chip key={v.id} selected={v.id === venue.id} onClick={() => pickVenue(v.id)}>
                {v.name}
              </Chip>
            ))}
          </div>
        )}

        <ScheduleCourts
          venue={venue}
          date={date}
          now={now}
          bookings={bookings}
          notice={notice}
          sheetTarget={sheetTarget}
          stateOf={stateOf}
          startableOf={startableOf}
          onRetryCourt={(courtId) => retryCourt(courtId, venue.id)}
          onPickSlot={(court, start) => {
            setNotice(null);
            setSheetTarget({ court, start });
          }}
        />

        <DayBookings
          bookings={bookings}
          date={date}
          courts={venue.courts}
          failed={bookingsFailed}
          onRetry={loadBookings}
        />
      </div>

      <LoginSheet
        open={sessionLoginOpen}
        onClose={() => setSessionLoginOpen(false)}
        onLoggedIn={() => {
          loadVenues();
          loadBookings();
          reloadAllCourts(venue);
        }}
        notice="Phiên đăng nhập đã hết. Hãy đăng nhập lại."
      />

      {sheetTarget && targetCourt && (
        <PhoneBookingSheet
          open={!sessionLoginOpen}
          court={targetCourt}
          date={date}
          start={sheetTarget.start}
          free={targetFree}
          now={nowProp}
          onClose={() => setSheetTarget(null)}
          onSaved={() => {
            const courtId = targetCourt.id;
            setSheetTarget(null);
            setNotice({ kind: 'status', text: 'Đã lưu booking' });
            retryCourt(courtId, venue.id);
            loadBookings();
          }}
          onConflict={(message) => {
            const courtId = targetCourt.id;
            setSheetTarget(null);
            setNotice({ kind: 'alert', text: message });
            retryCourt(courtId, venue.id);
            loadBookings();
          }}
          onCourtGone={(message) => {
            setSheetTarget(null);
            setNotice({ kind: 'alert', text: message });
            loadVenues();
          }}
          onSessionExpired={() => {
            setSessionLoginOpen(true);
          }}
        />
      )}
    </div>
  );
}
