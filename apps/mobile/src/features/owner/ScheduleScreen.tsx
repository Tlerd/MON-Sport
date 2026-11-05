import { api, ApiError, dayChipLabel, ownerStartableMinutes } from '@monsport/client';
import {
  addDaysYmd,
  minuteOfDayVN,
  vnDateString,
  type Availability,
  type CourtView,
  type OwnerBookingView,
  type VenueView,
} from '@monsport/shared';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { useSession } from '../../app/session.tsx';
import { Chip } from '../../components/Chip.tsx';
import { ContextBar } from '../../components/ContextBar.tsx';
import { EmptyState } from '../../components/EmptyState.tsx';
import { SlotRow } from '../../components/SlotRow.tsx';
import { LoginSheet } from '../auth/LoginSheet.tsx';
import { DayBookings } from './DayBookings.tsx';
import { PhoneBookingSheet } from './PhoneBookingSheet.tsx';

const DAY_COUNT = 7;

type WindowId = 'sang' | 'chieu' | 'toi';
interface TimeWindow {
  id: WindowId;
  name: string;
  from: number;
  to: number;
}

const WINDOWS: TimeWindow[] = [
  { id: 'sang', name: 'Sáng', from: 0, to: 12 * 60 },
  { id: 'chieu', name: 'Chiều', from: 12 * 60, to: 17 * 60 },
  { id: 'toi', name: 'Tối', from: 17 * 60, to: 24 * 60 },
];

function windowsFor(opensAt: number, closesAt: number): TimeWindow[] {
  return WINDOWS.map((w) => ({
    ...w,
    from: Math.max(w.from, opensAt),
    to: Math.min(w.to, closesAt),
  })).filter((w) => w.to - w.from >= 30);
}

function firstWindow(windows: TimeWindow[], date: string, now: Date): WindowId | undefined {
  if (date === vnDateString(now)) {
    const minute = minuteOfDayVN(now);
    const current = windows.find((w) => minute < w.to);
    if (current) return current.id;
  }
  return (windows.find((w) => w.id === 'toi') ?? windows[0])?.id;
}

const shortTime = (m: number) =>
  m % 60 === 0 ? String(m / 60) : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

function nearest(list: number[], minute: number): number | undefined {
  let best: number | undefined;
  for (const m of list) {
    if (best === undefined || Math.abs(m - minute) < Math.abs(best - minute)) best = m;
  }
  return best;
}

type CourtState =
  | { key: string; status: 'ok'; free: Availability['free'] }
  | { key: string; status: 'error' };

