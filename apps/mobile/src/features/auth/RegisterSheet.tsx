import { api, ApiError } from '@monsport/client';
import { Messages, PRIVACY_NOTICE } from '@monsport/shared';
import { useState, type CSSProperties, type FormEvent } from 'react';
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
  const { refresh } = useSession();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!consent) {
      setError(Messages.consent);
      return;
    }
    setError('');
    setBusy(true);
    try {
      await api('/api/auth/register', {
        method: 'POST',
        json: { name, phone, password, consent: true },
      });
      await refresh();
      onClose();
      onRegistered?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không kết nối được. Thử lại sau');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Tạo tài khoản">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {error && (
          <p style={{ margin: 0, font: 'var(--font-meta)', color: 'var(--color-status-no)' }} role="alert">
            {error}
          </p>
        )}

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
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            style={inputStyle}
          />
        </div>

        <div>
          <label htmlFor="register-password" style={labelStyle}>
            Mật khẩu
          </label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
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
