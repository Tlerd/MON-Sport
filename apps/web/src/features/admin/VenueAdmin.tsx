import type { AccountView, AdminVenueView, CourtView, Sport } from '@monsport/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { CourtPrices } from '../../components/CourtPrices.tsx';
import { api, ApiError } from '../../lib/api.ts';
import { hhmm } from '../../lib/format.ts';

// Opening hours sit on the 30-minute grid, from 00:00 to 24:00 (data dictionary, Venue.opensAt).
const HALF_HOURS = Array.from({ length: 49 }, (_, i) => i * 30);
const message = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

type VenueDraft = { ownerId: string; name: string; address: string; phone: string; opensAt: number; closesAt: number };
type CourtDraft = { name: string; sport: Sport; priceNormal: number; pricePeak: number };

/** UC-10, steps 2 and 3: the admin creates and edits venues and their courts. */
export function VenueAdmin({ owners }: { owners: AccountView[] }) {
  const [venues, setVenues] = useState<AdminVenueView[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<AdminVenueView[]>('/api/admin/venues').then(setVenues, (err) => setError(message(err, 'Không tải được danh sách đơn vị')));
  }, []);

  const put = (v: AdminVenueView) =>
    setVenues((list) => [...list.filter((x) => x.id !== v.id), v].sort((a, b) => a.name.localeCompare(b.name, 'vi')));
  const putCourt = (venueId: string, c: CourtView) =>
    setVenues((list) =>
      list.map((v) =>
        v.id === venueId ? { ...v, courts: [...v.courts.filter((x) => x.id !== c.id), c].sort((a, b) => a.name.localeCompare(b.name, 'vi')) } : v,
      ),
    );

  return (
    <section className="panel">
      <h2>Đơn vị</h2>
      {error && <p className="error" role="alert">{error}</p>}
      {venues.length === 0 && !error && <p className="empty">Chưa có đơn vị nào.</p>}
      <div className="venues">
        {venues.map((v) => (
          <article key={v.id} className="venue" aria-labelledby={`admin-venue-${v.id}`}>
            <h3 id={`admin-venue-${v.id}`}>{v.name}</h3>
            <p className="venue-meta">
              <span>{`${hhmm(v.opensAt)}–${hhmm(v.closesAt)}`}</span>
              <span>Chủ sân: {v.owner.name}</span>
            </p>
            <CourtPrices courts={v.courts} />
            <details className="drawer">
              <summary>{`Sửa ${v.name}`}</summary>
              <VenueForm
                owners={owners}
                initial={{ ownerId: v.owner.id, name: v.name, address: v.address, phone: v.phone, opensAt: v.opensAt, closesAt: v.closesAt }}
                submitLabel="Lưu đơn vị"
                save={(draft) => api<AdminVenueView>(`/api/admin/venues/${v.id}`, { method: 'PATCH', json: draft }).then(put)}
              />
              {v.courts.map((c) => (
                <CourtForm
                  key={c.id}
                  legend={`Sửa ${c.name}`}
                  initial={{ name: c.name, sport: c.sport, priceNormal: c.priceNormal, pricePeak: c.pricePeak }}
                  fixedSport
                  submitLabel={`Lưu ${c.name}`}
                  save={({ name, priceNormal, pricePeak }) =>
                    api<CourtView>(`/api/admin/courts/${c.id}`, { method: 'PATCH', json: { name, priceNormal, pricePeak } }).then((x) => putCourt(v.id, x))
                  }
                />
              ))}
              <CourtForm
                legend={`Thêm sân vào ${v.name}`}
                initial={{ name: '', sport: v.courts[0]?.sport ?? 'BADMINTON', priceNormal: 0, pricePeak: 0 }}
                submitLabel="Thêm sân"
                resetOnSave
                save={(draft) => api<CourtView>(`/api/admin/venues/${v.id}/courts`, { method: 'POST', json: draft }).then((x) => putCourt(v.id, x))}
              />
            </details>
          </article>
        ))}
      </div>
      <details className="drawer">
        <summary>Tạo đơn vị</summary>
        <VenueForm
          owners={owners}
          initial={{ ownerId: '', name: '', address: '', phone: '', opensAt: 360, closesAt: 1380 }}
          submitLabel="Tạo đơn vị"
          resetOnSave
          save={(draft) => api<AdminVenueView>('/api/admin/venues', { method: 'POST', json: draft }).then(put)}
        />
      </details>
    </section>
  );
}

