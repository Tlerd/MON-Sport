import { useEffect, useState } from 'react';
import { ApiError, disablePush, enablePush, getPublicKey, isPushOn, PushPermissionError, pushSupported } from '@monsport/client';

type State = 'loading' | 'hidden' | 'unsupported' | 'denied' | 'off' | 'on';

const DENIED = 'Trình duyệt đang chặn thông báo. Hãy bật lại trong cài đặt của trình duyệt';
const UNSUPPORTED =
  'Trình duyệt này chưa hỗ trợ thông báo. Trên iPhone, hãy chọn Chia sẻ, rồi Thêm vào Màn hình chính, rồi mở app từ biểu tượng. Trên Android, hãy mở app bằng Chrome';

/**
 * Brief F-014 (UC-14): the button that turns Web Push on or off for this device, inside the notification drawer.
 * The tap and the browser dialog are the consent (Assumption 1). Nothing shows while the state loads, or when the server
 * has Web Push off.
 */
export function PushToggle({ userId }: { userId: string }) {
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const settle = (next: State) => {
      if (alive) setState(next);
    };
    (async () => {
      // The key comes first: when the server has Web Push off, no hint shows either.
      if (!(await getPublicKey())) return settle('hidden');
      if (!pushSupported()) return settle('unsupported');
      if (Notification.permission === 'denied') return settle('denied');
      settle((await isPushOn(userId)) ? 'on' : 'off');
    })().catch(() => settle('hidden'));
    return () => {
      alive = false;
    };
  }, [userId]);

  async function turnOn() {
    setBusy(true);
    setError(null);
    try {
      await enablePush(userId);
      setState('on');
    } catch (e) {
      if (e instanceof PushPermissionError && e.permission === 'denied') setState('denied');
      else if (e instanceof PushPermissionError) setError('Bạn chưa cho phép thông báo. Hãy thử lại.');
      else setError(e instanceof ApiError ? e.message : 'Chưa bật được thông báo. Hãy thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setError(null);
    await disablePush();
    setState('off');
    setBusy(false);
  }

  if (state === 'loading' || state === 'hidden') return null;

  return (
    <div className="push-toggle">
      {state === 'unsupported' && <p className="push-note">{UNSUPPORTED}</p>}
      {state === 'denied' && <p className="push-note push-denied">{DENIED}</p>}
      {(state === 'off' || state === 'on') && (
        // One element for both states, so the keyboard focus stays on it. While it works it is aria-disabled, not
        // disabled: a disabled button loses the focus.
        <button
          type="button"
          className={state === 'on' ? 'push-button quiet' : 'push-button'}
          aria-disabled={busy}
          onClick={() => {
            if (busy) return;
            void (state === 'on' ? turnOff() : turnOn());
          }}
        >
          {state === 'on' ? 'Tắt thông báo trên thiết bị này' : 'Nhận thông báo trên thiết bị này'}
        </button>
      )}
      {error && (
        <p className="push-note error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
