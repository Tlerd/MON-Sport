import type { CourtView, VenueView } from '@monsport/shared';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api.ts';
import { CourtPrices } from '../../components/CourtPrices.tsx';
import { hhmm } from '../../lib/format.ts';
import { HoursForm, PriceForm } from './OwnerEdits.tsx';

/** UC-10 and BR-23: an owner sees only their own venues, with the courts and prices. UC-11: the owner edits them. */
export function MyVenues() {
  const [venues, setVenues] = useState<VenueView[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<VenueView[]>('/api/owner/venues').then(setVenues, (err) => setError(err instanceof ApiError ? err.message : 'Không tải được đơn vị của bạn'));
  }, []);

  const put = (v: VenueView) => setVenues((list) => list?.map((x) => (x.id === v.id ? v : x)) ?? null);

  return (
    <section className="panel">
      <h2>Đơn vị của tôi</h2>
      {error && <p className="error" role="alert">{error}</p>}
      {venues === null && !error && <p className="empty">Đang tải…</p>}
      {venues?.length === 0 && <p className="empty">Bạn chưa có đơn vị nào. Admin gắn đơn vị cho tài khoản của bạn.</p>}
      <div className="venues">
        {venues?.map((v) => <VenueCard key={v.id} venue={v} onSaved={put} />)}
      </div>
    </section>
  );
}

/** One form at a time: the opening hours, or the prices of one court. */
function VenueCard({ venue: v, onSaved }: { venue: VenueView; onSaved: (v: VenueView) => void }) {
  const [editing, setEditing] = useState<'hours' | string | null>(null);
  const close = () => setEditing(null);
  const putCourt = (c: CourtView) => onSaved({ ...v, courts: v.courts.map((x) => (x.id === c.id ? c : x)) });
  const court = v.courts.find((c) => c.id === editing);

  return (
    <article className="venue" aria-labelledby={`venue-${v.id}`}>
      <h3 id={`venue-${v.id}`}>{v.name}</h3>
      <p className="venue-meta">
        <span>{`${hhmm(v.opensAt)}–${hhmm(v.closesAt)}`}</span>
        <span>{v.address}</span>
      </p>
      <CourtPrices courts={v.courts} />
      {editing === null && (
        <div className="edit-links">
          <button type="button" className="link" onClick={() => setEditing('hours')}>Sửa giờ mở cửa</button>
          {v.courts.map((c) => (
            <button key={c.id} type="button" className="link" onClick={() => setEditing(c.id)}>{`Sửa giá ${c.name}`}</button>
          ))}
        </div>
      )}
      {editing === 'hours' && (
        <HoursForm
          initial={{ opensAt: v.opensAt, closesAt: v.closesAt }}
          save={(hours) => api<VenueView>(`/api/owner/venues/${v.id}`, { method: 'PATCH', json: hours }).then(onSaved)}
          close={close}
        />
      )}
      {court && (
        <PriceForm
          legend={`Giá ${court.name}`}
          initial={{ priceNormal: court.priceNormal, pricePeak: court.pricePeak }}
          save={(prices) => api<CourtView>(`/api/owner/courts/${court.id}`, { method: 'PATCH', json: prices }).then(putCourt)}
          close={close}
        />
      )}
    </article>
  );
}
