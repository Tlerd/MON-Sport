import { bookingPrice, type BookingView, minuteOfDayVN, type OwnerBookingView, type VenueView } from '@monsport/shared';
import { type FormEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '../../lib/api.ts';
import { formatDay, formatSlot, formatTime, formatVnd, hhmm } from '../../lib/format.ts';
import { SlotBar } from './BookingForm.tsx';
import { Customer } from './customer.tsx';
import { DURATIONS, slotAt as at } from './slot.ts';
import { STATUS_LABEL } from './status.ts';

/** "YYYY-MM-DD" of today in Asia/Ho_Chi_Minh (BR-27). */
const todayVN = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const byStart = (a: OwnerBookingView, b: OwnerBookingView) => a.startAt.localeCompare(b.startAt);

/** Brief F-007 (UC-5): the owner enters the booking of a customer who phoned, and cancels it when the customer calls again. */
export function PhoneBookings() {
  const [rows, setRows] = useState<OwnerBookingView[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const now = new Date().toISOString();
    api<OwnerBookingView[]>('/api/owner/bookings?status=CONFIRMED').then(
      (list) => setRows(list.filter((b) => new Date(b.endAt).toISOString() > now).sort(byStart)),
      () => setError('Không tải được danh sách booking'),
    );
  }, []);

  return (
    <>
      <PhoneBookingForm onSaved={(b) => setRows((list) => [...(list ?? []), b].sort(byStart))} />
      <ConfirmedBookings rows={rows} error={error} onCancelled={(b) => setRows((list) => list?.map((r) => (r.id === b.id ? { ...r, ...b, customer: r.customer } : r)) ?? null)} />
    </>
  );
}

function PhoneBookingForm({ onSaved }: { onSaved: (b: OwnerBookingView) => void }) {
  const [venues, setVenues] = useState<VenueView[]>([]);
  const [courtId, setCourtId] = useState('');
  const [date, setDate] = useState(todayVN);
  const [start, setStart] = useState(0);
  const [duration, setDuration] = useState(60);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<VenueView[]>('/api/owner/venues').then(setVenues, () => setError('Không tải được danh sách sân'));
  }, []);

  const venue = venues.find((v) => v.courts.some((c) => c.id === courtId));
  const court = venue?.courts.find((c) => c.id === courtId);
  const starts = useMemo(() => {
    const today = todayVN();
    if (!venue || !date || date < today) return [];
    const after = date === today ? minuteOfDayVN(new Date()) : -1;
    const list: number[] = [];
    for (let m = venue.opensAt; m + 60 <= venue.closesAt; m += 30) if (m > after) list.push(m);
    return list;
  }, [venue, date]);
  // A start that left the list (another venue, another day) falls back to the first one listed.
  const begin = starts.includes(start) ? start : starts[0];
  const durations = venue && begin !== undefined ? DURATIONS.filter((d) => begin + d <= venue.closesAt) : [];
  const length = durations.includes(duration) ? duration : 60;
  const price = court && begin !== undefined ? bookingPrice(new Date(at(date, begin)), new Date(at(date, begin + length)), court.priceNormal, court.pricePeak) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (begin === undefined || busy) return;
    setError('');
    setSaved('');
    setBusy(true);
    try {
      const booking = await api<OwnerBookingView>('/api/owner/bookings', {
        method: 'POST',
        json: {
          courtId,
          startAt: at(date, begin),
          endAt: at(date, begin + length),
          ...(name.trim() && { customerName: name.trim() }),
          ...(phone.trim() && { customerPhone: phone.trim() }),
        },
      });
      onSaved(booking);
      setSaved(`Đã lưu booking ${formatTime(booking.startAt)}–${formatTime(booking.endAt)} ngày ${formatDay(booking.startAt)}.`);
      setName('');
      setPhone('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được booking');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>Nhập booking khách gọi điện</h2>
      <p className="hint lead">Booking bạn nhập ở trạng thái "Đã xác nhận" ngay, và chặn khung giờ đó trong app.</p>
      <form onSubmit={submit} className="stack">
        <label>
          Sân
          <select value={courtId} onChange={(e) => setCourtId(e.target.value)} required>
            <option value="">Chọn sân</option>
            {venues.flatMap((v) => v.courts.map((c) => <option key={c.id} value={c.id}>{`${v.name} · ${c.name}`}</option>))}
          </select>
        </label>
        <div className="row">
          <label>
            Ngày
            <input type="date" value={date} min={todayVN()} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label>
            Bắt đầu
            <select value={begin ?? ''} onChange={(e) => setStart(Number(e.target.value))} disabled={starts.length === 0}>
              {starts.map((m) => <option key={m} value={m}>{hhmm(m)}</option>)}
            </select>
          </label>
          <label>
            Thời lượng
            <select value={length} onChange={(e) => setDuration(Number(e.target.value))} disabled={durations.length === 0}>
              {durations.map((d) => <option key={d} value={d}>{(d / 60).toLocaleString('vi-VN')} giờ</option>)}
            </select>
          </label>
        </div>
        {venue && starts.length === 0 && <p className="hint">Ngày này không còn giờ nào trong giờ mở cửa {hhmm(venue.opensAt)}–{hhmm(venue.closesAt)}.</p>}
        {begin !== undefined && <SlotBar start={begin} duration={length} />}
        <div className="row two">
          <label>
            Tên khách (không bắt buộc)
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="off" />
          </label>
          <label>
            Số điện thoại khách (không bắt buộc)
            <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="numeric" autoComplete="off" />
          </label>
        </div>
        <p role="status" className="live saved">{saved}</p>
        <div className="checkout">
          {error && <p className="error" role="alert">{error}</p>}
          <span className="total">
            <span>Giá</span>
            <strong className="money">{price !== null ? formatVnd(price) : '—'}</strong>
          </span>
          <button type="submit" disabled={!court || begin === undefined || busy}>Lưu booking</button>
        </div>
      </form>
    </section>
  );
}

