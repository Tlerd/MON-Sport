import type { CourtView, VenueView } from '@monsport/shared';
import { Plus } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { api, ApiError, hhmm } from '@monsport/client';
import { ComingSoonButton } from '../../components/ComingSoon.tsx';
import { CourtArt } from '../../components/CourtArt.tsx';
import { CourtPrices } from '../../components/CourtPrices.tsx';
import { EmptyState } from '../../components/EmptyState.tsx';
import { HoursForm, PriceForm } from './OwnerEdits.tsx';

/** UC-10 and BR-23: an owner sees only their own venues, with the courts and prices. UC-11: the owner edits them. */
export function MyVenues({ renderStaff }: { renderStaff?: (venue: VenueView) => ReactNode } = {}) {
  const [venues, setVenues] = useState<VenueView[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<VenueView[]>('/api/owner/venues').then(setVenues, (err) => setError(err instanceof ApiError ? err.message : 'Không tải được đơn vị của bạn'));
  }, []);

  const put = (v: VenueView) => setVenues((list) => list?.map((x) => (x.id === v.id ? v : x)) ?? null);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Đơn vị và giá</h1>
          <p>Quản lý cụm sân, giờ mở cửa, bảng giá và tài khoản nhân viên.</p>
        </div>
        <ComingSoonButton className="btn lime">
          <Plus size={18} className="ic" aria-hidden="true" />
          <span>Đăng ký đơn vị mới</span>
        </ComingSoonButton>
      </div>

      <section className="panel clean">
        <h2>Đơn vị của tôi</h2>
        {error && <p className="error" role="alert">{error}</p>}
        {venues === null && !error && <p className="empty">Đang tải…</p>}
        {venues?.length === 0 && (
          <EmptyState message="Bạn chưa có đơn vị nào. Admin gắn đơn vị cho tài khoản của bạn." />
        )}
        <div className="venues stack">
          {venues?.map((v) => <VenueCard key={v.id} venue={v} onSaved={put} renderStaff={renderStaff} />)}
        </div>
      </section>
    </div>
  );
}

/** One form at a time: the opening hours, or the prices of one court. */
function VenueCard({
  venue: v,
  onSaved,
  renderStaff,
}: {
  venue: VenueView;
  onSaved: (v: VenueView) => void;
  renderStaff?: (venue: VenueView) => ReactNode;
}) {
  const [editing, setEditing] = useState<'hours' | string | null>(null);
  // When a form closes, focus goes back to the button that opened it, so a keyboard user keeps their place.
  const opener = useRef<string | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => {
    if (editing === null && opener.current) buttons.current.get(opener.current)?.focus();
  }, [editing]);
  const open = (key: string) => {
    opener.current = key;
    setEditing(key);
  };
  const close = () => setEditing(null);
  const keep = (key: string) => (el: HTMLButtonElement | null) => {
    if (el) buttons.current.set(key, el);
    else buttons.current.delete(key);
  };
  const putCourt = (c: CourtView) => onSaved({ ...v, courts: v.courts.map((x) => (x.id === c.id ? c : x)) });
  const court = v.courts.find((c) => c.id === editing);

  return (
    <article className="card ov" aria-labelledby={`venue-${v.id}`}>
      <header>
        <span className="near-art">
          <CourtArt sport={v.courts[0]?.sport ?? 'BADMINTON'} />
        </span>
        <div>
          <h3 id={`venue-${v.id}`}>{v.name}</h3>
          <p className="venue-meta">
            <span>{`${hhmm(v.opensAt)}–${hhmm(v.closesAt)}`}</span>
            <span>{v.address}</span>
          </p>
        </div>
        <span className="tag ok">Đang hoạt động</span>
      </header>
      <CourtPrices courts={v.courts} />
      <div className="pad ov-foot">
        {editing === null && (
          <div className="edit-links">
            <button ref={keep('hours')} type="button" className="btn sm ghost" onClick={() => open('hours')}>Sửa giờ mở cửa</button>
            {v.courts.map((c) => (
              <button key={c.id} ref={keep(c.id)} type="button" className="btn sm ghost" onClick={() => open(c.id)}>{`Sửa giá ${c.name}`}</button>
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
      </div>
      {renderStaff ? renderStaff(v) : null}
    </article>
  );
}
