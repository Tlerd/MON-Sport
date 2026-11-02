import { useEffect, useRef } from 'react';

const STREAM_URL = '/api/matches/stream';
const DEBOUNCE_MS = 500;

/**
 * Calls onChange once per burst of `match` events (500 ms debounce) from the lobby SSE stream.
 * The stream is open only while enabled and the tab is visible. The browser reconnects by itself after an error.
 */
export function useLobbyStream(onChange: () => void, enabled = true): void {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') return;

    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    const open = () => {
      if (source) return;
      source = new EventSource(STREAM_URL);
      source.addEventListener('match', () => {
        clearTimer();
        timer = setTimeout(() => {
          timer = null;
          onChangeRef.current();
        }, DEBOUNCE_MS);
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