function ConfirmedBookings({ rows, error, onCancelled }: { rows: OwnerBookingView[] | null; error: string; onCancelled: (b: BookingView) => void }) {
  const heading = useId();
  const [asking, setAsking] = useState('');
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
  // Each step of the cancel unmounts the button that was pressed, so focus moves to what replaces it.
  const [focus, setFocus] = useState('');
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!focus) return;
    list.current?.querySelector<HTMLElement>(`[data-focus="${focus}"]`)?.focus();
    setFocus('');
  }, [focus]);

  async function cancel(id: string) {
    if (busy) return;
    setFailure('');
    setBusy(true);
    try {
      onCancelled(await api<BookingView>(`/api/owner/bookings/${id}/cancel`, { method: 'POST' }));
      setAsking('');
      setFocus(id);
    } catch (err) {
      setFailure(err instanceof ApiError ? err.message : 'Không hủy được booking');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel" aria-labelledby={heading}>
      <h2 id={heading}>Booking đã xác nhận</h2>
      {(error || failure) && <p className="error" role="alert">{error || failure}</p>}
      {rows?.length === 0 && <p className="empty">Chưa có booking nào sắp tới.</p>}
      <ul className="tickets" ref={list}>
        {rows?.map((r) => (
          <li key={r.id} className="ticket" data-status={r.status}>
            <span className="stub">
              <strong>{formatTime(r.startAt)}</strong>
              <span>đến {formatTime(r.endAt)}</span>
            </span>
            <span className="body">
              <Customer customer={r.customer} />
              <span className="meta">
                <span>Ngày {formatDay(r.startAt)}</span>
                <span>{r.source === 'PHONE' ? 'Qua điện thoại' : 'Đặt trong app'}</span>
                <span className="money">{formatVnd(r.priceTotal)}</span>
              </span>
              {r.status !== 'CONFIRMED' ? (
                <span className="status" tabIndex={-1} data-focus={r.id}>{STATUS_LABEL[r.status]}</span>
              ) : r.source === 'PHONE' && new Date(r.startAt) > new Date() && (
                asking === r.id ? (
                  <span className="actions">
                    <button type="button" className="secondary" autoFocus disabled={busy} aria-label={`Xác nhận hủy booking ${formatSlot(r.startAt, r.endAt)}`} onClick={() => cancel(r.id)}>Xác nhận hủy</button>
                    <button type="button" className="keep" onClick={() => { setAsking(''); setFocus(r.id); }}>Giữ booking</button>
                  </span>
                ) : (
                  <span className="actions single">
                    <button type="button" className="keep" data-focus={r.id} aria-label={`Hủy booking ${formatSlot(r.startAt, r.endAt)}`} onClick={() => setAsking(r.id)}>Hủy</button>
                  </span>
                )
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
