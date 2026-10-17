import { type FormEvent, type ReactNode, useState } from 'react';
import { ApiError } from '../../lib/api.ts';
import { HALF_HOURS, hhmm } from '../../lib/format.ts';

// Brief F-005 (UC-11): the forms an owner opens on a venue card. Each closes after a save; the card shows the response.

type Hours = { opensAt: number; closesAt: number };
type Prices = { priceNormal: number; pricePeak: number };

/** The form state of one save: the error text of the API stays next to the form, and the stored values stay on the card. */
function useSave<T>(save: (draft: T) => Promise<void>, close: () => void, fallback: string) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent, draft: T) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await save(draft);
      close();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : fallback);
      setBusy(false);
    }
  }
  return { error, busy, submit };
}

function Buttons({ busy, close, error }: { busy: boolean; close: () => void; error: string }): ReactNode {
  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        <button type="submit" disabled={busy}>Lưu</button>
        <button type="button" className="secondary" onClick={close}>Hủy</button>
      </div>
    </>
  );
}

export function HoursForm(props: { initial: Hours; save: (h: Hours) => Promise<void>; close: () => void }) {
  const [draft, setDraft] = useState(props.initial);
  const { error, busy, submit } = useSave(props.save, props.close, 'Không lưu được giờ mở cửa');
  return (
    <form onSubmit={(e) => submit(e, draft)} className="owner-edit">
      <fieldset className="step">
        <legend>Giờ mở cửa</legend>
        <div className="row two">
          <label>
            Mở cửa
            <select value={draft.opensAt} onChange={(e) => setDraft((d) => ({ ...d, opensAt: Number(e.target.value) }))}>
              {HALF_HOURS.slice(0, -1).map((m) => <option key={m} value={m}>{hhmm(m)}</option>)}
            </select>
          </label>
          <label>
            Đóng cửa
            <select value={draft.closesAt} onChange={(e) => setDraft((d) => ({ ...d, closesAt: Number(e.target.value) }))}>
              {HALF_HOURS.slice(1).map((m) => <option key={m} value={m}>{hhmm(m)}</option>)}
            </select>
          </label>
        </div>
        <Buttons busy={busy} close={props.close} error={error} />
      </fieldset>
    </form>
  );
}

export function PriceForm(props: { legend: string; initial: Prices; save: (p: Prices) => Promise<void>; close: () => void }) {
  const [draft, setDraft] = useState(props.initial);
  const { error, busy, submit } = useSave(props.save, props.close, 'Không lưu được giá');
  const set = (key: keyof Prices, value: string) => setDraft((d) => ({ ...d, [key]: Number(value) }));
  return (
    <form onSubmit={(e) => submit(e, draft)} className="owner-edit">
      <fieldset className="step">
        <legend>{props.legend}</legend>
        <div className="row two">
          <label>
            Giá giờ thường (đ)
            <input type="number" inputMode="numeric" min={1} step={1} value={draft.priceNormal || ''} onChange={(e) => set('priceNormal', e.target.value)} required />
          </label>
          <label>
            Giá cao điểm (đ)
            <input type="number" inputMode="numeric" min={1} step={1} value={draft.pricePeak || ''} onChange={(e) => set('pricePeak', e.target.value)} required />
          </label>
        </div>
        <Buttons busy={busy} close={props.close} error={error} />
      </fieldset>
    </form>
  );
}
