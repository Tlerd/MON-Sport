import type { SessionUser } from '@monsport/shared';
import { type FormEvent, useState } from 'react';
import { api, ApiError } from '../../lib/api.ts';

/** UC-1, flow 1.1: sign in with a phone number and a password. */
export function LoginForm({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      onLogin(await api<SessionUser>('/api/auth/login', { method: 'POST', json: { phone, password } }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không đăng nhập được');
    }
  }

  return (
    <>
      <h2 tabIndex={-1}>Đăng nhập</h2>
      <form onSubmit={submit} className="stack">
        <label>
          Số điện thoại
          <input inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </label>
        <label>
          Mật khẩu
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit">Đăng nhập</button>
      </form>
    </>
  );
}