function VenueForm(props: { owners: AccountView[]; initial: VenueDraft; submitLabel: string; resetOnSave?: boolean; save: (d: VenueDraft) => Promise<void> }) {
  const [draft, setDraft] = useState(props.initial);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const set = <K extends keyof VenueDraft>(key: K, value: VenueDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setDone('');
    try {
      await props.save(draft);
      setDone(`Đã lưu ${draft.name}.`);
      if (props.resetOnSave) setDraft(props.initial);
    } catch (err) {
      setError(message(err, 'Không lưu được đơn vị'));
    }
  }

  return (
    <form onSubmit={submit} className="stack">
      <label>
        Tên đơn vị
        <input value={draft.name} maxLength={100} onChange={(e) => set('name', e.target.value)} required />
      </label>
      <label>
        Chủ sân của đơn vị
        <select value={draft.ownerId} onChange={(e) => set('ownerId', e.target.value)} required>
          <option value="" disabled>Chọn chủ sân</option>
          {props.owners.map((o) => (
            <option key={o.id} value={o.id} disabled={!!o.lockedAt}>{`${o.name} (${o.phone})${o.lockedAt ? ' (đã khóa)' : ''}`}</option>
          ))}
        </select>
      </label>
      <label>
        Địa chỉ
        <input value={draft.address} maxLength={200} onChange={(e) => set('address', e.target.value)} required />
      </label>
      <label>
        Số điện thoại cho nút Gọi chủ sân
        <input inputMode="tel" maxLength={10} value={draft.phone} onChange={(e) => set('phone', e.target.value)} required />
      </label>
      <div className="row two">
        <label>
          Mở cửa
          <select value={draft.opensAt} onChange={(e) => set('opensAt', Number(e.target.value))}>
            {HALF_HOURS.slice(0, -1).map((m) => <option key={m} value={m}>{hhmm(m)}</option>)}
          </select>
        </label>
        <label>
          Đóng cửa
          <select value={draft.closesAt} onChange={(e) => set('closesAt', Number(e.target.value))}>
            {HALF_HOURS.slice(1).map((m) => <option key={m} value={m}>{hhmm(m)}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="live hint" role="status">{done}</p>
      <button type="submit">{props.submitLabel}</button>
    </form>
  );
}

function CourtForm(props: {
  legend: string; initial: CourtDraft; submitLabel: string; fixedSport?: boolean; resetOnSave?: boolean; save: (d: CourtDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState(props.initial);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const set = <K extends keyof CourtDraft>(key: K, value: CourtDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setDone('');
    try {
      await props.save(draft);
      setDone(`Đã lưu ${draft.name}.`);
      if (props.resetOnSave) setDraft(props.initial);
    } catch (err) {
      setError(message(err, 'Không lưu được sân'));
    }
  }

  return (
    <form onSubmit={submit} className="court-form">
      <fieldset className="step">
        <legend>{props.legend}</legend>
        <div className="row">
          <label>
            Tên sân
            <input value={draft.name} maxLength={50} onChange={(e) => set('name', e.target.value)} required />
          </label>
          <label>
            Giờ thường (đ)
            <input type="number" inputMode="numeric" min={1} step={1} value={draft.priceNormal || ''} onChange={(e) => set('priceNormal', Number(e.target.value))} required />
          </label>
          <label>
            Cao điểm (đ)
            <input type="number" inputMode="numeric" min={1} step={1} value={draft.pricePeak || ''} onChange={(e) => set('pricePeak', Number(e.target.value))} required />
          </label>
        </div>
        {!props.fixedSport && (
          <label>
            Môn
            <select value={draft.sport} onChange={(e) => set('sport', e.target.value as Sport)}>
              <option value="BADMINTON">Cầu lông</option>
              <option value="FOOTBALL">Bóng đá</option>
            </select>
          </label>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <p className="live hint" role="status">{done}</p>
        <button type="submit">{props.submitLabel}</button>
      </fieldset>
    </form>
  );
}
