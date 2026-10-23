import { PRIVACY_NOTICE, type GooglePendingView, type SessionUser } from '@monsport/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@monsport/client';
import { isGoogleSessionMissing } from './googleErrors.ts';
import { GoogleSessionExpired } from './GoogleSessionExpired.tsx';

async function sendOtpApi(payload: { purpose: string; phone?: string; consent?: boolean }) {
  const res = await fetch('/api/auth/google/otp', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(typeof data.message === 'string' ? data.message : 'Có lỗi, hãy thử lại') as Error & {
      status: number;
      retryAfter?: number;
    };
    error.status = res.status;
    if (typeof data.retryAfter === 'number') error.retryAfter = data.retryAfter;
    throw error;
  }
  return data as { resendAfter?: number };
}

async function completeApi(payload: { name: string; phone: string; code: string; consent: boolean }) {
  const res = await fetch('/api/auth/google/complete', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(typeof data.message === 'string' ? data.message : 'Có lỗi, hãy thử lại') as Error & {
      status: number;
    };
    error.status = res.status;
    throw error;
  }
  return data as SessionUser;
}

export function GoogleComplete({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const [pending, setPending] = useState<GooglePendingView | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    let active = true;
    api<GooglePendingView>('/api/auth/google/pending')
      .then((data) => {
        if (!active) return;
        setPending(data);
        if (data?.name) setName(data.name);
      })
      .catch((err) => {
        if (active && err instanceof ApiError && err.status === 404) setExpired(true);
      });
    return () => {
      active = false;
    };
  }, []);

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
      const res = await sendOtpApi({ purpose: 'google_signup', phone, consent });
      setCodeSent(true);
      setCountdown(res?.resendAfter ?? 60);
    } catch (err: any) {
      if (isGoogleSessionMissing(err)) {
        setExpired(true);
        return;
      }
      setError(err?.message ?? 'Không gửi được mã. Thử lại sau');
      if (typeof err?.retryAfter === 'number') {
        setCountdown(err.retryAfter);
      }
    } finally {
      setSendingOtp(false);
    }
  }

  function handleChangePhone() {
    setCodeSent(false);
    setCode('');
    setCountdown(0);
    setError('');
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
      const user = await completeApi({ name, phone, code, consent });
      onLogin(user);
    } catch (err: any) {
      if (isGoogleSessionMissing(err)) {
        setExpired(true);
        return;
      }
      setError(err?.message ?? 'Không thể hoàn tất đăng ký');
      setBusy(false);
    }
  }

  if (expired) {
    return (
      <>
        <h2 tabIndex={-1}>Hoàn tất đăng ký</h2>
        <GoogleSessionExpired />
      </>
    );
  }

  const sendLabel = codeSent ? 'Gửi lại mã' : 'Gửi mã';

  return (
    <>
      <h2 tabIndex={-1}>Hoàn tất đăng ký</h2>
      {pending && (
        <div className="google-user-info">
          {pending.name && (
            <p className="google-name">
              <strong>{pending.name}</strong>
            </p>
          )}
          {pending.email && <p className="meta">{pending.email}</p>}
        </div>
      )}
      <form onSubmit={handleSubmit} className="stack">
        <label>
          Tên
          <input
            type="text"
            autoComplete="name"
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <div>
          <label>
            Số điện thoại
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              readOnly={codeSent}
              required
            />
          </label>
          {codeSent && (
            <button type="button" className="link" onClick={handleChangePhone}>
              Đổi số
            </button>
          )}
          <p className="hint">10 chữ số, bắt đầu bằng 0.</p>
        </div>

        <div
          id="privacy-notice"
          className="privacy"
          role="region"
          aria-label="Thông báo bảo vệ dữ liệu cá nhân"
          tabIndex={0}
        >
          {PRIVACY_NOTICE.split('\n').map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <label className="consent">
          <input
            type="checkbox"
            aria-describedby="privacy-notice"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          Tôi đã đọc và đồng ý với thông báo bảo vệ dữ liệu cá nhân ở trên.
        </label>

        <div>
          <button
            type="button"
            onClick={handleSendOtp}
            disabled={!consent || !phone || sendingOtp || countdown > 0}
          >
            {countdown > 0 ? `${sendLabel} (${countdown}s)` : sendLabel}
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
            Hoàn tất
          </button>
        </div>
      </form>
    </>
  );
}
