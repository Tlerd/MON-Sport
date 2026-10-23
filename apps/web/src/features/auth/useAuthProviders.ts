import { useEffect, useState } from 'react';
import { api } from '@monsport/client';
import type { ProvidersResponse } from '@monsport/shared';

export function useAuthProviders() {
  const [providers, setProviders] = useState<ProvidersResponse>({ google: false });

  useEffect(() => {
    let active = true;
    api<ProvidersResponse>('/api/auth/providers')
      .then((res) => {
        if (active && res && typeof res.google === 'boolean') {
          setProviders(res);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return providers;
}
