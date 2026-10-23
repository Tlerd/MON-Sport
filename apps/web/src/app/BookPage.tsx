import {
  bookingPrice,
  confirmDeadline,
  minuteOfDayVN,
  vnDateString,
  addDaysYmd,
  type BookingView,
  type VenueView,
  type CourtView,
} from '@monsport/shared';
import { Calendar, Clock, MapPin, Phone } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Chip } from '../components/Chip.tsx';
import { SportIcon } from '../components/icons.tsx';
import { SlotGrid, hhmm, type SlotCellInfo } from '../components/SlotGrid.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { api, ApiError } from '../lib/api.ts';
import { formatDay, formatSlot, formatTime, formatVnd } from '../lib/format.ts';
import { useSession } from './session.tsx';
import { DURATIONS, fitsAnyDuration, slotAt as at } from '../features/bookings/slot.ts';
import { findVenues, normalizeName } from '../features/venues/search.ts';

const NOTICE = 'App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt.';

function CourtLines() {
  return (
    <svg className="court-lines" viewBox="0 0 134 61" aria-hidden="true">
      <rect x="0.5" y="0.5" width="133" height="60" fill="none" stroke="currentColor" strokeWidth="1" />
      <line x1="67" y1="0.5" x2="67" y2="60.5" stroke="currentColor" strokeWidth="1" />
      <line x1="20" y1="0.5" x2="20" y2="60.5" stroke="currentColor" strokeWidth="1" />
      <line x1="114" y1="0.5" x2="114" y2="60.5" stroke="currentColor" strokeWidth="1" />
      <line x1="20" y1="30.5" x2="114" y2="30.5" stroke="currentColor" strokeWidth="1" />
      <line x1="0.5" y1="4.5" x2="133.5" y2="4.5" stroke="currentColor" strokeWidth="1" />
      <line x1="0.5" y1="56.5" x2="133.5" y2="56.5" stroke="currentColor" strokeWidth="1" />
      <line x1="7.5" y1="0.5" x2="7.5" y2="60.5" stroke="currentColor" strokeWidth="1" />
      <line x1="126.5" y1="0.5" x2="126.5" y2="60.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

function formatDayChip(ymd: string) {
  // Noon UTC falls on the same calendar day in every time zone, so the weekday never depends on the machine (BR-27).
  const d = new Date(`${ymd}T12:00:00Z`);
  const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const dayOfWeek = days[d.getUTCDay()];
  const parts = ymd.split('-');
  return `${dayOfWeek} ${parts[2]}/${parts[1]}`;
}

function formatPriceRange(courts: CourtView[]): string {
  if (courts.length === 0) return '—';
  const minNormal = Math.min(...courts.map((c) => c.priceNormal));
  const maxPeak = Math.max(...courts.map((c) => c.pricePeak));
  const minK = Math.round(minNormal / 1000);
  const maxK = Math.round(maxPeak / 1000);
  return minK === maxK ? `${minK}k` : `${minK}k–${maxK}k`;
}

export function BookPage() {
  const { user, bumpRefresh } = useSession();
  const navigate = useNavigate();
  const { id: routeVenueId } = useParams<{ id?: string }>();

  const [venues, setVenues] = useState<VenueView[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string>('');
  const [selectedCourtId, setSelectedCourtId] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [sportFilter, setSportFilter] = useState<'ALL' | 'BADMINTON' | 'FOOTBALL'>('ALL');

  const todayStr = useMemo(() => vnDateString(new Date()), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const [duration, setDuration] = useState<number>(60);

  const [cells, setCells] = useState<Record<string, SlotCellInfo[]>>({});
  const [result, setResult] = useState<BookingView | null>(null);
  const [error, setError] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);

  const dateInputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<VenueView[]>('/api/venues').then(
      (data) => {
        setVenues(data);
        if (data.length > 0) {
          if (routeVenueId && data.some((v) => v.id === routeVenueId)) {
            setSelectedVenueId(routeVenueId);
          } else if (!selectedVenueId) {
            setSelectedVenueId(data[0].id);
          }
        }
      },
      () => setError('Không tải được danh sách đơn vị'),
    );
  }, [routeVenueId]);

  const selectedVenue = venues.find((v) => v.id === selectedVenueId) ?? venues[0];
  const selectedCourt = selectedVenue?.courts.find((c) => c.id === selectedCourtId) ?? null;

  // Fetch availability for all courts in the selected venue on selectedDate
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
    const result: Record<string, SlotCellInfo[]> = {};
    for (const court of selectedVenue.courts) {
      const courtCells = cells[court.id];
      if (courtCells) {
        result[court.id] = courtCells.map((c) => {
          if (!fitsAnyDuration(c.startMinute, selectedVenue.closesAt)) {
            return { ...c, status: 'taken' as const };
          }
          return c;
        });
      } else {
        result[court.id] = [];
        for (let m = selectedVenue.opensAt; m < selectedVenue.closesAt; m += 30) {
          result[court.id].push({
            startMinute: m,
            status: fitsAnyDuration(m, selectedVenue.closesAt) ? 'free' : 'taken',
          });
        }
      }
    }
    return result;
  }, [cells, selectedVenue]);

  // Date list: today + next 6 days
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

  // Filtered venues for left pane using findVenues for court-name search
  const filteredVenues = useMemo(() => {
    const isSearching = normalizeName(search) !== '';
    const matchingVenueIds = isSearching
      ? new Set(findVenues(venues, search).map((m) => m.venue.id))
      : null;

    return venues.filter((v) => {
      const matchSearch = matchingVenueIds ? matchingVenueIds.has(v.id) : true;
      const matchSport =
        sportFilter === 'ALL' || v.courts.some((c) => c.sport === sportFilter);
      return matchSearch && matchSport;
    });
  }, [venues, search, sportFilter]);

  // Calculated price
  const price = useMemo(() => {
    if (!selectedCourt || selectedStart === null || !selectedDate) return null;
    const startAt = new Date(at(selectedDate, selectedStart));
    const endAt = new Date(at(selectedDate, selectedStart + duration));
    return bookingPrice(startAt, endAt, selectedCourt.priceNormal, selectedCourt.pricePeak);
  }, [selectedCourt, selectedDate, selectedStart, duration]);

  // Deadline hint
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

  return (
    <div className="book-page">
      {!user && (
        <div className="hero">
          <CourtLines />
          <h1>Đặt sân cầu lông, bóng đá</h1>
          <p>Chọn giờ trống, gửi yêu cầu, chủ sân xác nhận.</p>
        </div>
      )}

      <div className="book-page-panes">
        <section className="pane-left-mid" aria-labelledby="heading-gio-trong">
          {/* Left Pane (300px): Search, Sport Chips, Venue List */}
          <aside className="pane pane-l" aria-label="Tìm kiếm và danh sách sân">
            <div className="search-box stack">
              <label>
                Tìm theo tên sân
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm sân theo tên..."
                />
              </label>
            </div>

            <div className="chips sport-chips">
              <Chip
                selected={sportFilter === 'ALL'}
                onClick={() => setSportFilter('ALL')}
              >
                Tất cả
              </Chip>
              <Chip
                selected={sportFilter === 'BADMINTON'}
                icon={<SportIcon sport="BADMINTON" size={16} />}
                onClick={() => setSportFilter('BADMINTON')}
              >
                Cầu lông
              </Chip>
              <Chip
                selected={sportFilter === 'FOOTBALL'}
                icon={<SportIcon sport="FOOTBALL" size={16} />}
                onClick={() => setSportFilter('FOOTBALL')}
              >
                Bóng đá
              </Chip>
            </div>

            <div className="venue-list" role="list" aria-label="Danh sách đơn vị">
              {filteredVenues.map((v) => {
                const active = v.id === selectedVenue?.id;
                const primarySport = v.courts[0]?.sport ?? 'BADMINTON';
                return (
                  <div
                    key={v.id}
                    role="listitem"
                    className={`venue-card ${active ? 'on active' : ''}`}
                    onClick={() => {
                      setSelectedVenueId(v.id);
                      setSelectedCourtId('');
                      setSelectedStart(null);
                    }}
                  >
                    <span className="sport">
                      <SportIcon sport={primarySport} size={20} />
                    </span>
                    <div className="venue-card-body">
                      <b>{v.name}</b>
                      <span className="meta">
                        {v.courts.length} sân · {formatPriceRange(v.courts)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Middle Pane: Venue Details, Date Chips, SlotGrid */}
          <main className="pane pane-m">
            {selectedVenue ? (
              <>
                <div className="v-head">
                  <div className="grow">
                    <h2 id="heading-gio-trong">{selectedVenue.name}</h2>
                    <div className="meta">
                      <span>
                        <MapPin size={14} aria-hidden="true" /> {selectedVenue.address}
                      </span>
                      <span>· Mở {hhmm(selectedVenue.opensAt)}–{hhmm(selectedVenue.closesAt)}</span>
                      <span>
                        · <a className="call" href={`tel:${selectedVenue.phone}`}>
                          <Phone size={14} aria-hidden="true" /> Gọi chủ sân {selectedVenue.phone}
                        </a>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="chips date-chips" aria-label="Chọn ngày">
                  {dateOptions.map((opt) => (
                    <Chip
                      key={opt.ymd}
                      selected={selectedDate === opt.ymd}
                      onClick={() => {
                        setSelectedDate(opt.ymd);
                        setSelectedStart(null);
                      }}
                    >
                      {opt.label}
                    </Chip>
                  ))}
                  <label className={`chip ${isOtherDate ? 'on selected' : ''}`}>
                    <Calendar size={14} aria-hidden="true" />
                    <span>Ngày khác</span>
                    <input
                      ref={dateInputRef}
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
                    if (selectedVenue && !fitsAnyDuration(minute, selectedVenue.closesAt)) {
                      return;
                    }
                    setSelectedCourtId(cId);
                    setSelectedStart(minute);
                    if (selectedVenue) {
                      const allowed = DURATIONS.filter((d) => minute + d <= selectedVenue.closesAt);
                      const maxAllowed = allowed.length > 0 ? Math.max(...allowed) : 60;
                      if (duration > maxAllowed) {
                        setDuration(maxAllowed);
                      }
                    }
                  }}
                  opensAt={selectedVenue.opensAt}
                  closesAt={selectedVenue.closesAt}
                />

                <div className="legend">
                  <span><i />Còn trống</span>
                  <span><i className="taken-box" />Đã có người</span>
                  <span><i className="peak-box" />Giờ cao điểm</span>
                  <span><i className="sel-box" />Bạn chọn</span>
                </div>
              </>
            ) : (
              <h2 id="heading-gio-trong">Giờ trống</h2>
            )}
          </main>
        </section>

        {/* Right Pane (320px, sticky): Summary, Price, Submit */}
        <aside className="pane pane-r">
          <section className="summary-section">
            <h2>Đặt sân</h2>
            <p className="notice">{NOTICE}</p>

            <div className="sumbox card-web">
              <b>Yêu cầu của bạn</b>
              <dl className="tnum">
                <dt>Sân</dt>
                <dd>{selectedCourt ? selectedCourt.name : 'Chưa chọn'}</dd>
                <dt>Ngày</dt>
                <dd>{selectedDate ? formatDay(selectedDate) : '—'}</dd>
                <dt>Giờ</dt>
                <dd>
                  {selectedStart !== null
                    ? `${hhmm(selectedStart)}–${hhmm(selectedStart + duration)}`
                    : 'Chưa chọn'}
                </dd>
                <dt>Thời lượng</dt>
                <dd>
                  {selectedVenue ? (
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
                          {(d / 60).toLocaleString('vi-VN')} giờ
                        </option>
                      ))}
                    </select>
                  ) : (
                    '1 giờ'
                  )}
                </dd>
              </dl>

              <div className="total">
                <span className="meta">Tạm tính</span>
                <strong className="money tnum">{price !== null ? formatVnd(price) : '—'}</strong>
              </div>
            </div>

            {error && <p className="error" role="alert">{error}</p>}

            <button
              type="button"
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px' }}
              disabled={!selectedCourt || selectedStart === null || busy}
              onClick={handleSubmitBooking}
            >
              Gửi yêu cầu
            </button>

            {selectedStart !== null && selectedVenue?.phone && (
              <a
                className="call link call-owner-link"
                href={`tel:${selectedVenue.phone}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}
              >
                <Phone size={14} aria-hidden="true" />
                <span>Gọi chủ sân</span>
              </a>
            )}

            {deadlineHint && (
              <div className="hint">
                <Clock size={16} aria-hidden="true" />
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
    </div>
  );
}
