import type { AccountView, AdminVenueView, CourtView, Sport } from '@monsport/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { CourtArt } from '../../components/CourtArt.tsx';
import { CourtPrices } from '../../components/CourtPrices.tsx';
import { EmptyState } from '../../components/EmptyState.tsx';
import { errorMessage, api, HALF_HOURS, hhmm } from '@monsport/client';

type VenueDraft = { ownerId: string; name: string; address: string; phone: string; opensAt: number; closesAt: number };
type CourtDraft = { name: string; sport: Sport; priceNormal: number; pricePeak: number };

function changed(draft: VenueDraft, venue: AdminVenueView): Partial<VenueDraft> {
  const stored: VenueDraft = { ownerId: venue.owner.id, name: venue.name, address: venue.address, phone: venue.phone, opensAt: venue.opensAt, closesAt: venue.closesAt };
  return Object.fromEntries(Object.entries(draft).filter(([key, value]) => stored[key as keyof VenueDraft] !== value));
}

export function VenueAdmin({ owners }: { owners: AccountView[] }) {
  const [venues, setVenues] = useState<AdminVenueView[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<AdminVenueView[]>('/api/admin/venues').then(setVenues, (err) => setError(errorMessage(err, 'Không tải được danh sách đơn vị')));
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
    <section className="panel clean">
      <h2>Đơn vị</h2>
      {error && <p className="error" role="alert">{error}</p>}
      {venues.length === 0 && !error && <EmptyState message="Chưa có đơn vị nào." />}
      <div className="venues stack">
        {venues.map((v) => (
          <article key={v.id} className="card ov" aria-labelledby={`admin-venue-${v.id}`}>
            <header>
              <span className="near-art">
                <CourtArt sport={v.courts[0]?.sport ?? 'BADMINTON'} />
              </span>
              <div>
                <h3 id={`admin-venue-${v.id}`}>{v.name}</h3>
                <p className="venue-meta">
                  <span>{`${hhmm(v.opensAt)}–${hhmm(v.closesAt)}`}</span>
                  <span data-field="customer">Chủ sân: {v.owner.name}</span>
                </p>
              </div>
              <span className="tag ok">Đang hoạt động</span>
            </header>
            <CourtPrices courts={v.courts} />
            <div className="pad">
              <details className="drawer">
                <summary>{`Sửa ${v.name}`}</summary>
                <VenueForm
                  owners={owners}
                  initial={{ ownerId: v.owner.id, name: v.name, address: v.address, phone: v.phone, opensAt: v.opensAt, closesAt: v.closesAt }}
                  submitLabel="Lưu đơn vị"
                  save={(draft) => api<AdminVenueView>(`/api/admin/venues/${v.id}`, { method: 'PATCH', json: changed(draft, v) }).then(put)}
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
            </div>
          </article>
        ))}
      </div>
      <div className="card pad">
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
      </div>
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
      setError(errorMessage(err, 'Không lưu được đơn vị'));
    }
  }

  return (
    <form onSubmit={submit} className="stack-form">
      <div className="fgrid">
        <label className="fld">
          <span>Tên đơn vị</span>
          <input value={draft.name} maxLength={100} onChange={(e) => set('name', e.target.value)} required />
        </label>
        <label className="fld">
          <span>Chủ sân của đơn vị</span>
          <select value={draft.ownerId} onChange={(e) => set('ownerId', e.target.value)} required>
            <option value="" disabled>Chọn chủ sân</option>
            {props.owners.map((o) => (
              <option key={o.id} value={o.id} disabled={!!o.lockedAt}>{`${o.name} (${o.phone})${o.lockedAt ? ' (đã khóa)' : ''}`}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="fgrid">
        <label className="fld">
          <span>Địa chỉ</span>
          <input value={draft.address} maxLength={200} onChange={(e) => set('address', e.target.value)} required />
        </label>
        <label className="fld">
          <span>Số điện thoại cho nút Gọi chủ sân</span>
          <input inputMode="tel" maxLength={10} value={draft.phone} onChange={(e) => set('phone', e.target.value)} required />
        </label>
      </div>
      <div className="fgrid">
        <label className="fld">
          <span>Mở cửa</span>
          <select value={draft.opensAt} onChange={(e) => set('opensAt', Number(e.target.value))}>
            {HALF_HOURS.slice(0, -1).map((m) => <option key={m} value={m}>{hhmm(m)}</option>)}
          </select>
        </label>
        <label className="fld">
          <span>Đóng cửa</span>
          <select value={draft.closesAt} onChange={(e) => set('closesAt', Number(e.target.value))}>
            {HALF_HOURS.slice(1).map((m) => <option key={m} value={m}>{hhmm(m)}</option>)}
          </select>
        </label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <p className="live hint" role="status">{done}</p>
      <div className="actions">
        <button type="submit" className="btn lime">{props.submitLabel}</button>
      </div>
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
      setError(errorMessage(err, 'Không lưu được sân'));
    }
  }

  return (
    <form onSubmit={submit} className="court-form stack-form">
      <fieldset className="step">
        <legend>{props.legend}</legend>
        <div className="fgrid three">
          <label className="fld">
            <span>Tên sân</span>
            <input value={draft.name} maxLength={50} onChange={(e) => set('name', e.target.value)} required />
          </label>
          <label className="fld">
            <span>Giờ thường (đ)</span>
            <input type="number" inputMode="numeric" min={1} step={1} value={draft.priceNormal || ''} onChange={(e) => set('priceNormal', Number(e.target.value))} required />
          </label>
          <label className="fld">
            <span>Cao điểm (đ)</span>
            <input type="number" inputMode="numeric" min={1} step={1} value={draft.pricePeak || ''} onChange={(e) => set('pricePeak', Number(e.target.value))} required />
          </label>
        </div>
        {!props.fixedSport && (
          <label className="fld">
            <span>Môn</span>
            <select value={draft.sport} onChange={(e) => set('sport', e.target.value as Sport)}>
              <option value="BADMINTON">Cầu lông</option>
              <option value="FOOTBALL">Bóng đá</option>
            </select>
          </label>
        )}
        {error && <p className="error" role="alert">{error}</p>}
        <p className="live hint" role="status">{done}</p>
        <div className="actions">
          <button type="submit" className="btn sm lime">{props.submitLabel}</button>
        </div>
      </fieldset>
    </form>
  );
}
