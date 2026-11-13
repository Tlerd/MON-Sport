export function GoogleButton() {
  return (
    <div className="oauth-providers">
      <div className="divider">
        <span>hoặc</span>
      </div>
      <a href="/api/auth/google/start" className="btn ghost wide google-btn">
        Tiếp tục với Google
      </a>
    </div>
  );
}
