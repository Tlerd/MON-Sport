import { useCallback, useState } from 'react';
import { errorMessage } from '@monsport/client';

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T>(work: () => Promise<T>, fallback: string): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await work();
    } catch (e) {
      setError(errorMessage(e, fallback));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);

  return { run, busy, error, setError };
}
