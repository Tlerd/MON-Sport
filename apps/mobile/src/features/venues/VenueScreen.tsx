import { api, dayChipLabel, durationsAt, hhmm, slotAt, startableMinutes } from '@monsport/client';
import {
  addDaysYmd,
  bookingPrice,
  minuteOfDayVN,
  vnDateString,
  type Availability,
  type CourtView,
  type VenueView,
} from '@monsport/shared';
import { Phone } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router';
import type { ShellContextType } from '../../app/App.tsx';
import { useSession } from '../../app/session.tsx';
import { ActionBar } from '../../components/ActionBar.tsx';
import { Chip } from '../../components/Chip.tsx';
import { ContextBar } from '../../components/ContextBar.tsx';
import { EmptyState } from '../../components/EmptyState.tsx';
import { SlotRow } from '../../components/SlotRow.tsx';
import { LoginSheet } from '../auth/LoginSheet.tsx';
import { BookingSheet } from '../bookings/BookingSheet.tsx';

const NOTICE = 'App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt.';
const DAY_COUNT = 7;
const HOUR = 60;

/** DESIGN.md, "Time windows": the chips scroll the rows, they never filter the cells. */
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

/** The windows cut to the opening hours. A window with no cell is left out. */
function windowsFor(opensAt: number, closesAt: number): TimeWindow[] {
  return WINDOWS.map((w) => ({ ...w, from: Math.max(w.from, opensAt), to: Math.min(w.to, closesAt) })).filter(
    (w) => w.to - w.from >= 30,
  );
}

/** Today: the window that holds the current time. Another day: Tối. Else the first window. */
function firstWindow(windows: TimeWindow[], date: string, now: Date): WindowId | undefined {
  if (date === vnDateString(now)) {
    const minute = minuteOfDayVN(now);
    const current = windows.find((w) => minute < w.to);
    if (current) return current.id;
  }
  return (windows.find((w) => w.id === 'toi') ?? windows[0])?.id;
}

