import type { SessionUser } from '@monsport/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@monsport/client';
import { AuthCard } from './AuthCard.tsx';
import { GOOGLE_ERROR_MESSAGES, isGoogleSessionMissing } from './googleErrors.ts';
import { GoogleSessionExpired } from './GoogleSessionExpired.tsx';

export function GoogleVerify({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  async function handleSendOtp() {
    setError('');
    setSendingOtp(true);
    try {
      const res = await api<{ resendAfter?: number }>('/api/auth/google/otp', {
        method: 'POST',
        json: { purpose: 'google_verify' },
      });
      setCodeSent(true);
      setCountdown(res?.resendAfter ?? 60);
    } catch (err) {
      if (isGoogleSessionMissing(err)) {
        setExpired(true);
        return;
      }
      if (err instanceof ApiError) {
        setError(err.status === 403 ? GOOGLE_ERROR_MESSAGES.locked : err.message);
        if (typeof err.retryAfter === 'number') {
          setCountdown(err.retryAfter);
        }
      } else {
        setError('Không gửi được mã');
      }
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!codeSent) {
      await handleSendOtp();
      return;
    }
    setError('');
    setBusy(true);
    try {
      const user = await api<SessionUser>('/api/auth/google/verify', { method: 'POST', json: { code } });
      onLogin(user);
    } catch (err) {
      if (isGoogleSessionMissing(err)) {
        setExpired(true);
        return;
      }
      if (err instanceof ApiError) {
        setError(err.status === 403 ? GOOGLE_ERROR_MESSAGES.locked : err.message);
      } else {
        setError('Xác minh không thành công');
      }
      setBusy(false);
    }
  }

  if (expired) {
    return (
      <AuthCard>
        <h2 tabIndex={-1}>Xác minh số điện thoại</h2>
        <GoogleSessionExpired />
      </AuthCard>
    );
  }

  const sendLabel = codeSent ? 'Gửi lại mã' : 'Gửi mã';

  return (
    <AuthCard>
      <h2 tabIndex={-1}>Xác minh số điện thoại</h2>
      <p className="hint">Mã xác minh sẽ được gửi đến số điện thoại của tài khoản.</p>
      <form onSubmit={handleSubmit} className="stack">
        <div>
          <button
            type="button"
            className="btn ghost wide"
            onClick={handleSendOtp}
            disabled={sendingOtp || countdown > 0}
          >
            {countdown > 0 ? `${sendLabel} (${countdown}s)` : sendLabel}
          </button>
        </div>

        {codeSent && (
          <div>
            <label className="fld">
              <span>Mã OTP</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                pattern="[0-9]{6}"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6 chữ số"
                required
              />
            </label>
          </div>
        )}

        {error && (
          <p className="error bad" role="alert">
            {error}
          </p>
        )}

        <div>
          <button type="submit" className="btn lime wide" disabled={!codeSent || !code || busy}>
            Xác minh
          </button>
        </div>
      </form>
    </AuthCard>
  );
}
