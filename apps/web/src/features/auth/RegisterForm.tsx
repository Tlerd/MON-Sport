import { PRIVACY_NOTICE, type SessionUser } from '@monsport/shared';
import { type FormEvent, useState } from 'react';
import { api, ApiError } from '../../lib/api.ts';

/** UC-1, flow 1.0: sign up with a name, a phone number, and a password. Consent is required (BR-29). */
export function RegisterForm({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      onLogin(await api<SessionUser>('/api/auth/register', { method: 'POST', json: { name, phone, password, consent } }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không tạo được tài khoản');
      setBusy(false);
    }
  }

  return (
    <>
      <h2 tabIndex={-1}>Tạo tài khoản</h2>
      <form onSubmit={submit} className="stack">
        <label>
          Tên của bạn
          <input autoComplete="name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <div>
          <label>
            Số điện thoại
            <input type="tel" autoComplete="tel-national" aria-describedby="phone-hint" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </label>
          <p id="phone-hint" className="hint">10 chữ số, bắt đầu bằng 0.</p>
        </div>
        <div>
          <label>
            Mật khẩu
            <input type="password" autoComplete="new-password" minLength={8} maxLength={128} aria-describedby="password-hint"
              value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <p id="password-hint" className="hint">Ít nhất 8 ký tự.</p>
        </div>
        <div id="privacy-notice" className="privacy" role="region" aria-label="Thông báo bảo vệ dữ liệu cá nhân" tabIndex={0}>
          {PRIVACY_NOTICE.split('\n').map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
        <label className="consent">
          <input type="checkbox" aria-describedby="privacy-notice" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          Tôi đã đọc và đồng ý với thông báo bảo vệ dữ liệu cá nhân ở trên.
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <div>
          <button type="submit" disabled={!consent || busy} aria-describedby={consent ? undefined : 'consent-hint'}>Tạo tài khoản</button>
          {!consent && <p id="consent-hint" className="hint">Tick ô đồng ý để tạo tài khoản.</p>}
        </div>
      </form>
    </>
  );
}
