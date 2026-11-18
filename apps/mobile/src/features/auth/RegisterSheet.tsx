import { api } from '@monsport/client';
import { Messages, PRIVACY_NOTICE, type SessionUser } from '@monsport/shared';
import { useState, type CSSProperties, type FormEvent } from 'react';
import { useAction } from '../../hooks/useAction.ts';
import { useSession } from '../../app/session.tsx';
import { Sheet } from '../../components/Sheet.tsx';

export interface RegisterSheetProps {
  open: boolean;
  onClose: () => void;
  onRegistered?: () => void;
  onSwitchToLogin?: () => void;
}

const NOTICE_PARAGRAPHS = PRIVACY_NOTICE.split('\n');

const labelStyle: CSSProperties = { display: 'block', font: 'var(--font-label)', marginBottom: 'var(--space-xs)' };

const hintStyle: CSSProperties = { margin: 'var(--space-xs) 0 0', font: 'var(--font-meta)', color: 'var(--color-ink-muted)' };

const inputStyle: CSSProperties = {
  width: '100%',
  height: '44px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-line)',
  padding: '0 var(--space-md)',
  font: 'var(--font-body)',
  boxSizing: 'border-box',
};

export function RegisterSheet({ open, onClose, onRegistered, onSwitchToLogin }: RegisterSheetProps) {
  const { login, refresh } = useSession();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const { run, busy, error, setError } = useAction();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!consent) {
      setError(Messages.consent);
      return;
    }
    await run(async () => {
      const registered = await api<SessionUser | undefined>('/api/auth/register', {
        method: 'POST',
        json: { name, phone, password, consent: true },
      });
      if (registered?.id) login(registered);
      await refresh();
      onClose();
      onRegistered?.();
    }, 'Không kết nối được. Thử lại sau');
  };

  return (
    <Sheet open={open} onClose={onClose} title="Tạo tài khoản">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <div>
          <label htmlFor="register-name" style={labelStyle}>
            Tên
          </label>
          <input
            id="register-name"
            type="text"
            autoComplete="name"
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={inputStyle}
          />
        </div>

        <div>
          <label htmlFor="register-phone" style={labelStyle}>
            Số điện thoại
          </label>
          <input
            id="register-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            aria-describedby="register-phone-hint"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            style={inputStyle}
          />
          <p id="register-phone-hint" style={hintStyle}>
            10 chữ số, bắt đầu bằng 0
          </p>
        </div>

        <div>
          <label htmlFor="register-password" style={labelStyle}>
            Mật khẩu
          </label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            aria-describedby="register-password-hint"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
          <p id="register-password-hint" style={hintStyle}>
            Ít nhất 8 ký tự
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {NOTICE_PARAGRAPHS.map((text) => (
            <p key={text} style={{ margin: 0, font: 'var(--font-meta)', color: 'var(--color-ink-muted)' }}>
              {text}
            </p>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', minHeight: '44px' }}>
          <input
            id="register-consent"
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            style={{ width: '24px', height: '24px', flexShrink: 0, margin: 0 }}
          />
          <label htmlFor="register-consent" style={{ font: 'var(--font-body)' }}>
            Tôi đồng ý với thông báo bảo vệ dữ liệu cá nhân
          </label>
        </div>

        {error && (
          <p style={{ margin: 0, font: 'var(--font-meta)', color: 'var(--color-status-no)' }} role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{
            width: '100%',
            height: '44px',
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-on-primary)',
            font: 'var(--font-body-strong)',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? 'Đang tạo...' : 'Tạo tài khoản'}
        </button>

        <button
          type="button"
          onClick={onSwitchToLogin}
          style={{
            width: '100%',
            height: '44px',
            background: 'transparent',
            color: 'var(--color-primary)',
            font: 'var(--font-body-strong)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Đã có tài khoản? Đăng nhập
        </button>
      </form>
    </Sheet>
  );
}
