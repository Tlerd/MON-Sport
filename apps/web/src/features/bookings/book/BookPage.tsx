import {
  bookingPrice,
  confirmDeadline,
  minuteOfDayVN,
  vnDateString,
  type BookingView,
  type SessionUser,
} from '@monsport/shared';
import {
  ApiError,
  errorMessage,
  api,
  DURATIONS,
  fitsAnyDuration,
  formatDay,
  hhmm,
  slotAt as at,
} from '@monsport/client';
import { Calendar, ChevronLeft, Clock, MapPin, Phone } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { CourtArt } from '../../../components/CourtArt.tsx';
import { SlotGrid } from '../../../components/SlotGrid.tsx';
import { BookingSummary } from './BookingSummary.tsx';
import { useCourtAvailability } from './useCourtAvailability.ts';

const NOTICE = 'App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt.';

export interface BookPageProps {
  user?: SessionUser | null;
  onBooked?: () => void;
}

export function BookPage({ user = null, onBooked }: BookPageProps = {}) {
  const navigate = useNavigate();
  const { id: routeVenueId } = useParams<{ id?: string }>();

  const {
    venuesLoaded,
    selectedVenue,
    selectedDate,
    setSelectedDate,
    gridCells,
    dateOptions,
    isOtherDate,
    error,
    setError,
  } = useCourtAvailability(routeVenueId);

  const [selectedCourtId, setSelectedCourtId] = useState<string>('');
  const [selectedStart, setSelectedStart] = useState<number | null>(null);
  const [duration, setDuration] = useState<number>(60);
  const [result, setResult] = useState<BookingView | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedCourtId('');
    setSelectedStart(null);
    setResult(null);
    setError('');
  }, [routeVenueId, setError]);

  const selectedCourt = selectedVenue?.courts.find((c) => c.id === selectedCourtId) ?? null;

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
      onBooked?.();
      resultRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Khung giờ này vừa có người đặt');
      } else {
        setError(errorMessage(err, 'Không gửi được yêu cầu'));
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

            <BookingSummary
              selectedVenue={selectedVenue}
              selectedCourt={selectedCourt}
              selectedDate={selectedDate}
              selectedStart={selectedStart}
              duration={duration}
              onDurationChange={setDuration}
              price={price}
              deadlineHint={deadlineHint}
              error={error}
              busy={busy}
              result={result}
              resultRef={resultRef}
              onSubmit={() => void handleSubmitBooking()}
            />
          </div>
        </>
      )}
    </div>
  );
}
