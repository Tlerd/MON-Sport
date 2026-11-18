import { PRIVACY_NOTICE, SKILL_LEVEL_LABELS, SKILL_LEVEL_REQUIRED_MESSAGE, type SessionUser, type SkillLevel } from '@monsport/shared';
import { type FormEvent, useRef, useState } from 'react';
import { api } from '@monsport/client';
import { GoogleButton } from './GoogleButton.tsx';
import { useAction } from '../../hooks/useAction.ts';
import { useAuthProviders } from './useAuthProviders.ts';

export function RegisterForm({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const { google } = useAuthProviders();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [skillLevel, setSkillLevel] = useState<SkillLevel | ''>('');
  const [consent, setConsent] = useState(false);
  const { run, busy, error, setError } = useAction();
  const selectRef = useRef<HTMLSelectElement>(null);

  const hasSkillError = error === SKILL_LEVEL_REQUIRED_MESSAGE;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (skillLevel === '') {
      setError(SKILL_LEVEL_REQUIRED_MESSAGE);
      selectRef.current?.focus();
      return;
    }
    await run(
      async () => onLogin(await api<SessionUser>('/api/auth/register', { method: 'POST', json: { name, phone, password, consent, skillLevel } })),
      'Không tạo được tài khoản',
    );
  }

  return (
    <>
      <h2 tabIndex={-1}>Tạo tài khoản</h2>
      <form onSubmit={submit} className="stack">
        <label className="fld">
          <span>Tên của bạn</span>
          <input autoComplete="name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <div className="fld-group">
          <label className="fld">
            <span>Số điện thoại</span>
            <input type="tel" autoComplete="tel-national" aria-describedby="phone-hint" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </label>
          <p id="phone-hint" className="hint">10 chữ số, bắt đầu bằng 0.</p>
        </div>
        <div className="fld-group">
          <label className="fld">
            <span>Mật khẩu</span>
            <input type="password" autoComplete="new-password" minLength={8} maxLength={128} aria-describedby="password-hint"
              value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <p id="password-hint" className="hint">Ít nhất 8 ký tự.</p>
        </div>
        <label className="fld">
          <span>Trình độ</span>
          <select
            ref={selectRef}
            value={skillLevel}
            aria-invalid={hasSkillError ? 'true' : undefined}
            aria-describedby={hasSkillError ? 'skill-level-error' : undefined}
            onChange={(e) => {
              const value = e.target.value as SkillLevel | '';
              setSkillLevel(value);
              if (value && error === SKILL_LEVEL_REQUIRED_MESSAGE) {
                setError('');
              }
            }}
          >
            <option value="">Chọn trình độ</option>
            {(Object.entries(SKILL_LEVEL_LABELS) as [SkillLevel, string][]).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div id="privacy-notice" className="privacy" role="region" aria-label="Thông báo bảo vệ dữ liệu cá nhân" tabIndex={0}>
          {PRIVACY_NOTICE.split('\n').map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
        <label className="consent">
          <input type="checkbox" aria-describedby="privacy-notice" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>Tôi đã đọc và đồng ý với thông báo bảo vệ dữ liệu cá nhân ở trên.</span>
        </label>
        {error && (
          <p id={hasSkillError ? 'skill-level-error' : undefined} className="error bad" role="alert">
            {error}
          </p>
        )}
        <div>
          <button type="submit" className="btn lime wide" disabled={!consent || busy} aria-describedby={consent ? undefined : 'consent-hint'}>Tạo tài khoản</button>
          {!consent && <p id="consent-hint" className="hint">Tick ô đồng ý để tạo tài khoản.</p>}
        </div>
      </form>
      {google && <GoogleButton />}
    </>
  );
}
