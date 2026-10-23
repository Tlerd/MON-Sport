import type { FormEvent } from 'react';
import { useState } from 'react';
import { api, ApiError } from '@monsport/client';
import type { GoogleLinkStartResponse } from '@monsport/shared';
import { useAuthProviders } from './useAuthProviders.ts';

export function GoogleAccountActions() {
  const { google } = useAuthProviders();
  const [showForm, setShowForm] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!google) return null;

  async function handleLinkSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api<GoogleLinkStartResponse>('/api/auth/google/link-start', {
        method: 'POST',
        json: { password },
      });
      if (res?.url) {
        window.location.href = res.url;
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không liên kết được');
      setBusy(false);
    }
  }

  async function handleUnlink() {
    setError('');
    setBusy(true);
    try {
      await api('/api/auth/google/unlink', { method: 'POST' });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không gỡ liên kết được');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="google-account-actions">
      {!showForm ? (
        <div className="google-account-buttons">
          <button
            type="button"
            className="link"
            onClick={() => {
              setError('');
              setShowForm(true);
            }}
          >
            Liên kết Google
          </button>
          <button type="button" className="link" onClick={handleUnlink} disabled={busy}>
            Gỡ liên kết Google
          </button>
        </div>
      ) : (
        <form onSubmit={handleLinkSubmit} className="google-link-form">
          <label>
            Mật khẩu
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={busy}>
            Liên kết Google
          </button>
          <button
            type="button"
            className="link"
            onClick={() => {
              setShowForm(false);
              setPassword('');
              setError('');
            }}
          >
            Hủy
          </button>
        </form>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
