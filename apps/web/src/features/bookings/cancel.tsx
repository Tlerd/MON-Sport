import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '@monsport/client';

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
      setFailure(errorMessage(err, 'Không hủy được booking'));
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

export function CancelAsk({ id, label, ask }: { id: string; label: string; ask: CancelAskState }) {
  return ask.asking === id ? (
    <span className="actions">
      <button type="button" className="btn sm danger" autoFocus data-focus={id} disabled={ask.busy} aria-label={`Xác nhận hủy booking ${label}`} onClick={() => ask.onConfirm(id)}>Xác nhận hủy</button>
      <button type="button" className="btn sm ghost" onClick={() => ask.onKeep(id)}>Giữ booking</button>
    </span>
  ) : (
    <span className="actions single">
      <button type="button" className="btn sm ghost" data-focus={id} aria-label={`Hủy booking ${label}`} onClick={() => ask.onAsk(id)}>Hủy</button>
    </span>
  );
}
