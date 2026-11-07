import { api, ApiError } from '@monsport/client';
import { useState, type FormEvent } from 'react';
import { useSession } from '../../app/session.tsx';
import { Sheet } from '../../components/Sheet.tsx';

export interface LoginSheetProps {
  open: boolean;
  onClose: () => void;
  onLoggedIn?: () => void;
  onSwitchToRegister?: () => void;
  notice?: string;
}

export function LoginSheet({ open, onClose, onLoggedIn, onSwitchToRegister, notice }: LoginSheetProps) {
  const { refresh } = useSession();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/api/auth/login', {
        method: 'POST',
        json: { phone, password },
      });
      await refresh();
      onClose();
      onLoggedIn?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không kết nối được. Thử lại sau');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Đăng nhập">
      {notice && (
        <p style={{ margin: 0, font: 'var(--font-meta)', color: 'var(--color-ink-muted)' }} role="status">
          {notice}
        </p>
      )}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {error && (
          <p style={{ margin: 0, font: 'var(--font-meta)', color: 'var(--color-status-no)' }} role="alert">
            {error}
          </p>
        )}

        <div>
          <label htmlFor="login-phone" style={{ display: 'block', font: 'var(--font-label)', marginBottom: 'var(--space-xs)' }}>
            Số điện thoại
          </label>
          <input
            id="login-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            style={{
              width: '100%',
              height: '44px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-line)',
              padding: '0 var(--space-md)',
              font: 'var(--font-body)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div>
          <label htmlFor="login-password" style={{ display: 'block', font: 'var(--font-label)', marginBottom: 'var(--space-xs)' }}>
            Mật khẩu
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: '100%',
              height: '44px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-line)',
              padding: '0 var(--space-md)',
              font: 'var(--font-body)',
              boxSizing: 'border-box',
            }}
          />
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
            marginTop: 'var(--space-xs)',
          }}
        >
          {busy ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>

        {onSwitchToRegister && (
          <button
            type="button"
            onClick={onSwitchToRegister}
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
            Tạo tài khoản
          </button>
        )}
      </form>
    </Sheet>
  );
}
