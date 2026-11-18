import type { FormEvent } from 'react';
import { useState } from 'react';
import { api } from '@monsport/client';
import type { GoogleLinkStartResponse } from '@monsport/shared';
import { useAction } from '../../hooks/useAction.ts';
import { useAuthProviders } from './useAuthProviders.ts';

export function GoogleAccountActions() {
  const { google } = useAuthProviders();
  const [showForm, setShowForm] = useState(false);
  const [password, setPassword] = useState('');
  const { run, busy, error, setError } = useAction();
  const [status, setStatus] = useState('');

  if (!google) return null;

  async function handleLinkSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('');
    await run(async () => {
      const res = await api<GoogleLinkStartResponse>('/api/auth/google/link-start', {
        method: 'POST',
        json: { password },
      });
      if (res?.url) {
        window.location.href = res.url;
      }
    }, 'Không liên kết được');
  }

  async function handleUnlink() {
    setStatus('');
    await run(async () => {
      await api('/api/auth/google/unlink', { method: 'POST' });
      setShowForm(false);
      setStatus('Đã gỡ liên kết Google');
    }, 'Không gỡ liên kết được');
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
              setStatus('');
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
        <form onSubmit={handleLinkSubmit} className="google-link-form stack">
          <label className="fld">
            <span>Mật khẩu</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="btn lime sm wide" disabled={busy}>
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
      {status && (
        <p className="hint" role="status">
          {status}
        </p>
      )}
    </div>
  );
}
