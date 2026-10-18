import { type Availability, startOfDayVN, type VenueView } from '@monsport/shared';
import { useEffect, useId, useState } from 'react';
import { api } from '../../lib/api.ts';
import { hhmm } from '../../lib/format.ts';

const NOTICE = 'App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt.';

/**
 * Brief F-008 (UC-2): pick a venue, a court, and a day, then see the free ranges with a link to call the owner.
 * It needs no login. A guest sees the notice here. A user sees it in the booking form, so `notice` is off there.
 */
export function VenueBrowser({ notice = false }: { notice?: boolean }) {
  const heading = useId();
  const [venues, setVenues] = useState<VenueView[]>([]);
  const [venueId, setVenueId] = useState('');
  const [courtId, setCourtId] = useState('');
  const [date, setDate] = useState('');
  const [free, setFree] = useState<Availability['free'] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<VenueView[]>('/api/venues').then(setVenues, () => setError('Không tải được danh sách đơn vị'));
  }, []);

  // A late answer for an earlier pick must not replace the list of the newer pick.
  useEffect(() => {
    if (!courtId || !date) return;
    let current = true;
    setError('');
    api<Availability>(`/api/courts/${courtId}/availability?date=${date}`).then(
      (answer) => current && setFree(answer.free),
      () => {
        if (!current) return;
        setFree(null);
        setError('Không tải được giờ trống');
      },
    );
    return () => {
      current = false;
    };
  }, [courtId, date]);

  const venue = venues.find((v) => v.id === venueId);
  const dayStart = date ? startOfDayVN(date).getTime() : 0;
  // Minutes since 00:00 of the day, so a range that ends at 00:00 of the next day shows 24:00.
  const minute = (iso: string) => Math.round((Date.parse(iso) - dayStart) / 60_000);

  return (
    <section className="panel" aria-labelledby={heading}>
      <h2 id={heading}>Giờ trống</h2>
      {notice && <p className="notice">{NOTICE}</p>}
      <div className="stack">
        <label>
          Chọn đơn vị
          <select value={venueId} onChange={(e) => { setVenueId(e.target.value); setCourtId(''); setFree(null); }}>
            <option value="">Chọn đơn vị</option>
            {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
        {venue && (
          <label>
            Chọn sân
            <select value={courtId} onChange={(e) => { setCourtId(e.target.value); setFree(null); }}>
              <option value="">Chọn sân</option>
              {venue.courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        {venue && (
          <label>
            Chọn ngày
            <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setFree(null); }} />
          </label>
        )}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {/* The live region stays in the DOM, so screen readers announce the empty day when it appears. */}
      <div role="status" className="live">
        {free?.length === 0 && <p className="empty">Hết giờ trống trong ngày này. Hãy chọn ngày khác.</p>}
      </div>
      {venue && free && free.length > 0 && (
        <ul className="free-list">
          {free.map((range) => (
            <li key={range.startAt}>
              <strong>{hhmm(minute(range.startAt))}–{hhmm(minute(range.endAt))}</strong>
              <a className="call" href={`tel:${venue.phone}`}>Gọi chủ sân {venue.phone}</a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
