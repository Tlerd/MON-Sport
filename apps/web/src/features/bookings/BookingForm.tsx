import { bookingPrice, type BookingView, type VenueView } from '@monsport/shared';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../../lib/api.ts';
import { formatSlot, formatTime, formatVnd, hhmm } from '../../lib/format.ts';
import { STATUS_LABEL } from './status.ts';

const DURATIONS = [60, 90, 120, 150, 180];
const PEAK = [17 * 60, 22 * 60]; // BR-4
const at = (date: string, minute: number) => `${date}T${hhmm(minute)}:00+07:00`;

/** UC-2 (short form) and UC-3: pick a court and a slot, then send the request. */
export function BookingForm({ onBooked }: { onBooked?: (b: BookingView) => void }) {
  const [venues, setVenues] = useState<VenueView[]>([]);
  const [venueId, setVenueId] = useState('');
  const [courtId, setCourtId] = useState('');
  const [date, setDate] = useState('');
  const [start, setStart] = useState(0);
  const [duration, setDuration] = useState(60);
  const [result, setResult] = useState<BookingView | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<VenueView[]>('/api/venues').then(setVenues, () => setError('Không tải được danh sách đơn vị'));
  }, []);

  const venue = venues.find((v) => v.id === venueId);
  const court = venue?.courts.find((c) => c.id === courtId);
  const starts = useMemo(() => {
    if (!venue) return [];
    const list: number[] = [];
    for (let m = venue.opensAt; m + 60 <= venue.closesAt; m += 30) list.push(m);
    return list;
  }, [venue]);
  const price = court && date ? bookingPrice(new Date(at(date, start)), new Date(at(date, start + duration)), court.priceNormal, court.pricePeak) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const booking = await api<BookingView>('/api/bookings', {
        method: 'POST',
        json: { courtId, startAt: at(date, start), endAt: at(date, start + duration) },
      });
      setResult(booking);
      onBooked?.(booking);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không gửi được yêu cầu');
    }
  }

  return (
    <section className="panel">
      <h2>Đặt sân</h2>
      <p className="notice">App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt.</p>
      <form onSubmit={submit} className="stack">
        <fieldset className="step">
          <legend><span className="step-no">1</span>Chọn sân</legend>
          <label>
            Đơn vị
            <select value={venueId} onChange={(e) => { setVenueId(e.target.value); setCourtId(''); setStart(venues.find((v) => v.id === e.target.value)?.opensAt ?? 0); }} required>
              <option value="">Chọn đơn vị</option>
              {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
          {venue && (
            <>
              <p className="venue-meta">
                <span>Mở cửa {hhmm(venue.opensAt)}–{hhmm(venue.closesAt)}</span>
                <a className="call" href={`tel:${venue.phone}`}>Gọi chủ sân {venue.phone}</a>
              </p>
              <label>
                Sân
                <select value={courtId} onChange={(e) => setCourtId(e.target.value)} required>
                  <option value="">Chọn sân</option>
                  {venue.courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            </>
          )}
        </fieldset>
        {venue && (
          <fieldset className="step">
            <legend><span className="step-no">2</span>Chọn giờ</legend>
            <div className="row">
              <label>
                Ngày
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </label>
              <label>
                Bắt đầu
                <select value={start} onChange={(e) => setStart(Number(e.target.value))}>
                  {starts.map((m) => <option key={m} value={m}>{hhmm(m)}</option>)}
                </select>
              </label>
              <label>
                Thời lượng
                <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                  {DURATIONS.filter((d) => start + d <= venue.closesAt).map((d) => <option key={d} value={d}>{(d / 60).toLocaleString('vi-VN')} giờ</option>)}
                </select>
              </label>
            </div>
            <SlotBar start={start} duration={duration} />
          </fieldset>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="checkout">
          <span className="total">
            <span>Tạm tính</span>
            <strong className="money">{price !== null ? formatVnd(price) : '—'}</strong>
          </span>
          <button type="submit" disabled={!court || !date}>Gửi yêu cầu</button>
        </div>
      </form>
      {result && (
        <div className="ticket result" data-status={result.status} role="status">
          <span className="stub">
            <strong>{formatTime(result.startAt)}</strong>
            <span>đến {formatTime(result.endAt)}</span>
          </span>
          <span className="body">
            <span className="status">{STATUS_LABEL[result.status]}</span>
            <span>{formatSlot(result.startAt, result.endAt)}</span>
            <span className="money">{formatVnd(result.priceTotal)}</span>
          </span>
        </div>
      )}
    </section>
  );
}

/** The chosen slot cut into 30-minute pieces. Floodlight amber marks the peak pieces (BR-4). */
function SlotBar({ start, duration }: { start: number; duration: number }) {
  const pieces = Array.from({ length: duration / 30 }, (_, i) => start + i * 30);
  const hasPeak = pieces.some((m) => m >= PEAK[0] && m < PEAK[1]);
  return (
    <div className="slot">
      <div className="slotbar" aria-hidden="true">
        {pieces.map((m) => <span key={m} className={m >= PEAK[0] && m < PEAK[1] ? 'peak' : ''}>{hhmm(m)}</span>)}
        <span className="end">{hhmm(start + duration)}</span>
      </div>
      {hasPeak && <p className="hint">Ô vàng là giờ cao điểm (17:00–22:00), giá cao hơn.</p>}
    </div>
  );
}