interface Notice {
  kind: 'status' | 'alert';
  text: string;
}

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

  const [venues, setVenues] = useState<VenueView[] | undefined>(undefined);
  const [venuesFailed, setVenuesFailed] = useState(false);
  const [selectedVenueId, setSelectedVenueId] = useState<string | undefined>(undefined);
  const [date, setDate] = useState(today);
  const [chosenWindow, setChosenWindow] = useState<{ key: string; id: WindowId; n: number } | null>(null);
  const [courtStates, setCourtStates] = useState<Record<string, CourtState>>({});
  const [bookings, setBookings] = useState<OwnerBookingView[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sheetTarget, setSheetTarget] = useState<{ court: CourtView; start: number } | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [sessionLoginOpen, setSessionLoginOpen] = useState(false);

  const mountedRef = useRef(true);
  const venuesRef = useRef(venues);
  venuesRef.current = venues;
  const venuesReqRef = useRef(0);
  const bookingsReqRef = useRef(0);
  const availGenRef = useRef(0);
  const courtReqRef = useRef<Record<string, number>>({});

  const active = user?.role === 'OWNER';

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      venuesReqRef.current++;
      bookingsReqRef.current++;
      availGenRef.current++;
    };
  }, []);

  useEffect(() => {
    if (user?.role === 'USER') navigate('/', { replace: true });
  }, [user?.role, navigate]);

  const loadVenues = useCallback(() => {
    const reqId = ++venuesReqRef.current;
    api<VenueView[]>('/api/owner/venues').then(
      (list) => {
        if (!mountedRef.current || reqId !== venuesReqRef.current) return;
        const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
        setVenuesFailed(false);
        setVenues(sorted);
        setSelectedVenueId((prev) =>
          prev && sorted.some((v) => v.id === prev) ? prev : sorted[0]?.id,
        );
      },
      (err: unknown) => {
        if (!mountedRef.current || reqId !== venuesReqRef.current) return;
        if (err instanceof ApiError && err.status === 401) setSessionLoginOpen(true);
        if (!venuesRef.current) setVenuesFailed(true);
      },
    );
  }, []);

  const loadBookings = useCallback(() => {
    const reqId = ++bookingsReqRef.current;
    Promise.all([
      api<OwnerBookingView[]>('/api/owner/bookings?status=CONFIRMED'),
      api<OwnerBookingView[]>('/api/owner/bookings?status=PENDING'),
    ]).then(
      ([confirmed, pending]) => {
        if (!mountedRef.current || reqId !== bookingsReqRef.current) return;
        setBookings([...confirmed, ...pending]);
      },
      (err: unknown) => {
        if (!mountedRef.current || reqId !== bookingsReqRef.current) return;
        if (err instanceof ApiError && err.status === 401) setSessionLoginOpen(true);
      },
    );
  }, []);

  useEffect(() => {
    if (!active) return;
    loadVenues();
    loadBookings();
  }, [user?.id, active, loadVenues, loadBookings]);

  const venue = venues?.find((v) => v.id === selectedVenueId) ?? venues?.[0];
  const activeKey = venue ? `${venue.id}|${date}` : '';
  const activeKeyRef = useRef(activeKey);
  activeKeyRef.current = activeKey;

  const loadCourt = useCallback((courtId: string, forDate: string, forVenueId: string, gen: number) => {
    const key = `${forVenueId}|${forDate}`;
    const n = (courtReqRef.current[courtId] ?? 0) + 1;
    courtReqRef.current[courtId] = n;
    api<Availability>(`/api/courts/${courtId}/availability?date=${forDate}`).then(
      (answer) => {
        if (
          !mountedRef.current ||
          availGenRef.current !== gen ||
          activeKeyRef.current !== key ||
          courtReqRef.current[courtId] !== n
        ) {
          return;
        }
        setCourtStates((s) => ({ ...s, [courtId]: { key, status: 'ok', free: answer.free } }));
      },
      () => {
        if (
          !mountedRef.current ||
          availGenRef.current !== gen ||
          activeKeyRef.current !== key ||
          courtReqRef.current[courtId] !== n
        ) {
          return;
        }
        setCourtStates((s) => ({ ...s, [courtId]: { key, status: 'error' } }));
      },
    );
  }, []);

  useEffect(() => {
    if (!active || !venue) return;
    const gen = ++availGenRef.current;
    for (const court of venue.courts) {
      loadCourt(court.id, date, venue.id, gen);
    }
  }, [active, venue, date, loadCourt]);

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
  const windows = windowsFor(venue.opensAt, venue.closesAt);
  const windowKey = `${date}|${venue.opensAt}|${venue.closesAt}`;
  const activeId = chosenWindow?.key === windowKey ? chosenWindow.id : firstWindow(windows, date, now);
  const activeWindow = windows.find((w) => w.id === activeId) ?? windows[0];
  const scrollSignal = `${windowKey}|${chosenWindow?.key === windowKey ? chosenWindow.n : 0}`;

  const stateOf = (court: CourtView): CourtState | undefined => {
    const s = courtStates[court.id];
    return s && s.key === activeKey ? s : undefined;
  };
  const startableOf = (court: CourtView): number[] => {
    const s = stateOf(court);
    return s?.status === 'ok' ? ownerStartableMinutes(date, s.free, now) : [];
  };

  const focusCell = (courtId: string, minute: number) => {
    document
      .querySelector<HTMLElement>(`[data-court-id="${courtId}"] button[data-minute="${minute}"]`)
      ?.focus();
  };

  const onCellKeyDown = (event: KeyboardEvent<HTMLButtonElement>, courtIndex: number, minute: number) => {
    const own = startableOf(venue.courts[courtIndex]!);
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const next =
        event.key === 'ArrowRight' ? own.find((m) => m > minute) : [...own].reverse().find((m) => m < minute);
      if (next !== undefined) focusCell(venue.courts[courtIndex]!.id, next);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      for (let i = courtIndex + step; i >= 0 && i < venue.courts.length; i += step) {
        const target = nearest(startableOf(venue.courts[i]!), minute);
        if (target !== undefined) {
          focusCell(venue.courts[i]!.id, target);
          return;
        }
      }
    }
  };

  const pickDate = (ymd: string) => {
    availGenRef.current++;
    setDate(ymd);
    setSheetTarget(null);
    setNotice(null);
  };

  const pickVenue = (id: string) => {
    availGenRef.current++;
    setSelectedVenueId(id);
    setSheetTarget(null);
    setNotice(null);
  };

  const targetCourt = sheetTarget && venue.courts.find((c) => c.id === sheetTarget.court.id);
  const targetFree = targetCourt
    ? (() => {
        const s = stateOf(targetCourt);
        return s?.status === 'ok' ? s.free : [];
      })()
    : [];

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

        {windows.length > 1 && (
          <div
            role="group"
            aria-label="Buổi"
            style={{
              display: 'flex',
              gap: 'var(--space-sm)',
              padding: 'var(--space-sm) var(--space-base)',
              minWidth: 0,
              overflowX: 'auto',
              scrollbarWidth: 'none',
            }}
          >
            {windows.map((w) => (
              <Chip
                key={w.id}
                selected={w.id === activeWindow?.id}
                onClick={() =>
                  setChosenWindow({ key: windowKey, id: w.id, n: (chosenWindow?.n ?? 0) + 1 })
                }
              >
                {`${w.name} ${shortTime(w.from)}–${shortTime(w.to)}`}
              </Chip>
            ))}
          </div>
        )}

        {notice && (
          <p
            role={notice.kind === 'alert' ? 'alert' : 'status'}
            style={{
              margin: 0,
              padding: 'var(--space-sm) var(--space-base)',
              minWidth: 0,
              font: 'var(--font-meta)',
              color: notice.kind === 'alert' ? 'var(--color-status-no)' : 'var(--color-ink-muted)',
              overflowWrap: 'anywhere',
            }}
          >
            {notice.text}
          </p>
        )}

        {venue.courts.map((court, courtIndex) => {
          const state = stateOf(court);
          return (
            <section key={court.id} style={{ minWidth: 0, maxWidth: '100%', padding: 'var(--space-sm) 0' }}>
              <h2
                style={{
                  margin: 0,
                  padding: '0 var(--space-base) var(--space-xs)',
                  font: 'var(--font-body-strong)',
                  color: 'var(--color-ink)',
                  minWidth: 0,
                  overflowWrap: 'anywhere',
                }}
              >
                {court.name}
              </h2>
              {state?.status === 'error' ? (
                <EmptyState
                  message="Không tải được giờ trống"
                  actionLabel="Thử lại"
                  onAction={() => loadCourt(court.id, date, venue.id, availGenRef.current)}
                />
              ) : (
                <SlotRow
                  courtId={court.id}
                  courtName={court.name}
                  opensAt={venue.opensAt}
                  closesAt={venue.closesAt}
                  startable={startableOf(court)}
                  selected={sheetTarget?.court.id === court.id ? sheetTarget.start : undefined}
                  onPick={(start) => {
                    setNotice(null);
                    setSheetTarget({ court, start });
                  }}
                  scrollToMinute={activeWindow?.from}
                  scrollSignal={scrollSignal}
                  onCellKeyDown={(event, minute) => onCellKeyDown(event, courtIndex, minute)}
                />
              )}
            </section>
          );
        })}

        <DayBookings bookings={bookings} date={date} courts={venue.courts} />
      </div>

      <LoginSheet
        open={sessionLoginOpen}
        onClose={() => setSessionLoginOpen(false)}
        onLoggedIn={() => {
          loadVenues();
          loadBookings();
          for (const c of venue.courts) {
            loadCourt(c.id, date, venue.id, availGenRef.current);
          }
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
            loadCourt(courtId, date, venue.id, availGenRef.current);
            loadBookings();
          }}
          onConflict={(message) => {
            const courtId = targetCourt.id;
            setSheetTarget(null);
            setNotice({ kind: 'alert', text: message });
            loadCourt(courtId, date, venue.id, availGenRef.current);
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
