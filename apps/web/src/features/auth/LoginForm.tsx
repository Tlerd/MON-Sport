import type { SessionUser } from '@monsport/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { errorMessage, api } from '@monsport/client';
import { GoogleButton } from './GoogleButton.tsx';
import { resolveGoogleError } from './googleErrors.ts';
import { useAuthProviders } from './useAuthProviders.ts';

export function LoginForm({
  onLogin,
  initialError,
}: {
  onLogin: (user: SessionUser) => void;
  initialError?: string;
}) {
  const { google } = useAuthProviders();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(() => {
    if (initialError) return initialError;
    if (typeof window !== 'undefined') {
      const code = new URLSearchParams(window.location.search).get('google_error');
      return resolveGoogleError(code) ?? '';
    }
    return '';
  });

  useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      onLogin(await api<SessionUser>('/api/auth/login', { method: 'POST', json: { phone, password } }));
    } catch (err) {
      setError(errorMessage(err, 'Không đăng nhập được'));
    }
  }

  return (
    <>
      <h2 tabIndex={-1}>Đăng nhập</h2>
      <form onSubmit={submit} className="stack">
        <label className="fld">
          <span>Số điện thoại</span>
          <input inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </label>
        <label className="fld">
          <span>Mật khẩu</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error bad" role="alert">{error}</p>}
        <button type="submit" className="btn lime wide">Đăng nhập</button>
      </form>
      {google && <GoogleButton />}
    </>
  );
}
