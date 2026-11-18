import { PRICE_MAX } from '@monsport/shared';
import { type FormEvent, type ReactNode, useState } from 'react';
import { useAction } from '../../hooks/useAction.ts';
import { HALF_HOURS, hhmm } from '@monsport/client';

type Hours = { opensAt: number; closesAt: number };
type Prices = { priceNormal: number; pricePeak: number };

function useSave<T>(save: (draft: T) => Promise<void>, close: () => void, fallback: string) {
  const { run, busy, error } = useAction();
  async function submit(e: FormEvent, draft: T) {
    e.preventDefault();
    await run(async () => {
      await save(draft);
      close();
    }, fallback);
  }
  return { error: error ?? '', busy, submit };
}

function Buttons({ busy, close, error }: { busy: boolean; close: () => void; error: string }): ReactNode {
  return (
    <>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        <button type="submit" className="btn sm lime" disabled={busy}>Lưu</button>
        <button type="button" className="btn sm ghost" onClick={close} disabled={busy}>Hủy</button>
      </div>
    </>
  );
}

export function HoursForm(props: { initial: Hours; save: (h: Hours) => Promise<void>; close: () => void }) {
  const [draft, setDraft] = useState(props.initial);
  const { error, busy, submit } = useSave(props.save, props.close, 'Không lưu được giờ mở cửa');
  return (
    <form onSubmit={(e) => submit(e, draft)} className="owner-edit stack-form">
      <fieldset className="step">
        <legend>Giờ mở cửa</legend>
        <div className="fgrid">
          <label className="fld">
            <span>Mở cửa</span>
            <select autoFocus value={draft.opensAt} onChange={(e) => setDraft((d) => ({ ...d, opensAt: Number(e.target.value) }))}>
              {HALF_HOURS.slice(0, -1).map((m) => <option key={m} value={m}>{hhmm(m)}</option>)}
            </select>
          </label>
          <label className="fld">
            <span>Đóng cửa</span>
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
    <form onSubmit={(e) => submit(e, draft)} className="owner-edit stack-form">
      <fieldset className="step">
        <legend>{props.legend}</legend>
        <div className="fgrid">
          <label className="fld">
            <span>Giá giờ thường (đ)</span>
            <input type="number" inputMode="numeric" autoFocus min={1} max={PRICE_MAX} step={1} value={draft.priceNormal || ''} onChange={(e) => set('priceNormal', e.target.value)} required />
          </label>
          <label className="fld">
            <span>Giá cao điểm (đ)</span>
            <input type="number" inputMode="numeric" min={1} max={PRICE_MAX} step={1} value={draft.pricePeak || ''} onChange={(e) => set('pricePeak', e.target.value)} required />
          </label>
        </div>
        <Buttons busy={busy} close={props.close} error={error} />
      </fieldset>
    </form>
  );
}
