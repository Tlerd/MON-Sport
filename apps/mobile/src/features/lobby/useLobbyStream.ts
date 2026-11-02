import { useEffect, useLayoutEffect, useRef } from 'react';

const STREAM_URL = '/api/matches/stream';
const DEBOUNCE_MS = 500;
const MAX_WAIT_MS = 1000;

/**
 * Calls onChange once per burst of `match` events (500 ms debounce) from the lobby SSE stream.
 * The stream is open only while enabled and the tab is visible. The browser reconnects by itself after an error.
 */
export function useLobbyStream(onChange: () => void, enabled = true): void {
  const onChangeRef = useRef(onChange);
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
  });

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
        // Wait for 500 ms of quiet, but never longer than 1 s after the first event of a burst.
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
