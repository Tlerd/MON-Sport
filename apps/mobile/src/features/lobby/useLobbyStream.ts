import { useEffect } from 'react';
import { useLatest } from '../../hooks/useLatest.ts';

const STREAM_URL = '/api/matches/stream';
const DEBOUNCE_MS = 500;
const MAX_WAIT_MS = 1000;

export function useLobbyStream(onChange: () => void, enabled = true): void {
  const onChangeRef = useLatest(onChange);

  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') return;

    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    let firstEventAt: number | null = null;

    const clearTimer = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      firstEventAt = null;
    };
    const open = () => {
      if (source) return;
      source = new EventSource(STREAM_URL);
      source.addEventListener('match', () => {
        const now = Date.now();
        if (firstEventAt === null) firstEventAt = now;
        const delay = Math.min(DEBOUNCE_MS, Math.max(0, firstEventAt + MAX_WAIT_MS - now));
        if (timer !== null) clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          firstEventAt = null;
          onChangeRef.current();
        }, delay);
      });
    };
    const close = () => {
      clearTimer();
      source?.close();
      source = null;
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (source) return;
        open();
        onChangeRef.current();
      } else {
        close();
      }
    };

    if (document.visibilityState === 'visible') open();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      close();
    };
  }, [enabled]);
}
