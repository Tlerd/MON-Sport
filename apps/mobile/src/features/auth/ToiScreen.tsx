import { useState, type CSSProperties } from 'react';
import { useSession } from '../../app/session.tsx';
import { LoginSheet } from './LoginSheet.tsx';
import { RegisterSheet } from './RegisterSheet.tsx';

type OpenSheet = 'login' | 'register' | null;

const ROLE_LABELS: Record<string, string> = {
  USER: 'Người chơi',
  OWNER: 'Chủ sân',
};

const buttonBase: CSSProperties = {
  font: 'var(--font-body-strong)',
  borderRadius: 'var(--radius-sm)',
  padding: '12px var(--space-base)',
  minHeight: '44px',
  cursor: 'pointer',
  width: '100%',
  boxSizing: 'border-box',
};

const primaryStyle: CSSProperties = {
  ...buttonBase,
  backgroundColor: 'var(--color-primary)',
  color: 'var(--color-on-primary)',
  border: 'none',
};

const secondaryStyle: CSSProperties = {
  ...buttonBase,
  backgroundColor: 'var(--color-canvas)',
  color: 'var(--color-ink)',
  border: '1px solid var(--color-line)',
};

export function ToiScreen() {
  const { user, logout } = useSession();
  const [openSheet, setOpenSheet] = useState<OpenSheet>(null);
  const [sheetKey, setSheetKey] = useState(0);

  const open = (sheet: Exclude<OpenSheet, null>) => {
    setSheetKey((k) => k + 1);
    setOpenSheet(sheet);
  };
  const close = () => {
    setSheetKey((k) => k + 1);
    setOpenSheet(null);
  };

  if (user === undefined) {
    return (
      <div
        role="status"
        aria-label="Đang tải"
        aria-busy="true"
        style={{ padding: 'var(--space-base)', minHeight: '120px' }}
      />
    );
  }

  if (!user) {
    return (
      <div style={{ padding: 'var(--space-base)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        <button type="button" onClick={() => open('login')} style={primaryStyle}>
          Đăng nhập
        </button>
        <button type="button" onClick={() => open('register')} style={secondaryStyle}>
          Tạo tài khoản
        </button>
        <LoginSheet
          key={`login-${sheetKey}`}
          open={openSheet === 'login'}
          onClose={close}
          onSwitchToRegister={() => open('register')}
        />
        <RegisterSheet
          key={`register-${sheetKey}`}
          open={openSheet === 'register'}
          onClose={close}
          onSwitchToLogin={() => open('login')}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--space-base)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <div>
        <p data-testid="user-name" style={{ font: 'var(--font-body-strong)', margin: 0 }}>{user.name}</p>
        <p style={{ font: 'var(--font-meta)', color: 'var(--color-ink-muted)', margin: 0 }}>
          {ROLE_LABELS[user.role] ?? user.role}
        </p>
      </div>
      <button type="button" onClick={() => logout()} style={secondaryStyle}>
        Đăng xuất
      </button>
    </div>
  );
}
