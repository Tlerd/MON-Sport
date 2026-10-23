import type { SessionUser } from '@monsport/shared';
import { type FormEvent, useEffect, useState } from 'react';

async function sendVerifyOtpApi() {
  const res = await fetch('/api/auth/google/otp', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ purpose: 'google_verify' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(
      res.status === 403
        ? 'Tài khoản đã bị khóa'
        : typeof data.message === 'string'
          ? data.message
          : 'Có lỗi, hãy thử lại',
    ) as Error & { status: number; retryAfter?: number };
    error.status = res.status;
    if (typeof data.retryAfter === 'number') error.retryAfter = data.retryAfter;
    throw error;
  }
  return data as { resendAfter?: number };
}

async function verifyOtpApi(code: string) {
  const res = await fetch('/api/auth/google/verify', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(
      res.status === 403
        ? 'Tài khoản đã bị khóa'
        : typeof data.message === 'string'
          ? data.message
          : 'Có lỗi, hãy thử lại',
    ) as Error & { status: number };
    error.status = res.status;
    throw error;
  }
  return data as SessionUser;
}

export function GoogleVerify({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
      const res = await sendVerifyOtpApi();
      setCodeSent(true);
      setCountdown(res?.resendAfter ?? 60);
    } catch (err: any) {
      setError(err?.status === 403 ? 'Tài khoản đã bị khóa' : (err?.message ?? 'Không gửi được mã'));
      if (typeof err?.retryAfter === 'number') {
        setCountdown(err.retryAfter);
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
      const user = await verifyOtpApi(code);
      onLogin(user);
    } catch (err: any) {
      setError(err?.status === 403 ? 'Tài khoản đã bị khóa' : (err?.message ?? 'Xác minh không thành công'));
      setBusy(false);
    }
  }

  return (
    <>
      <h2 tabIndex={-1}>Xác minh số điện thoại</h2>
      <p className="hint">Mã xác minh sẽ được gửi đến số điện thoại của tài khoản.</p>
      <form onSubmit={handleSubmit} className="stack">
        <div>
          <button
            type="button"
            onClick={handleSendOtp}
            disabled={sendingOtp || countdown > 0}
          >
            {codeSent
              ? countdown > 0
                ? `Gửi lại mã (${countdown}s)`
                : 'Gửi lại mã'
              : 'Gửi mã'}
          </button>
        </div>

        {codeSent && (
          <div>
            <label>
              Mã OTP
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
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div>
          <button type="submit" disabled={!codeSent || !code || busy}>
            Xác minh
          </button>
        </div>
      </form>
    </>
  );
}
