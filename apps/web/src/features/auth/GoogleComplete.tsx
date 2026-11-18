import { PRIVACY_NOTICE, type GooglePendingView, type SessionUser } from '@monsport/shared';
import { type FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@monsport/client';
import { AuthCard } from './AuthCard.tsx';
import { isGoogleSessionMissing } from './googleErrors.ts';
import { GoogleSessionExpired } from './GoogleSessionExpired.tsx';

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
      const res = await api<{ resendAfter?: number }>('/api/auth/google/otp', {
        method: 'POST',
        json: { purpose: 'google_signup', phone, consent },
      });
      setCodeSent(true);
      setCountdown(res?.resendAfter ?? 60);
    } catch (err) {
      if (isGoogleSessionMissing(err)) {
        setExpired(true);
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Không gửi được mã. Thử lại sau');
      if (err instanceof ApiError && typeof err.retryAfter === 'number') {
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
      const user = await api<SessionUser>('/api/auth/google/complete', {
        method: 'POST',
        json: { name, phone, code, consent },
      });
      onLogin(user);
    } catch (err) {
      if (isGoogleSessionMissing(err)) {
        setExpired(true);
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Không thể hoàn tất đăng ký');
      setBusy(false);
    }
  }

  if (expired) {
    return (
      <AuthCard>
        <h2 tabIndex={-1}>Hoàn tất đăng ký</h2>
        <GoogleSessionExpired />
      </AuthCard>
    );
  }

  const sendLabel = codeSent ? 'Gửi lại mã' : 'Gửi mã';

  return (
    <AuthCard>
      <h2 tabIndex={-1}>Hoàn tất đăng ký</h2>
      {pending && (
        <div className="google-user-info">
          {pending.name && (
            <p className="google-name" data-field="customer">
              <strong>{pending.name}</strong>
            </p>
          )}
          {pending.email && <p className="meta" data-field="customer">{pending.email}</p>}
        </div>
      )}
      <form onSubmit={handleSubmit} className="stack">
        <label className="fld">
          <span>Tên</span>
          <input
            type="text"
            autoComplete="name"
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <div className="fld-group">
          <label className="fld">
            <span>Số điện thoại</span>
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
          <span>Tôi đã đọc và đồng ý với thông báo bảo vệ dữ liệu cá nhân ở trên.</span>
        </label>

        <div>
          <button
            type="button"
            className="btn ghost wide"
            onClick={handleSendOtp}
            disabled={!consent || !phone || sendingOtp || countdown > 0}
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
            Hoàn tất
          </button>
        </div>
      </form>
    </AuthCard>
  );
}
