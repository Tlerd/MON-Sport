import type { VenueView } from '@monsport/shared';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api.ts';
import { CourtPrices } from '../../components/CourtPrices.tsx';
import { hhmm } from '../../lib/format.ts';

/** UC-10 and BR-23: an owner sees only their own venues, with the courts and prices. */
export function MyVenues() {
  const [venues, setVenues] = useState<VenueView[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<VenueView[]>('/api/owner/venues').then(setVenues, (err) => setError(err instanceof ApiError ? err.message : 'Không tải được đơn vị của bạn'));
  }, []);

  return (
    <section className="panel">
      <h2>Đơn vị của tôi</h2>
      {error && <p className="error" role="alert">{error}</p>}
      {venues === null && !error && <p className="empty">Đang tải…</p>}
      {venues?.length === 0 && <p className="empty">Bạn chưa có đơn vị nào. Admin gắn đơn vị cho tài khoản của bạn.</p>}
      <div className="venues">
        {venues?.map((v) => (
          <article key={v.id} className="venue" aria-labelledby={`venue-${v.id}`}>
            <h3 id={`venue-${v.id}`}>{v.name}</h3>
            <p className="venue-meta">
              <span>{`${hhmm(v.opensAt)}–${hhmm(v.closesAt)}`}</span>
              <span>{v.address}</span>
            </p>
            <CourtPrices courts={v.courts} />
          </article>
        ))}
      </div>
    </section>
  );
}
