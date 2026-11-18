import { useCallback, useState } from 'react';
import { errorMessage } from '@monsport/client';

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async <T>(
      work: () => Promise<T>,
      fallback: string,
      options?: { keepBusyOnSuccess?: boolean },
    ): Promise<T | undefined> => {
      setBusy(true);
      setError(null);
      try {
        const value = await work();
        if (!options?.keepBusyOnSuccess) setBusy(false);
        return value;
      } catch (e) {
        setError(errorMessage(e, fallback));
        setBusy(false);
        return undefined;
      }
    },
    [],
  );

  return { run, busy, error, setError };
}
