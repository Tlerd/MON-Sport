import { api, ApiError, dayHeading, formatVnd, hhmm, joinedByOthers, splitMine } from '@monsport/client';
import {
  MATCH_CAPACITY_MESSAGE,
  MATCH_PRICE_MESSAGE,
  minuteOfDayVN,
  PRICE_MAX,
  vnDateString,
  type JoinMode,
  type MatchView,
  type MyBookingView,
} from '@monsport/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSession } from '../../app/session.tsx';
import { Chip } from '../../components/Chip.tsx';
import { ContextBar } from '../../components/ContextBar.tsx';
import { EmptyState } from '../../components/EmptyState.tsx';
import { Sheet } from '../../components/Sheet.tsx';
import { LoginSheet } from '../auth/LoginSheet.tsx';
import { BookingCard } from './BookingCard.tsx';
import { MatchCard } from './MatchCard.tsx';

type Tab = 'UPCOMING' | 'JOINED' | 'HISTORY';

const JOIN_MODE_OPTIONS: { value: JoinMode; label: string }[] = [
  { value: 'INSTANT', label: 'Vào ngay' },
  { value: 'APPROVAL', label: 'Host duyệt' },
];

export interface MyScreenProps {
  now?: Date;
}

export function MyScreen({ now: nowProp }: MyScreenProps) {
  const navigate = useNavigate();
  const { user } = useSession();
  const now = nowProp ?? new Date();

  const [tab, setTab] = useState<Tab>('UPCOMING');
  const [bookings, setBookings] = useState<MyBookingView[] | undefined>(undefined);
  const [matches, setMatches] = useState<MatchView[] | undefined>(undefined);
  const [bookingsFailed, setBookingsFailed] = useState(false);
  const [joinedFailed, setJoinedFailed] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<MyBookingView | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [openTarget, setOpenTarget] = useState<MyBookingView | null>(null);
  const [openCapacity, setOpenCapacity] = useState('10');
  const [openPrice, setOpenPrice] = useState('0');
  const [openJoinMode, setOpenJoinMode] = useState<JoinMode>('INSTANT');
  const [openBusy, setOpenBusy] = useState(false);
  const [openError, setOpenError] = useState('');
  const [sessionLoginOpen, setSessionLoginOpen] = useState(false);

  const reqCounter = useRef(0);

  const load = useCallback(() => {
    setBookingsFailed(false);
    setJoinedFailed(false);
    const reqId = ++reqCounter.current;
    Promise.allSettled([
      api<MyBookingView[]>('/api/bookings/mine'),
      api<MatchView[]>('/api/matches/joined'),
    ]).then(([bRes, mRes]) => {
      if (reqId !== reqCounter.current) return;
      if (bRes.status === 'fulfilled') {
        setBookings(bRes.value);
      } else {
        setBookingsFailed(true);
      }
      if (mRes.status === 'fulfilled') {
        setMatches(mRes.value);
      } else {
        setJoinedFailed(true);
      }
    });
  }, []);

  useEffect(() => {
    if (user?.role === 'OWNER') {
      navigate('/chu-san/yeu-cau', { replace: true });
    }
  }, [user?.role, navigate]);

  useEffect(() => {
    reqCounter.current++;
    setBookings(undefined);
    setMatches(undefined);
    if (user && user.role !== 'OWNER') {
      load();
    }
  }, [user?.id, load]);

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
  }, [user?.id, load]);

  const openCancel = (booking: MyBookingView) => {
    setCancelError('');
    setCancelTarget(booking);
  };

  const closeCancel = () => {
    setCancelTarget(null);
    setCancelError('');
  };

  const confirmCancel = async () => {
    if (!cancelTarget || cancelBusy) return;
    setCancelBusy(true);
    setCancelError('');
    try {
      await api(`/api/bookings/${cancelTarget.id}/cancel`, { method: 'POST' });
      setCancelTarget(null);
      load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setCancelTarget(null);
        setSessionLoginOpen(true);
      } else if (err instanceof ApiError) {
        setCancelError(err.message);
        if (err.status === 409) load();
      } else {
        setCancelError('Không kết nối được. Thử lại sau');
      }
    } finally {
      setCancelBusy(false);
    }
  };

  const capacityNum = openCapacity.trim() === '' ? Number.NaN : Number(openCapacity);
  const priceNum = openPrice.trim() === '' ? Number.NaN : Number(openPrice);
  const capacityValid = Number.isInteger(capacityNum) && capacityNum >= 2 && capacityNum <= 30;
  const priceValid = Number.isInteger(priceNum) && priceNum >= 0 && priceNum <= PRICE_MAX;
  const openValidationMessage = !capacityValid
    ? MATCH_CAPACITY_MESSAGE
    : !priceValid
      ? MATCH_PRICE_MESSAGE
      : '';
  const openAlert = openValidationMessage || openError;

  // The sheet that a reply belongs to: a late reply for booking A must not close or change the sheet of booking B.
  const openTargetId = useRef<string | null>(null);

  const openMatch = (booking: MyBookingView) => {
    openTargetId.current = booking.id;
    setOpenError('');
    setOpenCapacity('10');
    setOpenPrice('0');
    setOpenJoinMode('INSTANT');
    setOpenTarget(booking);
  };

  const closeOpenMatch = () => {
    openTargetId.current = null;
    setOpenTarget(null);
    setOpenError('');
  };

  const confirmOpenMatch = async () => {
    if (!openTarget || openBusy || openValidationMessage) return;
    const targetId = openTarget.id;
    setOpenBusy(true);
    setOpenError('');
    try {
      await api<MatchView>('/api/matches', {
        method: 'POST',
        json: {
          bookingId: targetId,
          capacity: capacityNum,
          pricePerSlot: priceNum,
          joinMode: openJoinMode,
        },
      });
      if (openTargetId.current === targetId) {
        openTargetId.current = null;
        setOpenTarget(null);
      }
      load();
    } catch (err) {
      const same = openTargetId.current === targetId;
      if (err instanceof ApiError && err.status === 401) {
        if (same) {
          openTargetId.current = null;
          setOpenTarget(null);
        }
        setSessionLoginOpen(true);
      } else if (err instanceof ApiError) {
        if (same) setOpenError(err.message);
        if (err.status === 409) load();
      } else if (same) {
        setOpenError('Không kết nối được. Thử lại sau');
      }
    } finally {
      setOpenBusy(false);
    }
  };

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

      <Sheet
        open={openTarget !== null}
        onClose={closeOpenMatch}
        title="Mở trận"
        primaryAction={{
          label: 'Mở trận',
          onClick: confirmOpenMatch,
          disabled: openBusy || Boolean(openValidationMessage),
        }}
      >
        {openTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
              <div style={{ font: 'var(--font-body-strong)' }}>
                {`${openTarget.venueName} · ${openTarget.courtName}`}
              </div>
              <div style={{ font: 'var(--font-body)' }}>
                {dayHeading(vnDateString(new Date(openTarget.startAt)))}
              </div>
              <div className="tnum" style={{ font: 'var(--font-numeric)', color: 'var(--color-ink-muted)' }}>
                {`${hhmm(minuteOfDayVN(new Date(openTarget.startAt)))}–${hhmm(minuteOfDayVN(new Date(openTarget.endAt)))}`}
              </div>
            </div>

            <div>
              <label
                htmlFor="open-match-capacity"
                style={{ display: 'block', font: 'var(--font-label)', marginBottom: 'var(--space-xs)' }}
              >
                Số suất
              </label>
              <input
                id="open-match-capacity"
                type="number"
                inputMode="numeric"
                min={2}
                max={30}
                value={openCapacity}
                onChange={(e) => {
                  setOpenError('');
                  setOpenCapacity(e.target.value);
                }}
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-line)',
                  padding: '0 var(--space-md)',
                  font: 'var(--font-body)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="open-match-price"
                style={{ display: 'block', font: 'var(--font-label)', marginBottom: 'var(--space-xs)' }}
              >
                Giá mỗi suất
              </label>
              <input
                id="open-match-price"
                type="number"
                inputMode="numeric"
                min={0}
                max={PRICE_MAX}
                value={openPrice}
                onChange={(e) => {
                  setOpenError('');
                  setOpenPrice(e.target.value);
                }}
                style={{
                  width: '100%',
                  height: '44px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-line)',
                  padding: '0 var(--space-md)',
                  font: 'var(--font-body)',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <fieldset style={{ margin: 0, padding: 0, border: 'none', minWidth: 0 }}>
              <legend style={{ padding: 0, font: 'var(--font-label)', marginBottom: 'var(--space-xs)' }}>
                Cách vào trận
              </legend>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                {JOIN_MODE_OPTIONS.map(({ value, label }) => {
                  const on = openJoinMode === value;
                  return (
                    <label
                      key={value}
                      style={{
                        position: 'relative',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '44px',
                        minWidth: '44px',
                        padding: '0 var(--space-md)',
                        boxSizing: 'border-box',
                        borderRadius: 'var(--radius-full)',
                        border: `1px solid ${on ? 'var(--color-primary)' : 'var(--color-line)'}`,
                        backgroundColor: on ? 'var(--color-primary)' : 'var(--color-surface)',
                        color: on ? 'var(--color-on-primary)' : 'var(--color-ink)',
                        font: 'var(--font-label)',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="radio"
                        name="open-match-join-mode"
                        value={value}
                        checked={on}
                        onChange={() => {
                          setOpenError('');
                          setOpenJoinMode(value);
                        }}
                        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                      />
                      {label}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {openAlert && (
              <p
                role="alert"
                style={{ margin: 0, font: 'var(--font-meta)', color: 'var(--color-status-no)' }}
              >
                {openAlert}
              </p>
            )}
          </div>
        )}
      </Sheet>

      <Sheet
        open={cancelTarget !== null}
        onClose={closeCancel}
        title="Hủy booking này?"
        primaryAction={{ label: 'Hủy booking', onClick: confirmCancel, disabled: cancelBusy }}
      >
        {cancelTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
            <div style={{ font: 'var(--font-body-strong)' }}>
              {`${cancelTarget.venueName} · ${cancelTarget.courtName}`}
            </div>
            <div style={{ font: 'var(--font-body)' }}>
              {dayHeading(vnDateString(new Date(cancelTarget.startAt)))}
            </div>
            <div className="tnum" style={{ font: 'var(--font-numeric)', color: 'var(--color-ink-muted)' }}>
              {`${hhmm(minuteOfDayVN(new Date(cancelTarget.startAt)))}–${hhmm(minuteOfDayVN(new Date(cancelTarget.endAt)))}`}
              {' · '}
              {formatVnd(cancelTarget.priceTotal)}
            </div>
            {cancelError && (
              <p
                role="alert"
                style={{ margin: 0, font: 'var(--font-meta)', color: 'var(--color-status-no)' }}
              >
                {cancelError}
              </p>
            )}
          </div>
        )}
      </Sheet>

      <LoginSheet
        open={sessionLoginOpen}
        onClose={() => setSessionLoginOpen(false)}
        onLoggedIn={load}
        notice="Phiên đăng nhập đã hết. Hãy đăng nhập lại."
      />
    </div>
  );
}
