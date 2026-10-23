import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@monsport/client';

/**
 * The state that a list of cancellable rows shares (brief F-009): which row asks to confirm, the call in flight,
 * the failure, and the focus. Each step of a cancel unmounts the button that was pressed, so focus moves to
 * the element with `data-focus` set to the row id.
 */
export function useCancelFlow(run: (id: string) => Promise<void>, onFail?: () => Promise<unknown>) {
  const [asking, setAsking] = useState('');
  const [failure, setFailure] = useState('');
  const [busy, setBusy] = useState(false);
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
      await run(id);
      setAsking('');
      setFocus(id);
    } catch (err) {
      setFailure(err instanceof ApiError ? err.message : 'Không hủy được booking');
      // The reload comes first: the row may lose its button, and the label that replaces it takes the focus.
      await onFail?.();
      setFocus(id);
    } finally {
      setBusy(false);
    }
  }

  return {
    list,
    failure,
    ask: { asking, busy, onAsk: setAsking, onKeep: (id: string) => { setAsking(''); setFocus(id); }, onConfirm: cancel },
  };
}

export type CancelAskState = ReturnType<typeof useCancelFlow>['ask'];

/** "Hủy", which asks "Xác nhận hủy" or "Giữ booking" before it calls the API. `label` names the booking for a screen reader. */
export function CancelAsk({ id, label, ask }: { id: string; label: string; ask: CancelAskState }) {
  return ask.asking === id ? (
    <span className="actions">
      <button type="button" className="secondary" autoFocus data-focus={id} disabled={ask.busy} aria-label={`Xác nhận hủy booking ${label}`} onClick={() => ask.onConfirm(id)}>Xác nhận hủy</button>
      <button type="button" className="keep" onClick={() => ask.onKeep(id)}>Giữ booking</button>
    </span>
  ) : (
    <span className="actions single">
      <button type="button" className="keep" data-focus={id} aria-label={`Hủy booking ${label}`} onClick={() => ask.onAsk(id)}>Hủy</button>
    </span>
  );
}
