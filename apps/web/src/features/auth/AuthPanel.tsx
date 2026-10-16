import type { SessionUser } from '@monsport/shared';
import { useEffect, useRef, useState } from 'react';
import { LoginForm } from './LoginForm.tsx';
import { RegisterForm } from './RegisterForm.tsx';

/** UC-1: one panel for both flows. Login (1.1) comes first, because most visits are return visits. */
export function AuthPanel({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const panel = useRef<HTMLElement>(null);
  const shown = useRef(mode);

  // After a switch, focus moves to the new heading, so a screen reader reads which form is open.
  // Comparing with the mode shown before keeps the first render (and a StrictMode re-run) from taking focus.
  useEffect(() => {
    if (shown.current !== mode) panel.current?.querySelector('h2')?.focus();
    shown.current = mode;
  }, [mode]);

  return (
    <section className="panel" ref={panel}>
      {mode === 'login' ? <LoginForm onLogin={onLogin} /> : <RegisterForm onLogin={onLogin} />}
      <p className="switch">
        {mode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
        <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Tạo tài khoản' : 'Đăng nhập'}
        </button>
      </p>
    </section>
  );
}
