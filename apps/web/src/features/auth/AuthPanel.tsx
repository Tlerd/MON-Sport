import type { SessionUser } from '@monsport/shared';
import { useEffect, useRef, useState } from 'react';
import { AuthCard } from './AuthCard.tsx';
import { LoginForm } from './LoginForm.tsx';
import { RegisterForm } from './RegisterForm.tsx';

export function AuthPanel({
  onLogin,
  initialError,
}: {
  onLogin: (user: SessionUser) => void;
  initialError?: string;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const panel = useRef<HTMLElement>(null);
  const shown = useRef(mode);

  useEffect(() => {
    if (shown.current !== mode) panel.current?.querySelector('h2')?.focus();
    shown.current = mode;
  }, [mode]);

  return (
    <AuthCard cardRef={panel}>
      <div className="seg auth-seg" role="tablist" aria-label="Chế độ tài khoản">
        <button
          type="button"
          role={mode === 'login' ? 'tab' : undefined}
          aria-selected={mode === 'login' ? true : undefined}
          className={mode === 'login' ? 'on' : ''}
          onClick={() => setMode('login')}
        >
          Đăng nhập
        </button>
        <button
          type="button"
          role={mode === 'register' ? 'tab' : undefined}
          aria-selected={mode === 'register' ? true : undefined}
          className={mode === 'register' ? 'on' : ''}
          onClick={() => setMode('register')}
        >
          Tạo tài khoản
        </button>
      </div>
      {mode === 'login' ? (
        <LoginForm onLogin={onLogin} initialError={initialError} />
      ) : (
        <RegisterForm onLogin={onLogin} />
      )}
    </AuthCard>
  );
}