/** "06:00" shows as "6", "06:30" stays "6:30". */
const shortTime = (m: number) => (m % 60 === 0 ? String(m / 60) : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`);

type CourtState =
  | { date: string; status: 'ok'; free: Availability['free'] }
  | { date: string; status: 'error' };

const formatK = (price: number) => `${Math.round(price / 1000)}k`;

/** The nearest value in a list. On a tie the earlier one wins. */
function nearest(list: number[], minute: number): number | undefined {
  let best: number | undefined;
  for (const m of list) {
    if (best === undefined || Math.abs(m - minute) < Math.abs(best - minute)) best = m;
  }
  return best;
}

export interface VenueScreenProps {
  /** The current time; a prop so that tests can fix it. */
  now?: Date;
}

export function VenueScreen({ now: nowProp }: VenueScreenProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setTitle, setOnBack, setTopBarActions } = useOutletContext<ShellContextType>();
  const { user, setUser } = useSession();
  const now = nowProp ?? new Date();
  const today = vnDateString(now);

  const [venues, setVenues] = useState<VenueView[] | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const venue = venues?.find((v) => v.id === id);

  const [date, setDate] = useState(today);
  const [chosenWindow, setChosenWindow] = useState<{ key: string; id: WindowId; n: number } | null>(null);
  const [selected, setSelected] = useState<{ courtId: string; start: number; duration: number } | undefined>(undefined);
  const [loginOpen, setLoginOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [courtStates, setCourtStates] = useState<Record<string, CourtState>>({});
  const dateRef = useRef(date);
  dateRef.current = date;
  const requestRef = useRef<Record<string, number>>({});

  const loadVenues = useCallback(() => {
    setFailed(false);
    api<VenueView[]>('/api/venues').then(
      (list) => setVenues(list),
      () => setFailed(true),
    );
  }, []);

  useEffect(() => {
    loadVenues();
  }, [loadVenues]);

  useEffect(() => {
    if (!venue) return;
    setTitle(venue.name);
    setOnBack(() => () => navigate('/'));
    setTopBarActions(
      <a
        aria-label="Gọi chủ sân"
        href={`tel:${venue.phone}`}
        style={{
          width: '44px',
          height: '44px',
          display: 'grid',
          placeItems: 'center',
          borderRadius: 'var(--radius-full)',
          color: 'var(--color-primary)',
        }}
      >
        <Phone size={20} aria-hidden="true" />
      </a>,
    );
    return () => {
      setTitle(undefined);
      setOnBack(undefined);
      setTopBarActions(undefined);
    };
  }, [venue, navigate, setTitle, setOnBack, setTopBarActions]);

  /** One request for one court on one date. An older answer never replaces a newer one (AC-12). */
  const loadCourt = useCallback((courtId: string, forDate: string) => {
    const n = (requestRef.current[courtId] ?? 0) + 1;
    requestRef.current[courtId] = n;
    api<Availability>(`/api/courts/${courtId}/availability?date=${forDate}`).then(
      (answer) => {
        if (dateRef.current !== forDate || requestRef.current[courtId] !== n) return;
        setCourtStates((s) => ({ ...s, [courtId]: { date: forDate, status: 'ok', free: answer.free } }));
      },
      () => {
        if (dateRef.current !== forDate || requestRef.current[courtId] !== n) return;
        setCourtStates((s) => ({ ...s, [courtId]: { date: forDate, status: 'error' } }));
      },
    );
  }, []);

  useEffect(() => {
    if (!venue) return;
    for (const court of venue.courts) loadCourt(court.id, date);
  }, [venue, date, loadCourt]);

  useEffect(() => {
    if (!selected) return;
    const s = courtStates[selected.courtId];
    if (s?.status !== 'ok' || s.date !== date) return;
    const durations = durationsAt(date, selected.start, s.free, now);
    if (durations.length > 0 && !durations.includes(selected.duration)) {
      const largest = Math.max(...durations);
      setSelected((prev) => (prev ? { ...prev, duration: largest } : prev));
    }
  }, [courtStates, date, selected, now]);

  if (failed) {
    return <EmptyState message="Không tải được danh sách đơn vị" actionLabel="Thử lại" onAction={loadVenues} />;
  }
  if (!venues) {
    return (
      <p style={{ margin: 0, padding: 'var(--space-xl) var(--space-base)', textAlign: 'center', font: 'var(--font-meta)', color: 'var(--color-ink-muted)' }}>
        Đang tải…
      </p>
    );
  }
  if (!venue) {
    return <EmptyState message="Không tìm thấy đơn vị" actionLabel="Về danh sách" onAction={() => navigate('/')} />;
  }

  const days = Array.from({ length: DAY_COUNT }, (_, i) => (i === 0 ? today : addDaysYmd(today, i)));
  const windows = windowsFor(venue.opensAt, venue.closesAt);
  const windowKey = `${date}|${venue.opensAt}|${venue.closesAt}`;
  const activeId = chosenWindow?.key === windowKey ? chosenWindow.id : firstWindow(windows, date, now);
  const activeWindow = windows.find((w) => w.id === activeId) ?? windows[0];
  const scrollSignal = `${windowKey}|${chosenWindow?.key === windowKey ? chosenWindow.n : 0}`;

  const stateOf = (court: CourtView): CourtState | undefined => {
    const s = courtStates[court.id];
    return s && s.date === date ? s : undefined;
  };
  const startableOf = (court: CourtView): number[] => {
    const s = stateOf(court);
    return s?.status === 'ok' ? startableMinutes(date, s.free, now) : [];
  };
  const allAnswered = venue.courts.every((c) => stateOf(c)?.status === 'ok');
  const allEmpty = allAnswered && venue.courts.every((c) => startableOf(c).length === 0);

  const selectedCourt = selected && venue.courts.find((c) => c.id === selected.courtId);

  const focusCell = (courtId: string, minute: number) => {
    document
      .querySelector<HTMLElement>(`[data-court-id="${courtId}"] button[data-minute="${minute}"]`)
      ?.focus();
  };

  /** AC-19: arrows move between startable cells. Disabled cells are not buttons, so they are skipped. */
  const onCellKeyDown = (event: KeyboardEvent<HTMLButtonElement>, courtIndex: number, minute: number) => {
    const own = startableOf(venue.courts[courtIndex]);
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      const next = event.key === 'ArrowRight' ? own.find((m) => m > minute) : [...own].reverse().find((m) => m < minute);
      if (next !== undefined) focusCell(venue.courts[courtIndex].id, next);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      for (let i = courtIndex + step; i >= 0 && i < venue.courts.length; i += step) {
        const target = nearest(startableOf(venue.courts[i]), minute);
        if (target !== undefined) {
          focusCell(venue.courts[i].id, target);
          return;
        }
      }
    }
  };

  const pickDate = (ymd: string) => {
    setDate(ymd);
    setSelected(undefined);
    setBookingOpen(false);
  };

  return (
    <div style={{ minWidth: 0 }}>
      <ContextBar aria-label="Ngày">
        {days.map((ymd, i) => (
          <Chip key={ymd} selected={ymd === date} onClick={() => pickDate(ymd)}>
            {i === 0 ? 'Hôm nay' : dayChipLabel(ymd)}
          </Chip>
        ))}
      </ContextBar>

      <div style={{ paddingTop: '61px', paddingBottom: selected ? '88px' : 0, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            padding: 'var(--space-md) var(--space-base)',
            font: 'var(--font-meta)',
            color: 'var(--color-ink-muted)',
          }}
        >
          {NOTICE}
        </p>

        {windows.length > 1 && (
          <div
            role="group"
            aria-label="Buổi"
            style={{
              display: 'flex',
              gap: 'var(--space-sm)',
              padding: '0 var(--space-base) var(--space-md)',
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

        {allEmpty && <EmptyState message="Hết giờ trống trong ngày này. Hãy chọn ngày khác." />}

        {venue.courts.map((court, courtIndex) => {
          const state = stateOf(court);
          return (
            <section key={court.id} style={{ minWidth: 0, padding: 'var(--space-sm) 0' }}>
              <h2
                style={{
                  margin: 0,
                  padding: '0 var(--space-base) var(--space-xs)',
                  font: 'var(--font-body-strong)',
                  color: 'var(--color-ink)',
                }}
              >
                {court.name}
              </h2>
              {state?.status === 'error' ? (
                <EmptyState
                  message="Không tải được giờ trống"
                  actionLabel="Thử lại"
                  onAction={() => loadCourt(court.id, date)}
                />
              ) : (
                <SlotRow
                  courtId={court.id}
                  courtName={court.name}
                  opensAt={venue.opensAt}
                  closesAt={venue.closesAt}
                  startable={startableOf(court)}
                  selected={selected?.courtId === court.id ? selected.start : undefined}
                  onPick={(start) => setSelected({ courtId: court.id, start, duration: HOUR })}
                  scrollToMinute={activeWindow?.from}
                  scrollSignal={scrollSignal}
                  onCellKeyDown={(event, minute) => onCellKeyDown(event, courtIndex, minute)}
                />
              )}
            </section>
          );
        })}
      </div>

      {selected && selectedCourt && (
        <ActionBar
          hidden
          title={`${selectedCourt.name} · ${hhmm(selected.start)}–${hhmm(selected.start + selected.duration)}`}
          price={formatK(
            bookingPrice(
              new Date(slotAt(date, selected.start)),
              new Date(slotAt(date, selected.start + selected.duration)),
              selectedCourt.priceNormal,
              selectedCourt.pricePeak,
            ),
          )}
          actionLabel="Gửi yêu cầu"
          onAction={() => {
            if (user?.role === 'OWNER') {
              navigate('/chu-san/yeu-cau');
              return;
            }
            if (!user) setLoginOpen(true);
            else setBookingOpen(true);
          }}
          secondary={{ label: 'Gọi chủ sân', href: `tel:${venue.phone}` }}
        />
      )}

      <LoginSheet
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onLoggedIn={() => setBookingOpen(true)}
      />

      {selected && selectedCourt && (
        <BookingSheet
          open={bookingOpen}
          court={selectedCourt}
          date={date}
          start={selected.start}
          duration={selected.duration}
          free={
            (() => {
              const s = stateOf(selectedCourt);
              return s?.status === 'ok' ? s.free : [];
            })()
          }
          now={now}
          onDuration={(duration) => setSelected((s) => (s ? { ...s, duration } : s))}
          onClose={() => setBookingOpen(false)}
          onBooked={() => {
            setSelected(undefined);
            for (const court of venue.courts) loadCourt(court.id, date);
          }}
          onConflict={() => {
            for (const court of venue.courts) loadCourt(court.id, date);
          }}
          onUnauthorized={() => {
            setBookingOpen(false);
            setUser(null);
            setLoginOpen(true);
          }}
        />
      )}
    </div>
  );
}
