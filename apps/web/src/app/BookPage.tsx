import {
  bookingPrice,
  confirmDeadline,
  minuteOfDayVN,
  vnDateString,
  addDaysYmd,
  type BookingView,
  type VenueView,
} from '@monsport/shared';
import { Calendar, ChevronLeft, Clock, MapPin, Phone } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { CourtArt } from '../components/CourtArt.tsx';
import { SlotGrid, type SlotCellInfo } from '../components/SlotGrid.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';
import {
  api,
  ApiError,
  DURATIONS,
  durationLabel,
  fitsAnyDuration,
  formatDay,
  formatSlot,
  formatTime,
  formatVnd,
  hhmm,
  slotAt as at,
} from '@monsport/client';
import { useSession } from './session.tsx';

const NOTICE = 'App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt.';

function formatDayChip(ymd: string) {
  // Noon UTC falls on the same calendar day in every time zone, so the weekday never depends on the machine (BR-27).
  const d = new Date(`${ymd}T12:00:00Z`);
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const dayOfWeek = days[d.getUTCDay()];
  const parts = ymd.split('-');
  return `${dayOfWeek} ${parts[2]}/${parts[1]}`;
}

export function BookPage() {
  const { user, bumpRefresh } = useSession();
  const navigate = useNavigate();
  const { id: routeVenueId } = useParams<{ id?: string }>();

  const [venues, setVenues] = useState<VenueView[]>([]);
  const [venuesLoaded, setVenuesLoaded] = useState(false);
  const [selectedCourtId, setSelectedCourtId] = useState<string>('');

  const todayStr = useMemo(() => vnDateString(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const [duration, setDuration] = useState<number>(60);

  const [cells, setCells] = useState<Record<string, SlotCellInfo[]>>({});
  const [result, setResult] = useState<BookingView | null>(null);
  const [error, setError] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [summaryExpanded, setSummaryExpanded] = useState<boolean>(false);

  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    api<VenueView[]>('/api/venues').then(
      (data) => {
        if (!active) return;
        setVenues(data);
        setVenuesLoaded(true);
      },
      () => {
        if (!active) return;
        setError('Không tải được danh sách đơn vị');
        setVenuesLoaded(true);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setSelectedCourtId('');
    setSelectedStart(null);
    setResult(null);
    setError('');
  }, [routeVenueId]);

  const selectedVenue = routeVenueId
    ? venues.find((v) => v.id === routeVenueId)
    : venues[0];
  const selectedCourt = selectedVenue?.courts.find((c) => c.id === selectedCourtId) ?? null;

  // Fetch availability for all courts in the selected venue on selectedDate.
  useEffect(() => {
    if (!selectedVenue || !selectedDate) return;
    let active = true;

    Promise.all(
      selectedVenue.courts.map((court) =>
        api<{ courtId: string; free: Array<{ startAt: string; endAt: string }> }>(
          `/api/courts/${court.id}/availability?date=${selectedDate}`,
        )
          .then((res) => ({ courtId: court.id, free: res?.free ?? [] }))
          .catch(() => ({ courtId: court.id, free: [] })),
      ),
    ).then((results) => {
      if (!active) return;
      const nextCells: Record<string, SlotCellInfo[]> = {};
      for (const res of results) {
        const courtCells: SlotCellInfo[] = [];
        for (let m = selectedVenue.opensAt; m < selectedVenue.closesAt; m += 30) {
          const slotStart = new Date(at(selectedDate, m)).toISOString();
          const slotEnd = new Date(at(selectedDate, m + 30)).toISOString();
          const isFree =
            fitsAnyDuration(m, selectedVenue.closesAt) &&
            res.free.some((r) => slotStart >= r.startAt && slotEnd <= r.endAt);
          courtCells.push({
            startMinute: m,
            status: isFree ? 'free' : 'taken',
          });
        }
        nextCells[res.courtId] = courtCells;
      }
      setCells(nextCells);
    });

    return () => {
      active = false;
    };
  }, [selectedVenue?.id, selectedDate]);

  const gridCells = useMemo(() => {
    if (!selectedVenue) return cells;
    const mapped: Record<string, SlotCellInfo[]> = {};
    for (const court of selectedVenue.courts) {
      const courtCells = cells[court.id];
      if (courtCells) {
        mapped[court.id] = courtCells.map((c) =>
          fitsAnyDuration(c.startMinute, selectedVenue.closesAt) ? c : { ...c, status: 'taken' as const },
        );
      } else {
        mapped[court.id] = [];
        for (let m = selectedVenue.opensAt; m < selectedVenue.closesAt; m += 30) {
          mapped[court.id].push({
            startMinute: m,
            status: fitsAnyDuration(m, selectedVenue.closesAt) ? 'free' : 'taken',
          });
        }
      }
    }
    return mapped;
  }, [cells, selectedVenue]);

  // Date list: today + next 6 days.
  const dateOptions = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const ymd = addDaysYmd(todayStr, i);
      return {
        ymd,
        label: i === 0 ? 'Hôm nay' : formatDayChip(ymd),
      };
    });
  }, [todayStr]);

  const isOtherDate = !dateOptions.some((d) => d.ymd === selectedDate);

  const price = useMemo(() => {
    if (!selectedCourt || selectedStart === null || !selectedDate) return null;
    const startAt = new Date(at(selectedDate, selectedStart));
    const endAt = new Date(at(selectedDate, selectedStart + duration));
    return bookingPrice(startAt, endAt, selectedCourt.priceNormal, selectedCourt.pricePeak);
  }, [selectedCourt, selectedDate, selectedStart, duration]);

  const deadlineHint = useMemo(() => {
    if (selectedStart === null || !selectedDate) return null;
    const now = new Date();
    const startAt = new Date(at(selectedDate, selectedStart));
    const dl = confirmDeadline(now, startAt);
    const timeStr = hhmm(minuteOfDayVN(dl));
    const isToday = vnDateString(dl) === vnDateString(now);
    const dayStr = isToday ? 'hôm nay' : formatDay(vnDateString(dl));
    return `Chủ sân xác nhận trước ${timeStr} ${dayStr}. Bạn trả tiền tại sân.`;
  }, [selectedDate, selectedStart]);

  async function handleSubmitBooking() {
    if (!user) {
      navigate('/dang-nhap');
      return;
    }
    if (!selectedCourt || selectedStart === null || !selectedDate) return;

    setError('');
    setResult(null);
    setBusy(true);

    try {
      const booking = await api<BookingView>('/api/bookings', {
        method: 'POST',
        json: {
          courtId: selectedCourt.id,
          startAt: at(selectedDate, selectedStart),
          endAt: at(selectedDate, selectedStart + duration),
        },
      });
      setResult(booking);
      bumpRefresh();
      resultRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Khung giờ này vừa có người đặt');
      } else {
        setError(err instanceof ApiError ? err.message : 'Không gửi được yêu cầu');
      }
    } finally {
      setBusy(false);
    }
  }

  if (venuesLoaded && !selectedVenue) {
    return (
      <div className="page">
        <Link to="/san" className="back">
          <ChevronLeft size={16} className="ic" aria-hidden="true" />
          <span>Tất cả đơn vị</span>
        </Link>
        <div className="card empty">
          <span className="empty-ball" aria-hidden="true">
            <MapPin size={24} />
          </span>
          <h3>Không tìm thấy đơn vị này</h3>
          <p>{error || 'Đơn vị không tồn tại hoặc tạm thời không khả dụng.'}</p>
          <Link to="/san" className="btn lime sm">
            Tất cả đơn vị
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page book-page">
      <Link to="/san" className="back">
        <ChevronLeft size={16} className="ic" aria-hidden="true" />
        <span>Tất cả đơn vị</span>
      </Link>

      {selectedVenue && (
        <>
          <div className="card vhead">
            <div className="vhead-art">
              <CourtArt sport={selectedVenue.courts[0]?.sport ?? 'BADMINTON'} />
            </div>
            <div className="vhead-b">
              <h1>{selectedVenue.name}</h1>
              <div className="vhead-f">
                <span>
                  <MapPin size={15} className="ic" aria-hidden="true" />
                  <span>{selectedVenue.address}</span>
                </span>
                <span>
                  <Clock size={15} className="ic" aria-hidden="true" />
                  <span>{`Mở ${hhmm(selectedVenue.opensAt)}–${hhmm(selectedVenue.closesAt)}`}</span>
                </span>
                <a className="call" href={`tel:${selectedVenue.phone}`}>
                  <Phone size={15} className="ic" aria-hidden="true" />
                  <span>{`Gọi chủ sân ${selectedVenue.phone}`}</span>
                </a>
              </div>
            </div>
          </div>

          <div className="book">
            <div className="card book-main">
              <div className="book-top">
                <h2>Chọn giờ</h2>
                <div className="legend">
                  <span className="lg">Còn trống</span>
                  <span className="lg booked">Đã có người</span>
                  <span className="lg peak">Giờ cao điểm</span>
                  <span className="lg on">Bạn chọn</span>
                </div>
              </div>

              <div className="days date-chips" role="group" aria-label="Chọn ngày">
                {dateOptions.map((opt) => {
                  const active = selectedDate === opt.ymd;
                  return (
                    <button
                      type="button"
                      key={opt.ymd}
                      className={active ? 'on selected' : ''}
                      aria-pressed={active}
                      onClick={() => {
                        setSelectedDate(opt.ymd);
                        setSelectedStart(null);
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
                <label className={`day-picker ${isOtherDate ? 'on selected' : ''}`}>
                  <Calendar size={14} className="ic" aria-hidden="true" />
                  <span>Ngày khác</span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setSelectedStart(null);
                    }}
                    style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
                  />
                </label>
              </div>

              <p className="notice warnbox book-uc2-notice">{NOTICE}</p>

              <SlotGrid
                courts={selectedVenue.courts}
                date={selectedDate}
                cells={gridCells}
                mode="pick"
                selected={
                  selectedCourtId && selectedStart !== null
                    ? Array.from({ length: Math.floor(duration / 30) }, (_, i) => ({
                        courtId: selectedCourtId,
                        startMinute: selectedStart + i * 30,
                      }))
                    : null
                }
                onPick={(cId, minute) => {
                  if (!fitsAnyDuration(minute, selectedVenue.closesAt)) return;
                  setSelectedCourtId(cId);
                  setSelectedStart(minute);
                  const allowed = DURATIONS.filter((d) => minute + d <= selectedVenue.closesAt);
                  const maxAllowed = allowed.length > 0 ? Math.max(...allowed) : 60;
                  if (duration > maxAllowed) setDuration(maxAllowed);
                }}
                opensAt={selectedVenue.opensAt}
                closesAt={selectedVenue.closesAt}
              />
            </div>

            <aside className="book-side">
              <section className={`card sum summary-section ${summaryExpanded ? 'expanded' : ''}`}>
                <button
                  type="button"
                  className="book-sum-toggle"
                  aria-expanded={summaryExpanded}
                  onClick={() => setSummaryExpanded((v) => !v)}
                >
                  <span>Tạm tính</span>
                  <b className="money tnum">{price !== null ? formatVnd(price) : '—'}</b>
                  <span className="link">{summaryExpanded ? 'Thu gọn' : 'Chi tiết'}</span>
                </button>
                <h2>Đặt sân</h2>

                <dl className="sum-list tnum">
                  <div className="sum-row">
                    <dt>Sân</dt>
                    <dd>{selectedCourt ? selectedCourt.name : 'Chưa chọn'}</dd>
                  </div>
                  <div className="sum-row">
                    <dt>Ngày</dt>
                    <dd>{selectedDate ? formatDay(selectedDate) : '—'}</dd>
                  </div>
                  <div className="sum-row">
                    <dt>Giờ</dt>
                    <dd>
                      {selectedStart !== null
                        ? `${hhmm(selectedStart)}–${hhmm(selectedStart + duration)}`
                        : 'Chưa chọn'}
                    </dd>
                  </div>
                  <div className="sum-row">
                    <dt>Thời lượng</dt>
                    <dd>
                      <select
                        value={duration}
                        onChange={(e) => setDuration(Number(e.target.value))}
                        className="duration-select"
                        aria-label="Thời lượng"
                      >
                        {DURATIONS.filter(
                          (d) => (selectedStart ?? selectedVenue.opensAt) + d <= selectedVenue.closesAt,
                        ).map((d) => (
                          <option key={d} value={d}>
                            {durationLabel(d)}
                          </option>
                        ))}
                      </select>
                    </dd>
                  </div>
                </dl>

                <div className="sum-total total">
                  <span>Tạm tính</span>
                  <strong className="money tnum">{price !== null ? formatVnd(price) : '—'}</strong>
                </div>

                {error && <p className="error bad" role="alert">{error}</p>}

                <button
                  type="button"
                  className="btn lime wide"
                  disabled={!selectedCourt || selectedStart === null || busy}
                  onClick={handleSubmitBooking}
                >
                  Gửi yêu cầu
                </button>

                {selectedStart !== null && selectedVenue.phone && (
                  <a
                    className="call link call-owner-link"
                    href={`tel:${selectedVenue.phone}`}
                  >
                    <Phone size={14} className="ic" aria-hidden="true" />
                    <span>Gọi chủ sân</span>
                  </a>
                )}

                {deadlineHint && (
                  <div className="hint">
                    <Clock size={16} className="ic" aria-hidden="true" />
                    <span>{deadlineHint}</span>
                  </div>
                )}

                <div role="status" className="live">
                  {result && (
                    <div ref={resultRef} className="ticket result" data-status={result.status}>
                      <span className="stub">
                        <strong>{formatTime(result.startAt)}</strong>
                        <span>đến {formatTime(result.endAt)}</span>
                      </span>
                      <span className="body">
                        <StatusBadge status={result.status} />
                        <span>{formatSlot(result.startAt, result.endAt)}</span>
                        <strong className="money">{formatVnd(result.priceTotal)}</strong>
                      </span>
                    </div>
                  )}
                </div>
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
