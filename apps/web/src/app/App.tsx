import { HealthResponse } from '@monsport/shared';
import { useEffect, useState } from 'react';

type State = 'loading' | 'up' | 'down';

const LABEL: Record<State, string> = {
  loading: 'Đang kiểm tra kết nối…',
  up: 'Máy chủ và cơ sở dữ liệu đang chạy',
  down: 'Không kết nối được máy chủ hoặc cơ sở dữ liệu',
};

export function App() {
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((body) => setState(HealthResponse.parse(body).db))
      .catch(() => setState('down'));
  }, []);

  return (
    <main>
      <h1>MONSPORT</h1>
      <p>{LABEL[state]}</p>
    </main>
  );
}
