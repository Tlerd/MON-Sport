import { GOOGLE_SESSION_EXPIRED } from './googleErrors.ts';

export function GoogleSessionExpired() {
  return (
    <div className="stack">
      <p>{GOOGLE_SESSION_EXPIRED}</p>
      <a href="/api/auth/google/start" className="btn ghost wide google-btn">
        Tiếp tục với Google
      </a>
    </div>
  );
}
