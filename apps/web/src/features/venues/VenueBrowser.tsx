import { type Availability, startOfDayVN, type VenueView } from '@monsport/shared';
import { Phone } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { api, hhmm } from '@monsport/client';
import { findVenues, normalizeName } from './search.ts';

const NOTICE = 'App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt.';

export function VenueBrowser({ notice = false }: { notice?: boolean }) {
  const heading = useId();
  const [venues, setVenues] = useState<VenueView[]>([]);
  const [venueId, setVenueId] = useState('');
  const [courtId, setCourtId] = useState('');
  const [date, setDate] = useState('');
  const [free, setFree] = useState<Availability['free'] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [focusRequest, setFocusRequest] = useState(0);
  const courtSelect = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    api<VenueView[]>('/api/venues').then(setVenues, () => setError('Không tải được danh sách đơn vị'));
  }, []);

  useEffect(() => {
    if (focusRequest > 0) courtSelect.current?.focus();
  }, [focusRequest]);

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

  const found = findVenues(venues, query);
  const searching = normalizeName(query) !== '';
  const venue = venues.find((v) => v.id === venueId);

  function openVenue(id: string) {
    setVenueId(id);
    setCourtId('');
    setFree(null);
    setError('');
    setFocusRequest((n) => n + 1);
  }
  const dayStart = date ? startOfDayVN(date).getTime() : 0;
  const minute = (iso: string) => Math.round((Date.parse(iso) - dayStart) / 60_000);

  return (
    <section className="panel" aria-labelledby={heading}>
      <h2 id={heading}>Giờ trống</h2>
      {notice && <p className="notice">{NOTICE}</p>}
      <div className="stack search-box">
        <label>
          Tìm theo tên sân
          <input type="text" inputMode="search" value={query} onChange={(e) => setQuery(e.target.value)} autoComplete="off" />
        </label>
        {found.length > 0 && (
          <ul className="search-results" aria-label="Kết quả tìm sân">
            {found.map(({ venue: v, courts }) => (
              <li key={v.id}>
                <button type="button" onClick={() => openVenue(v.id)}>
                  <strong>{v.name}</strong>
                  <span>{courts.map((c) => c.name).join(', ')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div role="status" className="live">
          {searching && found.length === 0 && <p className="empty">Không có sân nào tên như vậy</p>}
          {found.length > 0 && <p className="hint">Có {found.length} đơn vị có sân khớp.</p>}
        </div>
      </div>
      <div className="stack">
        <label>
          Chọn đơn vị
          <select value={venueId} onChange={(e) => { setVenueId(e.target.value); setCourtId(''); setFree(null); setError(''); }}>
            <option value="">Chọn đơn vị</option>
            {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
        {venue && (
          <label>
            Chọn sân
            <select ref={courtSelect} value={courtId} onChange={(e) => { setCourtId(e.target.value); setFree(null); setError(''); }}>
              <option value="">Chọn sân</option>
              {venue.courts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        {venue && (
          <label>
            Chọn ngày
            <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setFree(null); setError(''); }} />
          </label>
        )}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div role="status" className="live">
        {free?.length === 0 && <p className="empty">Hết giờ trống trong ngày này. Hãy chọn ngày khác.</p>}
        {free && free.length > 0 && <p className="hint">Có {free.length} khoảng giờ trống.</p>}
      </div>
      {venue && free && free.length > 0 && (
        <ul className="free-list">
          {free.map((range) => (
            <li key={range.startAt}>
              <strong>{hhmm(minute(range.startAt))}–{hhmm(minute(range.endAt))}</strong>
              <a className="call" href={`tel:${venue.phone}`}>
                <Phone size={14} aria-hidden="true" /> Gọi chủ sân {venue.phone}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
