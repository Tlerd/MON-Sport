import { useState } from 'react';
import { useSession } from '../../app/session.tsx';
import { LoginSheet } from './LoginSheet.tsx';

export function ToiScreen() {
  const { user, logout } = useSession();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!user) {
    return (
      <div style={{ padding: 'var(--space-base)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-md)' }}>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-on-primary)',
            font: 'var(--font-body-strong)',
            borderRadius: 'var(--radius-sm)',
            padding: '12px var(--space-base)',
            height: '44px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Đăng nhập
        </button>
        <LoginSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--space-base)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <p style={{ font: 'var(--font-body-strong)', margin: 0 }}>{user.name}</p>
      <button
        type="button"
        onClick={() => logout()}
        style={{
          backgroundColor: 'var(--color-canvas)',
          color: 'var(--color-ink)',
          font: 'var(--font-body-strong)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px var(--space-base)',
          height: '44px',
          border: '1px solid var(--color-line)',
          cursor: 'pointer',
          width: 'fit-content',
        }}
      >
        Đăng xuất
      </button>
    </div>
  );
}
