import type { SessionUser } from '@monsport/shared';
import { useState } from 'react';
import { LoginForm } from './LoginForm.tsx';
import { RegisterForm } from './RegisterForm.tsx';

/** UC-1: one panel for both flows. Login (1.1) comes first, because most visits are return visits. */
export function AuthPanel({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  return (
    <section className="panel">
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
